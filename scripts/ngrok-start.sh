#!/bin/bash
# DuckOps — Start ngrok tunnels for production
# Exposes: provisioning-service (4002), pipeline-service (4003), health-service (4004)
# Jenkins (8085) is exposed separately via your ngrok static domain.
#
# Prerequisites:
#   brew install ngrok
#   ngrok config add-authtoken <your-token>  (from dashboard.ngrok.com)
#
# Usage:
#   ./scripts/ngrok-start.sh
#
# After running, copy the printed URLs into your Vercel env vars.

set -e

command -v ngrok >/dev/null 2>&1 || { echo "ERROR: ngrok not found. Run: brew install ngrok"; exit 1; }

# Check authtoken is set
ngrok config check >/dev/null 2>&1 || { echo "ERROR: ngrok not configured. Run: ngrok config add-authtoken <token>"; exit 1; }

echo "DuckOps — Starting ngrok tunnels..."
echo ""

# Kill any existing ngrok processes
pkill -f "ngrok" 2>/dev/null || true
sleep 1

# Start all tunnels via ngrok config (supports multiple tunnels on free plan with named tunnels)
# We use a single ngrok agent with multiple tunnels defined in ngrok.yml

NGROK_CONFIG="$HOME/.config/ngrok/ngrok.yml"

cat > /tmp/duckops-ngrok.yml << 'EOF'
version: "3"
tunnels:
  provisioning:
    proto: http
    addr: 4002
    inspect: false
  pipeline:
    proto: http
    addr: 4003
    inspect: false
  health:
    proto: http
    addr: 4004
    inspect: false
  catalog:
    proto: http
    addr: 4001
    inspect: false
  jenkins:
    proto: http
    addr: 8085
    inspect: false
EOF

# Merge authtoken from existing config if present
if [ -f "$NGROK_CONFIG" ]; then
  AUTHTOKEN=$(grep authtoken "$NGROK_CONFIG" | awk '{print $2}' | tr -d '"')
  if [ -n "$AUTHTOKEN" ]; then
    echo "authtoken: $AUTHTOKEN" >> /tmp/duckops-ngrok.yml
  fi
fi

echo "Starting tunnels for: catalog (:4001) provisioning (:4002) pipeline (:4003) health (:4004)"
echo "Waiting for tunnels to come up..."

# Start ngrok in background
ngrok start --all --config /tmp/duckops-ngrok.yml > /tmp/duckops-ngrok.log 2>&1 &
NGROK_PID=$!

sleep 4

# Fetch tunnel URLs from ngrok local API
TUNNELS=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null)

if [ -z "$TUNNELS" ]; then
  echo ""
  echo "ERROR: Could not reach ngrok API at localhost:4040"
  echo "Check /tmp/duckops-ngrok.log for errors."
  exit 1
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  NGROK TUNNEL URLs — copy these into Vercel env vars"
echo "══════════════════════════════════════════════════════════════"
echo ""

python3 - << PYEOF
import json, sys

data = json.loads("""$TUNNELS""")
tunnels = data.get("tunnels", [])

mapping = {
  "catalog": "NEXT_PUBLIC_CATALOG_URL    → Vercel env var",
  "provisioning": "NEXT_PUBLIC_API_URL + NEXT_PUBLIC_SOCKET_URL  → Vercel env var",
  "pipeline": "NEXT_PUBLIC_PIPELINE_URL  → Vercel env var",
  "health": "NEXT_PUBLIC_HEALTH_URL     → Vercel env var",
  "jenkins": "JENKINS_URL               → GitHub webhook payload URL (append /github-webhook/)",
}

for t in tunnels:
  name = t.get("name", "")
  url = t.get("public_url", "")
  if url.startswith("https://"):
    var = mapping.get(name, name.upper() + "_URL")
    print(f"  {var}")
    print(f"  {url}")
    print()
PYEOF

echo "══════════════════════════════════════════════════════════════"
echo ""
echo "ngrok dashboard: http://localhost:4040"
echo "ngrok PID: $NGROK_PID (kill with: kill $NGROK_PID)"
echo ""
echo "NEXT STEPS:"
echo "  1. Copy the URLs above"
echo "  2. Go to your Vercel project → Settings → Environment Variables"
echo "  3. Set each variable and redeploy"
echo ""
echo "Tunnels are running. Press Ctrl+C to stop."
echo ""

wait $NGROK_PID
