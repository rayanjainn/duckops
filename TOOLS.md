# DuckOps — DevOps Tools Reference

Every tool used in this project, what it does, where it lives in the codebase, and exactly how it helps. Written in plain language — no assumed prior knowledge.

---

## Table of Contents

1. [pnpm](#1-pnpm)
2. [Turborepo](#2-turborepo)
3. [TypeScript](#3-typescript)
4. [Docker + BuildKit](#4-docker--buildkit)
5. [Colima](#5-colima)
6. [Docker Compose](#6-docker-compose)
7. [k3d (local Kubernetes)](#7-k3d-local-kubernetes)
8. [k3s (production Kubernetes on EC2)](#8-k3s-production-kubernetes-on-ec2)
9. [kubectl](#9-kubectl)
10. [Terraform](#10-terraform)
11. [Ansible](#11-ansible)
12. [Jenkins](#12-jenkins)
13. [Nginx](#13-nginx)
14. [AWS (EC2 + ECR + IAM)](#14-aws-ec2--ecr--iam)
15. [PostgreSQL + Prisma](#15-postgresql--prisma)
16. [Neon.tech (Cloud Database)](#16-neontech-cloud-database)
17. [Redis + BullMQ](#17-redis--bullmq)
18. [Socket.io](#18-socketio)
19. [Handlebars (hbs)](#19-handlebars-hbs)
20. [Traefik Ingress](#20-traefik-ingress)
21. [Winston](#21-winston)
22. [Zod](#22-zod)
23. [GitHub OAuth + API](#23-github-oauth--api)
24. [TanStack Query (React Query)](#24-tanstack-query-react-query)
25. [AI Service (Ollama)](#25-ai-service-ollama)
26. [node-cron](#26-node-cron)
27. [PM2](#27-pm2)
28. [Prometheus + Grafana](#28-prometheus--grafana)
29. [GitHub Actions CI/CD](#29-github-actions-cicd)
30. [Certbot + Let's Encrypt](#30-certbot--lets-encrypt)

---

## 1. pnpm

**What it is in plain English:** A faster, smarter version of npm (Node package manager). Instead of copying the same library into every project folder, it stores one copy on your disk and creates links — like shortcuts — saving gigabytes of space.

**Why we use it:** DuckOps is a monorepo — one big repo containing 5 apps (`provisioning-service`, `pipeline-service`, `health-service`, `ai-service`, `catalog-service`, and `web`) plus 3 shared packages. pnpm's "workspaces" feature lets all of these share their common dependencies (like Express, Zod, TypeScript) from a single install. Without this, you'd install 8 separate copies of React, Express, etc.

**Where it lives:**
- `pnpm-workspace.yaml` — tells pnpm which directories are part of the monorepo
- `pnpm-lock.yaml` — the exact locked versions of every dependency, checked into git so everyone gets the same packages
- Each `package.json` references internal packages with `"@duckops/db": "workspace:*"` — the `workspace:*` protocol means "use the local version, not one from npm"

**What it does for us:**
- `pnpm install` at the repo root installs everything for all 8 apps/packages in one shot
- `pnpm turbo build` builds the entire project
- Dockerfiles use pnpm's cache feature to skip re-downloading packages that haven't changed, making Docker builds much faster

---

## 2. Turborepo

**What it is in plain English:** A smart task runner for monorepos. It understands that `ai-service` depends on `shared-utils`, so it always builds `shared-utils` first. It also caches build results — if nothing changed in a package, it skips rebuilding it entirely and reuses the cached output.

**Why we use it:** With 8 packages, running builds naively would take forever and might fail if packages build in the wrong order. Turbo solves both problems automatically.

**Where it lives:**
- `turbo.json` — the pipeline config: which tasks depend on which others, and what output files to cache

**What it does for us:**
- Builds packages in the correct order (shared packages before the services that depend on them)
- Runs independent builds in parallel (e.g. `ai-service` and `catalog-service` build at the same time since they don't depend on each other)
- `pnpm turbo build --filter=health-service` builds only the health service and the packages it needs — nothing else
- Second build after no changes: completes in milliseconds because Turbo reuses cached output

---

## 3. TypeScript

**What it is in plain English:** JavaScript with types. You tell the compiler "this variable is a string" or "this function returns an object with these fields," and it warns you if you accidentally use it wrong — before you even run the code.

**Why we use it:** Without types, you could rename an API response field (e.g. `userId` → `user_id`) in the backend and the frontend would silently break at runtime. With TypeScript, it's a compile error — caught immediately.

**Where it lives:**
- Every `apps/*/tsconfig.json` and `packages/*/tsconfig.json`
- `packages/shared-types/src/index.ts` — defines shared data shapes (`Project`, `Pipeline`, `TemplateOption`, etc.) that both the frontend and all backends import

**What it does for us:**
- If you change a field name in the shared types package, TypeScript immediately highlights every place in every service that uses the old name
- Prisma (the database tool) generates TypeScript types from the schema automatically, so database queries are also type-checked
- The entire codebase compiles with zero type errors before deploying

---

## 4. Docker + BuildKit

**What it is in plain English:** Docker packages your app and everything it needs (the right version of Node.js, all npm packages, your compiled code) into a single portable box called a "container." That container runs identically everywhere — your laptop, the CI server, production.

**BuildKit** is Docker's newer, faster build engine. It can run build steps in parallel and has a "cache mount" feature that remembers downloaded packages between builds.

**Why we use it:** All 4 backend microservices are packaged as Docker images so we can push them to AWS ECR (a registry) and have K3s on EC2 pull and run them.

**Where it lives:**
- `apps/*/Dockerfile` — one per service. Each uses a two-stage build:
  - Stage 1 (builder): installs all dependencies including dev tools, compiles TypeScript → JavaScript
  - Stage 2 (runtime): only copies the compiled JS and production dependencies — no TypeScript compiler or dev tools in the final image (smaller and safer)

**Key pattern in every Dockerfile:**
```dockerfile
# syntax=docker/dockerfile:1.7

# Stage 1: compile TypeScript
FROM node:22-alpine AS builder
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=<service>

# Stage 2: lean production image
FROM node:22-alpine AS runtime
RUN addgroup -S duckops && adduser -S duckops -G duckops
USER duckops   # non-root for security
COPY --from=builder /app/dist ./dist
```

**What it does for us:**
- Production images are small (no dev tools, no source maps) and run as a non-root user
- The `--mount=type=cache` line means `pnpm install` during Docker builds only downloads packages that changed since last time — rebuilds are fast
- ECR stores versioned images: `:latest` for the current build, `:<build-number>` for rollback

---

## 5. Colima

**What it is in plain English:** Docker normally requires Docker Desktop on Mac, which is a heavy GUI app. Colima is a lightweight alternative — it runs Docker inside a small Linux VM with exactly the resources you specify (CPU, RAM, disk).

**Why we use it:** Running k3d (local Kubernetes) + Jenkins + 4 microservices + Postgres + Redis simultaneously needs significant RAM. Colima lets you allocate, say, 10 GB RAM and 6 CPUs to Docker — something Docker Desktop doesn't do easily.

**Where it lives:**
- `scripts/colima-start.sh` — starts Colima with the right settings

**What it does for us:**
- Prevents out-of-memory kills during parallel Docker builds (which are very RAM-hungry)
- `--vm-type vz --vz-rosetta` uses Apple's fast virtualization on M1/M2/M3 Macs
- Only needed for local development — production uses EC2 (a real Linux machine, no VM needed)

---

## 6. Docker Compose

**What it is in plain English:** A tool that lets you describe all the containers your application needs in one YAML file and start them all with one command. Instead of running 8 `docker run` commands with lots of flags, you run `docker compose up`.

**Why we use it:** Local development needs Postgres, Redis, Jenkins, 4 microservices, and Nginx — all talking to each other. Compose manages their networking, environment variables, disk volumes, and startup order.

**Where it lives:**
- `docker-compose.yml` — root of the repo

**Key design decisions:**
- Services with `depends_on: postgres: condition: service_healthy` don't start until Postgres passes its health check — no more "can't connect to database" crashes on startup
- The `k3d-duckops` network is declared `external: true` — it must exist before Compose starts (created by the setup script), so services can talk to the local Kubernetes cluster
- `provisioning-service` mounts `/var/run/docker.sock` so it can run Docker builds for scaffolded projects
- `develop.watch` enables hot-reload: changes to source files auto-rebuild inside the container

---

## 7. k3d (local Kubernetes)

**What it is in plain English:** Kubernetes is the system that runs and manages containerized apps in production. k3d is a tool that runs a full Kubernetes cluster inside Docker containers on your laptop. "k3s in Docker" — hence k3d. You get a real cluster locally without needing a cloud account.

**Why we use it:** DuckOps deploys every scaffolded project to Kubernetes. k3d gives developers a local cluster that behaves exactly like the production K3s cluster on EC2, so the same code works in both environments.

**Where it lives:**
- `scripts/setup-local.sh` — creates the cluster and a local container registry
- `infra/terraform/environments/local/main.tf` — Terraform provisions namespaces inside this cluster
- `infra/ansible/playbooks/deploy-app.yml` — Ansible applies deployment manifests to this cluster

**Cluster layout:**
```
k3d-duckops (local cluster)
├── server-0      — the "control plane" (the brain that manages everything)
├── agent-0       — worker node 1
├── agent-1       — worker node 2
└── k3d-duckops-registry:5111  — local Docker image registry
    (images pushed here are immediately available to the cluster)
```

**What it does for us:**
- Every scaffolded project gets its own Kubernetes namespace (`project-<name>`)
- Apps are accessible at `http://<name>.localhost:8080` via Traefik (the built-in ingress)
- Deleted when done: the whole local setup tears down cleanly with `k3d cluster delete duckops`

---

## 8. k3s (production Kubernetes on EC2)

**What it is in plain English:** k3s is a lightweight version of Kubernetes designed to run on a single server (rather than the usual 3+ server cluster). It has the same capabilities as full Kubernetes but uses much less RAM (~512MB vs ~2GB), making it practical on a single EC2 instance.

**Why we use it:** Production needs real Kubernetes — pods, namespaces, rolling deployments, ingress. k3s gives all of that on a single t3.large EC2 instance without the cost of a managed cluster (EKS on AWS would cost ~$70/month just for the control plane).

**Where it lives:**
- Installed on EC2 via `infra/ansible/playbooks/setup-node.yml`
- Config at `/etc/rancher/k3s/k3s.yaml` on EC2 (the kubeconfig)
- All kubectl commands from the provisioning and health services run against this cluster

**How it differs from k3d (local):**

| | k3d (local) | k3s (production EC2) |
|---|---|---|
| Runs inside | Docker containers | Native Linux processes |
| Registry | Local `k3d-duckops-registry:5111` | AWS ECR |
| Namespace format | `project-<name>` | `<github>-<project>` |
| Ingress domain | `<name>.localhost:8080` | `<project>-<github>-duckops.raycode.tech` |
| RAM usage | ~300MB (in Docker) | ~512MB (native) |

**What it does for us:**
- Each user's project runs in its own namespace (e.g. `rayan-myapp`) — isolation and easy cleanup
- Rolling deployments: when Jenkins pushes a new image, k3s replaces pods one-by-one with zero downtime
- `kubectl delete namespace rayan-myapp` tears down everything (pods, services, ingress) for that project

---

## 9. kubectl

**What it is in plain English:** The command-line tool for talking to a Kubernetes cluster. Like a remote control for Kubernetes — you tell it "create this deployment," "show me running pods," "delete this namespace," and it talks to the cluster's API to make it happen.

**Why we use it:** DuckOps programmatically creates and deletes Kubernetes resources for every project. kubectl is the standard way to do this from code.

**Where it lives:**
- Used in `apps/provisioning-service/src/services/projectService.ts` — `kubectl delete namespace` when deleting a project
- Used in `apps/health-service/src/routes/health.ts` — `kubectl exec` to run health checks from inside pods
- `infra/jenkins/Dockerfile` — kubectl installed into the Jenkins image so Jenkins pipelines can do `kubectl set image` for deployments

**What it does for us:**
- `kubectl delete namespace <name> --wait=false` — instantly removes a project's entire K8s footprint
- `kubectl rollout status deploy/<name>` — waits until a new deployment is fully up before marking the project as RUNNING
- `kubectl set image deploy/<name> app=<ecr-url>:<tag>` — live update to a new container image (rolling deploy, zero downtime)

---

## 10. Terraform

**What it is in plain English:** Terraform is an Infrastructure-as-Code (IaC) tool. Instead of clicking buttons in a cloud console or running commands manually to create servers, databases, and networking — you write a file that describes what you want, and Terraform creates it. More importantly, Terraform remembers what it created (in a "state file") so it can update or delete it later correctly.

**Why we use it — the IaC principle:** The core idea of IaC is: infrastructure should be defined in code, checked into git, and repeatable. If the server dies, you don't spend hours re-clicking the console — you run `terraform apply` and everything is recreated exactly as before. If two people set up the environment, they get identical results.

**Two ways Terraform is used in DuckOps:**

### Terraform for AWS infrastructure (one-time setup)

Before the platform runs, someone must provision the EC2 instance, the ECR repositories, security groups, and an Elastic IP. This is what Terraform is *classically* for — **creating the actual cloud infrastructure on AWS**. Terraform talks directly to the AWS API using an IAM access key.

What Terraform provisions on AWS:
- **EC2 instance** (`t3.large`, Ubuntu 24.04, ap-south-1, 50GB gp3 SSD)
- **Elastic IP** — a static IP address that stays the same even if the EC2 is stopped/restarted
- **Security group** — the firewall rules: open port 22 (SSH), 80 (HTTP), 443 (HTTPS), 8085 (Jenkins)
- **ECR repositories** — one per microservice (`duckops/provisioning-service`, `duckops/pipeline-service`, etc.) where Docker images are stored
- **Key pair** — the SSH key for accessing EC2

Terraform uses the AWS provider (`hashicorp/aws`), which calls the AWS API to create all of this. You run it once from your laptop, it creates everything, and the EC2 instance is ready.

### Terraform for per-project Kubernetes namespaces (runtime, per project)

When a user creates a project in DuckOps, the provisioning service runs Terraform programmatically to create a Kubernetes namespace + ConfigMap for that project. This uses the Kubernetes provider (`hashicorp/kubernetes`) to talk to the k3s cluster on EC2.

```hcl
# infra/terraform/environments/cloud/main.tf
resource "kubernetes_namespace" "project" {
  metadata {
    name = var.namespace              # e.g. "rayan-myapp"
    labels = {
      "managed-by"   = "duckops"
      "project-name" = var.project_name
    }
  }
}

resource "kubernetes_config_map" "project_config" {
  # Stores the project's env vars (DATABASE_URL, etc.) in K8s
  data = {
    PROJECT_NAME = var.project_name
    DATABASE_URL = var.database_url
    NAMESPACE    = var.namespace
  }
}
```

**Why use Terraform here instead of just `kubectl`?** Because Terraform tracks state. If you run `terraform apply` twice, the second run is a no-op (namespace already exists). When a project is deleted, `terraform destroy` removes exactly what was created — no manual cleanup needed.

**Workspaces — one per project:** Terraform workspaces isolate state between projects. Project `rayan-myapp` has its own workspace with its own state file. Deleting that workspace deletes only that project's Terraform state — it doesn't touch `rayan-blogapi` or any other project.

```
terraform workspace new rayan-myapp        # create isolated state
terraform apply -var="project_name=myapp" # provision for this project
terraform workspace select rayan-blogapi  # switch to another project's state
```

**Where it lives:**
- `infra/terraform/environments/local/main.tf` — used locally (k3d cluster)
- `infra/terraform/environments/cloud/main.tf` — used on EC2 (k3s cluster)
- `infra/terraform/modules/k8s-namespace/main.tf` — reusable module
- `apps/provisioning-service/src/services/terraformService.ts` — calls Terraform programmatically

---

## 11. Ansible

**What it is in plain English:** Ansible is an automation tool that connects to servers via SSH and runs tasks on them. You write a "playbook" — a YAML file listing what you want done ("install Docker," "create a swap file," "start a service") — and Ansible runs those steps on as many servers as needed. No special software needs to be installed on the servers — just SSH access.

**Why we use it:** DuckOps uses Ansible for two things:

1. **EC2 server setup** (`setup-node.yml`) — runs once when the EC2 instance is first launched to install Docker, K3s, Node.js 22, create swap space, and configure the system. Instead of SSHing in and running 40 commands manually, one `ansible-playbook` command does it all, reproducibly.

2. **Deploying application K8s manifests** (`deploy-app.yml`) — after Terraform creates the namespace, Ansible applies the `deployment.yaml`, `service.yaml`, and `ingress.yaml` for each user's project.

**The separation of concerns:**
- **Terraform** = declares what infrastructure resources should exist (namespace, configmap)
- **Ansible** = runs commands and applies application-level manifests (the actual app deployment)

**Where it lives:**
- `infra/ansible/playbooks/setup-node.yml` — EC2 one-time setup
- `infra/ansible/playbooks/deploy-app.yml` — per-project app deployment
- `infra/ansible/inventory/local.yml` — inventory file (tells Ansible which servers to connect to)
- `apps/provisioning-service/src/services/ansibleService.ts` — runs ansible-playbook programmatically from Node.js

**What the EC2 setup playbook does (simplified):**
```yaml
# install Docker
- name: Download Docker install script
  get_url: url=https://get.docker.com dest=/tmp/get-docker.sh
- name: Run Docker install
  command: /tmp/get-docker.sh

# install K3s
- name: Download K3s install script
  get_url: url=https://get.k3s.io dest=/tmp/get-k3s.sh
- name: Install K3s
  command: /tmp/get-k3s.sh --write-kubeconfig-mode 644

# create 2GB swap file (prevents OOM crashes on t3.large)
- name: Create swap file
  command: fallocate -l 2G /swapfile
- name: Enable swap
  command: swapon /swapfile
- name: Set swappiness to 10
  command: sysctl -w vm.swappiness=10
```

**Security note:** Sensitive values (database URLs, project names) are passed to Ansible via a temporary JSON file using `@<file>` syntax, not inline in the command. This prevents them from appearing in process lists or logs.

---

## 12. Jenkins

**What it is in plain English:** Jenkins is a CI/CD (Continuous Integration / Continuous Deployment) automation server. It watches your GitHub repo, and whenever you push new code, it automatically runs your tests, builds a Docker image, and deploys it. It's the thing that turns "git push" into "app updated in production."

**Why we use it:** Every project scaffolded by DuckOps gets its own Jenkins job with a Jenkinsfile (a script that defines the pipeline stages). Jenkins is shared — one Jenkins instance serves all users and all their projects.

**Where it lives:**
- `infra/jenkins/Dockerfile` — custom Jenkins image with Docker CLI, kubectl, and Node.js 22 pre-installed
- `apps/provisioning-service/src/templates/devops/Jenkinsfile.hbs` — the Jenkinsfile template injected into every scaffolded project
- `apps/pipeline-service/src/services/jenkinsService.ts` — creates/deletes/monitors Jenkins jobs via the Jenkins REST API

**Pipeline stages for every scaffolded project:**
```
Checkout → Install Dependencies → Run Tests → Build Docker Image → Push to ECR → Deploy to K3s
```

**How it works end-to-end:**
1. User pushes code to their GitHub repo
2. Jenkins polls GitHub every minute, detects new commits
3. Jenkins runs the Jenkinsfile:
   - `git checkout` — get the latest code
   - `npm install && npm test` — run tests
   - `docker build -t <ecr-url>/<project>:<build-number> .` — build Docker image
   - `docker push <ecr-url>/<project>:<build-number>` — push to ECR
   - `kubectl set image deploy/<project> app=<ecr-url>/<project>:<build-number>` — update K3s deployment
4. Jenkins POSTs the result back to DuckOps via `curl /api/pipelines/deployments` with `X-Jenkins-Secret` header for authentication
5. DuckOps updates the project status and shows the build result in the UI

**Credential management:** When DuckOps creates a Jenkins job, it automatically stores the user's GitHub token as a Jenkins `UsernamePasswordCredential` via the Jenkins credentials API — no manual credential setup needed.

---

## 13. Nginx

**What it is in plain English:** Nginx (pronounced "engine-x") is a web server and reverse proxy. A reverse proxy sits in front of your actual services — it receives all incoming requests and forwards them to the right backend based on the URL. It's the traffic director.

**Why we use it:** DuckOps has 5 backend services on 5 different ports (4001-4005). The outside world should only know one URL (`api.raycode.tech`). Nginx routes each request to the right service based on the URL path.

**Where it lives:**
- `infra/nginx/duckops.conf` — the nginx config on EC2 (also used in Docker Compose locally)
- Runs on EC2 as a system service, listening on ports 80 and 443

**Routing rules:**
```
https://api.raycode.tech/api/catalog/…     → catalog-service   :4001
https://api.raycode.tech/api/projects/…    → provisioning-service :4002
https://api.raycode.tech/api/auth/…        → provisioning-service :4002
https://api.raycode.tech/api/pipelines/…   → pipeline-service  :4003 (SSE: buffering off)
https://api.raycode.tech/api/health/…      → health-service    :4004
https://api.raycode.tech/api/ai/…          → ai-service        :4005 (SSE: buffering off)
https://api.raycode.tech/socket.io/…       → provisioning-service :4002 (WebSocket upgrade)

https://*.raycode.tech (wildcard)          → K3s Traefik :30080
  → e.g. myapp-rayan-duckops.raycode.tech → user's deployed app
```

**Special config for SSE (Server-Sent Events):**
The AI service and pipeline service stream real-time data. Nginx is configured with `proxy_buffering off` and `proxy_read_timeout 300s` for these routes — without this, Nginx would buffer the stream and the frontend would only receive data in chunks, breaking the live-streaming experience.

**Token redaction in logs:** Nginx is configured with a custom log format that replaces query string parameters (which might contain JWT tokens) with `[token_redacted]` in the access logs — preventing tokens from leaking into log files.

---

## 14. AWS (EC2 + ECR + IAM)

**What it is in plain English:** AWS (Amazon Web Services) is the cloud platform. DuckOps uses three AWS services:

- **EC2** (Elastic Compute Cloud): A virtual server (Linux VM) running in AWS's Mumbai data center. This is where all the backend services, Kubernetes, Jenkins, and Redis run.
- **ECR** (Elastic Container Registry): AWS's private Docker image registry. Like Docker Hub, but private and integrated with AWS authentication. Docker images built by Jenkins are pushed here and pulled by K3s.
- **IAM** (Identity and Access Management): AWS's permission system. You create users and roles with specific permissions (e.g. "can push/pull from ECR, can't touch billing") and use their access keys to authenticate programmatically.

### EC2 — The Server

**Instance:** `t3.large` — 2 vCPU, 8 GB RAM
**Region:** `ap-south-1` (Mumbai) — closest to the expected user base
**OS:** Ubuntu 24.04 LTS
**Storage:** 50 GB gp3 SSD
**IP:** `13.204.92.146` (Elastic IP — static, never changes)
**Domain:** `raycode.tech`

**What runs on it:**
```
EC2 t3.large
├── nginx            — traffic routing, SSL termination
├── PM2              — keeps all 5 Node.js services running
│   ├── catalog-service      :4001
│   ├── provisioning-service :4002
│   ├── pipeline-service     :4003
│   ├── health-service       :4004
│   └── ai-service           :4005
├── Redis            — BullMQ job queue backend
├── K3s              — Kubernetes for user-deployed projects
├── Jenkins          — CI/CD for all user projects     :8085
└── Docker           — builds images for projects
```

**RAM budget:**
```
OS + system:          ~300 MB
Nginx:                ~50 MB
Redis:                ~100 MB
PM2 (5 services):     ~600 MB
K3s + system pods:    ~800 MB
Jenkins:              ~512 MB
User project pods:    ~5.6 GB available (fine for ~5 simultaneous projects)
```

**Why Elastic IP matters:** When you stop and restart an EC2 instance, AWS normally gives it a new IP. An Elastic IP is a reserved static IP that stays permanently attached to your instance — so DNS records, SSL certs, and clients always find the server at the same address.

### ECR — Docker Image Registry

**What it stores:** Docker images for all DuckOps microservices and all user-scaffolded projects.

**Repository structure:**
```
<aws_account_id>.dkr.ecr.ap-south-1.amazonaws.com/
├── duckops/provisioning-service    ← DuckOps platform services
├── duckops/pipeline-service
├── duckops/health-service
├── duckops/ai-service
├── duckops/catalog-service
└── duckops/<github>-<project>      ← one repo per user project, created automatically
```

**How it's used:**
1. GitHub Actions CI builds Docker images and pushes them to ECR
2. Jenkins (on EC2) builds images for user projects and pushes to ECR
3. K3s pulls images from ECR when deploying pods

**Authentication:** ECR uses AWS credentials. Before pushing/pulling, you must log in:
```bash
aws ecr get-login-password --region ap-south-1 \
  | docker login --username AWS --password-stdin \
    <account_id>.dkr.ecr.ap-south-1.amazonaws.com
```
The ECR Credential Helper (`docker-credential-ecr-login`) automates this so Jenkins and K3s can pull images without manual login.

### IAM — Permissions

**IAM user created:** `duckops-admin`

**Policies attached:**
- `AmazonEC2FullAccess` — create/manage EC2 instances
- `AmazonECRFullAccess` — create repos, push/pull images
- `AmazonVPCFullAccess` — manage networking (security groups, VPC)
- `IAMReadOnlyAccess` — read permission info (needed by some tools)

**Access keys** (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`) are stored in:
- `/opt/duckops/.env` on EC2 — used by services at runtime (for ECR image creation/deletion)
- GitHub Actions secrets — used by CI to push images to ECR

**Why not use the root account?** The root account has unlimited access to everything — billing, account settings, other users. If those credentials leaked, the entire AWS account would be compromised. IAM lets you create a user with only the permissions it needs (principle of least privilege).

---

## 15. PostgreSQL + Prisma

**What it is in plain English:** PostgreSQL is the relational database — where all project data is stored permanently. Tables, rows, SQL. Prisma is the layer between Node.js and Postgres that makes database queries type-safe and easy to write.

**Why we use it:** All project metadata (name, status, GitHub URL, deployment history, health checks, AI sessions) needs to be stored durably. Postgres is the industry standard for reliable, transactional data storage.

**Prisma — what it adds:**
- You define your database schema in `schema.prisma` (a clear, readable format)
- Prisma generates TypeScript code from the schema — so `prisma.project.findMany()` returns a fully typed array of Project objects
- Schema changes create "migrations" — SQL files that alter the database structure in a controlled, versioned way
- `prisma.project.findMany()` is impossible to get wrong — TypeScript knows the exact shape of the result

**Where it lives:**
- `packages/db/prisma/schema.prisma` — single source of truth for the entire database schema
- `packages/db/prisma/migrations/` — versioned SQL migration files
- `packages/db/prisma/seed.ts` — seeds the `TemplateOption` table (languages, frameworks, databases)
- Every service imports `{ prisma }` from `@duckops/db`

**Schema overview:**
```
User → Project (one user can have many projects)
  Project → Pipeline (one pipeline per project)
  Project → Deployment (many deployments over time)
  Project → HealthCheck (many health check results)
  Project → AiSession (many AI code generation sessions)
TemplateOption (standalone — seeded data for the project wizard)
ServiceMetric (Prometheus-style metrics, stored for Grafana dashboards)
```

**In production:** The database is hosted on Neon.tech (see below), not on EC2. Prisma uses the same code — only the `DATABASE_URL` environment variable changes.

---

## 16. Neon.tech (Cloud Database)

**What it is in plain English:** Neon is a serverless Postgres hosting service. You get a real Postgres database on Neon's infrastructure without managing a server. "Serverless" means it scales to zero when idle (no compute cost when nobody's using it) and instantly wakes up when a request comes in.

**Why we use it instead of running Postgres on EC2:**
- **Cost:** Free tier gives 512MB storage, enough for the current user base. Running Postgres on EC2 would require either a larger instance or a separate RDS instance (adds ~$15-50/month)
- **Reliability:** Neon handles backups, updates, and failover — things that are a lot of work to manage manually
- **Decoupling:** If the EC2 instance needs to be terminated (cost saving, maintenance), the database is untouched. Data is safe even if EC2 is gone
- **Same code:** It's just Postgres. The only change is the `DATABASE_URL` — no code changes needed

**How it's connected:**
```env
DATABASE_URL=postgresql://neondb_owner:PASS@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

The `sslmode=require` forces encrypted connections — data between EC2 and Neon is always encrypted in transit.

---

## 17. Redis + BullMQ

**What it is in plain English:** Redis is an extremely fast in-memory database — it stores data in RAM, not on disk, so reads/writes happen in microseconds. BullMQ is a job queue library built on top of Redis — it lets you put "work items" in a queue and have workers process them, even if the main service is busy or restarts.

**Why we use it:** Provisioning a project takes 2-5 minutes (Docker build, Terraform, Ansible, Jenkins). If we ran this inside the HTTP request, the browser would have to wait 5 minutes for a response — and if it timed out, the work would be lost. Instead:

1. HTTP request arrives → create a DB record → put a job in the Redis queue → return `{ projectId }` immediately (response in ~50ms)
2. BullMQ worker picks up the job and does the actual work asynchronously
3. Progress is streamed to the browser via Socket.io as each stage completes

**If the server restarts mid-provision:** The job is still in Redis. The worker picks it up and continues from where it failed.

**Where it lives:**
- Redis runs on EC2 as a system service (port 6379)
- `apps/provisioning-service/src/queues/provisioningQueue.ts` — queue + worker for project provisioning
- Queue config:
  ```typescript
  {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },  // retry after 30s, 60s, 120s
    lockDuration: 600_000,   // 10 min — prevents timeout during Docker builds
    concurrency: 2,          // 2 projects can provision simultaneously
  }
  ```
- Redis configured with `maxmemory-policy: noeviction` — Redis will never silently drop a job to free memory

---

## 18. Socket.io

**What it is in plain English:** Socket.io enables real-time two-way communication between the browser and the server. Unlike regular HTTP (where the browser always has to ask first), Socket.io lets the server push data to the browser at any time. Under the hood it uses WebSockets (a persistent connection) with fallback to HTTP polling.

**Why we use it:** Provisioning takes minutes. Without Socket.io, you'd have to keep refreshing the page to see if "Scaffolding" became "Creating GitHub repo" became "Running." With Socket.io, each stage update appears in the browser the instant it happens.

**Where it lives:**
- Server: `apps/provisioning-service/src/index.ts` — Socket.io attached to the Express server
- Events emitted: `io.emit(`project:${projectId}`, { status, message, subStep })`
- Client: `apps/web/src/lib/socket.ts` — singleton connection
- Client: `apps/web/src/hooks/useRealTimeStatus.ts` — React hook that subscribes to `project:<id>` events

**Events used:**
- `project:<id>` — provisioning stage updates (SCAFFOLDING, CREATING_REPO, PROVISIONING, RUNNING, FAILED)
- `project:<id>:health` — live health check results every 30 seconds

---

## 19. Handlebars (hbs)

**What it is in plain English:** Handlebars is a templating language. It takes a template file with placeholders like `{{projectName}}` and a data object, and produces a filled-in file. Like mail-merge, but for code files.

**Why we use it:** DuckOps generates a different Dockerfile, Jenkinsfile, and K8s manifests for every combination of language + framework + database. Instead of hardcoding a separate file for each combination (that's hundreds of files), one template covers all variants:

```handlebars
{{!-- Dockerfile.hbs --}}
FROM node:22-alpine AS builder
{{#if (eq language "typescript")}}
RUN npm run build
{{else}}
RUN echo "No build step needed"
{{/if}}
{{#if (eq database "postgresql")}}
ENV DATABASE_URL={{databaseUrl}}
{{/if}}
```

**Where it lives:**
- `apps/provisioning-service/src/templates/devops/` — all `.hbs` files:
  - `Dockerfile.hbs` — base Dockerfile template
  - `Jenkinsfile.hbs` — CI/CD pipeline for the user's project
  - `deployment.yaml.hbs`, `service.yaml.hbs`, `ingress.yaml.hbs` — K8s manifests
- `apps/provisioning-service/src/services/scaffoldService.ts` — renders templates with the project's data

---

## 20. Traefik Ingress

**What it is in plain English:** Traefik is a smart reverse proxy that sits inside the Kubernetes cluster. When you create a Kubernetes `Ingress` resource saying "requests for `myapp-rayan-duckops.raycode.tech` should go to pod `myapp`," Traefik reads that configuration and starts routing traffic automatically. No restart or manual config changes needed.

**Why we use it:** k3s ships with Traefik built in. Every deployed project needs a public URL. Traefik handles this automatically from the Ingress manifests that Ansible applies during deployment.

**How the routing chain works:**
```
Browser → DNS → EC2 Elastic IP → Nginx (port 443)
  → wildcard match (*.raycode.tech)
  → Traefik (K3s NodePort :30080)
  → routes to the right pod based on hostname
```

**Where it lives:**
- K8s Ingress manifests generated from `apps/provisioning-service/src/templates/devops/ingress.yaml.hbs`
- k3d cluster created with `--port "8080:80@loadbalancer"` (local) / K3s NodePort 30080 (production)

---

## 21. Winston

**What it is in plain English:** Winston is a structured logging library for Node.js. "Structured" means logs are written as JSON with consistent fields (timestamp, level, service name, message) rather than plain free-form text. This makes logs machine-readable and easy to filter.

**Why we use it:** 5 services logging in different formats is impossible to read. Winston gives every service the same consistent format. When something breaks, you can `pm2 logs | grep "ERROR"` and see all errors across all services in one place.

**Where it lives:**
- `packages/shared-utils/src/index.ts` — `createLogger(serviceName)` factory
- Every service: `const logger = createLogger("provisioning-service")`

**Usage:**
```typescript
logger.info("Project created", { projectId, userId });
logger.warn("Jenkins build failed", { jobName, buildNumber });
logger.error("Provisioning failed", { error: err.message, projectId });
```

---

## 22. Zod

**What it is in plain English:** Zod validates the data coming into your API. When a user calls `POST /api/projects` with a request body, you can't trust that it contains the right fields in the right format. Zod lets you define exactly what the body must look like and rejects bad requests automatically.

**Why we use it:** Without validation, a missing `displayName` field or a `language` field set to an unsupported value propagates into your database and causes confusing errors. Zod catches bad input at the API boundary and returns clear error messages like "language must be one of: typescript, javascript, python."

**Where it lives:**
- Every route file defines a schema: `const createProjectSchema = z.object({ name: z.string().min(1), language: z.enum(["typescript", "javascript"]) })`
- `apps/*/src/middleware/validate.ts` — Express middleware that calls `schema.parse(req.body)` and returns a 400 error with field-level messages if validation fails

**What it does for us:**
- TypeScript type of the request body is inferred directly from the Zod schema — no manual interface needed
- Impossible to get a project with a missing required field into the database

---

## 23. GitHub OAuth + API

**What it is in plain English:** GitHub OAuth is "Login with GitHub." Instead of a username/password, users click "Login with GitHub," GitHub verifies their identity and sends DuckOps an access token. DuckOps uses that token to make API calls on the user's behalf — creating repos, pushing code.

**Why we use it:** DuckOps needs to create GitHub repos for users. Using OAuth means users authorize DuckOps with their GitHub account and DuckOps gets a token that allows it to create private repos under their account. No storing passwords.

**Where it lives:**
- `apps/provisioning-service/src/services/authService.ts` — OAuth flow
- `apps/provisioning-service/src/services/githubService.ts` — repo creation + code push

**Security details:**
- GitHub tokens are stored in the session JWT (cryptographically signed) and never persisted to the database
- Repos are private by default
- The token is passed to git via `GIT_ASKPASS` (a tiny script that outputs the token) rather than embedded in the repo URL — prevents it appearing in process lists or git remote configs

---

## 24. TanStack Query (React Query)

**What it is in plain English:** TanStack Query manages all the "fetching data from the API" logic in the React frontend. Without it, you'd write `useEffect` hooks with `useState` for loading, error, and data — everywhere. TanStack Query handles all of that: caching, loading states, error states, automatic refetching, and cache invalidation.

**Why we use it:** The DuckOps frontend has many server-dependent views: project list, project detail, templates, pipeline status. TanStack Query makes all of this clean and consistent.

**Where it lives:**
- `apps/web/src/hooks/useProjects.ts` — `useProjects()`, `useProject(id)`, `useCreateProject()`, `useDeleteProject()`
- `apps/web/src/hooks/useTemplates.ts` — `useTemplates()`, `useCompatibleTemplates(selections)`

**What it does for us:**
- `useCreateProject()` returns `isPending` — used to disable the submit button while the API call is in progress
- After creating a project, the cache for "all projects" is automatically invalidated — the list refreshes with the new project
- `useCompatibleTemplates()` fetches compatible database/ORM options whenever the user selects a language or framework — showing only valid combinations

---

## 25. AI Service (Ollama)

**What it is in plain English:** Ollama is a platform for running large language models (LLMs). DuckOps uses the Ollama cloud API (not a local model) to send code generation prompts and stream the responses back to the browser.

**Why we use it:** DuckOps includes an AI code builder where users describe a change ("add a /users endpoint that returns all users from the database") and the AI generates the code diff and applies it to their project. Ollama provides access to the `qwen3-coder:480b` model — a 480-billion-parameter code-focused LLM.

**Where it lives:**
- `apps/ai-service/` — dedicated microservice at port 4005
- `apps/ai-service/src/services/ollamaService.ts` — streams responses from Ollama API
- `apps/ai-service/src/services/codeGenerator.ts` — takes the generated code, applies file changes, commits + pushes to the user's GitHub repo

**How streaming works:**
1. Browser opens SSE connection to `/api/ai/generate/stream`
2. AI service sends the prompt to Ollama with `stream: true`
3. Ollama sends back tokens one at a time as they're generated
4. AI service forwards each token to the browser via SSE
5. Browser shows the response appearing word-by-word in real time
6. When generation is complete, the service commits the file changes to the user's GitHub repo

**Configuration:**
```env
OLLAMA_HOST=https://ollama.com
OLLAMA_API_KEY=...
OLLAMA_CODE_MODEL=qwen3-coder:480b
```

---

## 26. node-cron

**What it is in plain English:** node-cron runs a function on a schedule — like a timer, but using the standard "cron" syntax (e.g. `*/30 * * * * *` means "every 30 seconds"). Used for tasks that need to run automatically and repeatedly.

**Why we use it:** The health service needs to check every deployed project's `/health` endpoint every 30 seconds — without manual triggering.

**Where it lives:**
- `apps/health-service/src/services/healthCheckService.ts` — runs every 30 seconds
- Fetches the health endpoint for each `RUNNING` project
- Records `HealthCheck` rows in Postgres with status, response time, and HTTP status code
- Emits `project:<id>:health` Socket.io events so the UI shows live health status
- Sets project status to `DEGRADED` after 3 consecutive failures (prevents false alarms from single slow responses)

---

## 27. PM2

**What it is in plain English:** PM2 is a process manager for Node.js applications. On EC2 (a plain Linux server), if you run `node dist/index.js` and the process crashes, it just stops. PM2 monitors the process, automatically restarts it if it crashes, keeps logs, and ensures all services start automatically when the EC2 instance reboots.

**Why we use it:** Production runs on bare EC2 (not inside Docker containers — Docker Compose is for local dev only). PM2 is the production process manager that keeps all 5 services running reliably.

**Where it lives:**
- `ecosystem.config.js` — declares all 5 services, their paths, environment variables
- Services run as: `duckops-catalog`, `duckops-provisioning`, `duckops-pipeline`, `duckops-health`, `duckops-ai`

**What it does for us:**
- Auto-restart on crash with configurable backoff
- `pm2 reload ecosystem.config.js --update-env` — zero-downtime reload when deploying new code
- `pm2 logs duckops-provisioning --lines 100` — view recent logs for a specific service
- `pm2 save` + `pm2 startup` — services survive EC2 reboots
- `pm2 status` — shows memory usage, CPU, uptime, restart count for all services at a glance

---

## 28. Prometheus + Grafana

**What it is in plain English:** Prometheus is a monitoring system that regularly scrapes metrics from your services (like "how many requests per second?" "how much RAM is being used?" "how many projects have been created?"). Grafana is the dashboard tool that visualizes those metrics as graphs, charts, and gauges.

**Why we use it:** Without monitoring, you only know something is broken when users complain. Prometheus + Grafana give you continuous visibility into the platform's health — CPU/memory trends, request rates, error rates, and business metrics like active projects and deployments.

**Where it lives:**
- `infra/kubernetes/monitoring/prometheus-grafana.yaml` — Kubernetes manifests deploying both Prometheus and Grafana into the `monitoring` namespace on K3s
- `apps/health-service/src/routes/health.ts` — `/metrics` endpoint that Prometheus scrapes
- Grafana runs at `http://13.204.92.146:30030` (K3s NodePort)
- Prometheus runs at `http://13.204.92.146:30090`

**What Prometheus collects:**

*Service metrics* (from the `/metrics` endpoint on each service):
- HTTP request counts and latency (p50, p95, p99)
- Active connections
- Node.js process memory and CPU

*Business metrics* (queried from Postgres and exposed as Prometheus gauges):
- Total projects, users, deployments, AI prompts
- Projects by framework (Express, Fastify, Next.js, etc.)
- Deployments by status (LIVE, FAILED, DEPLOYING, ROLLED_BACK)

*Kubernetes metrics* (from kube-state-metrics):
- Pod status per namespace
- Container restart counts
- Resource requests vs. limits

**Three Grafana dashboards:**
1. **Services Dashboard** — per-service request rates, latency, and error rates
2. **Business KPIs** — total users, projects, deployments, AI prompts; pie charts by framework and deployment status
3. **K8s Dashboard** — pod status, restart counts, namespace summary

---

## 29. GitHub Actions CI/CD

**What it is in plain English:** GitHub Actions is GitHub's built-in automation platform. You write workflow files (YAML) that describe what to do when something happens in the repo — like "when code is pushed to main, run tests, build Docker images, and deploy to EC2." It runs in GitHub's cloud — no server needed.

**Why we use it:** DuckOps itself (not the user projects — those use Jenkins) needs a CI/CD pipeline. Every push to `main` should verify the code is correct and deploy updated services to EC2.

**Where it lives:**
- `.github/workflows/ci.yml` — the main pipeline
- `.github/dependabot.yml` — automated dependency updates

**Pipeline stages:**
```
push to main
  ├── lint-and-typecheck  — ESLint + TypeScript compiler on all packages
  ├── test                — pnpm turbo run test (runs unit tests)
  ├── validate-infra      — terraform validate + fmt-check + ansible-lint
  └── deploy (needs all above to pass)
      ├── deploy-backend  — rsync code to EC2, build, pm2 reload
      └── deploy-frontend — vercel --prod (deploys Next.js frontend)
```

**Dependabot:** Automatically opens pull requests to update outdated npm packages (weekly) and GitHub Actions versions. Keeps dependencies current without manual effort.

---

## 30. Certbot + Let's Encrypt

**What it is in plain English:** Let's Encrypt is a free certificate authority that issues SSL/TLS certificates — the things that enable `https://` and the padlock in your browser. Certbot is the tool that requests certificates from Let's Encrypt and automatically renews them before they expire (certificates last 90 days).

**Why we use it:** Without SSL, all traffic between users and the platform is unencrypted (HTTP). SSL is required for production — browsers show "Not Secure" warnings on HTTP sites, OAuth flows require HTTPS, and tokens/passwords would be sent in plaintext.

**Setup:**
```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d raycode.tech \
  -d "*.raycode.tech"   ← wildcard covers api., app., and all user app subdomains
```

The wildcard cert `*.raycode.tech` covers every subdomain: `api.raycode.tech`, `app.raycode.tech`, and `myapp-rayan-duckops.raycode.tech` — all with the same single certificate.

**Auto-renewal:** Certbot installs a systemd timer that runs twice daily and renews the cert if it's within 30 days of expiry. The cert auto-renews without any manual action.

---

*Last updated: May 2026*
