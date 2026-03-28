#!/bin/bash
set -e

echo "🦆 Deploying DuckOps platform to K3d cluster..."

# Apply base resources
kubectl apply -f infra/kubernetes/base/

# Apply service manifests
for svc in catalog provisioning pipeline health; do
  echo "→ Deploying $svc..."
  kubectl apply -f "infra/kubernetes/services/$svc/"
done

# Wait for rollouts
kubectl rollout status deployment/catalog-service -n duckops
kubectl rollout status deployment/provisioning-service -n duckops
kubectl rollout status deployment/pipeline-service -n duckops
kubectl rollout status deployment/health-service -n duckops

echo "✅ All services deployed!"
kubectl get pods -n duckops
