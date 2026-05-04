# DuckOps — Infrastructure Reference

How the infrastructure works — both locally for development and in production on AWS. The platform runs on a single EC2 instance in Mumbai (`ap-south-1`) and uses AWS ECR for container images and Neon.tech for the database.

---

## Production Architecture

```
Internet
  │
  ├── app.raycode.tech ──────────────────────► Vercel (Next.js frontend)
  │
  ├── api.raycode.tech  ─────────────────────► EC2 13.204.92.146 (Elastic IP)
  └── *.raycode.tech    ─────────────────────► EC2 13.204.92.146 (Elastic IP)
                                                    │
                                               nginx :80/:443
                                               (SSL: wildcard *.raycode.tech)
                                                ├── api.raycode.tech → PM2 services
                                                └── *.raycode.tech   → K3s Traefik

                                               PM2 — DuckOps backends
                                                ├── catalog-service      :4001
                                                ├── provisioning-service :4002
                                                ├── pipeline-service     :4003
                                                ├── health-service       :4004
                                                └── ai-service           :4005

                                               Redis :6379 (BullMQ queue backend)
                                               Jenkins :8085 (shared CI/CD)
                                               Docker (builds project images)

                                               K3s (single-node Kubernetes)
                                                └── Traefik ingress (NodePort :30080)
                                                    └── ns: {github}-{project}
                                                        └── user deployed apps

                                               Monitoring (K3s namespace: monitoring)
                                                ├── Prometheus :30090
                                                └── Grafana    :30030

  External Services:
  ├── Neon.tech ─── PostgreSQL (serverless, off-EC2)
  ├── AWS ECR ────── Docker image registry (per-project repos)
  └── Ollama API ─── AI model (qwen3-coder:480b)
```

---

## AWS Infrastructure

### What Terraform provisions on AWS

Terraform is used to create the base AWS infrastructure — the server, networking, firewall rules, and container registry. This runs once from a developer's machine before the platform starts.

**EC2 Instance**
- Instance type: `t3.large` (2 vCPU, 8 GB RAM)
- AMI: Ubuntu 24.04 LTS (64-bit x86)
- Region: `ap-south-1` (Mumbai)
- Storage: 50 GB gp3 SSD
- Elastic IP: `13.204.92.146` (static — never changes on stop/start)
- Key pair: `duckops-ec2` (SSH access)

**Security Group inbound rules:**
| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Your IP | SSH access |
| 80 | TCP | 0.0.0.0/0 | HTTP (redirected to HTTPS by nginx) |
| 443 | TCP | 0.0.0.0/0 | HTTPS |
| 8085 | TCP | Your IP | Jenkins UI |

**ECR Repositories** — one per DuckOps service:
```
<account_id>.dkr.ecr.ap-south-1.amazonaws.com/
├── duckops/provisioning-service
├── duckops/pipeline-service
├── duckops/health-service
├── duckops/ai-service
└── duckops/catalog-service
```
Per-project ECR repos (`duckops/<github>-<project>`) are created automatically when a user creates a project.

### IAM Setup

IAM user: `duckops-admin`

Policies attached:
- `AmazonEC2FullAccess`
- `AmazonECRFullAccess`
- `AmazonVPCFullAccess`
- `IAMReadOnlyAccess`

Access keys are stored in `/opt/duckops/.env` on EC2 (used by services to create/delete ECR repos per project) and as GitHub Actions secrets (used by CI to push images).

---

## What Terraform Does at Runtime (Per Project)

In addition to provisioning AWS infrastructure, Terraform runs automatically during project creation to provision Kubernetes namespaces. The provisioning service calls Terraform programmatically for every new project.

**Files:**
- `infra/terraform/environments/cloud/main.tf` — used on EC2 (k3s cluster)
- `infra/terraform/environments/local/main.tf` — used locally (k3d cluster)

