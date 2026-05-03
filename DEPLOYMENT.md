# DuckOps — Production Deployment Guide

Complete step-by-step guide. Do these phases in order. Each section states when it applies (one-time vs every deploy).

---

## Prerequisites (before you start)

- AWS account — IAM user `duckops-admin` with EC2FullAccess + ECRFullAccess + VPCFullAccess
- AWS Access Key ID + Secret Access Key for that user
- A domain you own (examples use `raycode.tech`)
- A Neon.tech account (free) — for serverless Postgres
- A GitHub account with this repo pushed to it
- A Stripe account with a product + price created (free + pro tiers)
- Vercel account (free) — for the Next.js frontend

---

## Phase 0 — Local machine setup (one-time)

### 0.1 Install AWS CLI

```bash
brew install awscli

aws configure
# AWS Access Key ID:     YOUR_ACCESS_KEY_ID
# AWS Secret Access Key: YOUR_SECRET_ACCESS_KEY
# Default region:        ap-south-1
# Default output format: json

# Verify
aws sts get-caller-identity
# Returns your account ID — if this works, AWS CLI is wired up
```

### 0.2 Push code to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/duckops.git
git push -u origin main
```

---

## Phase 1 — Neon.tech database (one-time)

1. Go to [neon.tech](https://neon.tech) → sign up → Create project
   - **Name:** `duckops`
   - **Region:** `AWS ap-southeast-1` (closest to Mumbai ap-south-1)
2. Copy the connection string — it looks like:
   ```
   postgresql://neondb_owner:PASS@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
3. Run migrations from your Mac:
   ```bash
   DATABASE_URL="postgresql://neondb_owner:PASS@ep-xxx..." \
     pnpm --filter @duckops/db exec prisma db push
   ```

---

## Phase 2 — Create ECR repositories (one-time)

```bash
# Get your account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "ECR base URL: ${AWS_ACCOUNT_ID}.dkr.ecr.ap-south-1.amazonaws.com"

# Create one ECR repo per service
for svc in provisioning-service pipeline-service health-service ai-service catalog-service; do
  aws ecr create-repository \
    --repository-name "duckops/${svc}" \
    --region ap-south-1 \
    --image-scanning-configuration scanOnPush=true
done

# DuckOps also creates per-project ECR repos automatically when DEPLOY_MODE=cloud.
# No manual action needed for user projects.
```

---

## Phase 3 — Launch EC2 instance (one-time)

### 3.1 Launch via AWS Console

1. EC2 → Launch Instance
   - **Name:** `duckops-prod`
   - **AMI:** Ubuntu Server 24.04 LTS (64-bit x86)
   - **Instance type:** `t3.large` (2 vCPU, 8 GB RAM)
   - **Key pair:** Create new → name `duckops-ec2` → download `.pem` → save to `~/duckops-ec2.pem`
   - **Storage:** 50 GB gp3
   - **Security group inbound rules:**
     | Port | Protocol | Source | Purpose |
     |------|----------|--------|---------|
     | 22 | TCP | Your IP | SSH |
     | 80 | TCP | 0.0.0.0/0 | HTTP (redirect to HTTPS) |
     | 443 | TCP | 0.0.0.0/0 | HTTPS |
     | 8085 | TCP | Your IP | Jenkins UI |
2. Launch Instance → wait ~2 min

### 3.2 Assign Elastic IP

1. EC2 → Elastic IPs → Allocate Elastic IP
2. Associate it with `duckops-prod`
3. Note the IP — used everywhere as `13.204.92.146`

### 3.3 Fix SSH key permissions

```bash
chmod 400 ~/duckops-ec2.pem

# Test SSH works
ssh -i ~/duckops-ec2.pem ubuntu@13.204.92.146 "echo connected"
```

### 3.4 Run the setup script on EC2

```bash
# Copy the setup script to EC2
scp -i ~/duckops-ec2.pem scripts/ec2-setup.sh ubuntu@13.204.92.146:~/

# SSH in and run it (takes ~10-15 min)
ssh -i ~/duckops-ec2.pem ubuntu@13.204.92.146
sudo bash ~/ec2-setup.sh
```

What the script installs: Node.js 22, pnpm, PM2, Docker, AWS CLI, Redis 7, K3s, Traefik (via Helm), Jenkins on port 8085, nginx, Certbot, `_duckops-ai` user, sudoers rules for Linux user isolation.

---

## Phase 4 — DNS setup (one-time, after EC2 has an IP)

At your domain registrar (Namecheap, Cloudflare, GoDaddy):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `13.204.92.146` | 300 |
| A | `api` | `13.204.92.146` | 300 |
| CNAME | `app` | `cname.vercel-dns.com` | 300 |
| A | `*` | `13.204.92.146` | 300 |

