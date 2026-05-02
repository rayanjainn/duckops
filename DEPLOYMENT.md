# DuckOps Production Deployment Guide

> **Do these steps in order. Each section has a "when" — some you do once, some every deploy.**

---

## Prerequisites (do these first, one time)

- AWS account with IAM user `duckops-admin` created (see `ARCHITECTURE_CLOUD.md`)
- AWS Access Key ID + Secret from your friend
- A `.tech` domain you own (add DNS records below)
- A Neon.tech account (free)
- A Vercel account (free)
- A GitHub account with this repo pushed
- Stripe account with product + price created

---

## Phase 0 — Local Setup (your Mac)

### 0.1 — Install AWS CLI and configure

```bash
brew install awscli

aws configure
# AWS Access Key ID:     YOUR_ACCESS_KEY_ID
# AWS Secret Access Key: YOUR_SECRET_ACCESS_KEY
# Default region:        ap-south-1
# Default output format: json

# Verify it works
aws sts get-caller-identity
# Should return your account ID
```

### 0.2 — Push code to GitHub

```bash
cd /path/to/duckops
git init   # if not already
git remote add origin https://github.com/YOUR_USERNAME/duckops.git
git add .
git commit -m "feat: initial production-ready platform"
git push -u origin main
```

---

## Phase 1 — Neon.tech Database (free Postgres)

### 1.1 — Create Neon project

