#!/bin/bash
# DuckOps — Full Local Setup
# Idempotent: safe to re-run at any time.
# Run scripts/colima-start.sh first if you're using Colima.

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

ok()   { echo -e "${GREEN}✓${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
err()  { echo -e "${RED}✗${RESET}  $*" >&2; }
step() { echo -e "\n${BOLD}──── $* ────${RESET}"; }

# ─── Resolve repo root (works whether called from root or scripts/) ────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

echo ""
echo -e "${BOLD}🦆 DuckOps — Local Setup${RESET}"
echo "   Working directory: $ROOT"
echo ""

# ─── 1. Prerequisites ─────────────────────────────────────────────────────────
step "Checking prerequisites"

MISSING_HARD=0
MISSING_SOFT=0

require_hard() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "$1 not found. $2"
    MISSING_HARD=1
  else
    ok "$1"
  fi
}

require_soft() {
  if ! command -v "$1" >/dev/null 2>&1; then
    warn "$1 not found — $2 (non-fatal)"
    MISSING_SOFT=1
  else
    ok "$1"
  fi
}

require_hard docker  "Install Docker / Colima: brew install colima"
require_hard pnpm    "Run: npm install -g pnpm"
require_soft k3d     "Kubernetes features unavailable. Install: brew install k3d"
require_soft kubectl "Install: brew install kubectl"
require_soft terraform "Install: brew install terraform"
require_soft ansible   "Install: brew install ansible"

[ "$MISSING_HARD" -eq 1 ] && { err "Hard prerequisites missing — aborting."; exit 1; }

# Verify Docker daemon is up
if ! docker info >/dev/null 2>&1; then
  err "Docker daemon is not running."
  echo "  • If using Colima: run  scripts/colima-start.sh"
  echo "  • If using Docker Desktop: start it from the menu bar"
  exit 1
fi
ok "Docker daemon is running"

# Enable BuildKit for faster builds with layer caching
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export BUILDKIT_PROGRESS=plain

# Verify docker-buildx is installed — it's a separate brew package.
# Without it, --mount=type=cache silently fails with "requires BuildKit".
if ! docker buildx version >/dev/null 2>&1; then
  warn "docker-buildx not found — cache mounts won't work."
  warn "Run scripts/colima-start.sh to install it automatically."
  warn "Or manually: brew install docker-buildx && mkdir -p ~/.docker/cli-plugins && ln -sf \$(brew --prefix docker-buildx)/bin/docker-buildx ~/.docker/cli-plugins/docker-buildx"
fi

# Use the duckops-builder (docker-container driver) if it exists.
# The default 'docker' driver does not support --mount=type=cache.
BUILDER_NAME="duckops-builder"
if docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
  docker buildx use "$BUILDER_NAME" 2>/dev/null
  ok "BuildKit enabled (builder: $BUILDER_NAME)"
elif docker buildx version >/dev/null 2>&1; then
  warn "Builder '$BUILDER_NAME' not found — creating it now..."
  docker buildx create \
    --name "$BUILDER_NAME" \
    --driver docker-container \
    --driver-opt network=host \
    --bootstrap \
    --use 2>/dev/null || true
  ok "BuildKit enabled (builder: $BUILDER_NAME, just created)"
else
  ok "BuildKit enabled (legacy builder — cache mounts may not work)"
fi

# ─── 2. Env file ──────────────────────────────────────────────────────────────
step "Environment file"

if [ ! -f "$ROOT/.env" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  warn ".env created from .env.example — fill in GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JWT_SECRET"
else
  ok ".env exists"
fi

# Backfill any env vars added after initial setup
# Update or add an env var in .env
update_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ROOT/.env"; then
    # Portable sed for Mac and Linux
    sed -i.bak "/^${key}=/s|=.*|=${val}|" "$ROOT/.env" && rm -f "$ROOT/.env.bak"
  else
    echo "${key}=${val}" >> "$ROOT/.env"
  fi
}

# Add env var only if missing
backfill_env() {
  local key="$1" val="$2"
  if ! grep -q "^${key}=" "$ROOT/.env" 2>/dev/null; then
    echo "${key}=${val}" >> "$ROOT/.env"
    warn "Added missing ${key} to .env"
  fi
}

backfill_env "NEXT_PUBLIC_PIPELINE_URL"  "http://localhost:4003"
backfill_env "NEXT_PUBLIC_HEALTH_URL"    "http://localhost:4004"
backfill_env "NEXT_PUBLIC_CATALOG_URL"   "http://localhost:4001"
backfill_env "NEXT_PUBLIC_SOCKET_URL"    "http://localhost:4002"
backfill_env "PIPELINE_SERVICE_URL"      "http://localhost:4003"
backfill_env "JWT_SECRET"                "change_me_$(openssl rand -hex 16)"

