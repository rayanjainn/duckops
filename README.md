<div align="center">

# DuckOps

**An Internal Developer Platform that takes you from "pick a stack" to a fully deployed, monitored, CI/CD-wired application — automatically.**

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

## What is DuckOps?

DuckOps is a self-hosted **Internal Developer Platform (IDP)** built as a TypeScript monorepo. Choose a language, framework, database, and ORM through a wizard UI — DuckOps does everything else:

1. Scaffolds production-ready project code from Handlebars templates
2. Creates a GitHub repository and pushes the initial commit
3. Builds and publishes a Docker image to the local k3d registry
4. Provisions a Kubernetes namespace with Terraform
5. Deploys the app with Ansible (Deployment, Service, Ingress)
6. Stands up a Jenkins CI/CD pipeline with GitHub SCM polling
7. Monitors the app's `/health` endpoint every 30 seconds
8. Runs an initial AI prompt (if provided at creation) after the app is live

Every stage streams live status to the UI over Socket.io. No manual `kubectl apply`. No copy-pasting boilerplate.

---

## The 8-Stage Provisioning Pipeline

```
INITIALIZING → SCAFFOLDING → CREATING_REPO → PROVISIONING
                                                    ↓
RUNNING ← DEPLOYING ← PIPELINE_READY ← CONFIGURING
```

| Stage | What happens |
|---|---|
| **INITIALIZING** | Project record created in DB; BullMQ job enqueued |
| **SCAFFOLDING** | Handlebars templates rendered — app code, Dockerfile, K8s manifests, Jenkinsfile |
| **CREATING_REPO** | GitHub repo created via API; scaffolded code committed and pushed |
| **PROVISIONING** | Docker image built and pushed to k3d registry; Terraform creates K8s namespace |
| **CONFIGURING** | Ansible deploys K8s Deployment, Service, and Traefik Ingress |
| **PIPELINE_READY** | Jenkins job created via API |
| **DEPLOYING** | Initial Jenkins build triggered; pipeline runs |
| **RUNNING** | Health service pings `/health` every 30s; AI prompt (if any) fires |

---

## Architecture

```
                     ┌──────────────────────────────────┐
                     │     Next.js Frontend :3000        │
                     │  (wizard, dashboard, AI builder)  │
                     └───────────────┬──────────────────┘
                                     │ HTTP + Socket.io
                     ┌───────────────▼──────────────────┐
                     │      Nginx API Gateway :4000      │
                     └──┬──────┬──────┬──────┬──────────┘
                        │      │      │      │
           ┌────────────▼─┐  ┌─▼──┐ ┌▼─────┐ ┌▼──────────┐ ┌▼─────────┐
           │ Provisioning  │  │Cat │ │Pipe. │ │  Health   │ │    AI    │
           │ Service :4002 │  │:4001│ │:4003 │ │  :4004    │ │  :4005   │
           │ + BullMQ      │  └────┘ └──────┘ └───────────┘ └──────────┘
           └──┬────┬───┬───┘
              │    │   │
   ┌──────────┘    │   └───────────────┐
   ▼               ▼                   ▼
GitHub API    Terraform +          Jenkins API
(repo create)  Ansible             (job + build trigger)
               (K8s deploy)
                   │
                   ▼
          ┌────────────────┐
          │  k3d cluster   │  ← k3s inside Docker
          │  :8080 ingress │
          │  :5111 registry│
          └────────────────┘

Shared: Neon.tech Postgres + Redis 7 (BullMQ queues)
```

---

## Supported Templates

### Backend

| Framework | Languages | ORMs |
|---|---|---|
| **Express 5** | TypeScript, JavaScript | Prisma, Drizzle, Raw SQL |
| **Fastify 5** | TypeScript, JavaScript | Prisma, Drizzle, Raw SQL |

### Frontend

| Framework | Serving |
|---|---|
| **React 18** | nginx (static, via Vite) |
| **Vue 3** | nginx (static, via Vite) |
| **Next.js 15** | Node standalone |

### Full-stack

| Stack | What you get |
|---|---|
| **Turbo** | Next.js 15 (web) + Express 5 API + Prisma — monorepo in one repo |

Every scaffolded project ships with a `Dockerfile`, K8s manifests, `Jenkinsfile`, and a landing page that shows the API status and available routes.

---

## Tech Stack

### Services

| Service | Port | Role |
|---|---|---|
| `apps/web` | 3000 | Next.js 15 dashboard — project wizard, live status, AI builder, settings |
| `apps/provisioning-service` | 4002 | Orchestration engine, scaffolder, auth, billing, BullMQ worker |
| `apps/catalog-service` | 4001 | Template & stack catalog API |
| `apps/pipeline-service` | 4003 | Jenkins integration, SSE live build logs |
| `apps/health-service` | 4004 | 30s health check cron, log streaming |
| `apps/ai-service` | 4005 | AI code generation (SSE streaming), session history |

