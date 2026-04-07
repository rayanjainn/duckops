#!/bin/bash
# DuckOps — Start all local services for production use
# Run this on your Mac to serve traffic from Vercel → your machine via ngrok.
#
# What this starts:
#   - Docker: postgres, redis, jenkins (data layer + CI/CD)
#   - k3d cluster (for project deployments)
#   - provisioning-service, pipeline-service, health-service (on host, for ngrok)
#   - ngrok tunnels (exposes above services to internet)
#
# catalog-service and frontend are on Vercel — don't start them here.

set -e

echo "DuckOps — Production Start"
echo "=========================="

# ─── 1. Check Docker ─────────────────────────────────────────────────────────
docker info >/dev/null 2>&1 || { echo "ERROR: Docker not running. Start Docker Desktop first."; exit 1; }

# ─── 2. Ensure k3d network exists ────────────────────────────────────────────
docker network create k3d-duckops 2>/dev/null || true

# ─── 3. Start k3d cluster if not running ─────────────────────────────────────
if command -v k3d >/dev/null 2>&1; then
  if k3d cluster list 2>/dev/null | grep -q "duckops"; then
    echo "→ Starting k3d cluster..."
    k3d cluster start duckops 2>/dev/null || true
  else
    echo "→ k3d cluster not found — run ./scripts/setup-local.sh first"
  fi
fi

# ─── 4. Fix kubeconfig in Jenkins (internal IP) ──────────────────────────────
K3D_IP=$(docker inspect k3d-duckops-server-0 \
  --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null | head -1)
if [ -n "$K3D_IP" ]; then
  k3d kubeconfig get duckops 2>/dev/null \
    | sed "s|https://0.0.0.0:[0-9]*|https://${K3D_IP}:6443|g" \
    > /tmp/duckops-kubeconfig-jenkins 2>/dev/null && \
  docker exec duckops-jenkins mkdir -p /root/.kube 2>/dev/null && \
  docker cp /tmp/duckops-kubeconfig-jenkins duckops-jenkins:/root/.kube/config 2>/dev/null && \
  rm -f /tmp/duckops-kubeconfig-jenkins && \
  echo "→ kubeconfig updated in Jenkins (${K3D_IP}:6443)"
fi

# ─── 5. Start data layer + Jenkins ───────────────────────────────────────────
echo "→ Starting postgres, redis, jenkins..."
docker compose up postgres redis jenkins -d

# ─── 6. Start backend services on host ───────────────────────────────────────
echo "→ Starting backend services..."
echo "   (provisioning :4002, pipeline :4003, health :4004)"
echo "   Logs → /tmp/duckops-provisioning.log etc"

pnpm --filter @duckops/provisioning-service build 2>/dev/null || true
pnpm --filter @duckops/pipeline-service build 2>/dev/null || true
pnpm --filter @duckops/health-service build 2>/dev/null || true

nohup pnpm --filter @duckops/provisioning-service dev > /tmp/duckops-provisioning.log 2>&1 &
echo "   provisioning-service PID: $!"

nohup pnpm --filter @duckops/pipeline-service dev > /tmp/duckops-pipeline.log 2>&1 &
echo "   pipeline-service PID: $!"

nohup pnpm --filter @duckops/health-service dev > /tmp/duckops-health.log 2>&1 &
echo "   health-service PID: $!"

sleep 3

# ─── 7. Start ngrok tunnels ──────────────────────────────────────────────────
echo ""
./scripts/ngrok-start.sh
