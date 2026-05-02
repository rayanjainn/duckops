#!/usr/bin/env bash
# DuckOps EC2 Setup Script
# Run once on a fresh Ubuntu 24.04 t3.large instance
# Usage: curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/scripts/ec2-setup.sh | sudo bash

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "==> DuckOps EC2 Setup Starting..."

# ── 1. System packages ──────────────────────────────────────────────────────
apt-get update -qq
apt-get install -y -qq \
  curl wget git unzip build-essential ca-certificates gnupg \
  nginx certbot python3-certbot-nginx \
  lsb-release apt-transport-https

# ── 2. Node.js 22 ────────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pnpm@9.15.4 pm2

# ── 3. Docker ────────────────────────────────────────────────────────────────
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
usermod -aG docker ubuntu
systemctl enable docker

# ── 4. AWS CLI ───────────────────────────────────────────────────────────────
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp
/tmp/aws/install
rm -rf /tmp/awscliv2.zip /tmp/aws

# ── 5. Redis 7 ───────────────────────────────────────────────────────────────
apt-get install -y redis-server
sed -i 's/^bind .*/bind 127.0.0.1/' /etc/redis/redis.conf
sed -i 's/^# maxmemory-policy .*/maxmemory-policy noeviction/' /etc/redis/redis.conf
sed -i 's/^# maxmemory .*/maxmemory 256mb/' /etc/redis/redis.conf
systemctl enable redis-server
systemctl start redis-server

# ── 6. K3s ───────────────────────────────────────────────────────────────────
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server --disable=traefik" sh -
mkdir -p /home/ubuntu/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
chown ubuntu:ubuntu /home/ubuntu/.kube/config
chmod 600 /home/ubuntu/.kube/config
# Install Traefik via Helm for wildcard ingress support
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm repo add traefik https://traefik.github.io/charts && helm repo update
helm install traefik traefik/traefik \
  --namespace kube-system \
  --set ports.web.redirectTo.port=websecure \
  --set ports.websecure.tls.enabled=true

# ── 7. Jenkins ───────────────────────────────────────────────────────────────
# Install Java (required for Jenkins)
apt-get install -y openjdk-21-jdk
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
  > /etc/apt/sources.list.d/jenkins.list
apt-get update -qq
apt-get install -y jenkins
# Jenkins runs on 8085 to avoid nginx conflict
sed -i 's/HTTP_PORT=8080/HTTP_PORT=8085/' /etc/default/jenkins 2>/dev/null || true
systemctl enable jenkins
systemctl start jenkins

# ── 8. Application directory ─────────────────────────────────────────────────
mkdir -p /opt/duckops
chown -R ubuntu:ubuntu /opt/duckops

# ── 9. Special Linux users ───────────────────────────────────────────────────
# AI code generation user — isolated workspace, no shell login
useradd -m -s /bin/false _duckops-ai || true
mkdir -p /home/_duckops-ai/workspaces
chown -R _duckops-ai:_duckops-ai /home/_duckops-ai

# ── 10. nginx config placeholder ─────────────────────────────────────────────
cat > /etc/nginx/sites-available/duckops << 'NGINX_EOF'
# Replace DOMAIN with your actual domain
# This file is overwritten by: scripts/nginx-setup.sh YOURDOMAIN.tech

server {
    listen 80;
    server_name _;
    return 200 "DuckOps EC2 OK - domain not configured yet";
}
NGINX_EOF
ln -sf /etc/nginx/sites-available/duckops /etc/nginx/sites-enabled/duckops
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 11. PM2 startup ──────────────────────────────────────────────────────────
pm2 startup systemd -u ubuntu --hp /home/ubuntu
env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo ""
echo "==> EC2 Setup Complete!"
echo ""
echo "Next steps:"
echo "  1. Upload your code: rsync -av --exclude node_modules . ubuntu@EC2_IP:/opt/duckops/"
echo "  2. Set up env vars: nano /opt/duckops/.env"
echo "  3. Configure domain: bash /opt/duckops/scripts/nginx-setup.sh yourdomain.tech"
echo "  4. Install SSL cert: certbot --nginx -d yourdomain.tech -d '*.yourdomain.tech'"
echo "  5. Build + start: cd /opt/duckops && pnpm install && pnpm -r build && pm2 start ecosystem.config.js"
echo "  6. Save PM2 state: pm2 save"
