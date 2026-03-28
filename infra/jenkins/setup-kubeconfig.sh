#!/bin/bash
# Runs at Jenkins container startup.
# Generates a kubeconfig pointing to the k3d server's Docker network IP
# so kubectl works from inside the Jenkins container.

KUBECONFIG_SRC="/root/.kube-host/config"
KUBECONFIG_DST="/root/.kube/config"

mkdir -p /root/.kube

if [ ! -f "$KUBECONFIG_SRC" ]; then
  echo "[setup-kubeconfig] No host kubeconfig at $KUBECONFIG_SRC, skipping"
  exit 0
fi

# Resolve the k3d server hostname — works once Jenkins is on the k3d-duckops Docker network
K3D_IP=$(getent hosts k3d-duckops-server-0 2>/dev/null | awk '{print $1}' | head -1)

if [ -z "$K3D_IP" ]; then
  echo "[setup-kubeconfig] Could not resolve k3d-duckops-server-0, copying kubeconfig as-is"
  cp "$KUBECONFIG_SRC" "$KUBECONFIG_DST"
else
  echo "[setup-kubeconfig] k3d server IP: $K3D_IP — patching kubeconfig"
  sed "s|https://0\.0\.0\.0:[0-9]*|https://$K3D_IP:6443|g" "$KUBECONFIG_SRC" > "$KUBECONFIG_DST"
fi

chmod 600 "$KUBECONFIG_DST"
echo "[setup-kubeconfig] Done"