# Warn if critical vars are still placeholder values
for var in GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET; do
  val=$(grep "^${var}=" "$ROOT/.env" | cut -d= -f2-)
  if [ -z "$val" ] || [[ "$val" == *"your_"* ]] || [[ "$val" == *"change_me"* ]]; then
    warn "${var} is not set — GitHub OAuth and repo creation will fail"
  fi
done

# ─── 3. pnpm install ──────────────────────────────────────────────────────────
step "Installing Node dependencies"
pnpm install --frozen-lockfile
ok "Dependencies installed"

# ─── 4. k3d Docker network ────────────────────────────────────────────────────
step "Docker network"
if ! docker network inspect k3d-duckops >/dev/null 2>&1; then
  docker network create k3d-duckops
  ok "Created k3d-duckops network"
else
  ok "k3d-duckops network exists"
fi

# ─── 5. k3d cluster ───────────────────────────────────────────────────────────
if command -v k3d >/dev/null 2>&1; then
  step "k3d Kubernetes cluster"

  if k3d cluster list 2>/dev/null | grep -q "duckops"; then
    ok "k3d cluster 'duckops' exists"
    # Start it if stopped
    k3d cluster start duckops 2>/dev/null || true
  else
    # Create registry first
    if ! k3d registry list 2>/dev/null | grep -q "duckops-registry"; then
      echo "  → Creating k3d registry..."
      k3d registry create duckops-registry --port 5111
      ok "Registry created (localhost:5111)"
    else
      ok "k3d registry exists"
    fi

    # Ghost cluster check: if list didn't see it but a previous attempt failed, 
    # 'k3d cluster create' might still throw a "FATA: already exists" error.
    if ! k3d cluster list 2>/dev/null | grep -q "duckops"; then
      k3d cluster delete duckops >/dev/null 2>&1 || true
    fi

    echo "  → Creating k3d cluster (this takes ~60s)..."
    k3d cluster create duckops \
      --port "8080:80@loadbalancer" \
      --port "8443:443@loadbalancer" \
      --port "30000-30100:30000-30100@server:0" \
      --agents 2 \
      --network k3d-duckops \
      --registry-use k3d-duckops-registry:5111
    ok "k3d cluster created"
  fi
fi

# ─── 6. Data layer ────────────────────────────────────────────────────────────
step "Starting PostgreSQL and Redis"
docker compose up postgres redis -d --wait
ok "PostgreSQL and Redis are healthy"

# ─── 7. Migrate and seed database ─────────────────────────────────────────────
step "Database migrations and seed"

# Load .env into current shell so Prisma can see DATABASE_URL
set -a; source "$ROOT/.env"; set +a

(
  cd "$ROOT/packages/db"
  # migrate deploy is idempotent; fall back to migrate dev only on a fresh DB
  if pnpm prisma migrate deploy 2>/dev/null; then
    ok "Migrations applied (deploy)"
  else
    warn "migrate deploy failed — running migrate dev (first-time setup)"
    pnpm prisma migrate dev --name init
    ok "Migrations applied (dev)"
  fi
  pnpm prisma generate
)

if (cd "$ROOT/packages/db" && pnpm prisma db seed) 2>/dev/null; then
  ok "Database seeded"
else
  warn "Seed skipped (already seeded or no seed data)"
fi

# ─── 8. Build all service images in parallel with BuildKit ────────────────────
step "Building Docker images (parallel with BuildKit)"
echo "  This is fast on second run due to layer caching."
echo ""

# Compose v2 builds services in parallel automatically when BuildKit is active.
# Pass --builder explicitly so the docker-container driver (cache mount support)
# is used even if the active context builder is still set to 'docker'.
BUILDER_NAME="duckops-builder"
BUILD_CMD="docker compose build"
if docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
  BUILD_CMD="docker compose build --builder $BUILDER_NAME"
fi

$BUILD_CMD jenkins catalog-service provisioning-service pipeline-service health-service
ok "All images built"

# ─── 9. Start Jenkins ─────────────────────────────────────────────────────────
step "Starting Jenkins"
docker compose up jenkins -d

echo "  Waiting for Jenkins (up to 120s)..."
# Bash 3.2 (macOS default) can be picky about parentheses in [[ =~ ]]
# Moving the regex to a variable is the most compatible way.
JENKINS_READY_REG="(200|403|302)"
for i in $(seq 1 40); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8085/login 2>/dev/null || true)
  if [[ "$CODE" =~ $JENKINS_READY_REG ]]; then
    ok "Jenkins is up (HTTP $CODE)"
    break
  fi
  printf "  ... attempt %d/40\r" "$i"
  sleep 3
done

step "Automating Jenkins setup"
echo "  → Checking Jenkins status..."

# Try to see if existing token works
JENKINS_USER=${JENKINS_USER:-admin}
JENKINS_TOKEN=${JENKINS_TOKEN:-}
READY=0

