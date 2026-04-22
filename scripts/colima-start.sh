#!/bin/bash
# DuckOps — Start Colima with enough resources for parallel Docker builds
# Run this ONCE before setup-local.sh (or any time after a reboot).
#
# What this does:
#   1. Starts (or creates) a Colima VM with enough CPU/RAM/disk
#   2. Installs docker-buildx if missing (required for --mount=type=cache)
#   3. Creates the 'duckops-builder' buildx builder (docker-container driver)
#      which is the only driver that supports BuildKit cache mounts
#   4. Sets it as the active builder

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
err()  { echo -e "  ${RED}✗${RESET}  $*" >&2; }

PROFILE="${COLIMA_PROFILE:-duckops}"
CPU="${COLIMA_CPU:-6}"
MEMORY="${COLIMA_MEMORY:-10}"   # GiB
DISK="${COLIMA_DISK:-40}"       # GiB
BUILDER_NAME="duckops-builder"

echo ""
echo -e "${BOLD}🦆 DuckOps — Colima + BuildKit Setup${RESET}"
echo "  Profile  : $PROFILE"
echo "  CPU      : $CPU"
echo "  Memory   : ${MEMORY} GiB"
echo "  Disk     : ${DISK} GiB"
echo ""

# ─── 1. Prerequisites ─────────────────────────────────────────────────────────
command -v colima >/dev/null 2>&1 || {
  err "colima not found. Install with: brew install colima"
  exit 1
}

# ─── 2. Start Colima VM ───────────────────────────────────────────────────────
if colima status "$PROFILE" 2>/dev/null | grep -q "Running"; then
  ok "Colima profile '$PROFILE' is already running"
elif colima list 2>/dev/null | grep -q "^$PROFILE "; then
  echo "  → Starting existing Colima profile '$PROFILE'..."
  colima start "$PROFILE"
  ok "Colima started"
else
  echo "  → Creating Colima profile '$PROFILE' (first run, ~60s)..."
  colima start "$PROFILE" \
    --cpu "$CPU" \
    --memory "$MEMORY" \
    --disk "$DISK" \
    --vm-type vz \
    --vz-rosetta \
    --network-address \
    --activate
  ok "Colima profile '$PROFILE' created and started"
fi

# ─── 3. Install docker-buildx plugin if missing ───────────────────────────────
# docker-buildx is a SEPARATE brew formula from 'docker'.
# Without it, 'docker compose build' uses the legacy builder and
# --mount=type=cache silently fails with "requires BuildKit".
echo ""
echo "  → Checking docker-buildx..."

BUILDX_OK=false
if docker buildx version >/dev/null 2>&1; then
  ok "docker-buildx already installed ($(docker buildx version 2>&1 | head -1))"
  BUILDX_OK=true
else
  if command -v brew >/dev/null 2>&1; then
    echo "  → Installing docker-buildx via brew..."
    brew install docker-buildx
    # Link into CLI plugins dir so Docker finds it
    mkdir -p ~/.docker/cli-plugins
    ln -sfv "$(brew --prefix docker-buildx)/bin/docker-buildx" ~/.docker/cli-plugins/docker-buildx
    if docker buildx version >/dev/null 2>&1; then
      ok "docker-buildx installed and linked ($(docker buildx version 2>&1 | head -1))"
      BUILDX_OK=true
    else
      err "docker-buildx installed but 'docker buildx version' still fails — check \$PATH"
    fi
  else
    warn "brew not found — install docker-buildx manually:"
    warn "  Download from https://github.com/docker/buildx/releases"
    warn "  Copy to ~/.docker/cli-plugins/docker-buildx and chmod +x"
  fi
fi

