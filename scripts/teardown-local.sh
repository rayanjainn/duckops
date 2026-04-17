#!/bin/bash
# DuckOps — Full Local Teardown
# Destroys everything: containers, volumes, images, networks, k3d cluster,
# Terraform state, BuildKit cache, pnpm store, build artifacts, temp files.
#
# Run setup-local.sh (and colima-start.sh if using Colima) to start fresh.

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
skip() { echo -e "  ${YELLOW}–${RESET}  $* (skipped)"; }
step() { echo -e "\n${BOLD}──── $* ────${RESET}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# ─── Parse flags ──────────────────────────────────────────────────────────────
NUKE_DEPS=false       # also wipe node_modules + pnpm store
NUKE_COLIMA=false     # also stop Colima VM entirely
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --deps)   NUKE_DEPS=true ;;
    --colima) NUKE_COLIMA=true ;;
    --force)  FORCE=true ;;
    --all)    NUKE_DEPS=true; NUKE_COLIMA=true ;;
    --help|-h)
      echo "Usage: $0 [--deps] [--colima] [--all] [--force]"
      echo ""
      echo "  (no flags)   Destroy containers, volumes, images, k3d, networks,"
      echo "               Terraform state, BuildKit cache, build artifacts, temp files"
      echo "  --deps       Also wipe node_modules and pnpm store cache"
      echo "  --colima     Also stop the Colima VM after teardown"
      echo "  --all        All of the above"
      echo "  --force      Skip confirmation prompt"
      exit 0
      ;;
  esac
done

# ─── Confirmation ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${RED}🦆 DuckOps — Full Teardown${RESET}"
echo ""
echo "  This will destroy:"
echo "    • All DuckOps Docker containers, volumes, and images"
echo "    • The k3d cluster, registry, and all namespaces inside it"
echo "    • The k3d-duckops Docker network"
echo "    • Docker BuildKit builder cache"
echo "    • Terraform state and workspace files"
echo "    • Ansible temp files"
echo "    • Build artifacts (dist/, prisma generated client)"
echo "    • Temp scaffolded project files (/tmp/duckops-projects)"
if $NUKE_DEPS; then
  echo "    • node_modules in all packages (--deps)"
  echo "    • pnpm global store cache (--deps)"
fi
if $NUKE_COLIMA; then
  echo "    • Colima VM will be stopped (--colima)"
fi
echo ""

if ! $FORCE; then
  read -rp "  Continue? [y/N] " confirm
  echo ""
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "  Cancelled."; exit 0; }
fi

# ─── 1. Docker Compose — stop services + remove volumes ───────────────────────
step "Docker Compose"
if docker info >/dev/null 2>&1; then
  docker compose down --volumes --remove-orphans --timeout 10 2>/dev/null && ok "Compose services stopped and volumes removed" || warn "Compose down returned non-zero (may already be stopped)"
else
  skip "Docker daemon not running"
fi

# ─── 2. Remove named containers by name (in case Compose missed any) ──────────
step "Stale containers"
CONTAINERS=(
  duckops-postgres duckops-redis duckops-jenkins
  duckops-catalog duckops-provisioning duckops-pipeline duckops-health duckops-nginx
)
any_removed=false
for name in "${CONTAINERS[@]}"; do
  if docker rm -f "$name" 2>/dev/null; then
    ok "Removed container: $name"
    any_removed=true
  fi
done
$any_removed || skip "No stale containers found"

# ─── 3. Remove DuckOps Docker images ─────────────────────────────────────────
step "Docker images"
if docker info >/dev/null 2>&1; then
  # Remove images with duckops in their name or tag, plus the builder base
  DUCKOPS_IMAGES=$(docker images --format "{{.Repository}}:{{.Tag}}" 2>/dev/null \
    | grep -E "(duckops|duckops-catalog|duckops-provisioning|duckops-pipeline|duckops-health)" \
    || true)
  if [ -n "$DUCKOPS_IMAGES" ]; then
    echo "$DUCKOPS_IMAGES" | xargs docker rmi -f 2>/dev/null && ok "DuckOps service images removed" || warn "Some images could not be removed"
  else
    skip "No DuckOps service images found"
  fi

  # Remove images in the local k3d registry (localhost:5111/*)
  REGISTRY_IMAGES=$(docker images --format "{{.Repository}}:{{.Tag}}" 2>/dev/null \
    | grep -E "^(localhost:5111|k3d-duckops-registry:5111)/" \
    || true)
  if [ -n "$REGISTRY_IMAGES" ]; then
    echo "$REGISTRY_IMAGES" | xargs docker rmi -f 2>/dev/null && ok "k3d registry images removed" || warn "Some registry images could not be removed"
  else
    skip "No k3d registry images found"
  fi
fi

