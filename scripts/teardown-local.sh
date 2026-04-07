#!/bin/bash
# DuckOps — Full Teardown
# Stops and removes all containers, volumes, images, and the k3d cluster.

set -e

echo "DuckOps — Full Teardown"
echo "========================"

read -p "This will destroy ALL containers, volumes, images, and the k3d cluster. Continue? [y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Cancelled."
  exit 0
fi

# 1. Stop and remove docker compose services + volumes
echo "→ Stopping Docker Compose services..."
docker compose down -v --remove-orphans 2>/dev/null || true

# 2. Remove any dangling named containers by name in case compose missed them
for name in duckops-postgres duckops-redis duckops-jenkins duckops-catalog duckops-provisioning duckops-pipeline duckops-health duckops-nginx; do
  docker rm -f "$name" 2>/dev/null || true
done

# 3. Delete k3d cluster and registry
echo "→ Removing k3d cluster and registry..."
k3d cluster delete duckops 2>/dev/null || true
k3d registry delete duckops-registry 2>/dev/null || true

# 4. Remove all unused Docker images (prune)
echo "→ Pruning Docker images..."
docker image prune -af 2>/dev/null || true

# 5. Remove all unused volumes
echo "→ Pruning Docker volumes..."
docker volume prune -f 2>/dev/null || true

# 6. Remove all unused networks
echo "→ Pruning Docker networks..."
docker network prune -f 2>/dev/null || true

# 7. Clean temp project files
echo "→ Cleaning temp files..."
rm -rf /tmp/duckops-projects

echo ""
echo "Teardown complete. YOUR DOCKER IS NOW EMPTY (containers + images)."
echo ""
echo "!!! MAC USERS: To forcefully reset Docker Desktop now, run:"
echo "killall Docker; killall 'Docker Desktop'; open -a 'Docker Desktop'"
echo "Wait for the icon to be steady before running setup again."
