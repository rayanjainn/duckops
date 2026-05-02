#!/usr/bin/env bash
# Configure nginx for DuckOps on EC2
# app.yourdomain.tech → Vercel (handled by DNS CNAME, not nginx)
# api.yourdomain.tech → EC2 backend services
# *.yourdomain.tech   → K3s Traefik (deployed projects)
# Usage: sudo bash scripts/nginx-setup.sh yourdomain.tech
# Run AFTER ec2-setup.sh and BEFORE certbot

set -euo pipefail

DOMAIN="${1:?Usage: $0 yourdomain.tech}"

cat > /etc/nginx/sites-available/duckops << EOF
# DuckOps nginx — EC2 only
# app.${DOMAIN} is handled by Vercel (CNAME in DNS), not nginx

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name ${DOMAIN} api.${DOMAIN} *.${DOMAIN};
    return 301 https://\$host\$request_uri;
}

# ── Backend API services ──────────────────────────────────────────────────
server {
    listen 443 ssl;
    server_name api.${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 50m;

    location /api/auth      { proxy_pass http://localhost:4002; include /etc/nginx/proxy_params; }
    location /api/projects  { proxy_pass http://localhost:4002; include /etc/nginx/proxy_params; }
    location /api/billing   { proxy_pass http://localhost:4002; include /etc/nginx/proxy_params; }
    location /api/templates { proxy_pass http://localhost:4001; include /etc/nginx/proxy_params; }
    location /api/options   { proxy_pass http://localhost:4001; include /etc/nginx/proxy_params; }
    location /api/health    { proxy_pass http://localhost:4004; include /etc/nginx/proxy_params; }
    location /api/logs      { proxy_pass http://localhost:4004; include /etc/nginx/proxy_params; }

    location /api/pipelines {
        proxy_pass http://localhost:4003;
        proxy_buffering off;
        proxy_read_timeout 300s;
        include /etc/nginx/proxy_params;
    }
    location /api/generate {
        proxy_pass http://localhost:4005;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_set_header Connection "";
        include /etc/nginx/proxy_params;
    }
    location /api/stack {
        proxy_pass http://localhost:4005;
        include /etc/nginx/proxy_params;
    }

    # Socket.IO real-time updates
    location /socket.io/ {
        proxy_pass http://localhost:4002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        include /etc/nginx/proxy_params;
    }
}

# ── User-deployed project subdomains → K3s Traefik (wildcard) ────────────
server {
    listen 443 ssl;
    server_name *.${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://localhost:30080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

# Shared proxy params
cat > /etc/nginx/proxy_params << 'PARAMS_EOF'
proxy_set_header Host $http_host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_http_version 1.1;
PARAMS_EOF

nginx -t && systemctl reload nginx
echo ""
echo "==> nginx configured for ${DOMAIN}"
echo ""
echo "Now issue SSL cert (wildcard requires DNS challenge):"
echo ""
echo "  sudo certbot certonly --manual --preferred-challenges dns \\"
echo "    -d ${DOMAIN} -d '*.${DOMAIN}' \\"
echo "    --agree-tos -m your@email.com"
echo ""
echo "  Then reload nginx: sudo systemctl reload nginx"