# ─── 4. Docker volumes ────────────────────────────────────────────────────────
step "Docker volumes"
if docker info >/dev/null 2>&1; then
  # Remove named DuckOps volumes explicitly first
  for vol in duckops_pgdata duckops_redisdata duckops_jenkinsdata; do
    docker volume rm "$vol" 2>/dev/null && ok "Removed volume: $vol" || true
  done
  # Prune any remaining anonymous/dangling volumes
  docker volume prune -f 2>/dev/null && ok "Dangling volumes pruned" || true
fi

# ─── 5. Full Docker system prune ─────────────────────────────────────────────
step "Docker system prune (images, build cache, volumes)"
if docker info >/dev/null 2>&1; then
  # Show before size so the user can see how much was freed
  BEFORE=$(docker system df --format "{{.Size}}" 2>/dev/null | paste -sd '+' | bc 2>/dev/null || echo "?")

  # Remove all stopped containers, unused networks, dangling images
  docker container prune --force 2>/dev/null && ok "Stopped containers pruned" || true
  docker image prune --all --force 2>/dev/null \
    && ok "All unused images removed (including pulled base images)" \
    || warn "Image prune failed"

  # BuildKit cache mounts (pnpm store, npm cache, etc.) — biggest single bucket
  docker builder prune --filter type=exec.cachemount --force 2>/dev/null \
    && ok "BuildKit cache mounts removed" \
    || warn "BuildKit cache prune failed (may not exist)"

  # Full builder layer cache
  docker builder prune --all --force 2>/dev/null \
    && ok "BuildKit layer cache removed" \
    || warn "Full builder prune failed"

  ok "Docker system clean"
fi

# ─── 6. k3d cluster, registry, and all namespaces ────────────────────────────
step "k3d cluster + registry"
if command -v k3d >/dev/null 2>&1; then
  if k3d cluster list 2>/dev/null | grep -q "duckops"; then
    k3d cluster delete duckops 2>/dev/null && ok "k3d cluster 'duckops' deleted" || warn "k3d cluster delete failed"
  else
    skip "k3d cluster 'duckops' not found"
  fi

  if k3d registry list 2>/dev/null | grep -q "duckops-registry"; then
    k3d registry delete duckops-registry 2>/dev/null && ok "k3d registry deleted" || warn "k3d registry delete failed"
  else
    skip "k3d registry not found"
  fi
else
  skip "k3d not installed"
fi

# ─── 7. k3d-duckops Docker network ───────────────────────────────────────────
step "Docker network"
if docker info >/dev/null 2>&1; then
  if docker network inspect k3d-duckops >/dev/null 2>&1; then
    docker network rm k3d-duckops 2>/dev/null && ok "k3d-duckops network removed" || warn "Network in use — will be removed once k3d containers stop"
  else
    skip "k3d-duckops network not found"
  fi
  # Prune all unused networks
  docker network prune -f 2>/dev/null && ok "Unused networks pruned" || true
fi

# ─── 8. Terraform state and workspace files ───────────────────────────────────
step "Terraform state"
TF_DIR="$ROOT/infra/terraform/environments/local"
if [ -d "$TF_DIR" ]; then
  # Workspace state dirs
  if [ -d "$TF_DIR/terraform.tfstate.d" ]; then
    rm -rf "$TF_DIR/terraform.tfstate.d"
    ok "Terraform workspace state removed"
  else
    skip "No Terraform workspace state found"
  fi
  # Root state files
  for f in terraform.tfstate terraform.tfstate.backup tfplan-* .terraform.lock.hcl; do
    find "$TF_DIR" -maxdepth 1 -name "$f" -exec rm -f {} \; 2>/dev/null || true
  done
  # .terraform provider cache (re-downloaded on next init)
  if [ -d "$TF_DIR/.terraform" ]; then
    rm -rf "$TF_DIR/.terraform"
    ok "Terraform provider cache (.terraform/) removed"
  fi
  ok "Terraform state cleared"
else
  skip "Terraform directory not found ($TF_DIR)"
fi

# ─── 9. Ansible temp files ────────────────────────────────────────────────────
step "Ansible temp files"
# ansibleService writes temp vars files to /tmp/duckops-ansible-*
find /tmp -maxdepth 1 -name "duckops-ansible-*.json" -exec rm -f {} \; 2>/dev/null && ok "Ansible temp vars files removed" || true

# ─── 10. Git askpass temp scripts ─────────────────────────────────────────────
step "Git credential temp files"
find /tmp -maxdepth 2 -name ".git-askpass.sh" -exec rm -f {} \; 2>/dev/null && ok "Git askpass scripts removed" || true

# ─── 11. Scaffolded temp project files ───────────────────────────────────────
step "Scaffolded project files"
if [ -d "/tmp/duckops-projects" ]; then
  rm -rf /tmp/duckops-projects
  ok "/tmp/duckops-projects removed"
else
  skip "/tmp/duckops-projects not found"
fi

# ─── 12. Build artifacts (dist/, prisma generated) ───────────────────────────
step "Build artifacts"
# Remove compiled JS dist/ dirs from all apps and packages
REMOVED=0
while IFS= read -r d; do
  rm -rf "$d"
  REMOVED=$((REMOVED + 1))
