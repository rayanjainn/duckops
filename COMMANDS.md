# DuckOps — Command Reference

Complete reference for setup, teardown, troubleshooting, and daily dev operations.

---

## 🆘 Critical Reset (Do this if Docker/K8s/Jenkins is stuck)

### 1. Nuclear option — wipe EVERYTHING

This deletes all containers, ALL images (to free disk), volumes (resets DB/Jenkins), and k3d clusters.

```bash
./scripts/teardown-local.sh
```

### 2. Forcefully restart Docker Desktop (macOS)

Run this if Docker is frozen or "no space left" persists after pruning.

```bash
# Force kill and relaunch Docker
killall Docker; killall 'Docker Desktop'; open -a "Docker Desktop"
```

---

## Prerequisites

Install these tools before anything else.

| Tool              | Install                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Docker Desktop    | https://www.docker.com/products/docker-desktop                                                       |
| Node.js 22 + pnpm | `brew install node@22 && npm i -g pnpm`                                                              |
| k3d               | `brew install k3d` or `curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh \| bash` |
| kubectl           | `brew install kubectl`                                                                               |
| Terraform         | `brew tap hashicorp/tap && brew install hashicorp/tap/terraform`                                     |
| Ansible           | `pip3 install ansible`                                                                               |

---

## Quick: Stop everything right now

```bash
docker compose down -v --remove-orphans
```

---

## Nuclear option — Manual Wipe

Only use this if the `teardown-local.sh` script fails.

```bash
# Stop compose + delete volumes
docker compose down -v --remove-orphans

# Kill any leftover containers by name
for name in duckops-postgres duckops-redis duckops-jenkins duckops-catalog duckops-provisioning duckops-pipeline duckops-health duckops-nginx; do
  docker rm -f "$name" 2>/dev/null || true
done

# Delete k3d cluster and registry
k3d cluster delete duckops
k3d registry delete duckops-registry

# Prune images, volumes, networks
docker image prune -af
docker volume prune -f
docker network prune -f

# Clean temp project files
rm -rf /tmp/duckops-projects
```

---

## Full fresh setup (after teardown or first clone)

```bash
./scripts/setup-local.sh
```

The script handles everything in order. It pauses for Jenkins first-run setup — read the output.

**What it does:**

