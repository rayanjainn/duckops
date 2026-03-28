#!/bin/bash
set -e

echo "🦆 DuckOps — Local Setup"
echo "========================"

# 1. Check prerequisites
echo "→ Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "❌ Docker not found. Install Docker Desktop."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm not found. Run: npm install -g pnpm"; exit 1; }
command -v k3d >/dev/null 2>&1 || { echo "⚠  k3d not found. Install: https://k3d.io"; }
command -v terraform >/dev/null 2>&1 || { echo "⚠  terraform not found. Install: https://terraform.io"; }
command -v ansible >/dev/null 2>&1 || { echo "⚠  ansible not found. Install: pip install ansible"; }

# 2. Copy env file
if [ ! -f .env ]; then
  echo "→ Creating .env from .env.example..."
  cp .env.example .env
fi

# 3. Install dependencies
echo "→ Installing dependencies..."
pnpm install

# 4. Create K3d cluster (if k3d is available)
if command -v k3d >/dev/null 2>&1; then
  if ! k3d cluster list | grep -q "duckops"; then
    echo "→ Creating K3d cluster..."
    k3d registry create duckops-registry --port 5111 2>/dev/null || true
    k3d cluster create duckops \
      --port "8080:80@loadbalancer" \
      --port "8443:443@loadbalancer" \
      --port "30000-30100:30000-30100@server:0" \
      --agents 2 \
      --registry-use k3d-duckops-registry:5111
  else
    echo "→ K3d cluster 'duckops' already exists"
  fi
fi

# 5. Start PostgreSQL and Redis first
echo "→ Starting PostgreSQL and Redis..."
docker compose up postgres redis -d

# 6. Wait for PostgreSQL to be ready
echo "→ Waiting for PostgreSQL..."
sleep 15

# 7. Run migrations and seed
echo "→ Running database migrations..."
cd packages/db
pnpm prisma migrate dev --name init 2>/dev/null || pnpm prisma migrate deploy
pnpm prisma generate
pnpm prisma db seed || true
cd ../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  Start all services:    docker compose up -d"
echo "  Start dev mode:        pnpm turbo dev"
echo "  Frontend:              http://localhost:3000"
echo "  API Gateway:           http://localhost:4000"
echo "  Jenkins:               http://localhost:8085"
echo "  Prisma Studio:         cd packages/db && pnpm prisma studio"
