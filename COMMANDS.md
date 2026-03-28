# DuckOps — Commands Reference

Full startup guide for **Linux**, **macOS**, and **Windows (WSL2)**.

---

## Prerequisites

Install these before anything else.

### Node.js 22 + pnpm

**macOS**
```bash
brew install node@22
npm install -g pnpm
```

**Linux (Ubuntu/Debian)**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm
```

**Windows (WSL2 — run all commands in Ubuntu terminal)**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm
```

Verify:
```bash
node -v    # v22.x.x
pnpm -v    # 9.x.x
```

---

### Docker Desktop

**macOS**
```bash
brew install --cask docker
# Open Docker Desktop from Applications, wait for whale icon in menu bar
```

**Linux**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker          # apply group without logging out
```

**Windows**
1. Download Docker Desktop from docker.com
2. During install → check **"Use WSL 2 instead of Hyper-V"**
3. Open Docker Desktop → Settings → Resources → WSL Integration → enable Ubuntu
4. Click Apply & Restart
5. All commands below run inside the **Ubuntu (WSL2) terminal**

Verify:
```bash
docker --version          # Docker version 27.x.x
docker compose version    # Docker Compose version v2.x.x
docker run hello-world    # should print Hello from Docker!
```

---

## First-Time Setup

Do this once after cloning the repo.

### 1. Install dependencies

```bash
cd duckops
pnpm install
```

### 2. Create your .env file

```bash
cp .env.example .env
```

### 3. Set up GitHub OAuth App

DuckOps uses GitHub OAuth for authentication and to create private repos on your behalf. You need to register a GitHub OAuth App.

1. Go to **https://github.com/settings/developers** → "OAuth Apps" → "New OAuth App"
2. Fill in:
   - **Application name:** `DuckOps Local`
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:4000/api/auth/github/callback`
3. Click **Register application**
4. Copy the **Client ID** and generate a **Client Secret**
5. Add them to your `.env`:
   ```bash
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   JWT_SECRET=any_long_random_string_here
   ```

   Generate a strong JWT secret:
   ```bash
   openssl rand -hex 32
   ```

### 4. Start the database and Redis

```bash
docker compose up postgres redis -d
```

Wait ~10 seconds for postgres to be ready:
```bash
docker compose ps          # STATUS should show "healthy" for postgres and redis
```

If you want to watch the logs until ready:
```bash
docker compose logs -f postgres
# Wait until you see: "database system is ready to accept connections"
# Press Ctrl+C to exit logs
```

### 5. Run database migrations and seed

```bash
cd packages/db
pnpm prisma migrate dev --name init
pnpm prisma generate
pnpm prisma db seed
cd ../..
```

Expected output at the end:
```
✅ Seed data inserted successfully
```

---

## Starting Everything (Dev Mode — Hot Reload)

Run each of these in a **separate terminal window/tab**.

**Terminal 1 — Infrastructure (postgres + redis + jenkins + nginx)**
```bash
docker compose up postgres redis jenkins nginx -d
```

**Terminal 2 — Catalog Service**
```bash
cd apps/catalog-service
pnpm dev
# Running on http://localhost:4001
```

**Terminal 3 — Provisioning Service**
```bash
cd apps/provisioning-service
pnpm dev
# Running on http://localhost:4002
```

**Terminal 4 — Pipeline Service**
```bash
cd apps/pipeline-service
pnpm dev
# Running on http://localhost:4003
```

**Terminal 5 — Health Service**
```bash
cd apps/health-service
pnpm dev
# Running on http://localhost:4004
```

**Terminal 6 — Frontend**
```bash
cd apps/web
pnpm dev
# Running on http://localhost:3000
```

### Or: start all services at once with Turborepo

```bash
# From root — starts all 4 backend services + frontend concurrently
pnpm turbo dev
```

---

## Starting Everything (Docker — Production-Like)

Builds all images and runs everything in containers. No separate terminals needed.

```bash
# From repo root
docker compose up --build
```

This starts: postgres, redis, jenkins, catalog, provisioning, pipeline, health, nginx.

Frontend still runs separately (Next.js needs its own process):
```bash
cd apps/web
pnpm dev
```

Access the frontend at http://localhost:3000.

---

## Access Points

| Service              | URL                        | Notes                        |
|----------------------|----------------------------|------------------------------|
| **Frontend**         | http://localhost:3000      | Next.js app                  |
| **API Gateway**      | http://localhost:4000      | Nginx — routes to services   |
| Catalog Service      | http://localhost:4001      | Template options API         |
| Provisioning Service | http://localhost:4002      | Project creation + Socket.io |
| Pipeline Service     | http://localhost:4003      | Jenkins integration          |
| Health Service       | http://localhost:4004      | Health checks + logs         |
| **Jenkins**          | http://localhost:8085      | CI/CD dashboard              |
| **Prisma Studio**    | http://localhost:5555      | Visual DB browser (see below)|

---

## Database Tools

```bash
# Open Prisma Studio (visual database browser)
cd packages/db
pnpm prisma studio
# Opens at http://localhost:5555

# Re-run seed data (resets template options)
pnpm prisma db seed

# Reset database completely (destroys all data)
pnpm prisma migrate reset

# Create a new migration after editing schema.prisma
pnpm prisma migrate dev --name your-migration-name

# Regenerate Prisma TypeScript types after schema change
pnpm prisma generate
```

---

## Jenkins Setup (First Time)

Jenkins starts with the setup wizard disabled. You need to create an API token for DuckOps to use.