### Shared Packages

| Package | Contents |
|---|---|
| `packages/db` | Prisma schema, migrations, generated client (Neon.tech Postgres) |
| `packages/shared-types` | TypeScript interfaces shared across frontend and backends |
| `packages/shared-utils` | Winston logger, AppError, slugify |

### Infrastructure

| Tool | Role |
|---|---|
| k3d | Local Kubernetes — K3s running inside Docker |
| Terraform | Provisions K8s namespace + ConfigMap per project |
| Ansible | Applies K8s Deployment, Service, Ingress |
| Jenkins | CI/CD — build Docker image, push to registry, rolling K8s update |
| BullMQ + Redis | Provisioning job queue (survives docker restarts, retries on failure) |
| Nginx | API gateway routing `/api/*` to the right service |
| Neon.tech | Serverless Postgres (free tier, replaces local Postgres in production) |

---

## Project Structure

```
duckops/
├── apps/
│   ├── web/                          # Next.js 15 frontend
│   ├── provisioning-service/         # Orchestration engine + scaffolder
│   │   └── src/
│   │       ├── queues/               # BullMQ provisioning queue + worker
│   │       ├── services/             # projectService, scaffoldService, githubService, …
│   │       ├── routes/               # /api/projects, /api/auth, /api/billing
│   │       └── templates/            # Handlebars templates
│   │           ├── backend/          # Express + Fastify (TS + JS)
│   │           ├── frontend/         # React, Vue, Next.js, Turbo
│   │           └── devops/           # Dockerfile, Jenkinsfile, K8s manifests
│   ├── catalog-service/              # Template catalog API
│   ├── pipeline-service/             # Jenkins integration + SSE build logs
│   ├── health-service/               # 30s health check cron
│   └── ai-service/                   # AI code generation (SSE), session history
├── packages/
│   ├── db/                           # Prisma schema, migrations
│   ├── shared-types/                 # Shared TypeScript types
│   └── shared-utils/                 # Logger, AppError, utilities
├── infra/
│   ├── terraform/                    # K8s namespace provisioning
│   ├── ansible/                      # K8s deployment playbooks
│   ├── jenkins/                      # Custom Jenkins image
│   └── kubernetes/                   # Static K8s manifests
├── nginx/nginx.conf                  # API gateway config
├── scripts/
│   ├── setup-local.sh                # Full local setup (idempotent)
│   ├── ec2-setup.sh                  # EC2 production setup
│   └── nginx-setup.sh                # nginx + SSL config for EC2
├── .github/workflows/
│   ├── ci.yml                        # Build → ECR → EC2 deploy → Vercel
│   └── pr-check.yml                  # Type check + secret scan on PRs
├── ecosystem.config.js               # PM2 config for EC2
├── docker-compose.yml
├── DEPLOYMENT.md                     # Full production deployment guide
└── COMMANDS.md                       # Day-to-day command reference
```

---

## Getting Started (Local)

### Prerequisites

```bash
brew install colima k3d kubectl terraform ansible
npm install -g pnpm
```

Create a **GitHub OAuth App** at [github.com/settings/developers](https://github.com/settings/developers):
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:4002/api/auth/github/callback`

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/duckops.git
cd duckops

cp .env.example .env
# Fill in: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JWT_SECRET, DATABASE_URL

./scripts/setup-local.sh
```

The setup script is fully idempotent — safe to re-run. It handles everything: Colima, k3d cluster, Docker images, DB migrations, Jenkins bootstrap, kubeconfig injection.

### Jenkins first-time setup (one-time)

```bash
docker exec duckops-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

1. Open [http://localhost:8085](http://localhost:8085) and paste the password
2. Install suggested plugins, create an admin user
3. User icon → Configure → API Token → Add new Token → copy it
4. Add to `.env`: `JENKINS_TOKEN=<your-token>`

### Development

```bash
pnpm turbo dev        # all services with hot reload
pnpm build            # build everything
pnpm typecheck        # type-check all packages
```

---

## Service Ports

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:4000 |
| Catalog | http://localhost:4001 |
| Provisioning | http://localhost:4002 |
| Pipeline | http://localhost:4003 |
| Health | http://localhost:4004 |
| AI | http://localhost:4005 |
| Jenkins | http://localhost:8085 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| k3d Registry | localhost:5111 |
| Deployed apps | http://\<name\>.localhost:8080 |

---

## Documentation

| File | Contents |
|---|---|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Full production deployment guide (EC2 + Vercel + CI/CD) |
| [COMMANDS.md](./COMMANDS.md) | Day-to-day local development command reference |
| [INFRA.md](./INFRA.md) | Infrastructure deep-dive, k3d + Jenkins bootstrap |
| [TOOLS.md](./TOOLS.md) | Every DevOps tool — what it is, why it's here |

---

<div align="center">
Built with TypeScript · Kubernetes · Jenkins · Terraform · Ansible
</div>