1. Go to [neon.tech](https://neon.tech) → Sign up (free)
2. Create project: **Name:** `duckops` | **Region:** `AWS ap-southeast-1` (closest to Mumbai)
3. Copy the connection string — it looks like:
   ```
   postgresql://neondb_owner:PASS@ep-xxx-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this — it's your `DATABASE_URL` for production

### 1.2 — Run migrations against Neon

```bash
# On your Mac, with the Neon URL:
DATABASE_URL="postgresql://neondb_owner:PASS@ep-xxx..." \
  cd packages/db && node_modules/.bin/prisma db push
```

---

## Phase 2 — Create ECR Repositories

```bash
# Create one repo per service
for svc in provisioning-service pipeline-service health-service ai-service catalog-service; do
  aws ecr create-repository \
    --repository-name "duckops/${svc}" \
    --region ap-south-1 \
    --image-scanning-configuration scanOnPush=true
done

# Note your ECR registry URL — you'll need it:
aws sts get-caller-identity --query Account --output text
# ECR URL = <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com
```

---

## Phase 3 — Launch EC2 Instance

### 3.1 — Launch via AWS Console

1. Go to **EC2 → Launch Instance**
2. Settings:
   - **Name:** `duckops-prod`
   - **AMI:** Ubuntu Server 24.04 LTS (64-bit x86)
   - **Instance type:** `t3.large`
   - **Key pair:** Create new → name it `duckops-ec2` → **Download `.pem` file** → save to `~/.ssh/duckops-ec2.pem`
   - **Storage:** 50 GB gp3
   - **Security group:** Allow inbound: SSH (22), HTTP (80), HTTPS (443), and Custom TCP 8085 (Jenkins) from your IP only
3. Click **Launch Instance**
4. Wait ~2 min for it to start

### 3.2 — Assign Elastic IP

1. EC2 → **Elastic IPs** → Allocate Elastic IP
2. Associate it with `duckops-prod`
3. Note the IP address — you'll use it everywhere

### 3.3 — Fix SSH key permissions

```bash
chmod 400 ~/.ssh/duckops-ec2.pem
```

### 3.4 — Run the setup script on EC2

```bash
# Copy setup script to EC2
scp -i ~/.ssh/duckops-ec2.pem scripts/ec2-setup.sh ubuntu@EC2_IP:~/

# SSH in and run it (takes ~10 min)
ssh -i ~/.ssh/duckops-ec2.pem ubuntu@EC2_IP
sudo bash ~/ec2-setup.sh
```

---

## Phase 4 — DNS Setup

Go to your domain registrar (e.g. Namecheap, GoDaddy, Cloudflare):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<EC2 Elastic IP>` | 300 |
| A | `api` | `<EC2 Elastic IP>` | 300 |
| CNAME | `app` | `cname.vercel-dns.com` | 300 |
| A | `*` | `<EC2 Elastic IP>` | 300 |

> `app.yourdomain.tech` → Vercel (Next.js frontend)
> `api.yourdomain.tech` → EC2 (backend services)
> `*.yourdomain.tech` → EC2 wildcard → K3s Traefik → deployed projects

Wait 5-10 min for DNS to propagate, then verify:
```bash
dig api.yourdomain.tech +short
# Should return your EC2 IP
```

---

## Phase 5 — nginx + SSL on EC2

```bash
ssh -i ~/.ssh/duckops-ec2.pem ubuntu@EC2_IP

# Configure nginx (replace with your real domain)
sudo bash /opt/duckops/scripts/nginx-setup.sh yourdomain.tech

# Install wildcard SSL cert (needs DNS challenge for wildcard)
# Install certbot-dns plugin for your registrar, OR use manual DNS challenge:
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d yourdomain.tech \
  -d "*.yourdomain.tech" \
  --agree-tos \
  -m youremail@example.com

# Certbot will ask you to add a TXT record to your DNS — do that, wait 60s, then press Enter
# After cert is issued, reload nginx:
sudo nginx -t && sudo systemctl reload nginx

# Auto-renewal (runs twice daily):
sudo systemctl enable certbot.timer
```

---

## Phase 6 — Deploy Application to EC2

### 6.1 — Create production .env on EC2

```bash
ssh -i ~/.ssh/duckops-ec2.pem ubuntu@EC2_IP
sudo mkdir -p /opt/duckops
sudo chown ubuntu:ubuntu /opt/duckops
nano /opt/duckops/.env
```

Paste this (fill in all values):
```env
NODE_ENV=production
DEPLOY_MODE=cloud
DOMAIN=yourdomain.tech

# Database (Neon.tech)
DATABASE_URL=postgresql://neondb_owner:PASS@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# Redis (local on EC2)
REDIS_URL=redis://localhost:6379

# Jenkins (local on EC2)
JENKINS_URL=http://localhost:8085
JENKINS_USER=admin
JENKINS_TOKEN=   # get from Jenkins UI after first boot (see below)

# GitHub OAuth (CLOUD app — separate from local)
GITHUB_CLIENT_ID=      # create at github.com/settings/developers
GITHUB_CLIENT_SECRET=  # Authorization callback URL: https://api.yourdomain.tech/api/auth/github/callback

# JWT
JWT_SECRET=   # generate: openssl rand -hex 32

# URLs
APP_URL=https://app.yourdomain.tech
FRONTEND_URL=https://app.yourdomain.tech
API_URL=https://api.yourdomain.tech
NEXT_PUBLIC_API_URL=https://api.yourdomain.tech
NEXT_PUBLIC_PIPELINE_URL=https://api.yourdomain.tech
NEXT_PUBLIC_CATALOG_URL=https://api.yourdomain.tech
NEXT_PUBLIC_HEALTH_URL=https://api.yourdomain.tech
NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.tech
NEXT_PUBLIC_AI_URL=https://api.yourdomain.tech
PIPELINE_SERVICE_URL=http://localhost:4003

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI (Ollama cloud)
OLLAMA_HOST=https://ollama.com
OLLAMA_API_KEY=...
OLLAMA_CODE_MODEL=qwen3-coder:480b
OLLAMA_STACK_MODEL=qwen3-coder:480b

# AWS
export AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
AWS_REGION=ap-south-1

# ECR
REGISTRY_URL=<ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com
K8S_CONTEXT=default
```

### 6.2 — Get Jenkins initial admin password

```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

1. Open `http://EC2_IP:8085` in browser
2. Enter the password, install suggested plugins
3. Create admin user
4. Go to **Manage Jenkins → Security → API Token** → create token
5. Paste token as `JENKINS_TOKEN` in `.env` above

### 6.3 — Upload code and build

```bash
# From your Mac — sync code to EC2 (first time, full upload)
rsync -avz --exclude node_modules --exclude .git --exclude dist \
  -e "ssh -i ~/.ssh/duckops-ec2.pem" \
  . ubuntu@EC2_IP:/opt/duckops/

# SSH in and build
ssh -i ~/.ssh/duckops-ec2.pem ubuntu@EC2_IP
cd /opt/duckops

# Load env vars into shell for the build
export $(grep -v '^#' .env | xargs)

# Install + build
pnpm install --frozen-lockfile
pnpm --filter @duckops/db prisma:generate
pnpm -r build

# Start all services
pm2 start ecosystem.config.js

# Save PM2 state so services restart on reboot
pm2 save

# Check everything is running
pm2 status
```

---

## Phase 7 — Vercel Frontend Deployment

### 7.1 — Create GitHub OAuth app for production

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**
2. Settings:
   - **Application name:** `DuckOps`
   - **Homepage URL:** `https://app.yourdomain.tech`
   - **Authorization callback URL:** `https://api.yourdomain.tech/api/auth/github/callback`
3. Generate a client secret → save both Client ID and Secret
4. Update `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in EC2 `.env`
5. Restart: `pm2 restart duckops-provisioning`

### 7.2 — Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

cd apps/web
vercel
# Follow prompts:
# - Link to existing project or create new
# - Project name: duckops-web
# - Root directory: . (you're already in apps/web)
```

### 7.3 — Set Vercel environment variables

Go to [vercel.com](https://vercel.com) → your project → **Settings → Environment Variables**.

Add all `NEXT_PUBLIC_*` variables:
```
NEXT_PUBLIC_API_URL          = https://api.yourdomain.tech
NEXT_PUBLIC_PIPELINE_URL     = https://api.yourdomain.tech
NEXT_PUBLIC_CATALOG_URL      = https://api.yourdomain.tech
NEXT_PUBLIC_HEALTH_URL       = https://api.yourdomain.tech
NEXT_PUBLIC_SOCKET_URL       = https://api.yourdomain.tech
NEXT_PUBLIC_AI_URL           = https://api.yourdomain.tech
```

### 7.4 — Add custom domain on Vercel

1. Vercel project → **Settings → Domains** → Add `app.yourdomain.tech`
2. Vercel will give you a CNAME to add (already done in Phase 4 above)
3. Wait for SSL to provision (~2 min)

### 7.5 — Redeploy with production variables

```bash
cd apps/web
vercel --prod
```

---

## Phase 8 — GitHub Actions CI/CD Setup

### 8.1 — Add GitHub Secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions** → New repository secret:

| Secret name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | `YOUR_ACCESS_KEY_ID` |
| `AWS_SECRET_ACCESS_KEY` | `YOUR_SECRET_ACCESS_KEY` |
| `AWS_REGION` | `ap-south-1` |
| `EC2_HOST` | Your EC2 Elastic IP |
| `EC2_SSH_KEY` | Contents of `~/.ssh/duckops-ec2.pem` (entire file including header/footer) |
| `VERCEL_TOKEN` | From vercel.com → Settings → Tokens |
| `VERCEL_ORG_ID` | From `vercel project ls` output |
| `VERCEL_PROJECT_ID` | From `vercel project ls` output |

### 8.2 — Create a GitHub Environment for protection

1. GitHub repo → **Settings → Environments → New environment**: `production`
2. Add **Required reviewers** (yourself) — this means deploys to production need your approval
3. This matches `environment: production` in `.github/workflows/ci.yml`

### 8.3 — Test the pipeline

```bash
# Push any change to main
git add .
git commit -m "ci: test production pipeline"
git push origin main

# Watch it run:
# github.com/YOUR_USERNAME/duckops/actions
```

---

## Phase 9 — Stripe Production Setup

### 9.1 — Set up Stripe webhook for production

```bash
# In Stripe Dashboard → Developers → Webhooks → Add endpoint
# URL: https://api.yourdomain.tech/api/billing/webhook
# Events to listen to:
#   - customer.subscription.created
#   - customer.subscription.updated
#   - customer.subscription.deleted
#   - checkout.session.completed
```

Copy the webhook signing secret → update `STRIPE_WEBHOOK_SECRET` in EC2 `.env` → `pm2 restart duckops-provisioning`

### 9.2 — Switch to live mode keys

In Stripe Dashboard → switch to **Live mode** → get live keys:
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_PUBLISHABLE_KEY=pk_live_...`
- Update price ID for live mode product

Update on EC2: edit `.env` → `pm2 restart duckops-provisioning`

---

## Phase 10 — Verify Everything Works

```bash
# On EC2
pm2 status           # all 5 services should be "online"
redis-cli ping       # PONG
kubectl get nodes    # should show 1 node Ready
systemctl status jenkins  # active (running)

# From your browser
# https://app.yourdomain.tech         → DuckOps login page
# https://api.yourdomain.tech/health  → {"status":"ok","service":"provisioning-service"}
```

---

## Routine Operations

### Deploy a new version (automatic via GitHub Actions)
```bash
git push origin main
# CI builds images → pushes to ECR → SSH deploys → Vercel redeploys
```

### Deploy manually (without CI)
```bash
# From Mac
rsync -avz --exclude node_modules --exclude .git --exclude dist \
  -e "ssh -i ~/.ssh/duckops-ec2.pem" \
  . ubuntu@EC2_IP:/opt/duckops/

ssh -i ~/.ssh/duckops-ec2.pem ubuntu@EC2_IP
cd /opt/duckops
pnpm install --frozen-lockfile && pnpm -r build
pm2 reload ecosystem.config.js --update-env
```

### Check logs
```bash
ssh -i ~/.ssh/duckops-ec2.pem ubuntu@EC2_IP
pm2 logs duckops-provisioning --lines 100
pm2 logs duckops-ai --lines 50
# or all at once:
pm2 logs
```

### Restart a service
```bash
pm2 restart duckops-provisioning
pm2 restart all
```

### SSH into EC2
```bash
ssh -i ~/.ssh/duckops-ec2.pem ubuntu@EC2_IP
```

### Stop EC2 (save money, data preserved)
- AWS Console → EC2 → Select instance → Instance State → **Stop**
- Note: Elastic IP still costs ~$0.005/hr when not attached to a running instance
- Resume: Start instance → it gets the same Elastic IP back

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `pm2 status` shows errored service | `pm2 logs duckops-<service> --lines 50` to see error |
| Jenkins can't connect | Check `JENKINS_TOKEN` in `.env`, restart provisioning |
| OAuth callback fails | Verify GitHub OAuth app callback URL matches `api.yourdomain.tech` |
| SSL cert expired | `sudo certbot renew` (auto-renewal should handle this) |
| K3s pods not running | `kubectl get pods -A` to see status, `kubectl describe pod <name>` for details |
| DB connection error | Check Neon.tech dashboard, verify `DATABASE_URL` in `.env` |
| ECR push fails | `aws ecr get-login-password --region ap-south-1 \| docker login --username AWS --password-stdin <ECR_URL>` |
