# DuckOps — Infrastructure Reference

Everything about how the infra works, what was fixed, and the one-time machine setup required.
After the one-time setup, **all infra is handled automatically** by the provisioning service — no manual commands needed when creating projects.

---

## One-Time Machine Setup

Install these tools once. After this, everything else is automatic.

### macOS

```bash
# Package manager
brew install node@22 pnpm

# Container runtime
brew install --cask docker
# Open Docker Desktop and wait for it to be ready

# Kubernetes (local)
brew install k3d kubectl

# Infrastructure as Code
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Configuration management
brew install ansible

# Verify all tools
node -v          # v22+
pnpm -v          # 9+
docker --version
k3d version
terraform -v
ansible --version
kubectl version --client
```

### Linux / WSL2

```bash
# Node
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm

# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# k3d + kubectl
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
curl -LO "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install kubectl /usr/local/bin/kubectl

# Terraform
sudo apt install -y gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform

# Ansible
pip3 install ansible
```

---

## One-Time Cluster Bootstrap

Run this **once** after installing the tools above. The provisioning service handles everything after this.

```bash
# 1. Create the local Docker registry
k3d registry create duckops-registry --port 5111

# 2. Create the k3d cluster wired to the registry + expose port 8080 for ingress
k3d cluster create duckops \
  --port "8080:80@loadbalancer" \
  --registry-use k3d-duckops-registry:5111

# 3. Verify cluster and registry are up
kubectl cluster-info
k3d registry list    # should show k3d-duckops-registry
```

If you ever need to fully reset the cluster:
```bash
k3d cluster delete duckops
k3d cluster create duckops \
  --port "8080:80@loadbalancer" \
  --registry-use k3d-duckops-registry:5111
```

---

## One-Time Jenkins Bootstrap

Jenkins starts with no plugins. Run this **once** after `docker compose up jenkins`:

```bash
# Install Pipeline plugins via the Plugin Manager API
curl -X POST "http://localhost:8085/pluginManager/installNecessaryPlugins" \
  -H "Content-Type: application/xml" \
  -d '<jenkins>
    <install plugin="workflow-aggregator@latest"/>
    <install plugin="git@latest"/>
    <install plugin="github@latest"/>
    <install plugin="pipeline-stage-view@latest"/>
  </jenkins>'

# Wait ~2 minutes for plugins to install, then check:
curl -s "http://localhost:8085/updateCenter/api/json?depth=1" | \
  python3 -c "
import sys,json; d=json.load(sys.stdin)
jobs=d.get('jobs',[])
done=[j for j in jobs if j.get('status',{}).get('type')=='Success']
pending=[j for j in jobs if j.get('status',{}).get('type') not in ['Success','Failed','']]
print(f'Done: {len(done)}, Pending: {len(pending)}')
"
# Wait until Pending: 0, then restart Jenkins
docker restart duckops-jenkins && sleep 30

# Disable CSRF (required for API-based job creation — security is off anyway for local dev)
curl -s -c /tmp/j.txt "http://localhost:8085/crumbIssuer/api/json" > /tmp/crumb.json
CRUMB=$(python3 -c "import json; d=json.load(open('/tmp/crumb.json')); print(d['crumb'])")
curl -s -b /tmp/j.txt -X POST "http://localhost:8085/scriptText" \
  -H "Jenkins-Crumb: $CRUMB" \
  --data-urlencode 'script=import jenkins.model.Jenkins; Jenkins.instance.setCrumbIssuer(null); Jenkins.instance.save()'

# Fix jobs directory ownership (Jenkins runs as root in docker-compose but the dir may be owned by jenkins)
docker exec -u root duckops-jenkins chown -R jenkins:jenkins /var/jenkins_home/jobs
```

**Note:** The `infra/jenkins/Dockerfile` bakes in all plugins and the CSRF-disable script so future `docker compose up --build` won't need these steps.

---

## What the Provisioning Pipeline Does Automatically

When you click "Create Project" in the UI, the provisioning service runs these stages automatically:

### Stage 1 — INITIALIZING
- Creates the project record in the database
- Emits initial status via Socket.io

