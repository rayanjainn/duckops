#!/bin/bash
set -e

echo "🦆 DuckOps — Teardown"
echo "========================"

read -p "This will destroy all local resources. Continue? [y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Cancelled."
  exit 0
fi

echo "→ Stopping Docker Compose services..."
docker compose down -v 2>/dev/null || true

echo "→ Stopping K3d cluster..."
k3d cluster stop duckops 2>/dev/null || true
k3d cluster delete duckops 2>/dev/null || true
k3d registry delete duckops-registry 2>/dev/null || true

echo "→ Cleaning temp files..."
rm -rf /tmp/duckops-projects

echo "✅ Teardown complete."
