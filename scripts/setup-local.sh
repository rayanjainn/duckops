#!/bin/bash
# DuckOps — Full Local Setup
# Run once after a fresh clone or after teardown-local.sh

set -e

echo "DuckOps — Local Setup"
echo "====================="

# ─── 1. Prerequisites ────────────────────────────────────────────────────────
echo "→ Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker not found. Install Docker Desktop."; exit 1; }
command -v pnpm   >/dev/null 2>&1 || { echo "ERROR: pnpm not found. Run: npm install -g pnpm"; exit 1; }
command -v k3d    >/dev/null 2>&1 || { echo "WARN:  k3d not found. Kubernetes features will be unavailable."; }
command -v kubectl>/dev/null 2>&1 || { echo "WARN:  kubectl not found."; }
command -v terraform>/dev/null 2>&1 || { echo "WARN:  terraform not found."; }
command -v ansible>/dev/null 2>&1  || { echo "WARN:  ansible not found."; }

# Make sure Docker daemon is actually running
docker info >/dev/null 2>&1 || { echo "ERROR: Docker daemon is not running. Start Docker Desktop first."; exit 1; }

# ─── 2. Env file ─────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "→ Creating .env from .env.example..."
  cp .env.example .env
  echo "   NOTE: Edit .env and fill in GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JWT_SECRET."
fi

# ─── 3. pnpm install ─────────────────────────────────────────────────────────
echo "→ Installing dependencies..."
pnpm install

# ─── 4. k3d network (must exist BEFORE docker compose, because compose references it as external) ───
echo "→ Ensuring k3d-duckops Docker network exists..."
docker network create k3d-duckops 2>/dev/null || echo "   (network already exists — ok)"

# ─── 5. k3d cluster ──────────────────────────────────────────────────────────
if command -v k3d >/dev/null 2>&1; then
  if ! k3d cluster list 2>/dev/null | grep -q "duckops"; then
    echo "→ Creating k3d registry..."
    k3d registry create duckops-registry --port 5111 2>/dev/null || true

    echo "→ Creating k3d cluster (this takes ~60s)..."
    k3d cluster create duckops \
      --port "8080:80@loadbalancer" \
      --port "8443:443@loadbalancer" \
      --port "30000-30100:30000-30100@server:0" \
      --agents 2 \
      --network k3d-duckops \
      --registry-use k3d-duckops-registry:5111
  else
    echo "→ k3d cluster 'duckops' already exists"
    # Make sure the cluster is started
    k3d cluster start duckops 2>/dev/null || true
  fi
fi

# ─── 6. Start data layer first ───────────────────────────────────────────────
echo "→ Starting PostgreSQL and Redis..."
docker compose up postgres redis -d

# ─── 7. Wait for Postgres to be healthy ──────────────────────────────────────
echo "→ Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if docker exec duckops-postgres pg_isready -U duckops >/dev/null 2>&1; then
    echo "   PostgreSQL is ready."
    break
  fi
  echo "   ... attempt $i/30"
  sleep 2
done

# ─── 8. Migrate and seed database ────────────────────────────────────────────
echo "→ Running DB migrations..."
(cd packages/db && pnpm prisma migrate deploy 2>/dev/null || pnpm prisma migrate dev --name init)
(cd packages/db && pnpm prisma generate)

echo "→ Seeding database..."
(cd packages/db && pnpm prisma db seed) || echo "   WARN: seed failed (may already be seeded)"

# ─── 9. Start Jenkins ────────────────────────────────────────────────────────
echo "→ Building and starting Jenkins..."
docker compose up jenkins -d --build

echo "→ Waiting for Jenkins to start (up to 90s)..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8085/login 2>/dev/null | grep -qE "^(200|403)"; then
    echo "   Jenkins is up."
    break
  fi
  echo "   ... attempt $i/30"
  sleep 3
done

echo ""
echo "─────────────────────────────────────────────────────────────"
echo "IMPORTANT: Jenkins first-run setup"
echo "─────────────────────────────────────────────────────────────"
echo "1. Get the initial admin password:"
echo "   docker exec duckops-jenkins cat /var/jenkins_home/secrets/initialAdminPassword"
echo ""
echo "2. Open http://localhost:8085 and complete setup wizard."
echo "   Install 'suggested plugins', create admin user (or skip)."
echo ""
echo "3. Create an API token:"
echo "   Jenkins → [admin user] → Configure → API Token → Add new Token → copy it"
echo ""
echo "4. Set the token in .env:"
echo "   JENKINS_TOKEN=<paste token here>"
echo ""
echo "5. Then run: docker compose up -d"
echo "─────────────────────────────────────────────────────────────"

# ─── 10. Start remaining services ────────────────────────────────────────────
echo ""
read -p "Has Jenkins been configured and JENKINS_TOKEN set in .env? [y/N] " jenkinsDone
if [ "$jenkinsDone" = "y" ] || [ "$jenkinsDone" = "Y" ]; then
  echo "→ Starting all remaining services..."
  docker compose up -d --build

  # Copy kubeconfig into Jenkins so it can run kubectl
  if command -v k3d >/dev/null 2>&1; then
    echo "→ Copying kubeconfig into Jenkins container..."
    docker exec duckops-jenkins mkdir -p /root/.kube 2>/dev/null || true
    k3d kubeconfig get duckops > /tmp/duckops-kubeconfig 2>/dev/null && \
      docker cp /tmp/duckops-kubeconfig duckops-jenkins:/root/.kube/config && \
      rm -f /tmp/duckops-kubeconfig && \
      echo "   kubeconfig copied." || echo "   WARN: kubeconfig copy failed — Jenkins kubectl may not work"
  fi
else
  echo ""
  echo "Re-run after Jenkins is configured:"
  echo "  docker compose up -d"
fi

echo ""
echo "Setup complete!"
echo ""
echo "  Frontend:    http://localhost:3000"
echo "  API Gateway: http://localhost:4000"
echo "  Jenkins:     http://localhost:8085"
echo "  Prisma:      cd packages/db && pnpm prisma studio"
echo ""
echo "Dev mode (hot reload): pnpm turbo dev"