### Stage 2 — SCAFFOLDING
- Generates project files from Handlebars templates:
  - `src/index.ts` — Express/Fastify app with `/health` endpoint
  - `package.json` — dependencies for chosen language/framework/ORM
  - `tsconfig.json`
  - `Dockerfile` — multi-stage Node build
  - `prisma/schema.prisma` (if Prisma ORM)
  - `k8s/deployment.yaml` — K8s deployment using `k3d-duckops-registry:5111/<name>:latest`
  - `k8s/service.yaml` — ClusterIP service + Traefik ingress for `<name>.localhost`
  - `Jenkinsfile` — pipeline for future CI/CD builds
- Output: `/tmp/duckops-projects/<name>/`

### Stage 3 — CREATING_REPO
- Calls GitHub API to create a **private repository** under the authenticated user
- Initialises a git repo locally, commits all scaffolded files
- Force-pushes to the new GitHub repo
- Saves `githubRepoUrl`, `githubRepoName`, `githubRepoFullName` to the database

### Stage 4 — PROVISIONING (Build)
- Runs `docker build -t localhost:5111/<name>:latest <scaffoldDir>`
  - Uses `localhost:5111` to push from the host machine
  - The K8s manifest references `k3d-duckops-registry:5111/<name>:latest` (resolves inside Docker network)
- Runs `docker push localhost:5111/<name>:latest`

### Stage 5 — PROVISIONING (Terraform)
- Runs `terraform init` → `workspace new/select <name>` → `plan` → `apply`
- Creates a Kubernetes **namespace** `project-<name>` with labels
- Creates a Kubernetes **ConfigMap** with `DATABASE_URL`, `PROJECT_NAME`, `NAMESPACE`
- Terraform binary: `/opt/homebrew/Cellar/terraform/1.5.7/bin/terraform` (macOS)
- Working directory: `infra/terraform/environments/local/`
- Uses `~/.kube/config` with context `k3d-duckops`

### Stage 6 — CONFIGURING (Ansible)
- Runs `ansible-playbook playbooks/deploy-app.yml`
- Tasks:
  1. Ensure K8s namespace exists
  2. `kubectl apply -f k8s/deployment.yaml` — deploys the image built in Stage 4
  3. `kubectl apply -f k8s/service.yaml` — creates ClusterIP service + Traefik ingress
  4. `kubectl rollout status` — waits up to 120s for pod to be Ready (non-fatal if it times out)
- Ansible binary: `/opt/homebrew/Cellar/ansible/13.4.0_1/libexec/bin/ansible-playbook` (macOS)
- Working directory: `infra/ansible/`
- Inventory: `inventory/local.yml` (connection: local)

### Stage 7 — PIPELINE_READY → DEPLOYING
- POSTs to `http://localhost:4003/api/pipelines` to create a Jenkins job
- Jenkins job XML uses `workflow-job` plugin (Pipeline)
- Job stages: Checkout → Install → Test → Build Docker → Push to Registry → Deploy to K8s
- Jenkins job visible at `http://localhost:8085/job/duckops-<name>`

### Stage 8 — RUNNING
- Project is live at `http://<name>.localhost:8080`
- Health service checks `/health` every 30 seconds
- Status only degrades if the app was previously healthy and then fails (not on fresh deploy)

---

## Infrastructure Components

### k3d (Kubernetes)
| Detail | Value |
|--------|-------|
| Cluster name | `duckops` |
| API server | `https://0.0.0.0:<random-port>` (changes on recreate) |
| Ingress port | `8080` → `80` inside cluster |
| Ingress controller | Traefik (built into k3s) |
| Registry name | `k3d-duckops-registry` |
| Registry port | `5111` (host) |
| Push URL (from host) | `localhost:5111/<image>` |
| Pull URL (from K8s pods) | `k3d-duckops-registry:5111/<image>` |

**Why two registry URLs?**
The hostname `k3d-duckops-registry` resolves inside the Docker network (where K8s nodes live) but not on the host machine. So the provisioning service pushes to `localhost:5111` and the K8s deployment manifest references `k3d-duckops-registry:5111`.

**`*.localhost` DNS:**
macOS automatically resolves `*.localhost` → `127.0.0.1`. No `/etc/hosts` edits needed. Each project gets `http://<name>.localhost:8080`.