```bash
# 1. Open Jenkins
open http://localhost:8085     # macOS
xdg-open http://localhost:8085 # Linux
# Windows: open browser and go to http://localhost:8085
```

2. Login: **admin / admin** (default for `jenkins/jenkins:lts` with wizard disabled)
   - If it asks for a password, get it:
   ```bash
   docker exec duckops-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```

3. Install suggested plugins (click "Install suggested plugins")

4. Create an API token:
   - Top right → your username → Configure
   - API Token section → Add new Token → name it `duckops` → Generate
   - **Copy the token**

5. Add the token to your `.env`:
   ```bash
   # Edit .env
   JENKINS_TOKEN=your_token_here
   ```

6. Restart the pipeline service so it picks up the new token:
   ```bash
   # If running in dev mode (Ctrl+C in Terminal 4, then):
   cd apps/pipeline-service && pnpm dev

   # If running in Docker:
   docker compose restart pipeline-service
   ```

---

## Stopping Everything

```bash
# Stop all Docker containers (preserves data)
docker compose down

# Stop and delete all data (full reset)
docker compose down -v

# Stop a single service
docker compose stop postgres

# Restart a single service
docker compose restart provisioning-service
```

---

## Rebuilding After Code Changes

```bash
# Rebuild a single service image
docker compose build catalog-service

# Rebuild and restart one service
docker compose up --build catalog-service

# Rebuild everything
docker compose up --build
```

---

## Checking Service Health

```bash
# Check all container statuses
docker compose ps

# View logs for a specific service
docker compose logs -f provisioning-service

# Check individual health endpoints
curl http://localhost:4001/health   # catalog
curl http://localhost:4002/health   # provisioning
curl http://localhost:4003/health   # pipeline
curl http://localhost:4004/health   # health service
curl http://localhost:4000/health   # nginx gateway

# Test the templates API
curl http://localhost:4001/api/templates | jq .
```

---

## Optional: K3d (Kubernetes) Setup

Only needed if you want actual Kubernetes deployments (the provisioning service calls Terraform + kubectl). Skip this if you just want the frontend and APIs running.

**Install k3d**

macOS:
```bash
brew install k3d
```

Linux / WSL2:
```bash
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
```

**Create the cluster:**
```bash
# Create local registry
k3d registry create duckops-registry --port 5111

# Create cluster (exposes port 8080 for ingress)
k3d cluster create duckops \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer" \
  --port "30000-30100:30000-30100@server:0" \
  --agents 2 \
  --registry-use k3d-duckops-registry:5111

# Verify
kubectl get nodes
# Should show 3 nodes (1 server + 2 agents)
```

**Stop / Start the cluster:**
```bash
k3d cluster stop duckops    # pause (preserves data)
k3d cluster start duckops   # resume

k3d cluster delete duckops  # destroy completely
```

---

## Optional: Terraform + Ansible

Only needed for infrastructure provisioning to work end-to-end.

**Install Terraform**

macOS:
```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

Linux / WSL2:
```bash
sudo apt install -y gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

**Install Ansible**

macOS:
```bash
brew install ansible
```

Linux / WSL2:
```bash
pip3 install ansible
```

**Test that they work:**
```bash
terraform -v
ansible --version
ansible localhost -m ping
```

---

## Optional: Monitoring (Prometheus + Grafana)

Requires K3d cluster to be running first.

```bash
# Add Helm repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack into the cluster
kubectl create namespace monitoring
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.service.type=NodePort \
  --set grafana.service.nodePort=30001 \
  --set prometheus.service.type=NodePort \
  --set prometheus.service.nodePort=30002

# Wait for pods to be ready (2-3 minutes)
kubectl get pods -n monitoring -w
```

Access:
- Grafana: http://localhost:30001 — username: `admin`, password: `prom-operator`
- Prometheus: http://localhost:30002

---

## Full Daily Workflow

```bash
# 1. Start infrastructure
docker compose up postgres redis jenkins -d

# 2. Start services (pick one)
pnpm turbo dev              # all at once
# OR open 5 terminals and run each manually (see above)

# 3. Open the app
open http://localhost:3000  # macOS
xdg-open http://localhost:3000  # Linux
# Windows: open browser → http://localhost:3000

# 4. When done
docker compose down         # stop containers, keep data
# OR
docker compose down -v      # stop containers, wipe data
```

---

## Troubleshooting

**Port already in use**
```bash
# Find and kill the process on a port
lsof -ti:4001 | xargs kill -9    # macOS / Linux
# Windows WSL2: same command works in Ubuntu terminal
```

**Postgres won't connect**
```bash
docker compose ps                     # check it's running
docker compose logs postgres          # look for errors
docker compose restart postgres       # restart it
```

**pnpm install fails**
```bash
# Clear cache and retry
pnpm store prune
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

**Prisma migration fails**
```bash
cd packages/db
pnpm prisma migrate reset    # wipes DB and re-runs from scratch
pnpm prisma db seed
```

**Services can't reach each other in Docker**
- Make sure you're using the Docker service names (e.g., `postgres`, `redis`) as hostnames in env vars, not `localhost`. The `docker-compose.yml` already does this correctly.

**Windows-specific: Docker commands fail in PowerShell**
- Always use the **Ubuntu WSL2 terminal** for all commands, not PowerShell or CMD.
- Check Docker Desktop → Settings → WSL Integration → Ubuntu is enabled.

**"Cannot connect to Docker daemon"**
```bash
# Linux: make sure you're in the docker group
sudo usermod -aG docker $USER
newgrp docker

# Or use sudo temporarily
sudo docker compose up -d
```