- `app.raycode.tech` → Vercel (Next.js frontend)
- `api.raycode.tech` → EC2 nginx → PM2 backend services
- `*.raycode.tech` → EC2 nginx → K3s Traefik → deployed user projects

Wait 5-10 min for propagation, then verify:
```bash
dig api.raycode.tech +short   # should return 13.204.92.146
dig app.raycode.tech +short   # should return Vercel's IP
```

---

## Phase 5 — nginx + SSL on EC2 (one-time)

```bash
ssh -i ~/duckops-ec2.pem ubuntu@13.204.92.146

# Configure nginx for your domain
sudo bash /opt/duckops/scripts/nginx-setup.sh raycode.tech

# Issue wildcard SSL cert (wildcard requires DNS challenge — Certbot will prompt you)
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d raycode.tech \
  -d "*.raycode.tech" \
  --agree-tos \
  -m rayansjain@gmail.com

# Certbot prints a TXT record to add to your DNS — add it, wait 60s, then press Enter
# After cert is issued:
sudo nginx -t && sudo systemctl reload nginx

# Enable auto-renewal
sudo systemctl enable certbot.timer
```

---

## Phase 6 — Jenkins first-time setup (one-time)

```bash
# Get the initial admin password
ssh -i ~/duckops-ec2.pem ubuntu@13.204.92.146
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

1. Open `http://13.204.92.146:8085` in browser
2. Enter the password → Install suggested plugins → Create admin user
3. **User icon → Configure → API Token → Add new Token** → copy the token
4. Keep it — you'll paste it into `.env` as `JENKINS_TOKEN`

---

## Phase 7 — GitHub OAuth app for production (one-time)