### Terraform
| Detail | Value |
|--------|-------|
| Provider | `hashicorp/kubernetes ~> 2.35` |
| Config path | `~/.kube/config` |
| Context | `k3d-duckops` |
| Environment | `infra/terraform/environments/local/` |
| Resources created | `kubernetes_namespace`, `kubernetes_config_map` |
| Workspace per project | Yes — `terraform workspace new <projectName>` |

**If Terraform fails after cluster recreate:**
The old workspace still references resources in the deleted cluster. Clean up:
```bash
cd infra/terraform/environments/local
terraform workspace select <projectName>
terraform state rm kubernetes_config_map.project_config kubernetes_namespace.project
terraform workspace select default
terraform workspace delete <projectName>
```

### Ansible
| Detail | Value |
|--------|-------|
| Playbook | `infra/ansible/playbooks/deploy-app.yml` |
| Inventory | `infra/ansible/inventory/local.yml` |
| Connection | `local` (runs kubectl on the host) |
| Timeout for rollout | 120s (non-fatal — continues even if pod not ready) |

### Jenkins
| Detail | Value |
|--------|-------|
| URL | `http://localhost:8085` |
| Container | `duckops-jenkins` |
| Image | `infra/jenkins/Dockerfile` (custom — plugins pre-installed) |
| Plugins | `workflow-aggregator`, `git`, `github`, `pipeline-stage-view` + deps |
| CSRF | Disabled via `infra/jenkins/disable-csrf.groovy` init script |
| Auth | None (security disabled for local dev) |
| Jobs directory | `/var/jenkins_home/jobs/` |
| Data volume | `jenkinsdata` (Docker named volume) |

---

## Known Issues & Fixes Applied

### 1. Terraform `spawn /bin/sh ENOENT`
**Cause:** `process.cwd()` returned the wrong directory; binary symlinks not resolved; subprocess PATH missing Homebrew.
**Fix:**
- Use `path.resolve(__dirname, "../../../..")` for REPO_ROOT (not `process.cwd()`)
- Use full real path: `/opt/homebrew/Cellar/terraform/1.5.7/bin/terraform`
- Pass `subEnv` with PATH including `/opt/homebrew/bin` and HOME set

### 2. Terraform duplicate variable declarations
**Cause:** `variables.tf` and `outputs.tf` duplicated what was already in `main.tf`.
**Fix:** Deleted `variables.tf` and `outputs.tf` — everything lives in `main.tf`.

### 3. Jenkins `CannotResolveClassException: flow-definition`
**Cause:** Jenkins LTS ships with zero plugins. The `workflow-job` plugin (which handles `<flow-definition>`) wasn't installed.
**Fix:** Install `workflow-aggregator` (and deps) via Plugin Manager API, then restart Jenkins to load them. Baked into `infra/jenkins/Dockerfile`.

### 4. Jenkins 403 on `createItem` POST
**Cause:** Jenkins CSRF protection requires a crumb + session cookie pair. The crumb is fetched without a cookie, so it doesn't match on POST.
**Fix:** Disable CSRF entirely via Groovy script console (`Jenkins.instance.setCrumbIssuer(null)`). Persisted via `infra/jenkins/disable-csrf.groovy` init script run on every startup.

### 5. Jenkins jobs directory permission denied
**Cause:** `/var/jenkins_home/jobs/` owned by `jenkins` user but Docker runs as root; or vice versa. After restart the dir reverts.
**Fix:** `docker exec -u root duckops-jenkins chown -R jenkins:jenkins /var/jenkins_home/jobs` after each restart. Long-term fix: `infra/jenkins/Dockerfile` sets correct ownership.

### 6. `ImagePullBackOff` in Kubernetes
**Cause:** K8s deployment manifest references `k3d-duckops-registry:5111/<name>:latest` but the image was never built/pushed.
**Fix:** Added Stage 4 (Build) in `projectService.ts` — provisioning service now builds the Docker image and pushes to the registry before Ansible deploys.

### 7. Dockerfile `npm ci` fails — no lockfile
**Cause:** Scaffold generates `package.json` but not `package-lock.json`. `npm ci` requires a lockfile.
**Fix:** Changed `npm ci` → `npm install` in `Dockerfile.hbs` template.

