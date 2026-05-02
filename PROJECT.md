# DuckOps — Project Guide

A self-hosted Internal Developer Platform (IDP). Fill out a form, pick a stack, click Create — get a deployed, monitored, CI/CD-wired application in minutes.

---

## What It Does

1. Scaffolds production-ready code from Handlebars templates (app, Dockerfile, K8s manifests, Jenkinsfile)
2. Creates a private GitHub repo and pushes the initial commit
3. Builds a Docker image and pushes it to the local k3d registry (or ECR in production)
4. Provisions a Kubernetes namespace with Terraform
5. Deploys the app with Ansible (Deployment, Service, Ingress)
6. Creates a Jenkins CI/CD pipeline with GitHub SCM polling
7. Monitors the app's `/health` endpoint every 30 seconds
8. Runs an initial AI prompt (if provided) once the app is live

---

## The 8-Stage Pipeline

```
INITIALIZING → SCAFFOLDING → CREATING_REPO → PROVISIONING
                                                   ↓
RUNNING ← DEPLOYING ← PIPELINE_READY ← CONFIGURING
```

| Stage | What happens |
|---|---|
| **INITIALIZING** | Project saved to DB; BullMQ job enqueued in Redis |
| **SCAFFOLDING** | Handlebars templates rendered to `/tmp/duckops-projects/<name>/` |
| **CREATING_REPO** | GitHub repo created; scaffolded code committed and force-pushed |
| **PROVISIONING** | Docker image built + pushed to registry; Terraform creates K8s namespace |
| **CONFIGURING** | Ansible applies Deployment, Service, and Traefik Ingress manifests |
| **PIPELINE_READY** | Jenkins job created via REST API |
| **DEPLOYING** | Initial Jenkins build triggered |
| **RUNNING** | Health cron starts; AI prompt fires if set |

Every stage streams live status to the browser over Socket.io.

---

## Services

| Service | Port | Role |
|---|---|---|
| `apps/web` | 3000 | Next.js 15 — wizard, dashboard, AI builder |
| `apps/provisioning-service` | 4002 | Orchestration engine, scaffolder, auth, billing, BullMQ worker |
| `apps/catalog-service` | 4001 | Template & stack catalog API |
| `apps/pipeline-service` | 4003 | Jenkins integration, SSE live build logs |
| `apps/health-service` | 4004 | 30s health check cron, log streaming |
| `apps/ai-service` | 4005 | AI code generation (SSE streaming), session history |

---

## Supported Templates

### Backend
| Framework | Languages | ORMs |
|---|---|---|
| Express 5 | TypeScript, JavaScript | Prisma, Drizzle, Raw SQL |
| Fastify 5 | TypeScript, JavaScript | Prisma, Drizzle, Raw SQL |

### Frontend
| Framework | Serving |
|---|---|
| React 18 | nginx (static, via Vite) |
| Vue 3 | nginx (static, via Vite) |
| Next.js 15 | Node standalone |

### Full-stack
| Stack | What you get |
|---|---|
| Turbo | Next.js 15 + Express 5 API + Prisma — monorepo |

---

## Infrastructure

| Tool | Role |
|---|---|
| k3d | Local Kubernetes — K3s in Docker |
| Terraform | K8s namespace + ConfigMap per project |
| Ansible | Applies Deployment, Service, Ingress |
| Jenkins | CI/CD — build, push image, rolling K8s update |
| BullMQ + Redis | Provisioning job queue — survives restarts, retries on failure |
| Nginx | API gateway routing `/api/*` to the right service |
| Neon.tech | Serverless Postgres (production) |

---

## Key Flows

### Project creation (POST /api/projects)
1. Route validates body with Zod
2. Creates DB record (status: INITIALIZING)
3. Enqueues BullMQ job — returns 201 immediately
4. Worker picks up job, runs 8-stage pipeline
5. Each stage emits `project:<id>` Socket.io event to the browser

### Health checks
- Runs every 30s via node-cron
- Uses `kubectl exec` to probe from inside the cluster (avoids Docker network routing)
- Turbo: checks `http://<name>-api.<namespace>.svc.cluster.local/api/health`
- Non-turbo: checks `http://<name>.<namespace>.svc.cluster.local/health`
- Project degrades only after 3 consecutive failures

### CI/CD (per deployed project)
```
git push → Jenkins SCM poll (every minute)
  → checkout → npm install → tests
  → docker build → push to registry
  → kubectl set image → rolling update
  → POST /api/pipelines/deployments
```

### AI builder
- User sends prompt → SSE stream back from ai-service
- Ollama cloud API (`qwen3-coder:480b`) generates code token-by-token
- Sessions saved to localStorage (Zustand `persist` middleware)
- Stale `streaming: true` / `loading: true` states cleared on hydration

---

## Auth + Billing

- GitHub OAuth 2.0 — access token stored in signed JWT, never in DB
- GitHub token passed to git via `GIT_ASKPASS` temp script (not in remote URL)
- Stripe subscriptions — free tier (3 projects max) and Pro tier (unlimited)
- Billing webhook at `/api/billing/webhook` — updates subscription status in DB
- Provisioning checks subscription before creating a project

---

## Local Development

```bash
# First time
./scripts/setup-local.sh

# Daily
docker compose up -d
pnpm turbo dev
```

See [COMMANDS.md](./COMMANDS.md) for the full command reference.
See [INFRA.md](./INFRA.md) for infrastructure deep-dive.
See [DEPLOYMENT.md](./DEPLOYMENT.md) for production (EC2) deployment.

---

## Production Architecture

| Aspect | Local | Production (EC2) |
|---|---|---|
| Database | Local Postgres in Docker | Neon.tech serverless |
| Registry | k3d local registry | AWS ECR |
| Services | Docker Compose | PM2 on EC2 |
| Kubernetes | k3d (Docker) | k3s (native) |
| CI/CD | Jenkins SCM polling | Jenkins + GitHub Actions |
| Frontend | localhost:3000 | Vercel |
| Routing | Nginx (Docker) | Nginx (EC2 host) |