**What it creates per project:**
```hcl
# K8s namespace: e.g. "rayan-myapp"
resource "kubernetes_namespace" "project" {
  metadata {
    name = var.namespace
    labels = {
      "managed-by"   = "duckops"
      "project-name" = var.project_name
    }
  }
}

# ConfigMap: project env vars available to all pods in the namespace
resource "kubernetes_config_map" "project_config" {
  data = {
    PROJECT_NAME = var.project_name
    DATABASE_URL = var.database_url
    NAMESPACE    = var.namespace
  }
}
```

**Workspaces:** Each project gets its own Terraform workspace so state is isolated. `terraform destroy` for `rayan-myapp` only removes that project's namespace and configmap.

---

## EC2 Server — What's Installed

Installed via `infra/ansible/playbooks/setup-node.yml`:

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 22.x | Runtime for all backend services |
| pnpm | latest | Package manager |
| PM2 | latest | Process manager — keeps services running |
| Docker | latest | Builds Docker images for user projects |
| AWS CLI | v2 | ECR authentication, repo management |
| Redis | 7.x | BullMQ job queue backend |
| K3s | latest | Lightweight Kubernetes cluster |
| Jenkins | LTS | Shared CI/CD server |
| nginx | latest | Reverse proxy, SSL termination |
| Certbot | latest | Wildcard SSL cert management |
| Git | latest | Code operations |
| Swap | 2 GB | Prevents OOM kills on 8GB instance |

**RAM budget (t3.large = 8 GB):**
```
OS + system:            ~300 MB
nginx + Certbot:         ~50 MB
Redis:                  ~100 MB
PM2 backends (5 svcs):  ~600 MB
K3s + system pods:      ~800 MB
Jenkins:                ~512 MB
Available for pods:    ~5.6 GB  (fine for ~5 simultaneous user projects)
```

**Swap:** A 2 GB swapfile is configured with `vm.swappiness=10` — this means the OS only uses swap as a last resort, but it prevents OOM process kills under memory pressure.

---

## DNS Setup

At the domain registrar (Namecheap):

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| A | `@` | `13.204.92.146` | Root domain |
| A | `api` | `13.204.92.146` | Backend API |
| CNAME | `app` | `cname.vercel-dns.com` | Frontend on Vercel |
| A | `*` | `13.204.92.146` | Wildcard → user project apps |

The wildcard `*` record catches `myapp-rayan-duckops.raycode.tech` and routes it to EC2 where nginx passes it to K3s Traefik which routes it to the correct pod.

---

## nginx Configuration

nginx sits at the edge of EC2, receives all traffic, terminates SSL, and routes to the right backend.