# Ensure the symlink exists even if buildx was already installed via brew
if $BUILDX_OK; then
  mkdir -p ~/.docker/cli-plugins
  BREW_BUILDX="$(brew --prefix docker-buildx 2>/dev/null)/bin/docker-buildx"
  if [ -f "$BREW_BUILDX" ] && [ ! -L ~/.docker/cli-plugins/docker-buildx ]; then
    ln -sfv "$BREW_BUILDX" ~/.docker/cli-plugins/docker-buildx
    ok "docker-buildx symlinked to ~/.docker/cli-plugins/"
  fi
fi

# ─── 4. Create the duckops-builder (docker-container driver) ──────────────────
# The 'docker' driver (default) does NOT support --mount=type=cache.
# Only the 'docker-container' driver does.
echo ""
echo "  → Configuring buildx builder '$BUILDER_NAME'..."

if ! $BUILDX_OK; then
  warn "Skipping builder setup — docker-buildx not available"
else
  EXISTING=$(docker buildx ls 2>/dev/null | grep "^${BUILDER_NAME}" || true)

  if [ -n "$EXISTING" ]; then
    # Builder exists — check it's healthy
    STATUS=$(docker buildx inspect "$BUILDER_NAME" 2>/dev/null | grep "Status:" | awk '{print $2}' || true)
    if [ "$STATUS" = "running" ]; then
      ok "Builder '$BUILDER_NAME' already exists and is running"
    else
      warn "Builder '$BUILDER_NAME' exists but status is '$STATUS' — recreating..."
      docker buildx rm "$BUILDER_NAME" 2>/dev/null || true
      docker buildx create \
        --name "$BUILDER_NAME" \
        --driver docker-container \
        --driver-opt network=host \
        --bootstrap \
        --use 2>&1 | grep -v "^$" || true
      ok "Builder '$BUILDER_NAME' recreated"
    fi
  else
    echo "  → Creating buildx builder '$BUILDER_NAME' (docker-container driver)..."
    docker buildx create \
      --name "$BUILDER_NAME" \
      --driver docker-container \
      --driver-opt network=host \
      --bootstrap \
      --use 2>&1 | tail -1
    ok "Builder '$BUILDER_NAME' created"
  fi

  # Always set it as the active builder
  docker buildx use "$BUILDER_NAME" 2>/dev/null
  ok "Builder '$BUILDER_NAME' set as active"

  BUILDKIT_VER=$(docker buildx inspect "$BUILDER_NAME" 2>/dev/null | grep "BuildKit:" | awk '{print $2}' || echo "unknown")
  ok "BuildKit version: $BUILDKIT_VER"
fi

# ─── 5. daemon.json — parallel downloads/uploads ──────────────────────────────
echo ""
echo "  → Configuring Docker daemon..."
mkdir -p ~/.docker
DAEMON_JSON="$HOME/.docker/daemon.json"
if [ -f "$DAEMON_JSON" ]; then
  python3 - <<'PYEOF'
import json, os
path = os.path.expanduser("~/.docker/daemon.json")
with open(path) as f:
    d = json.load(f)
d.setdefault("features", {})["buildkit"] = True
d["max-concurrent-downloads"] = 8
d["max-concurrent-uploads"] = 8
with open(path, "w") as f:
    json.dump(d, f, indent=2)
PYEOF
  ok "daemon.json updated (buildkit=true, concurrent dl/ul=8)"
else
  cat > "$DAEMON_JSON" <<'JSON'
{
  "features": { "buildkit": true },
  "max-concurrent-downloads": 8,
  "max-concurrent-uploads": 8
}
JSON
  ok "daemon.json created"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}✓ Ready for DuckOps!${RESET}"
echo ""
echo "  Colima        : running ($PROFILE, ${CPU} CPU, ${MEMORY}GiB RAM)"
if $BUILDX_OK; then
  echo "  docker buildx : $(docker buildx version 2>&1 | head -1)"
  echo "  Active builder: $BUILDER_NAME (docker-container, cache mounts enabled)"
fi
echo ""
echo "  Verify:  docker buildx ls"
echo "  Next:    scripts/setup-local.sh"
echo ""
