<div align="center">

# 🦆 DuckOps

**An Internal Developer Platform that takes you from "pick a stack" to a fully deployed, monitored, and CI/CD-wired application — automatically.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-monorepo-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Kubernetes](https://img.shields.io/badge/k3d-local--k8s-326CE5?style=flat-square&logo=kubernetes&logoColor=white)](https://k3d.io/)
[![Terraform](https://img.shields.io/badge/Terraform-IaC-7B42BC?style=flat-square&logo=terraform&logoColor=white)](https://terraform.io/)
[![Jenkins](https://img.shields.io/badge/Jenkins-CI%2FCD-D24939?style=flat-square&logo=jenkins&logoColor=white)](https://jenkins.io/)
[![Ansible](https://img.shields.io/badge/Ansible-automation-EE0000?style=flat-square&logo=ansible&logoColor=white)](https://www.ansible.com/)

</div>

---

## ✨ Recent Updates

- **Premium UX & Design**: Upgraded the entire dashboard to a beautiful Dark Theme aesthetic featuring glassmorphism, animated transitions, and a secure `DeleteProjectDialog` replacing standard browser alerts.
- **Billing & Tiers Built-in**: We've added a Free & Pro tier system. Free users get up to **2 active projects** and **3 AI code generation prompts every 6 hours**. Pro users unlock unlimited usage!
- **Instant CI/CD Triggers**: Eliminated Jenkins 1-minute SCM polling. The AI-service now directly triggers pipelines via internal API for instant deployments.
- **Resilient Setup Scripts**: `setup-local.sh` is now completely lockfile-agnostic for smoother first-time local builds across different Node/pnpm versions.

---

## What is DuckOps?

DuckOps is a self-hosted **Internal Developer Platform (IDP)** built as a TypeScript monorepo. Choose a language, framework, database, and ORM through a wizard UI — DuckOps does everything else:

1. Scaffolds production-ready project code from Handlebars templates
2. Creates a GitHub repository (public or private — your choice)
3. Builds and publishes a Docker image to the local k3d registry
4. Provisions a Kubernetes namespace with Terraform
5. Deploys your app with Ansible (Deployment, Service, Ingress)
6. Stands up a Jenkins CI/CD pipeline with GitHub SCM polling
7. Monitors your app's `/health` endpoint every 30 seconds

Every stage streams live status to the UI over Socket.io. No manual `kubectl apply`. No copy-pasting boilerplate. No post-setup config steps.

---

## The 8-Stage Provisioning Pipeline

```
INITIALIZING → SCAFFOLDING → CREATING_REPO → PROVISIONING
                                                    ↓
RUNNING ← DEPLOYING ← PIPELINE_READY ← CONFIGURING
```

| Stage | What happens |
|---|---|
| **INITIALIZING** | Project record written to DB; Socket.io room opened for real-time updates |
| **SCAFFOLDING** | Handlebars templates rendered — app code, `Dockerfile`, K8s manifests, `Jenkinsfile` |
| **CREATING_REPO** | GitHub repo created via API; scaffolded code committed and pushed |
| **PROVISIONING** | Docker image built and pushed to local k3d registry; Terraform creates K8s namespace + ConfigMap |
| **CONFIGURING** | Ansible deploys K8s `Deployment`, `Service`, and Traefik `Ingress` |
| **PIPELINE_READY** | Jenkins job created via API with SCM polling every minute |
| **DEPLOYING** | `kubectl rollout status` confirms pod is up |
| **RUNNING** | Health service pings `/health` every 30s; app accessible at `http://<name>.localhost:8080` |

---

## Architecture

```
                     ┌──────────────────────────────────┐
                     │       Next.js Frontend :3000      │
                     │  (wizard, dashboard, live logs)   │
                     └───────────────┬──────────────────┘
                                     │ HTTP + Socket.io
                     ┌───────────────▼──────────────────┐
                     │       Nginx API Gateway :4000     │
                     └──┬──────┬──────┬──────┬──────────┘
                        │      │      │      │
           ┌────────────▼─┐  ┌─▼──┐ ┌▼────┐ ┌▼────────────┐
           │ Provisioning  │  │Cat.│ │Pipe.│ │   Health    │
           │ Service :4002 │  │:4001│ │:4003│ │ Service     │
           │ (orchestrator)│  └────┘ └─────┘ │ :4004       │
           └──┬────┬───┬───┘                  └─────────────┘
              │    │   │
   ┌──────────┘    │   └───────────────┐
   ▼               ▼                   ▼
GitHub API    Terraform +          Jenkins API
(repo create)  Ansible             (job create,
               (K8s deploy)         SCM polling)
                   │
                   ▼
          ┌────────────────┐
          │  k3d cluster   │  ← k3s inside Docker
          │  :8080 ingress │
          │  :5111 registry│
          └────────────────┘

Shared: PostgreSQL 16 + Redis 7 (via Docker Compose)
```

---

## Supported Templates

### Backend

| Framework | Languages | Databases | ORMs |
|---|---|---|---|
| **Express 5** | TypeScript, JavaScript | PostgreSQL, MySQL | Prisma, Drizzle, Raw SQL |
| **Fastify 5** | TypeScript, JavaScript | PostgreSQL, MySQL | Prisma, Drizzle, Raw SQL |

### Frontend

| Framework | Bundler | Serving |
|---|---|---|
| **React 18** | Vite | nginx (static) |
| **Vue 3** | Vite | nginx (static) |
| **Next.js 15** | built-in | Node standalone |

### Full-stack

| Stack | What you get |
|---|---|
| **Turbo** | Next.js 15 (web) + Express 5 API + Prisma — monorepo in one repo |

Every scaffolded project ships with a `Dockerfile`, Kubernetes `Deployment`/`Service`/`Ingress` manifests, and a `Jenkinsfile` — ready to iterate on immediately.

---

## Tech Stack

### Monorepo

| Tool | Version | Purpose |
|---|---|---|
| [pnpm workspaces](https://pnpm.io/workspaces) | 9.x | Package management across all apps + packages |
| [Turborepo](https://turbo.build/) | 2.x | Build orchestration, dependency-aware caching |
| [TypeScript](https://www.typescriptlang.org/) | 5.7 | End-to-end type safety |

### Services

| Service | Port | Stack |
|---|---|---|
| `apps/web` | 3000 | Next.js 15, React 19, Tailwind CSS 4, TanStack Query v5, Socket.io client |
| `apps/provisioning-service` | 4002 | Express 5, Socket.io, Handlebars, Prisma, JWT auth |
| `apps/catalog-service` | 4001 | Express 5, Prisma |
| `apps/pipeline-service` | 4003 | Express 5, Jenkins REST API, SSE for live build logs |
| `apps/health-service` | 4004 | Express 5, node-cron |

### Shared Packages

| Package | Contents |
|---|---|
| `packages/db` | Prisma schema, migrations, seed data, generated client |
| `packages/shared-types` | TypeScript interfaces shared between frontend and backend |
| `packages/shared-utils` | Logger (Winston), error classes, `slugify`, `sleep` |

### Infrastructure

| Tool | Role |
|---|---|
| [k3d](https://k3d.io/) | Local Kubernetes — K3s running inside Docker containers |
| [Terraform](https://terraform.io/) | Provisions K8s namespace + ConfigMap per project |
| [Ansible](https://www.ansible.com/) | Applies K8s Deployment, Service, Ingress manifests |
| [Jenkins](https://jenkins.io/) | CI/CD — builds Docker image, pushes to registry, does rolling update |
| [Docker](https://docker.com/) | Container builds, local image registry (port 5111) |
| [Nginx](https://nginx.org/) | API gateway routing `/api/*` to the right microservice |

### Data

| Tool | Role |
|---|---|
| PostgreSQL 16 | Primary database (all services) |
| Prisma 6 | ORM, schema migrations, seed |
| Redis 7 | Cache, session store |
| Winston | Structured JSON logging across all services |

---

## Project Structure

```
duckops/
├── apps/
│   ├── web/                          # Next.js 15 frontend
│   ├── provisioning-service/         # Orchestration engine + scaffolder
│   │   └── src/
│   │       ├── services/             # projectService, scaffoldService, githubService, …
│   │       ├── routes/               # /api/projects, /api/auth
│   │       └── templates/            # Handlebars templates
│   │           ├── devops/           # Dockerfile, Jenkinsfile, K8s manifests
│   │           └── frontend/         # React, Vue, Next.js, Turbo scaffolds
│   ├── catalog-service/              # Template & tech-stack catalog API
│   ├── pipeline-service/             # Jenkins integration + SSE live build stream
│   └── health-service/               # Periodic /health monitoring + cron
├── packages/
│   ├── db/                           # Prisma schema, migrations, seed
│   ├── shared-types/                 # Shared TypeScript types (Project, Pipeline, …)
│   └── shared-utils/                 # Logger, AppError, slugify
├── infra/
│   ├── terraform/
│   │   ├── modules/k8s-namespace/    # Reusable namespace + configmap module
│   │   ├── modules/k8s-deployment/   # Reusable deployment module
│   │   └── environments/local/       # Local environment wiring
│   ├── ansible/
│   │   ├── playbooks/deploy-app.yml  # Main deploy playbook
│   │   └── inventory/local.yml       # Local inventory (localhost connection)
│   ├── jenkins/                      # Custom Jenkins image: Docker CLI + kubectl + Node 22
│   └── kubernetes/                   # Static base K8s manifests
├── nginx/nginx.conf                  # API gateway config
├── monitoring/                       # Prometheus + Grafana config
├── scripts/
│   ├── setup-local.sh                # Full local setup (idempotent, re-runnable)
│   └── colima-start.sh               # Start Colima with correct resources
├── docker-compose.yml
├── .env.example
├── README.md                         # This file
└── TOOLS.md                          # Deep-dive into every DevOps tool used
```

---

## Getting Started

### Prerequisites

Install these before running setup:

```bash
# Required
brew install docker   # or: install Colima (recommended for Apple Silicon)
npm install -g pnpm

# Recommended (Kubernetes features)
brew install k3d kubectl

# Infrastructure tools
brew install terraform ansible

# If using Colima instead of Docker Desktop
brew install colima
```

Create a **GitHub OAuth App** at [github.com/settings/developers](https://github.com/settings/developers):
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:4002/api/auth/github/callback`

---

### 1. Clone and configure

```bash
git clone https://github.com/YOUR_USERNAME/duckops.git
cd duckops

cp .env.example .env
# Edit .env — fill in these three values:
#   GITHUB_CLIENT_ID=
#   GITHUB_CLIENT_SECRET=
#   JWT_SECRET=$(openssl rand -hex 32)

cp packages/db/.env.example packages/db/.env
# Paste DATABASE_URL from .env into packages/db/.env
```

---

### 2. Start Docker (Colima)

If you're using Colima (recommended on Apple Silicon — more control over CPU/RAM):

```bash
./scripts/colima-start.sh
```

This starts Colima with 6 CPUs, 10 GB RAM, 80 GB disk, and enables Docker BuildKit for parallel builds. Tweak via env vars:

```bash
COLIMA_CPU=8 COLIMA_MEMORY=12 ./scripts/colima-start.sh
```

If you're using Docker Desktop, just make sure it's running.

---

### 3. Run setup

```bash
./scripts/setup-local.sh
```

This script is **fully idempotent** — safe to re-run at any time. It will:

1. Check prerequisites
2. Create or update `.env` with any missing variables
3. Run `pnpm install`
4. Create the `k3d-duckops` Docker network
5. Create the k3d cluster and registry (skips if they exist)
6. Start PostgreSQL + Redis and wait for health
7. Run Prisma migrations and seed
8. Build all Docker images **in parallel** with BuildKit
9. Start Jenkins and wait for it to be up
10. Guide you through Jenkins first-time setup
11. Start all services and wire kubeconfig into Jenkins

---

### 4. Jenkins first-time setup (one-time only)

```bash
# Get the initial admin password
docker exec duckops-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

1. Open [http://localhost:8085](http://localhost:8085)
2. Paste the password, install suggested plugins, create an admin user
3. Go to your user → **Configure** → **API Token** → **Add new Token** → copy it
4. Add it to `.env`: `JENKINS_TOKEN=<your-token>`
5. Answer "y" when `setup-local.sh` asks if Jenkins is configured

---

### 5. Create your first project

Open [http://localhost:3000](http://localhost:3000), sign in with GitHub, click **New Project** and pick your stack. Watch the 8-stage pipeline complete in real time.

---

## Development

```bash
# Start all services in hot-reload dev mode
pnpm turbo dev

# Build everything
pnpm build

# Type-check all packages
pnpm typecheck

# Run tests
pnpm test

# Lint
pnpm lint

# Open Prisma Studio (DB browser)
cd packages/db && pnpm prisma studio

# Rebuild and restart a single service
docker compose up -d --build provisioning-service
```

---

## How CI/CD Works

After a project is created, every push to `main` triggers an automated pipeline:

```
git push origin main
      │
      ▼  (Jenkins SCM polling — checks every minute)
Jenkins picks up the new commit
      │
      ├─ Checkout code from GitHub (using stored credential)
      ├─ Install dependencies  (npm / pnpm / yarn / bun)
      ├─ Run tests             (failures don't block deploy)
      ├─ docker build → localhost:5111/<name>:<build_number>
      ├─ docker push → k3d registry
      └─ kubectl set image → rolling deployment update
                │
                ▼
      http://<name>.localhost:8080  ← live, updated
```

GitHub credentials are stored in Jenkins' credential store automatically during provisioning — no manual setup required. Build results are reported back to the DuckOps pipeline service via a `curl` call in the `Jenkinsfile`.

---

## Service Ports

| Service | URL |
|---|---|
| Next.js frontend | [http://localhost:3000](http://localhost:3000) |
| API Gateway (Nginx) | [http://localhost:4000](http://localhost:4000) |
| Catalog Service | [http://localhost:4001](http://localhost:4001) |
| Provisioning Service | [http://localhost:4002](http://localhost:4002) |
| Pipeline Service | [http://localhost:4003](http://localhost:4003) |
| Health Service | [http://localhost:4004](http://localhost:4004) |
| Jenkins | [http://localhost:8085](http://localhost:8085) |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| k3d Ingress (deployed apps) | [http://<name>.localhost:8080](http://localhost:8080) |
| k3d Registry | localhost:5111 |

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App client secret |
| `JWT_SECRET` | Yes | Secret for signing session JWTs — generate with `openssl rand -hex 32` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JENKINS_URL` | Yes | Jenkins base URL (`http://localhost:8085` locally) |
| `JENKINS_USER` | Yes | Jenkins username (default: `admin`) |
| `JENKINS_TOKEN` | Yes | Jenkins API token — created after first-time setup |
| `REGISTRY_URL` | Yes | Docker registry URL for K8s image pulls (`k3d-duckops-registry:5111`) |
| `HOST_REGISTRY_URL` | Yes | Docker registry URL for host pushes (`localhost:5111`) |
| `APP_URL` | Yes | Provisioning service public URL (used for OAuth redirect) |
| `FRONTEND_URL` | Yes | Frontend URL (for CORS + OAuth) |
| `PIPELINE_SERVICE_URL` | No | Internal URL for pipeline service (`http://pipeline-service:4003` in Docker) |
| `NEXT_PUBLIC_API_URL` | Yes | Frontend → provisioning service URL |
| `NEXT_PUBLIC_CATALOG_URL` | Yes | Frontend → catalog service URL |
| `NEXT_PUBLIC_PIPELINE_URL` | Yes | Frontend → pipeline service URL |
| `NEXT_PUBLIC_HEALTH_URL` | Yes | Frontend → health service URL |
| `NEXT_PUBLIC_SOCKET_URL` | Yes | Frontend → Socket.io server URL |

---

## Troubleshooting

### Docker daemon not running
```bash
# Colima
scripts/colima-start.sh

# Docker Desktop — start from the menu bar
```

### k3d cluster not found
```bash
k3d cluster list
k3d cluster start duckops
```

### Postgres not healthy
```bash
docker compose logs postgres
docker compose restart postgres
```

### Jenkins unreachable after restart
```bash
docker compose up jenkins -d
# Wait ~30s, then check:
curl -I http://localhost:8085/login
```

### kubeconfig not wired into Jenkins
```bash
K3D_IP=$(docker inspect k3d-duckops-server-0 --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' | head -1)
k3d kubeconfig get duckops | sed "s|0.0.0.0:[0-9]*|${K3D_IP}:6443|" | docker exec -i duckops-jenkins tee /root/.kube/config
```

### Services rebuilding from scratch every time (slow builds)
Make sure BuildKit is enabled and you're using Colima with enough RAM:
```bash
scripts/colima-start.sh
export DOCKER_BUILDKIT=1
docker compose build --parallel
```

### setup-local.sh fails on migration
```bash
cd packages/db
pnpm prisma migrate deploy
pnpm prisma generate
```

---

## Documentation

| File | Contents |
|---|---|
| [TOOLS.md](./TOOLS.md) | Every DevOps tool used — what it is, why it's here, how it's wired |
| [INFRA.md](./INFRA.md) | Infrastructure deep-dive, k3d + Jenkins bootstrap, known issues |
| [COMMANDS.md](./COMMANDS.md) | Day-to-day development command reference |

---

<div align="center">

Built with TypeScript · Powered by Kubernetes · Fully automated end to end

</div>