**Routing:**
```nginx
# api.raycode.tech — DuckOps platform backends
server {
    listen 443 ssl;
    server_name api.raycode.tech;

    location /api/catalog         → localhost:4001
    location /api/projects        → localhost:4002
    location /api/auth            → localhost:4002
    location /api/pipelines       → localhost:4003  (SSE: proxy_buffering off)
    location /api/health          → localhost:4004
    location /api/ai              → localhost:4005  (SSE: proxy_buffering off)
    location /socket.io/          → localhost:4002  (WebSocket upgrade headers)
}

# *.raycode.tech — user-deployed apps via K3s Traefik
server {
    listen 443 ssl;
    server_name ~^.+-duckops\.raycode\.tech$;

    location / → localhost:30080  (K3s Traefik NodePort)
}

# HTTP → HTTPS redirect for everything
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

**Token redaction in logs:** A custom `log_format` replaces query strings (which may contain JWT tokens) with `[token_redacted]` in the nginx access log. JWT tokens are only accepted in the `Authorization: Bearer` header, never in URLs.

**SSL:** Wildcard cert `*.raycode.tech` covers all subdomains. Auto-renewed by Certbot every 90 days.

---

## K3s Kubernetes Cluster

K3s runs as a native Linux process on EC2 (not inside Docker — that's k3d, used locally).

**Namespaces:**
```
kube-system     — K3s internal components
monitoring      — Prometheus + Grafana
{github}-{project}   — one per user project, e.g. "rayan-myapp"
```

**User project namespace layout (`rayan-myapp`):**
```
Deployment: myapp         — runs the app container
Service: myapp            — ClusterIP, internal routing
Ingress: myapp            — routes myapp-rayan-duckops.raycode.tech to the service
ConfigMap: myapp-config   — project env vars (created by Terraform)
```

**Traefik:** Built into K3s. Reads Ingress resources and routes traffic automatically. No config changes needed when new projects are deployed.

**kubeconfig:** K3s writes its kubeconfig to `/etc/rancher/k3s/k3s.yaml`. Services that need to run kubectl (provisioning-service, health-service) read this file.

---

## Container Images + ECR

**Build pipeline:**
1. GitHub Actions or Jenkins runs `docker build -t <ecr-url>/<name>:<tag> .`
2. ECR login: `aws ecr get-login-password | docker login --username AWS --password-stdin <ecr-url>`
3. `docker push <ecr-url>/<name>:<tag>`
4. K3s pulls the image when the Deployment is created or updated

**Per-project repos** are created automatically by the provisioning service (via AWS SDK) when a user creates a project. Deleted when the project is deleted.

**Image tagging:**
- `:latest` — current build
- `:<build-number>` — versioned (used for rollback)

**ECR Credential Helper** (`docker-credential-ecr-login`) is installed on EC2 so Jenkins and K3s can pull images without manual `docker login` calls.

---

## Jenkins (Shared CI/CD)

Jenkins runs on EC2 at port 8085. One Jenkins instance serves all users.

| Detail | Value |
|--------|-------|
| URL | `http://13.204.92.146:8085` |
| Installed by | Ansible (`setup-node.yml`) |
| Plugins | workflow-aggregator, git, github, pipeline-stage-view |
| Data | `/var/lib/jenkins` (persistent on EC2 disk) |

**Per-project Jenkins job** (created automatically by DuckOps):
```
Checkout → Install → Test → docker build → docker push to ECR → kubectl set image
  └── POST /api/pipelines/deployments with X-Jenkins-Secret header (reports result back)
```

**Jenkins global env var `JENKINS_CALLBACK_SECRET`** — set automatically via Jenkins Script Console API. Used in the Jenkinsfile callback `curl` command to authenticate with the pipeline service.

**GitHub credentials** — stored automatically in Jenkins when a project is created. The user's GitHub token is stored as a `UsernamePasswordCredential` — no manual setup.

---

## BullMQ + Redis Queue

Redis runs on EC2 at port 6379. BullMQ uses it to queue long-running jobs.

**Queue: `provisioning-queue`**

Used for project creation (2-5 minute async workflow):

```
POST /api/projects
  → DB record created (status: INITIALIZING)
  → job enqueued { projectId, input }
  → 201 response returned immediately

Worker picks up job:
  → SCAFFOLDING: render templates to /tmp/duckops-projects/<name>/
  → CREATING_REPO: GitHub API creates repo, pushes code
  → PROVISIONING: docker build → push to ECR → Terraform namespace → Ansible deploy
  → PIPELINE_READY: create Jenkins job, trigger first build
  → RUNNING: project live at https://<name>-<github>-duckops.raycode.tech
  → Socket.io emits status updates after each stage
```

**Config:**
```typescript
{
  attempts: 3,
  backoff: { type: "exponential", delay: 30_000 },  // retry after 30s, 60s, 120s
  lockDuration: 600_000,   // 10 min — prevents timeout during Docker builds
  concurrency: 2,          // 2 projects can provision simultaneously
}
```

Redis configured with `maxmemory-policy noeviction` — never drops jobs to free memory.

---

## Monitoring

Prometheus and Grafana run inside K3s in the `monitoring` namespace.

| Service | Access |
|---------|--------|
| Grafana | `http://13.204.92.146:30030` (NodePort) |
| Prometheus | `http://13.204.92.146:30090` (NodePort) |

**Prometheus scrape targets:**
- `health-service:4004/metrics` — service + business metrics
- `kube-state-metrics` — K8s pod and container metrics

**Grafana dashboards** (provisioned via ConfigMaps, auto-loaded):
1. **Services** — request rates, latency per service, active connections
2. **Business KPIs** — total users, projects, deployments, AI prompts; breakdown by framework and deployment status
3. **Kubernetes** — pod status per namespace, restart counts, resource usage

