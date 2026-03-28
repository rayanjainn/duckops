<div align="center">

# 🦆 DuckOps

**An internal developer platform that takes you from "pick a stack" to fully deployed, monitored, and CI/CD-wired application — automatically.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-monorepo-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-k3d-326CE5?style=flat-square&logo=kubernetes&logoColor=white)](https://k3d.io/)
[![Terraform](https://img.shields.io/badge/Terraform-IaC-7B42BC?style=flat-square&logo=terraform&logoColor=white)](https://terraform.io/)

</div>

---

## What is DuckOps?

DuckOps is a self-hosted **Internal Developer Platform (IDP)** built as a TypeScript monorepo. You pick a language, framework, database, and ORM through a UI — DuckOps handles everything else: scaffolding the project, pushing it to GitHub, building and publishing a Docker image, provisioning a Kubernetes namespace with Terraform, deploying it with Ansible, standing up a Jenkins CI/CD pipeline, and monitoring your app's health — all in one automated flow.

**No manual steps. No copy-pasting boilerplate. No kubectl apply from your laptop.**

---

## The 8-Stage Provisioning Pipeline

```
  INITIALIZING  ──▶  SCAFFOLDING  ──▶  CREATING_REPO
                                              │
                                              ▼
  RUNNING  ◀──  DEPLOYING  ◀──  CONFIGURING  ◀──  PROVISIONING
```

| Stage | What happens |
|---|---|
| **INITIALIZING** | Project record created, socket connection established for real-time updates |
| **SCAFFOLDING** | Handlebars templates rendered: app code, Dockerfile, K8s manifests, Jenkinsfile |
| **CREATING_REPO** | GitHub repo created, code committed and pushed |
| **PROVISIONING** | Docker image built & pushed to local registry; Terraform creates K8s namespace + ConfigMap |
| **CONFIGURING** | Ansible deploys manifests, creates Traefik ingress at `<name>.localhost:8080` |
| **PIPELINE_READY** | Jenkins job created via API with SCM polling + credential injection |
| **DEPLOYING** | Kubernetes deployment rolls out, pod health confirmed |
| **RUNNING** | Health service monitors `/health` every 30s; project accessible at its URL |

Every stage streams live status updates to the UI over Socket.io.

---

## Architecture

```
                        ┌─────────────────────────────────────┐
                        │          Next.js Frontend            │
                        │  (project wizard, dashboard, logs)   │
                        └──────────────┬──────────────────────┘
                                       │ HTTP + WebSocket
                        ┌──────────────▼──────────────────────┐
                        │           Nginx Gateway              │
                        │         localhost:4000               │
                        └───┬──────┬──────┬──────┬────────────┘
                            │      │      │      │
              ┌─────────────▼─┐ ┌──▼──┐ ┌▼────┐ ┌▼──────────────┐
              │   Provisioning │ │Cat. │ │Pipe.│ │    Health      │
              │    Service     │ │Svc  │ │Svc  │ │    Service     │
              │    :4002       │ │:4001│ │:4003│ │    :4004       │
              │  (orchestrator)│ └─────┘ └─────┘ └───────────────┘
              └───┬───┬───┬───┘
                  │   │   │
       ┌──────────┘   │   └────────────┐
       ▼              ▼                ▼
  GitHub API     Terraform +      Jenkins API
  (repo create)  Ansible          (job create,
                 (K8s deploy)      SCM polling)
                     │
                     ▼
             ┌───────────────┐
             │  k3d cluster  │
             │  (local K8s)  │
             │  :8080        │
             └───────────────┘
```

**Shared infrastructure:** PostgreSQL 16, Redis 7, all wired via Docker Compose for local development.

---

## Supported Templates

### Backend
| Framework | Databases | ORMs |
|---|---|---|
| **Express 5** | PostgreSQL, MySQL | Prisma, Drizzle, Raw SQL |
| **Fastify 5** | PostgreSQL, MySQL | Prisma, Drizzle, Raw SQL |

### Frontend
| Framework | Bundler | Deployment |
|---|---|---|
| **React 18** | Vite | nginx (static) |
| **Vue 3** | Vite | nginx (static) |
| **Next.js 15** | built-in | Node standalone |

Every scaffolded project ships with a `Dockerfile`, Kubernetes manifests, and a `Jenkinsfile` — ready to deploy and iterate on immediately.

---

## Tech Stack

### Monorepo
| Tool | Purpose |
|---|---|
| [pnpm workspaces](https://pnpm.io/workspaces) | Package management |
| [Turborepo](https://turbo.build/) | Build orchestration & caching |
| [TypeScript 5.7](https://www.typescriptlang.org/) | End-to-end type safety |

### Services
| Service | Tech |
|---|---|
| `apps/web` | Next.js 15, React 19, Tailwind CSS 4, TanStack Query, Zustand, Socket.io |
| `apps/provisioning-service` | Express 5, Socket.io, Handlebars, Prisma |
| `apps/catalog-service` | Express 5, Prisma |
| `apps/pipeline-service` | Express 5, Jenkins API |
| `apps/health-service` | Express 5, node-cron |

### Infrastructure
| Tool | Role |
|---|---|
| [k3d](https://k3d.io/) | Local Kubernetes (K3s in Docker) |
| [Terraform](https://terraform.io/) | K8s namespace + ConfigMap provisioning |
| [Ansible](https://ansible.com/) | App deployment to cluster |
| [Jenkins](https://jenkins.io/) | CI/CD pipelines with SCM polling |
| [Docker](https://docker.com/) | Container builds + local registry |
| [Nginx](https://nginx.org/) | API gateway + static frontend serving |
| [Prometheus + Grafana](https://grafana.com/) | Metrics & dashboards |

### Data
| Tool | Role |
|---|---|
| PostgreSQL 16 | Primary database |
| Prisma 6 | ORM, migrations, seed data |
| Redis 7 | Cache / session store |
| Winston | Structured logging across all services |

---

## Project Structure

```
duckops/
├── apps/
│   ├── web/                      # Next.js frontend
│   ├── provisioning-service/     # Orchestration engine + scaffolder
│   │   └── src/templates/        # Handlebars templates for all frameworks
│   ├── catalog-service/          # Template & tech stack catalog
│   ├── pipeline-service/         # Jenkins integration
│   └── health-service/           # Periodic health monitoring
├── packages/
│   ├── db/                       # Prisma schema, migrations, seed
│   ├── shared-types/             # Shared TypeScript interfaces
│   └── shared-utils/             # Logger, error classes, config helpers
├── infra/
│   ├── terraform/                # K8s resource provisioning
│   ├── ansible/                  # Deployment playbooks
│   ├── jenkins/                  # Custom Jenkins Dockerfile + init scripts
│   └── kubernetes/               # Base K8s manifests
├── monitoring/                   # Prometheus + Grafana config
├── nginx/                        # API gateway config
├── docker-compose.yml
├── INFRA.md                      # Full infrastructure setup guide
└── COMMANDS.md                   # Development command reference
```

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [k3d](https://k3d.io/#installation) — `brew install k3d`
- [kubectl](https://kubernetes.io/docs/tasks/tools/) — `brew install kubectl`
- [Terraform](https://developer.hashicorp.com/terraform/install) — `brew install terraform`
- [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/) — `brew install ansible`
- [pnpm](https://pnpm.io/installation) — `npm install -g pnpm`
- A GitHub OAuth App ([create one here](https://github.com/settings/developers))

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/duckops.git
cd duckops
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
cp packages/db/.env.example packages/db/.env
```

Edit `.env` — the fields you must fill in:

```bash
GITHUB_CLIENT_ID=        # from your GitHub OAuth app
GITHUB_CLIENT_SECRET=    # from your GitHub OAuth app
JWT_SECRET=              # any long random string: openssl rand -hex 32
```

### 3. Bootstrap the Kubernetes cluster

```bash
# Create local registry
k3d registry create duckops-registry --port 5111

# Create cluster (exposes :8080 for ingress)
k3d cluster create duckops \
  --port "8080:80@loadbalancer" \
  --registry-use k3d-duckops-registry:5111

# Verify
kubectl get nodes
```

### 4. Start services

```bash
docker compose up -d
```

This starts: PostgreSQL, Redis, Jenkins, all 4 microservices, and Nginx.

### 5. Initialize the database

```bash
cd packages/db
pnpm prisma:migrate
pnpm prisma:seed
```

### 6. Start the frontend

```bash
cd apps/web
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with GitHub. Start creating projects.

> For full Jenkins setup and kubeconfig wiring, see [INFRA.md](./INFRA.md).

---

## How CI/CD Works

Once a project is created, every push to `main` triggers an automated pipeline:

```
git push origin main
       │
       ▼ (SCM polling, ~1 min)
  Jenkins picks up new commit
       │
       ├── Checkout code
       ├── npm install
       ├── npm test
       ├── docker build → localhost:5111/<name>:<build_number>
       ├── docker push → k3d registry
       └── kubectl set image → rolling deployment update
                │
                ▼
       http://<name>.localhost:8080  ← updated
```

GitHub credentials are stored in Jenkins' credential store automatically during provisioning — no manual setup required.

---

## Development

```bash
# Run everything in watch mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint

# Prisma Studio (DB browser)
cd packages/db && pnpm prisma:studio
```

---

## Environment Variables Reference

| Variable | Description |
|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `JWT_SECRET` | Secret for signing JWTs |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JENKINS_URL` | Jenkins base URL (default: `http://localhost:8085`) |
| `JENKINS_USER` | Jenkins username |
| `JENKINS_TOKEN` | Jenkins API token |
| `REGISTRY_URL` | Docker registry URL for K8s pulls (`k3d-duckops-registry:5111`) |
| `HOST_REGISTRY_URL` | Docker registry URL for host pushes (`localhost:5111`) |
| `APP_URL` | Provisioning service public URL |
| `FRONTEND_URL` | Frontend URL (for OAuth redirect) |

---

## Documentation

| Doc | Contents |
|---|---|
| [INFRA.md](./INFRA.md) | One-time setup, k3d + Jenkins bootstrap, 12 known issues & fixes, debugging commands |
| [COMMANDS.md](./COMMANDS.md) | Day-to-day development commands |

---

<div align="center">

Built with TypeScript · Powered by Kubernetes · Automated end to end

</div>
