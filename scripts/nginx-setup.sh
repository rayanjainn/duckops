#!/usr/bin/env bash
# Configure nginx for DuckOps on EC2
# Usage: bash scripts/nginx-setup.sh yourdomain.tech
# Run AFTER ec2-setup.sh and BEFORE certbot

set -euo pipefail

DOMAIN="${1:?Usage: $0 yourdomain.tech}"

cat > /etc/nginx/sites-available/duckops << EOF
# DuckOps — api.${DOMAIN} → backends, *.${DOMAIN} → K3s Traefik

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name ${DOMAIN} api.${DOMAIN} *.${DOMAIN};
    return 301 https://\$host\$request_uri;
}

# DuckOps API backends
server {
    listen 443 ssl;
    server_name api.${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 50m;

    location /api/auth        { proxy_pass http://localhost:4002; include /etc/nginx/proxy_params; }
    location /api/projects    { proxy_pass http://localhost:4002; include /etc/nginx/proxy_params; }
    location /api/billing     { proxy_pass http://localhost:4002; include /etc/nginx/proxy_params; }
    location /api/templates   { proxy_pass http://localhost:4001; include /etc/nginx/proxy_params; }
    location /api/health      { proxy_pass http://localhost:4004; include /etc/nginx/proxy_params; }
    location /api/logs        { proxy_pass http://localhost:4004; include /etc/nginx/proxy_params; }

    # SSE — disable buffering
    location /api/pipelines {
        proxy_pass http://localhost:4003;
        proxy_buffering off;
        proxy_read_timeout 300s;
        include /etc/nginx/proxy_params;
    }
    location /api/ai {
        proxy_pass http://localhost:4005;
        proxy_buffering off;
        proxy_read_timeout 300s;
        include /etc/nginx/proxy_params;
    }
    location /api/generate {
        proxy_pass http://localhost:4005;
        proxy_buffering off;
        proxy_read_timeout 300s;
        include /etc/nginx/proxy_params;
    }
    location /api/stack {
        proxy_pass http://localhost:4005;
        include /etc/nginx/proxy_params;
    }

    # Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:4002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        include /etc/nginx/proxy_params;
    }
}

# User-deployed apps → K3s Traefik (wildcard)
server {
    listen 443 ssl;
    server_name ~^.+-duckops\\.${DOMAIN//./\\.}\$;

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

# Write shared proxy params if not present
cat > /etc/nginx/proxy_params << 'PARAMS_EOF'
proxy_set_header Host $http_host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_http_version 1.1;
PARAMS_EOF

nginx -t && systemctl reload nginx
echo "nginx configured for ${DOMAIN}"
echo ""
echo "Now run SSL cert:"
echo "  certbot --nginx -d ${DOMAIN} -d api.${DOMAIN} --agree-tos --non-interactive -m YOUR_EMAIL"
echo "  (wildcard cert needs DNS challenge — see DEPLOYMENT.md for details)"