**Business metrics exposed by health-service:**
- `duckops_projects_total` — gauge: total active projects
- `duckops_users_total` — gauge: total registered users
- `duckops_deployments_total` — gauge: total deployments
- `duckops_ai_prompts_total` — gauge: total AI generation sessions
- `duckops_projects_by_framework` — gauge per framework label
- `duckops_deployments_by_status` — gauge per status label

---

## Automated Provisioning Flow (When a User Creates a Project)

```
Stage 1: INITIALIZING
  - Project record created in Postgres (Neon.tech)
  - BullMQ job enqueued to Redis

Stage 2: SCAFFOLDING
  - Handlebars templates rendered to /tmp/duckops-projects/<name>/
    ├── index.ts (app entrypoint)
    ├── package.json, tsconfig.json
    ├── Dockerfile (multi-stage)
    ├── k8s/deployment.yaml, service.yaml, ingress.yaml
    └── Jenkinsfile

Stage 3: CREATING_REPO
  - GitHub API creates private repo under user's account
  - git init → commit all files → push to GitHub
  - Commit author: DuckOps AI <rayansjain29@gmail.com>
  - DB updated: githubRepoUrl, githubRepoFullName saved

Stage 4: PROVISIONING — Build
  - docker build -t <ecr-url>/<github>-<project>:latest <scaffoldDir>
  - aws ecr create-repository (creates ECR repo for this project)
  - docker push <ecr-url>/<github>-<project>:latest

Stage 5: PROVISIONING — Terraform
  - terraform workspace new/select <github>-<project>
  - terraform apply -var="namespace=<github>-<project>"
  - Creates K8s namespace + ConfigMap with DATABASE_URL and project vars

Stage 6: CONFIGURING — Ansible
  - ansible-playbook deploy-app.yml --extra-vars "@/tmp/<project>-vars.json"
  - Applies deployment.yaml, service.yaml, ingress.yaml via kubectl
  - kubectl rollout status waits up to 120s

Stage 7: PIPELINE_READY
  - Pipeline service creates Jenkins job via REST API
  - Jenkins stores GitHub credential (user's token)
  - Jenkins triggers initial build immediately

Stage 8: RUNNING
  - Project live at https://<project>-<github>-duckops.raycode.tech
  - Health cron begins checking /health every 30s
  - If aiPrompt was set, AI service fires it now
```

---

## Project Deletion

When a user deletes a project, everything is cleaned up:

```
1. kubectl delete namespace <github>-<project> --wait=false
   → deletes pods, services, ingress, configmaps for the project

2. Jenkins: POST /job/<github>-<project>/doDelete
   → removes the Jenkins job and all build history

3. AWS ECR: delete-repository --repository-name duckops/<github>-<project> --force
   → removes all Docker images for this project

4. Terraform: workspace select <name> → destroy
   → removes Terraform state for this project

5. DB cascade: Project → Pipeline, Deployments, HealthChecks, AiSessions all deleted
```

---

## Health Check Logic

- Runs every 30 seconds via node-cron in health-service
- For each project with status `RUNNING`:
  - Calls `kubectl exec deploy/<name> -n <namespace> -- wget -qO- http://localhost:<port>/health`
  - Records `HealthCheck` row: status, response time, HTTP code
  - Emits `project:<id>:health` Socket.io event
- Sets status to `DEGRADED` after **3 consecutive** failures (prevents false alarms from single slow responses)
- Recovers to `RUNNING` when health checks pass again

---

## GitHub Actions CI/CD (DuckOps Platform)

The platform itself deploys via GitHub Actions on every push to `main`:

```
push to main
  ├── lint-and-typecheck     — ESLint + tsc --noEmit
  ├── test                   — pnpm turbo run test --continue
  ├── validate-infra         — terraform validate + fmt-check; ansible-lint
  │
  └── (all pass) → deploy
      ├── deploy-backend     — rsync to EC2 → pnpm install → build → pm2 reload
      └── deploy-frontend    — vercel --prod
```

