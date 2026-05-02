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
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker ubuntu
systemctl enable docker
systemctl start docker

# ── 4. AWS CLI ───────────────────────────────────────────────────────────────
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp
/tmp/aws/install
rm -rf /tmp/awscliv2.zip /tmp/aws

# ── 5. Redis 7 ───────────────────────────────────────────────────────────────
apt-get install -y redis-server
sed -i 's/^bind .*/bind 127.0.0.1/' /etc/redis/redis.conf
# BullMQ requires noeviction — queued jobs must never be silently dropped
sed -i 's/^# maxmemory-policy .*/maxmemory-policy noeviction/' /etc/redis/redis.conf
sed -i 's/^maxmemory-policy .*/maxmemory-policy noeviction/' /etc/redis/redis.conf
sed -i 's/^# maxmemory .*/maxmemory 256mb/' /etc/redis/redis.conf
systemctl enable redis-server
systemctl restart redis-server

# ── 6. K3s ───────────────────────────────────────────────────────────────────
# Disable built-in Traefik so we can install a specific version via Helm
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server --disable=traefik" sh -

mkdir -p /home/ubuntu/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
chown ubuntu:ubuntu /home/ubuntu/.kube/config
chmod 600 /home/ubuntu/.kube/config
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Wait for K3s API server to be ready before running Helm
echo "==> Waiting for K3s to be ready..."
until kubectl get nodes 2>/dev/null | grep -q "Ready"; do
  sleep 3
done
echo "==> K3s ready."

# ── 7. Traefik via Helm ──────────────────────────────────────────────────────
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm repo add traefik https://traefik.github.io/charts && helm repo update

# Plain HTTP install — HTTPS redirect is handled by nginx + certbot at the host level.
# Traefik's job here is to route *.yourdomain.tech → the correct K8s service.
helm install traefik traefik/traefik \
  --namespace kube-system \
  --set service.type=NodePort \
  --set ports.web.nodePort=30080 \
  --set ports.websecure.nodePort=30443

# ── 8. Jenkins ───────────────────────────────────────────────────────────────
apt-get install -y openjdk-21-jdk
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
  > /etc/apt/sources.list.d/jenkins.list
apt-get update -qq
apt-get install -y jenkins

# Jenkins runs on 8085 to avoid conflicts (systemd drop-in override)
mkdir -p /etc/systemd/system/jenkins.service.d
cat > /etc/systemd/system/jenkins.service.d/port.conf << 'EOF'
[Service]
Environment="JENKINS_PORT=8085"
EOF
systemctl daemon-reload
systemctl enable jenkins
systemctl start jenkins

# ── 9. Application directory ─────────────────────────────────────────────────
mkdir -p /opt/duckops
chown -R ubuntu:ubuntu /opt/duckops

# ── 10. AI workspaces user ───────────────────────────────────────────────────
# _duckops-ai: isolated user for AI code-gen jobs (clone, write, commit, push)
# No shell login — jobs run as this user via sudo from provisioning-service
useradd -m -s /bin/false _duckops-ai || true
mkdir -p /home/_duckops-ai/workspaces
chown -R _duckops-ai:_duckops-ai /home/_duckops-ai

# Git identity for AI commits (matches githubService.ts commit author)
sudo -u _duckops-ai git config --global user.name "DuckOps AI"
sudo -u _duckops-ai git config --global user.email "rayansjain29@gmail.com"
sudo -u _duckops-ai git config --global credential.helper store

# Allow ubuntu (provisioning-service) to run commands as _duckops-ai without a password
echo "ubuntu ALL=(_duckops-ai) NOPASSWD: ALL" >> /etc/sudoers.d/duckops-ai
chmod 440 /etc/sudoers.d/duckops-ai

# Per-GitHub-user Linux accounts are created at runtime by provisioning-service via SSH.
# The ubuntu user needs sudo permission to run useradd/chown for new DuckOps users.
echo "ubuntu ALL=(ALL) NOPASSWD: /usr/sbin/useradd, /usr/sbin/userdel, /bin/mkdir, /bin/chown, /bin/rm" \
  >> /etc/sudoers.d/duckops-provision
chmod 440 /etc/sudoers.d/duckops-provision

# ── 11. nginx placeholder ────────────────────────────────────────────────────
cat > /etc/nginx/sites-available/duckops << 'NGINX_EOF'
# Placeholder — replaced by: sudo bash scripts/nginx-setup.sh yourdomain.tech
server {
    listen 80;
    server_name _;
    return 200 "DuckOps EC2 OK - run nginx-setup.sh to configure your domain";
    add_header Content-Type text/plain;
}
NGINX_EOF
ln -sf /etc/nginx/sites-available/duckops /etc/nginx/sites-enabled/duckops
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 12. PM2 startup ──────────────────────────────────────────────────────────
env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | bash || true

echo ""
echo "==> EC2 Setup Complete!"
echo ""
echo "Next steps:"
echo "  1. Upload code:    rsync -av --exclude node_modules --exclude .git . ubuntu@EC2_IP:/opt/duckops/"
echo "  2. Set env vars:   nano /opt/duckops/.env"
echo "  3. Install deps:   cd /opt/duckops && pnpm install && pnpm -r build"
echo "  4. Start services: pm2 start /opt/duckops/ecosystem.config.js && pm2 save"
echo "  5. Domain + SSL:   sudo bash /opt/duckops/scripts/nginx-setup.sh yourdomain.tech"
echo "  6. Issue cert:     sudo certbot --nginx -d yourdomain.tech -d '*.yourdomain.tech'"