done < <(find "$ROOT/apps" "$ROOT/packages" -maxdepth 3 -type d -name "dist" 2>/dev/null || true)
[ "$REMOVED" -gt 0 ] && ok "Removed $REMOVED dist/ directories" || skip "No dist/ directories found"

# Remove Prisma generated client
if [ -d "$ROOT/packages/db/node_modules/.prisma" ]; then
  rm -rf "$ROOT/packages/db/node_modules/.prisma"
  ok "Prisma generated client removed"
fi
if [ -d "$ROOT/packages/db/node_modules/@prisma/client" ]; then
  rm -rf "$ROOT/packages/db/node_modules/@prisma/client"
  ok "Prisma client package removed"
fi

# ─── 13. node_modules + pnpm store (--deps flag) ─────────────────────────────
if $NUKE_DEPS; then
  step "node_modules and pnpm store (--deps)"

  # Remove all node_modules in the monorepo
  NM_REMOVED=0
  while IFS= read -r d; do
    rm -rf "$d"
    NM_REMOVED=$((NM_REMOVED + 1))
  done < <(find "$ROOT" -maxdepth 4 -type d -name "node_modules" \
    ! -path "*/node_modules/*/node_modules" 2>/dev/null || true)
  [ "$NM_REMOVED" -gt 0 ] && ok "Removed $NM_REMOVED node_modules directories" || skip "No node_modules found"

  # Clear pnpm global store cache
  if command -v pnpm >/dev/null 2>&1; then
    PNPM_STORE=$(pnpm store path 2>/dev/null || echo "")
    if [ -n "$PNPM_STORE" ] && [ -d "$PNPM_STORE" ]; then
      pnpm store prune 2>/dev/null && ok "pnpm store pruned (unreferenced packages removed)" || warn "pnpm store prune failed"
    else
      skip "pnpm store not found"
    fi
  else
    skip "pnpm not installed"
  fi

  # Clear Turborepo build cache
  if [ -d "$ROOT/.turbo" ]; then
    rm -rf "$ROOT/.turbo"
    ok "Turborepo cache (.turbo/) removed"
  fi
  if [ -d "$ROOT/node_modules/.cache/turbo" ]; then
    rm -rf "$ROOT/node_modules/.cache/turbo"
    ok "Turborepo node cache removed"
  fi
fi

# ─── 14. Colima VM (--colima flag) ────────────────────────────────────────────
if $NUKE_COLIMA; then
  step "Colima VM (--colima)"
  if command -v colima >/dev/null 2>&1; then
    PROFILE="${COLIMA_PROFILE:-duckops}"
    if colima status "$PROFILE" 2>/dev/null | grep -q "Running"; then
      colima stop "$PROFILE" 2>/dev/null && ok "Colima profile '$PROFILE' stopped" || warn "Colima stop failed"
    else
      skip "Colima profile '$PROFILE' is not running"
    fi
  else
    skip "colima not installed"
  fi
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}✓ Teardown complete.${RESET}"
echo ""
echo "  What was cleared:"
echo "    • Docker containers, volumes, images (including pulled base images)"
echo "    • BuildKit layer + cache-mount cache"
echo "    • k3d cluster, registry, and all project namespaces"
echo "    • k3d-duckops Docker network"
echo "    • Terraform state + workspace files"
echo "    • Ansible temp files"
echo "    • Scaffolded project files (/tmp/duckops-projects)"
echo "    • Build artifacts (dist/, prisma client)"
if $NUKE_DEPS; then
  echo "    • node_modules + pnpm store (--deps)"
fi
if $NUKE_COLIMA; then
  echo "    • Colima VM stopped (--colima)"
fi
echo ""

# Show remaining Docker disk usage so the user knows what's left
if docker info >/dev/null 2>&1; then
  echo "  Remaining Docker disk usage:"
  docker system df 2>/dev/null | sed 's/^/    /' || true
  echo ""
fi

if command -v colima >/dev/null 2>&1 && ! $NUKE_COLIMA; then
  PROFILE="${COLIMA_PROFILE:-duckops}"
  if colima status "$PROFILE" 2>/dev/null | grep -q "Running"; then
    echo -e "  ${YELLOW}Note:${RESET} Colima VM is still running. The VM disk is fixed at 80GB."
    echo "  Stopping Colima does NOT shrink that disk — only deleting the VM does."
    echo "  To stop Colima: scripts/teardown-local.sh --colima"
    echo "  To delete Colima VM entirely: colima delete $PROFILE  (reclaims all disk)"
    echo ""
  fi
fi

echo "  To start fresh:"
if command -v colima >/dev/null 2>&1 && ! $NUKE_COLIMA; then
  echo "    scripts/colima-start.sh   # if Colima stopped after a reboot"
fi
echo "    scripts/setup-local.sh"
echo ""