**GitHub Secrets required:**
| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |
| `AWS_REGION` | `ap-south-1` |
| `EC2_HOST` | `13.204.92.146` |
| `EC2_SSH_KEY` | Contents of `~/duckops-ec2.pem` |
| `VERCEL_TOKEN` | From Vercel dashboard |
| `VERCEL_ORG_ID` | From `vercel project ls` |
| `VERCEL_PROJECT_ID` | From `vercel project ls` |

---

## Local vs Production Comparison

| Aspect | Local | Production (EC2) |
|--------|-------|------------------|
| Database | Postgres in Docker | Neon.tech serverless Postgres |
| Container registry | k3d local registry `localhost:5111` | AWS ECR |
| Service runtime | Docker Compose | PM2 on EC2 |
| Kubernetes | k3d (Docker containers) | k3s (native Linux process) |
| Terraform target | k3d cluster | k3s cluster on EC2 |
| Frontend | `localhost:3000` | Vercel (`app.raycode.tech`) |
| API routing | nginx in Docker `:4000` | nginx on EC2 `:80/:443` |
| Namespace format | `project-<name>` | `<github>-<project>` |
| App URL | `<name>.localhost:8080` | `<project>-<github>-duckops.raycode.tech` |
| Jenkins | `localhost:8085` | `13.204.92.146:8085` |
| SSL | None (HTTP only) | Wildcard cert `*.raycode.tech` |
| Monitoring | Optional (no persistent dashboards) | Prometheus + Grafana in K3s |

---

## Routine Operations

**Check service status:**
```bash
pm2 status
```

**View logs:**
```bash
pm2 logs                                     # all services
pm2 logs duckops-provisioning --lines 100    # one service
```

**Restart a service:**
```bash
pm2 restart duckops-provisioning
pm2 restart all
```

**Deploy latest code:**
```bash
# Triggered automatically by GitHub Actions on push to main.
# Manual deploy: push to main, or re-run the workflow in GitHub Actions.
```

**Check K3s / user projects:**
```bash
kubectl get namespaces | grep -v kube       # shows user project namespaces
kubectl get pods -n rayan-myapp
kubectl logs -n rayan-myapp deploy/myapp --tail=50
```

**DB migrations (after schema changes):**
```bash
# Runs against Neon.tech from your Mac
DATABASE_URL="postgresql://..." \
  pnpm --filter @duckops/db exec prisma migrate deploy
```

**ECR login (if Jenkins can't pull images):**
```bash
aws ecr get-login-password --region ap-south-1 \
  | docker login --username AWS --password-stdin \
    <account_id>.dkr.ecr.ap-south-1.amazonaws.com
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| PM2 service errored | `pm2 logs duckops-<service> --lines 50` |
| Jenkins unreachable | `systemctl status jenkins` — check port 8085 in EC2 security group |
| OAuth callback fails | Verify GitHub OAuth app callback URL = `https://api.raycode.tech/api/auth/github/callback` |
| SSL cert expired | `sudo certbot renew && sudo systemctl reload nginx` |
| K3s pods not starting | `kubectl get pods -A` → `kubectl describe pod <name> -n <ns>` |
| DB connection error | Check Neon.tech dashboard, verify `DATABASE_URL` in `/opt/duckops/.env` |
| ECR push fails | Re-run ECR login command above |
| SSH refused | Check EC2 security group has port 22 open for your IP |
| Redis not responding | `systemctl status redis-server` → `systemctl restart redis-server` |
| Health checks failing | `kubectl exec -n <ns> deploy/<name> -- wget -qO- http://localhost:<port>/health` |
| Terraform stale state | `cd infra/terraform/environments/cloud && terraform workspace select <name> && terraform state rm kubernetes_config_map.project_config kubernetes_namespace.project && terraform workspace select default && terraform workspace delete <name>` |
| Jenkins 401 after token rotation | Update `JENKINS_TOKEN` in `/opt/duckops/.env` then `pm2 reload ecosystem.config.js --update-env` |
