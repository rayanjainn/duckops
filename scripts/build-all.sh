#!/bin/bash
set -e

REGISTRY=${REGISTRY_URL:-k3d-duckops-registry:5111}

echo "🦆 Building all Docker images..."

for service in catalog-service provisioning-service pipeline-service health-service; do
  echo "→ Building $service..."
  docker build -t "$REGISTRY/$service:latest" -f "apps/$service/Dockerfile" .
  docker push "$REGISTRY/$service:latest"
  echo "✓ $service pushed"
done

echo "✅ All images built and pushed to $REGISTRY"