1. Checks prerequisites and verifies Docker is running
2. Copies `.env.example` → `.env` if missing
3. Runs `pnpm install`
4. Creates `k3d-duckops` Docker network (required before compose — it's an external network)
5. Creates k3d registry + cluster
6. Starts postgres + redis, waits for healthy
7. Runs DB migrations + seed
8. Starts Jenkins, waits up to 90s
9. Prints Jenkins first-run instructions
10. Starts remaining services + **automatically copies kubeconfig into Jenkins**

---

## First-time GitHub OAuth App setup

DuckOps uses GitHub OAuth for login and repo creation.

1. Go to **https://github.com/settings/developers** → OAuth Apps → New OAuth App
2. Fill in:
   - **Application name:** `DuckOps Local`
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:4000/api/auth/github/callback`
3. Copy **Client ID** and generate a **Client Secret**
4. Add to `.env`:
   ```
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   JWT_SECRET=$(openssl rand -hex 32)
   ```

---

## Jenkins first-run setup (required after every vol reset)

Jenkins resets when the `jenkinsdata` volume is deleted. You need to set it up again from scratch.

```bash
# 1. Get the initial admin password
docker exec duckops-jenkins cat /var/jenkins_home/secrets/initialAdminPassword

# 2. Open http://localhost:8085
#    - Paste the password
#    - Click "Install suggested plugins" and wait ~3 min
#    - Create an admin user OR click "Skip and continue as admin"

# 3. Create an API token
#    Jenkins → top-right user icon → Configure → API Token → Add new Token → copy it

# 4. Add token to .env
JENKINS_TOKEN=<paste_token_here>

# 5. Injection check:
#    If Jenkins can't see k3d pods, re-run this:
k3d kubeconfig get duckops > /tmp/config
docker cp /tmp/config duckops-jenkins:/root/.kube/config

# 6. Restart pipeline-service so it picks up the new token
docker compose restart pipeline-service
```

**Copy kubeconfig into Jenkins** (so Jenkinsfile pipelines can run `kubectl`):

The raw kubeconfig from k3d has `server: https://0.0.0.0:<port>` which is unreachable from inside Jenkins. You must replace it with the k3d server container's internal Docker network IP.

```bash
# Get the k3d server's internal Docker IP
K3D_IP=$(docker inspect k3d-duckops-server-0 \
  --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')

# Generate kubeconfig with internal IP substituted
k3d kubeconfig get duckops \
  | sed "s|https://0.0.0.0:[0-9]*|https://${K3D_IP}:6443|g" \
  > /tmp/duckops-kubeconfig-jenkins

# Copy into Jenkins
docker exec duckops-jenkins mkdir -p /root/.kube
docker cp /tmp/duckops-kubeconfig-jenkins duckops-jenkins:/root/.kube/config
rm /tmp/duckops-kubeconfig-jenkins

# Verify
docker exec duckops-jenkins kubectl get nodes
```

---

## k3d cluster

**IMPORTANT:** The `k3d-duckops` Docker network must exist before starting Docker Compose, because `docker-compose.yml` references it as an external network.

```bash
# Create the network first
docker network create k3d-duckops

# Create registry
k3d registry create duckops-registry --port 5111

# Create cluster (with --network flag to attach to the same network as Jenkins)
k3d cluster create duckops \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer" \
  --port "30000-30100:30000-30100@server:0" \
  --agents 2 \
  --network k3d-duckops \
  --registry-use k3d-duckops-registry:5111

# Verify
k3d cluster list
kubectl get nodes

# Stop / start (preserves data)
k3d cluster stop duckops
k3d cluster start duckops

# Delete
k3d cluster delete duckops
k3d registry delete duckops-registry
```

---

## Database

```bash
# Run migrations (deploy = no prompts, safe for CI)
cd packages/db && pnpm prisma migrate deploy

# Re-seed (seed removes stale rows before inserting)
cd packages/db && pnpm prisma db seed

# Open Prisma Studio (GUI at http://localhost:5555)
cd packages/db && pnpm prisma studio

# Open psql shell
docker exec -it duckops-postgres psql -U duckops -d duckops

# Full reset (drops all tables and re-runs from scratch)
cd packages/db && pnpm prisma migrate reset
```

---

## Build and deploy to k3d

```bash
# Build all microservice images and push to local registry
./scripts/build-all.sh

# Deploy all Kubernetes manifests
./scripts/deploy-k8s.sh

# Check pods
kubectl get pods -n duckops
kubectl get pods -n duckops -w   # watch mode

# Tail logs
kubectl logs -n duckops deploy/pipeline-service -f
```

---

## Dev mode (hot reload)

Best for active development — services run locally, only infra runs in Docker.

```bash
# Start infra in Docker
docker compose up postgres redis jenkins -d

# Start all apps with Turborepo (hot reload)
pnpm turbo dev
```

Or start individual services:

```bash
pnpm --filter @duckops/web dev                   # http://localhost:3000
pnpm --filter @duckops/catalog-service dev        # http://localhost:4001
pnpm --filter @duckops/provisioning-service dev   # http://localhost:4002
pnpm --filter @duckops/pipeline-service dev       # http://localhost:4003
pnpm --filter @duckops/health-service dev         # http://localhost:4004
```

---

## Daily Docker Compose commands

```bash
# Start all services (detached)
docker compose up -d

# Start and rebuild images
docker compose up -d --build

# Stop all (keep volumes)
docker compose stop

# Stop and delete volumes (full reset of DB + Jenkins)
docker compose down -v

# View all logs
docker compose logs -f

# View logs for one service
docker compose logs -f pipeline-service

# Restart one service
docker compose restart pipeline-service

# Check status
docker compose ps
```

---

## Service URLs

| Service              | URL                   | Port |
| :------------------- | :-------------------- | :--- |
| **Frontend**         | http://localhost:3000 | 3000 |
| **API Gateway**      | http://localhost:4000 | 4000 |
| **Catalog Service**  | http://localhost:4001 | 4001 |
| **Provisioning**     | http://localhost:4002 | 4002 |
| **Pipeline Service** | http://localhost:4003 | 4003 |
| **Health Service**   | http://localhost:4004 | 4004 |
| **Jenkins**          | http://localhost:8085 | 8085 |
| **Postgres**         | localhost:5432        | 5432 |
| **Redis**            | localhost:6379        | 6379 |
| **k3d Registry**     | localhost:5111        | 5111 |
| **Prisma Studio**    | http://localhost:5555 | 5555 |

---

## Troubleshooting

### "Cannot find name 'Set', 'Map', 'Buffer'..." (TypeScript failure)

Fixed in scaffolding!

- **Action**: Delete the failed project in the DuckOps UI and try creating it again. The fix ensures that `@types/node` and `vite/client` are included in the generated project.

### "Cannot connect to the Docker daemon"

Docker Desktop isn't running.

```bash
open -a "Docker Desktop"
# wait for whale icon, then:
docker info
```

### "network k3d-duckops not found" — compose fails to start

The external network doesn't exist yet. Always create it before compose.

```bash
docker network create k3d-duckops
docker compose up -d
```

### Postgres unreachable / services crash-looping

```bash
docker compose ps postgres          # is it running?
docker compose logs postgres        # any errors?
docker compose restart postgres
sleep 10
docker compose restart catalog-service provisioning-service pipeline-service health-service
```

### Jenkins returns 401 / pipeline-service can't authenticate

The `JENKINS_TOKEN` in `.env` is wrong or missing.

```bash
# Regenerate token:
# http://localhost:8085 → [user] → Configure → API Token → Add new Token

# Update .env JENKINS_TOKEN, then:
docker compose restart pipeline-service
```

### Jenkins pipeline fails: "dial tcp 0.0.0.0:XXXXX: connection refused"

The kubeconfig inside Jenkins points to `0.0.0.0` (the host), which is unreachable from inside the container. Fix it by using the k3d server's internal Docker network IP:

```bash
K3D_IP=$(docker inspect k3d-duckops-server-0 \
  --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
k3d kubeconfig get duckops \
  | sed "s|https://0.0.0.0:[0-9]*|https://${K3D_IP}:6443|g" \
  > /tmp/duckops-kubeconfig-jenkins
docker exec duckops-jenkins mkdir -p /root/.kube
docker cp /tmp/duckops-kubeconfig-jenkins duckops-jenkins:/root/.kube/config
rm /tmp/duckops-kubeconfig-jenkins
docker exec duckops-jenkins kubectl get nodes   # should show Ready nodes
```

### Jenkins container can't run kubectl (kubeconfig missing entirely)

Same command as above — the setup script now does this automatically with the correct internal IP.

### "no space left on device" — disk full

```bash
docker system df              # see what's using space
docker image prune -af        # remove all unused images
docker volume prune -f        # remove unused volumes
docker builder prune -af      # clear build cache
```

### Port already in use

```bash
lsof -ti:8085 | xargs kill -9   # kill whatever is on port 8085
```

### k3d cluster nodes NotReady

```bash
k3d cluster stop duckops
k3d cluster start duckops
kubectl get nodes               # wait for Ready status
```

### pnpm install fails

```bash
pnpm store prune
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

### Prisma migration fails

```bash
cd packages/db
pnpm prisma migrate reset   # drops DB and reruns from scratch
pnpm prisma db seed
```

---

## 🚀 Production Deployment (Vercel + ngrok)

### Architecture

```
Your Mac (always-on)
├── k3d cluster          ← TCP tunnel via ngrok → public URL
├── Jenkins :8085        ← HTTP tunnel via ngrok → GitHub webhooks
├── provisioning-service :4002  ← ngrok HTTP → Vercel frontend
├── pipeline-service :4003      ← ngrok HTTP → Vercel frontend
└── health-service :4004        ← ngrok HTTP → Vercel frontend

Vercel
├── Next.js frontend      (apps/web)
└── catalog-service       (apps/catalog-service — pure DB reads, no subprocesses)
```

### Prerequisites (one-time)

```bash
# 1. Install ngrok
brew install ngrok

# 2. Sign up at https://dashboard.ngrok.com and add your authtoken
ngrok config add-authtoken <your-token>

# 3. Install Vercel CLI
npm i -g vercel

# 4. Set up a free Neon Postgres DB for catalog-service on Vercel
#    https://neon.tech → create project → copy connection string
#    Add DATABASE_URL to catalog-service env in Vercel dashboard
```

### One-time Vercel project setup

```bash
# Deploy the frontend (from repo root — vercel.json points it at apps/web)
cd /Users/rayanjain/Projects/duckops
vercel

# Deploy catalog-service as a separate Vercel project
cd apps/catalog-service
vercel
# When prompted, set root directory to: apps/catalog-service
```

### Daily production workflow

```bash
# Start everything on your Mac (k3d + Jenkins + 3 services + ngrok tunnels)
./scripts/prod-start.sh

# The script prints ngrok URLs at the end, e.g.:
#   NEXT_PUBLIC_API_URL         https://abc123.ngrok-free.app
#   NEXT_PUBLIC_PIPELINE_URL    https://def456.ngrok-free.app
#   NEXT_PUBLIC_HEALTH_URL      https://ghi789.ngrok-free.app
```

### Setting Vercel environment variables

After running `prod-start.sh`, copy the ngrok URLs from the output and set:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CATALOG_URL` | Your catalog-service Vercel URL |
| `NEXT_PUBLIC_API_URL` | ngrok provisioning-service URL |
| `NEXT_PUBLIC_SOCKET_URL` | Same as `NEXT_PUBLIC_API_URL` |
| `NEXT_PUBLIC_PIPELINE_URL` | ngrok pipeline-service URL |
| `NEXT_PUBLIC_HEALTH_URL` | ngrok health-service URL |

```bash
# Set env vars via CLI (or use Vercel dashboard)
vercel env add NEXT_PUBLIC_API_URL production
# paste the ngrok URL when prompted

# After setting env vars, redeploy
vercel --prod
```

### GitHub OAuth for production

Create a **separate** GitHub OAuth App for production:

1. https://github.com/settings/developers → OAuth Apps → New OAuth App
2. Fill in:
   - **Homepage URL:** `https://your-app.vercel.app`
   - **Callback URL:** `https://<ngrok-provisioning-url>/api/auth/github/callback`
3. Add to Vercel env vars on provisioning-service:
   ```
   GITHUB_CLIENT_ID=<prod-client-id>
   GITHUB_CLIENT_SECRET=<prod-client-secret>
   JWT_SECRET=<same-secret-as-local>
   FRONTEND_URL=https://your-app.vercel.app
   ```

### Jenkins webhooks for production

```bash
# Your Jenkins ngrok URL is printed by ngrok-start.sh
# In GitHub repo → Settings → Webhooks → Add webhook:
#   Payload URL: https://<ngrok-jenkins-url>/github-webhook/
#   Content type: application/json
#   Events: Push, Pull Request
```

> **Note:** ngrok URLs on the free plan change every time you restart.
> To get a persistent URL, use ngrok's free static domain:
> `ngrok config add-authtoken <token>` then `ngrok http --domain=yourname.ngrok-free.app 4002`
