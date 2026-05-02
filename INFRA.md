# DuckOps — Infrastructure Reference

How the infrastructure works. After one-time setup, all infra is handled automatically by the provisioning service — no manual commands needed when creating projects.

---

## One-Time Local Machine Setup

### macOS

```bash
brew install colima k3d kubectl terraform ansible
brew install --cask docker   # or use Colima (recommended for Apple Silicon)
npm install -g pnpm
```

### Linux / WSL2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm

curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
curl -LO "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install kubectl /usr/local/bin/kubectl

wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform

pip3 install ansible
```

---

## k3d Cluster Bootstrap

The `setup-local.sh` script does this automatically. Manual steps if needed:

```bash
# Required external Docker network (docker-compose.yml references it)
docker network create k3d-duckops

k3d registry create duckops-registry --port 5111

k3d cluster create duckops \
  --port "8080:80@loadbalancer" \
  --port "30000-30100:30000-30100@server:0" \
  --agents 2 \
  --network k3d-duckops \
  --registry-use k3d-duckops-registry:5111

kubectl cluster-info
k3d registry list
```

**Two registry hostnames:**
- `localhost:5111` — used by provisioning service to push from the Mac host
- `k3d-duckops-registry:5111` — used in K8s manifests; resolves inside Docker network

---

## What Provisioning Does Automatically

When a user clicks "Create Project":

### 1. INITIALIZING
- Project record created in Postgres
- BullMQ job enqueued (survives restarts, retries on failure)

### 2. SCAFFOLDING
- Handlebars templates rendered to `/tmp/duckops-projects/<name>/`:
  - App entrypoint (`index.ts` / `index.js`)
  - `package.json`, `tsconfig.json`
  - `Dockerfile` (multi-stage)
  - `k8s/deployment.yaml`, `k8s/service.yaml`
  - `Jenkinsfile`
  - Landing page (shows API status + available routes)

### 3. CREATING_REPO
- GitHub API creates private repo under authenticated user
- Git init → commit all files → force push to new repo
- Commit author: `DuckOps AI <rayansjain29@gmail.com>`
- Saves `githubRepoUrl`, `githubRepoFullName` to DB

### 4. PROVISIONING — Docker build
- `docker build -t localhost:5111/<name>:latest <scaffoldDir>`
- `docker push localhost:5111/<name>:latest`

### 5. PROVISIONING — Terraform
- `terraform init → workspace new/select <name> → apply`
- Creates K8s namespace `project-<name>` + ConfigMap with env vars
- Working dir: `infra/terraform/environments/local/`

### 6. CONFIGURING — Ansible
- `ansible-playbook playbooks/deploy-app.yml`
- Applies `deployment.yaml`, `service.yaml` via kubectl
- `kubectl rollout status` waits up to 120s

### 7. PIPELINE_READY / DEPLOYING
- POST to pipeline-service → creates Jenkins job
- Initial Jenkins build triggered immediately

### 8. RUNNING
- Project live at `http://<name>.localhost:8080`
- Health cron checks `/health` every 30s
- If `aiPrompt` was set at creation, AI service fires it now

---

## Infrastructure Components

### k3d

| Detail | Value |
|---|---|
| Cluster name | `duckops` |
| Ingress port | `8080 → 80` inside cluster |
| Ingress controller | Traefik (built into k3s) |
| Registry | `k3d-duckops-registry:5111` |

### Terraform

| Detail | Value |
|---|---|
| Provider | `hashicorp/kubernetes ~> 2.35` |
| Config path | `~/.kube/config` |
| Context | `k3d-duckops` |
| Resources created | `kubernetes_namespace`, `kubernetes_config_map` |
| Workspace | One per project |

If Terraform fails after cluster recreate (stale state):
```bash
cd infra/terraform/environments/local
terraform workspace select <name>
terraform state rm kubernetes_config_map.project_config kubernetes_namespace.project
terraform workspace select default && terraform workspace delete <name>
```

### Ansible

| Detail | Value |
|---|---|
| Playbook | `infra/ansible/playbooks/deploy-app.yml` |
| Inventory | `infra/ansible/inventory/local.yml` |
| Connection | `local` (runs kubectl on host) |
| Rollout timeout | 120s (non-fatal) |

### Jenkins

| Detail | Value |
|---|---|
| URL | `http://localhost:8085` |
| Image | `infra/jenkins/Dockerfile` (custom — plugins pre-installed) |
| Plugins | `workflow-aggregator`, `git`, `github`, `pipeline-stage-view` |
| CSRF | Disabled via init script (local dev only) |
| Data volume | `jenkinsdata` (Docker named volume) |

### BullMQ

Provisioning jobs are enqueued into Redis with:
- `attempts: 3` with exponential backoff (30s, 60s, 120s)
- `lockDuration: 600_000ms` — prevents lock expiry during long Docker builds
- `concurrency: 2` — two projects can provision simultaneously
- `maxmemory-policy: noeviction` — required so Redis never silently drops jobs

---

## Health Check Logic

- Runs every 30 seconds via node-cron
- Uses `kubectl exec deploy/<name> -- wget` to check from inside the pod (avoids Docker network routing issues)
- Turbo projects check `http://<name>-api.<namespace>.svc.cluster.local/api/health`
- Non-turbo projects check `http://<name>.<namespace>.svc.cluster.local/health`
- Degrades project only after **3 consecutive** unhealthy checks (prevents flapping on pod restarts)

---

## CI/CD Pipeline (per deployed project)

```
git push → Jenkins SCM polling (every minute)
  → Checkout from GitHub
  → npm install
  → Run tests (non-blocking)
  → docker build → localhost:5111/<name>:<build_number>
  → docker push → k3d registry
  → kubectl set image → rolling update
  → POST /api/pipelines/deployments (report result to DuckOps)
```

---

## Production (EC2)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full guide.

Architecture differences vs local:

| Aspect | Local | Production (EC2) |
|---|---|---|
| Database | Local Postgres in Docker | Neon.tech serverless Postgres |
| Registry | k3d local registry | AWS ECR |
| Services | Docker Compose | PM2 on EC2 |
| Kubernetes | k3d (Docker) | k3s (native on EC2) |
| CI/CD | Jenkins SCM polling | Jenkins + GitHub Actions |
| Frontend | localhost:3000 | Vercel |
| Routing | Nginx (Docker) | Nginx (EC2 host) |
