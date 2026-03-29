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

# 2. Kill and remove ALL containers currently running or stopped
echo "→ Stopping and removing ALL containers..."
docker ps -aq | xargs -r docker stop 2>/dev/null || true
docker ps -aq | xargs -r docker rm -f 2>/dev/null || true

# 3. Delete k3d cluster and registry
echo "→ Removing k3d cluster and registry..."
k3d cluster delete duckops 2>/dev/null || true
k3d registry delete duckops-registry 2>/dev/null || true

# 4. Remove ALL Docker images
echo "→ Removing ALL Docker images..."
docker images -aq | xargs -r docker rmi -f 2>/dev/null || true

# 5. Prune volumes and networks
echo "→ Pruning Docker volumes and networks..."
docker volume prune -f 2>/dev/null || true
docker network prune -f 2>/dev/null || true

# 6. Clean temp project files
echo "→ Cleaning temp files..."
rm -rf /tmp/duckops-projects

echo ""
echo "Teardown complete. YOUR DOCKER IS NOW EMPTY (containers + images)."
echo ""
echo "!!! MAC USERS: To forcefully reset Docker Desktop now, run:"
echo "killall Docker; killall 'Docker Desktop'; open -a 'Docker Desktop'"
echo "Wait for the icon to be steady before running setup again."