1. [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**
   - **Application name:** `DuckOps`
   - **Homepage URL:** `https://app.raycode.tech`
   - **Authorization callback URL:** `https://api.raycode.tech/api/auth/github/callback`
2. Generate a client secret → save Client ID + Secret

---

## Phase 8 — Stripe webhook (one-time)

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
   - **URL:** `https://api.raycode.tech/api/billing/webhook`
   - **Events:** `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`
2. Copy the webhook signing secret

---

## Phase 9 — Create production .env on EC2 (one-time, update on changes)

```bash
ssh -i ~/duckops-ec2.pem ubuntu@13.204.92.146
nano /opt/duckops/.env
```

```env
NODE_ENV=production
DEPLOY_MODE=cloud
DOMAIN=raycode.tech

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://neondb_owner:PASS@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# ── Redis (local on EC2) ──────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Jenkins ───────────────────────────────────────────────────────────────────
JENKINS_URL=http://localhost:8085
JENKINS_USER=admin
JENKINS_TOKEN=YOUR_JENKINS_API_TOKEN

# ── GitHub OAuth ─────────────────────────────────────────────────────────────
GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=YOUR_GITHUB_CLIENT_SECRET

# ── Auth ──────────────────────────────────────────────────────────────────────
# Generate with: openssl rand -hex 32
JWT_SECRET=YOUR_RANDOM_64_CHAR_HEX

# ── URLs ──────────────────────────────────────────────────────────────────────
APP_URL=https://app.raycode.tech
FRONTEND_URL=https://app.raycode.tech
API_URL=https://api.raycode.tech
NEXT_PUBLIC_API_URL=https://api.raycode.tech
NEXT_PUBLIC_PIPELINE_URL=https://api.raycode.tech
NEXT_PUBLIC_CATALOG_URL=https://api.raycode.tech
NEXT_PUBLIC_HEALTH_URL=https://api.raycode.tech
NEXT_PUBLIC_SOCKET_URL=https://api.raycode.tech
NEXT_PUBLIC_AI_URL=https://api.raycode.tech
PIPELINE_SERVICE_URL=http://localhost:4003
AI_SERVICE_URL=http://localhost:4005

# ── Stripe ────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ── AI (Ollama cloud) ─────────────────────────────────────────────────────────
OLLAMA_HOST=https://ollama.com
OLLAMA_API_KEY=YOUR_OLLAMA_API_KEY
OLLAMA_CODE_MODEL=qwen3-coder:480b
OLLAMA_STACK_MODEL=qwen3-coder:480b

# ── AWS ───────────────────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
AWS_REGION=ap-south-1
AWS_ACCOUNT_ID=YOUR_12_DIGIT_ACCOUNT_ID

# ── Registry (ECR) ────────────────────────────────────────────────────────────
REGISTRY_URL=YOUR_AWS_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com
HOST_REGISTRY_URL=YOUR_AWS_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com

# ── K8s ───────────────────────────────────────────────────────────────────────
K8S_CONTEXT=default
DUCKOPS_ENV=cloud

# ── SSH (provisioning-service SSHes to EC2 for Linux user isolation) ──────────
# On EC2, these point to localhost since provisioning-service runs on the same machine
EC2_SSH_HOST=localhost
EC2_SSH_KEY_PATH=/home/ubuntu/.ssh/duckops-internal
EC2_SSH_USER=ubuntu
```

Generate the internal SSH key (provisioning-service uses this to SSH to itself for user management):
```bash
ssh-keygen -t ed25519 -f /home/ubuntu/.ssh/duckops-internal -N ""
cat /home/ubuntu/.ssh/duckops-internal.pub >> /home/ubuntu/.ssh/authorized_keys
chmod 600 /home/ubuntu/.ssh/duckops-internal
```

---

## Phase 10 — Deploy application to EC2 (first deploy + every deploy)

### First deploy

```bash
# From your Mac — sync code to EC2
rsync -avz \
  --exclude node_modules \
  --exclude .git \
  --exclude dist \
  --exclude .next \
  --exclude .env \
  --exclude "*.log" \
  --exclude .turbo \
  --exclude .claude \
  --exclude .code-review-graph \
  -e "ssh -i ~/duckops-ec2.pem" \
  . ubuntu@13.204.92.146:/opt/duckops/

# SSH in and build
ssh -i ~/duckops-ec2.pem ubuntu@13.204.92.146
cd /opt/duckops

# Load env vars
set -a; source .env; set +a

# Install with devDependencies (needed for tsc and prisma CLI)
pnpm install --frozen-lockfile --prod=false
pnpm --filter @duckops/db exec prisma generate
pnpm -r build

# Log into ECR so Docker can push/pull
aws ecr get-login-password --region ap-south-1 \
  | docker login --username AWS --password-stdin \
    ${AWS_ACCOUNT_ID}.dkr.ecr.ap-south-1.amazonaws.com

# Start all services
pm2 start /opt/duckops/ecosystem.config.js --env production

# Persist — services restart on reboot
pm2 save

# Check everything is running
pm2 status
```

### Every subsequent deploy

```bash
# From your Mac
rsync -avz \
  --exclude node_modules \
  --exclude .git \
  --exclude dist \
  --exclude .next \
  --exclude .env \
  --exclude "*.log" \
  --exclude .turbo \
  --exclude .claude \
  --exclude .code-review-graph \
  -e "ssh -i ~/duckops-ec2.pem" \
  . ubuntu@13.204.92.146:/opt/duckops/

ssh -i ~/duckops-ec2.pem ubuntu@13.204.92.146
cd /opt/duckops
pnpm install --frozen-lockfile --prod=false
pnpm --filter @duckops/db exec prisma generate
pnpm -r build
pm2 reload ecosystem.config.js --update-env
```

---

## Phase 11 — Vercel frontend (one-time setup, auto-deploys after)

```bash
npm install -g vercel
cd apps/web
vercel
# → Link to or create project "duckops-web"
# → Root directory: . (you're already in apps/web)
```

Set environment variables at vercel.com → your project → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL          = https://api.raycode.tech
NEXT_PUBLIC_PIPELINE_URL     = https://api.raycode.tech
NEXT_PUBLIC_CATALOG_URL      = https://api.raycode.tech
NEXT_PUBLIC_HEALTH_URL       = https://api.raycode.tech
NEXT_PUBLIC_SOCKET_URL       = https://api.raycode.tech
NEXT_PUBLIC_AI_URL           = https://api.raycode.tech
```

Add custom domain:
1. Vercel project → Settings → Domains → Add `app.raycode.tech`
2. Vercel gives you a CNAME to add (already done in Phase 4)
3. Wait ~2 min for SSL to provision

Deploy to production:
```bash
cd apps/web
vercel --prod
```

---

## Phase 12 — GitHub Actions CI/CD (one-time)

### Add GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | Your AWS key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret |
| `AWS_REGION` | `ap-south-1` |
| `EC2_HOST` | Your EC2 Elastic IP |
| `EC2_SSH_KEY` | Full contents of `~/duckops-ec2.pem` |
| `VERCEL_TOKEN` | From vercel.com → Settings → Tokens |
| `VERCEL_ORG_ID` | From `vercel project ls` |
| `VERCEL_PROJECT_ID` | From `vercel project ls` |

### Create production environment

1. GitHub repo → Settings → Environments → New: `production`
2. Add yourself as required reviewer (deploys need your approval)

### Test the pipeline

```bash
git add . && git commit -m "ci: test production pipeline" && git push origin main
# Watch at: github.com/YOUR_USERNAME/duckops/actions
```

---

## Phase 13 — Verify everything works

```bash
ssh -i ~/duckops-ec2.pem ubuntu@13.204.92.146

pm2 status                  # all 5 services: online
redis-cli ping              # PONG
kubectl get nodes           # 1 node Ready
systemctl status jenkins    # active (running)
systemctl status nginx      # active (running)
curl -s https://api.raycode.tech/health | jq .
# {"status":"ok","service":"provisioning-service"}
```

From your browser:
- `https://app.raycode.tech` → DuckOps login page
- `https://api.raycode.tech/health` → JSON health response

---

## Routine operations

### Check logs
```bash
ssh -i ~/duckops-ec2.pem ubuntu@13.204.92.146
pm2 logs                                    # all services
pm2 logs duckops-provisioning --lines 100   # one service
pm2 logs duckops-ai --lines 50
```

### Restart a service
```bash
pm2 restart duckops-provisioning
pm2 restart all
```

### DB migrations (after schema changes)
```bash
# From your Mac — runs against Neon.tech
DATABASE_URL="postgresql://..." \
  pnpm --filter @duckops/db exec prisma migrate deploy
```

### Check K3s / user projects
```bash
ssh -i ~/duckops-ec2.pem ubuntu@13.204.92.146
kubectl get namespaces | grep -v kube    # shows {github}-{project} namespaces
kubectl get pods -n {github}-{project}
kubectl logs -n {github}-{project} deploy/{project} --tail=50

# Linux user accounts (one per GitHub user)
ls /home/ | grep u_
```

### Stop EC2 to save money (data preserved)
- AWS Console → EC2 → Instance State → Stop
- Note: Elastic IP costs ~$0.005/hr when unattached to a running instance
- Resume: Start instance → same Elastic IP

### Rollback a deploy
```bash
ssh -i ~/duckops-ec2.pem ubuntu@13.204.92.146
cd /opt/duckops
git log --oneline -10        # find the commit to roll back to
git checkout <commit-hash>
pnpm -r build
pm2 reload ecosystem.config.js --update-env
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| PM2 service errored | `pm2 logs duckops-<service> --lines 50` |
| Jenkins unreachable | `systemctl status jenkins` → check port 8085 in security group |
| OAuth callback fails | Verify GitHub OAuth app callback URL = `https://api.raycode.tech/api/auth/github/callback` |
| SSL cert expired | `sudo certbot renew && sudo systemctl reload nginx` |
| K3s pods not running | `kubectl get pods -A` → `kubectl describe pod <name> -n <ns>` |
| DB connection error | Check Neon.tech dashboard, verify `DATABASE_URL` in `.env` |
| ECR push fails | Re-run: `aws ecr get-login-password --region ap-south-1 \| docker login --username AWS --password-stdin <ECR_URL>` |
| SSH connection refused | Check EC2 security group has port 22 open for your IP |
| Redis not responding | `systemctl status redis-server` → `systemctl restart redis-server` |
| Health checks failing | `kubectl exec -n <ns> deploy/<name> -- wget -qO- http://localhost:<port>/health` |
| Linux user not created | Check SSH key: `EC2_SSH_KEY_PATH` in `.env` must be readable by provisioning-service |
| Jenkins 401 after token rotation | Update `JENKINS_TOKEN` in `/opt/duckops/.env` then run: `set -a && source /opt/duckops/.env && set +a && pm2 reload ecosystem.config.js --update-env` |

---

## Architecture summary (cloud mode)

```
Internet
  │
  ├─ app.raycode.tech ──────────────────► Vercel (Next.js frontend)
  │
  └─ api.raycode.tech  ─────────────────► EC2 Elastic IP
  └─ *.raycode.tech    ─────────────────► EC2 Elastic IP
                                               │
                                          nginx :80/:443
                                           ├─ api.*  → PM2 services
                                           └─ *.*    → K3s Traefik :30080
                                               │
                                          PM2 Services
                                           ├─ provisioning :4002 (BullMQ worker)
                                           ├─ pipeline      :4003
                                           ├─ health        :4004 (SSH → kubectl)
                                           ├─ ai            :4005 (BullMQ worker)
                                           └─ catalog       :4001
                                               │
                                          Redis :6379 (BullMQ queues)
                                          Neon.tech Postgres (off-EC2)
                                               │
                                          K3s cluster
                                           ├─ Traefik ingress (NodePort 30080)
                                           ├─ ns: {github}-{project}  ← user projects
                                           └─ Linux users: /home/u_{github}/
                                               │
                                          ECR (per-project Docker images)
                                          Jenkins (shared CI/CD)
```