if [[ -n "$JENKINS_TOKEN" ]]; then
  if curl -s -f -u "${JENKINS_USER}:${JENKINS_TOKEN}" http://localhost:8085/api/json >/dev/null 2>&1; then
    ok "Jenkins is already configured and token is valid."
    READY=1
  fi
fi

if [ "$READY" -eq 0 ]; then
  echo "  → Provisioning admin user and generating API token..."
  GROOVY_TMP=$(mktemp)
  cat <<EOF > "$GROOVY_TMP"
import jenkins.model.*
import hudson.security.*
import jenkins.security.*
import jenkins.security.apitoken.*
def instance = Jenkins.get()
def hudsonRealm = new HudsonPrivateSecurityRealm(false)
instance.setSecurityRealm(hudsonRealm)
if (User.get('admin', false) == null) {
    hudsonRealm.createAccount('admin', 'admin')
}
def strategy = new FullControlOnceLoggedInAuthorizationStrategy()
strategy.setAllowAnonymousRead(false)
instance.setAuthorizationStrategy(strategy)
instance.save()
def user = User.get('admin')
def prop = user.getProperty(ApiTokenProperty.class)
def token = prop.tokenStore.generateNewToken('duckops-token').plainValue
user.save()
println 'TOKEN:' + token
EOF

  # Try anonymous first (fresh install), then try with existing credentials (retry/update)
  TOKEN_OUTPUT=$(curl -s -X POST http://localhost:8085/scriptText --data-urlencode "script=$(cat "$GROOVY_TMP")" 2>/dev/null || \
                 curl -s -u "${JENKINS_USER}:${JENKINS_TOKEN}" -X POST http://localhost:8085/scriptText --data-urlencode "script=$(cat "$GROOVY_TMP")" 2>/dev/null || \
                 echo "Error")
  rm -f "$GROOVY_TMP"

  if [[ "$TOKEN_OUTPUT" == *"TOKEN:"* ]]; then
    NEW_TOKEN=$(echo "$TOKEN_OUTPUT" | grep 'TOKEN:' | cut -d: -f2 | tr -d '\r\n')
    update_env "JENKINS_USER" "admin"
    update_env "JENKINS_TOKEN" "$NEW_TOKEN"
    ok "Jenkins automated setup complete. Token updated in .env"
  elif [[ "$TOKEN_OUTPUT" == *"Authentication required"* && "$READY" -eq 1 ]]; then
    ok "Jenkins is already locked down (Existing token remains valid)"
  else
    warn "Jenkins automation returned unexpected output (might be already configured)"
  fi
fi

# Reload env to pick up the brand new JENKINS_TOKEN
set -a; source "$ROOT/.env"; set +a

step "Starting remaining services"
docker compose up -d
ok "All services started"

# ─── 10. Copy kubeconfig into Jenkins + health-service ─────────────────────
if command -v k3d >/dev/null 2>&1; then
  step "Wiring kubeconfig into Jenkins and health-service"
  K3D_SERVER_IP=$(docker inspect k3d-duckops-server-0 \
    --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null \
    | head -1 || true)

  if [ -n "$K3D_SERVER_IP" ]; then
    TMPKUBE=$(mktemp)
    k3d kubeconfig get duckops 2>/dev/null \
      | sed "s|https://0.0.0.0:[0-9]*|https://${K3D_SERVER_IP}:6443|g" \
      > "$TMPKUBE"

    docker exec duckops-jenkins mkdir -p /root/.kube 2>/dev/null || true
    if docker cp "$TMPKUBE" duckops-jenkins:/root/.kube/config; then
      ok "kubeconfig copied to Jenkins - server: ${K3D_SERVER_IP}:6443"
    else
      warn "kubeconfig copy to Jenkins failed - run manually later"
    fi

    docker exec duckops-health mkdir -p /root/.kube 2>/dev/null || true
    if docker cp "$TMPKUBE" duckops-health:/root/.kube/config; then
      ok "kubeconfig copied to health-service - server: ${K3D_SERVER_IP}:6443"
    else
      warn "kubeconfig copy to health-service failed - run manually later"
    fi

    rm -f "$TMPKUBE"
  else
    warn "Could not detect k3d server IP - kubeconfig not copied"
    echo "  Run manually: k3d kubeconfig get duckops | sed 's|0.0.0.0:...|<k3d-ip>:6443|' | docker exec -i duckops-jenkins tee /root/.kube/config"
  fi
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}✓ Setup complete!${RESET}"
echo ""
echo "  Frontend Next.js dev   : pnpm turbo dev"
echo "  Frontend URL           : http://localhost:3000"
echo "  API Gateway            : http://localhost:4000"
echo "  Jenkins URL            : http://localhost:8085"
echo "  Deployed apps          : http://localhost:8080"
echo "  Prisma Studio          : cd packages/db && pnpm prisma studio"
echo ""
echo "  Tip: run scripts/colima-start.sh after a reboot to restart Colima."
echo ""
