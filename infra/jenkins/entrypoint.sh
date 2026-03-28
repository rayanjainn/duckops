#!/bin/bash
set -e

# Set up kubeconfig with the correct k3d Docker network IP
/usr/local/bin/setup-kubeconfig.sh || true

# Start Jenkins normally
exec /usr/bin/tini -- /usr/local/bin/jenkins.sh "$@"