### 8. Registry push fails from host — `no such host: k3d-duckops-registry`
**Cause:** `k3d-duckops-registry` hostname only resolves inside the Docker network, not on the macOS host.
**Fix:** `buildService.ts` pushes to `localhost:5111` (host-side) and tags the image as `k3d-duckops-registry:5111/<name>:latest` for K8s to pull.

### 9. Project stuck at `PIPELINE_READY`
**Cause:** `provisionProject()` set status to `PIPELINE_READY` and then stopped — it never called the pipeline service to create the Jenkins job.
**Fix:** Added Steps 7 & 8 in `projectService.ts`: POST to `localhost:4003/api/pipelines`, then set status to `RUNNING`.

### 10. Project immediately goes `DEGRADED` after provisioning
**Cause:** Health service checks `/health` every 30s. On the very first check after deploy the pod may not be ready yet → marks project `DEGRADED` immediately.
**Fix:** `healthCheckService.ts` only degrades a project if it has been `HEALTHY` at least once before. Fresh projects stay `RUNNING` until their first successful health check.

### 11. K8s API `connection refused` after machine restart
**Cause:** k3d cluster was deleted (or Docker Desktop restarted). Terraform state still references old cluster resources.
**Fix:**
```bash
# Recreate cluster
k3d cluster create duckops \
  --port "8080:80@loadbalancer" \
  --registry-use k3d-duckops-registry:5111

# Clean stale Terraform workspaces
cd infra/terraform/environments/local
terraform workspace select <name>
terraform state rm kubernetes_config_map.project_config kubernetes_namespace.project
terraform workspace select default
terraform workspace delete <name>
```

### 12. Git push "nothing to commit"
**Cause:** Scaffold reused an existing `/tmp/duckops-projects/<name>/` directory from a previous attempt. The `.git` dir was already there with everything committed.
**Fix:** `githubService.ts` deletes `.git` dir before re-initialising. Uses `--force` on push.

---

## Debugging Commands

```bash
# --- Kubernetes ---
kubectl get all -n project-<name>            # all resources in project namespace
kubectl get pods -n project-<name>           # pod status
kubectl describe pod <pod> -n project-<name> # full pod events (good for ImagePullBackOff)
kubectl logs <pod> -n project-<name>         # app logs
kubectl get ingress -A                       # all ingresses

# --- Registry ---
k3d registry list
curl http://localhost:5111/v2/_catalog        # list all images in registry
curl http://localhost:5111/v2/<name>/tags/list # tags for an image

# --- Terraform ---
cd infra/terraform/environments/local
terraform workspace list
terraform show                               # current state

# --- Jenkins ---
curl http://localhost:8085/api/json          # Jenkins status + job list
curl http://localhost:8085/pluginManager/api/json?depth=1 | python3 -m json.tool | grep shortName
docker logs duckops-jenkins 2>&1 | grep -E "WARNING|ERROR|Caused" | grep -v "at " | tail -20

# --- Health checks ---
# Check if a project's app is responding
curl http://<name>.localhost:8080/health

# Manually reset a project's status (if stuck)
docker exec duckops-postgres psql -U duckops -d duckops \
  -c "UPDATE \"Project\" SET status='RUNNING' WHERE name='<name>';"

# Clear bad health check history
docker exec duckops-postgres psql -U duckops -d duckops \
  -c "DELETE FROM \"HealthCheck\" WHERE \"projectId\"='<id>';"
```

---

## Environment Variables (Infra-Related)

These live in the root `.env` file:

```bash
# Kubernetes / Terraform — which environment to use
DUCKOPS_ENV=local          # "local" uses k3d; "cloud" would use a real cluster

# Override binary paths if your install location differs
TERRAFORM_BIN=/opt/homebrew/Cellar/terraform/1.5.7/bin/terraform
ANSIBLE_BIN=/opt/homebrew/Cellar/ansible/13.4.0_1/libexec/bin/ansible-playbook

# Docker registry
REGISTRY_URL=k3d-duckops-registry:5111      # used by K8s manifests
HOST_REGISTRY_URL=localhost:5111             # used by provisioning service to push

# Jenkins
JENKINS_URL=http://localhost:8085
JENKINS_USER=admin
JENKINS_TOKEN=                               # leave empty — CSRF is disabled for local dev
```
