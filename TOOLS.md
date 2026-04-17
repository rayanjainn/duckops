# DuckOps — DevOps Tools Reference

Every tool used in this project, what it does, where it lives in the codebase, and exactly how it helps.

---

## Table of Contents

1. [pnpm](#1-pnpm)
2. [Turborepo](#2-turborepo)
3. [TypeScript](#3-typescript)
4. [Docker + BuildKit](#4-docker--buildkit)
5. [Colima](#5-colima)
6. [Docker Compose](#6-docker-compose)
7. [k3d (k3s in Docker)](#7-k3d-k3s-in-docker)
8. [kubectl](#8-kubectl)
9. [Terraform](#9-terraform)
10. [Ansible](#10-ansible)
11. [Jenkins](#11-jenkins)
12. [Nginx](#12-nginx)
13. [PostgreSQL + Prisma](#13-postgresql--prisma)
14. [Redis](#14-redis)
15. [Socket.io](#15-socketio)
16. [Handlebars (hbs)](#16-handlebars-hbs)
17. [Traefik Ingress](#17-traefik-ingress)
18. [Winston](#18-winston)
19. [Zod](#19-zod)
20. [GitHub OAuth + API](#20-github-oauth--api)
21. [TanStack Query (React Query)](#21-tanstack-query-react-query)
22. [Prometheus + Grafana](#22-prometheus--grafana)
23. [node-cron](#23-node-cron)

---

## 1. pnpm

**What it is:** A fast, disk-efficient Node.js package manager that uses hard links and a content-addressable store to avoid duplicating packages.

**Why we use it:** DuckOps is a monorepo with 5 apps and 3 shared packages — each depending on the other. pnpm workspaces lets us hoist shared dependencies, link local packages (e.g. `@duckops/shared-types`), and run scripts across all packages with a single command. It's ~2× faster than npm for installs and uses significantly less disk space.

**Where it lives:**
- `pnpm-workspace.yaml` — declares which directories are workspace packages
- `pnpm-lock.yaml` — deterministic lockfile
- All `package.json` files use `workspace:*` protocol to reference internal packages

**How it helps:**
- `pnpm install` at the root installs everything for all apps and packages in one shot
- `pnpm turbo build` or `pnpm dev` runs the command across the whole monorepo
- Dockerfiles use `--mount=type=cache,target=/root/.local/share/pnpm/store` to cache the store between builds, making rebuilds dramatically faster

---

## 2. Turborepo

**What it is:** A high-performance build system for JavaScript/TypeScript monorepos. It understands the dependency graph between packages and only rebuilds what changed.

**Why we use it:** With 5 apps and 3 packages, building everything serially would be slow. Turbo builds packages in topological order (e.g. `shared-utils` before `provisioning-service`), caches build artifacts by content hash, and runs independent tasks in parallel.

**Where it lives:**
- `turbo.json` — pipeline definition (what depends on what, which outputs to cache)
- All `package.json` scripts call `turbo run build` / `turbo run dev`

**How it helps:**
- Second build is near-instant — Turbo restores cached outputs
- `pnpm turbo dev` starts all services in hot-reload mode in parallel
- `pnpm turbo build --filter=catalog-service` builds only one service and its deps
- Each Dockerfile calls `pnpm turbo build --filter=<service>` so only the relevant sub-graph is built inside the container

---

## 3. TypeScript

**What it is:** A typed superset of JavaScript that compiles to plain JS.

**Why we use it:** End-to-end type safety. The `packages/shared-types` package defines the same `Project`, `Pipeline`, `TemplateOption`, etc. interfaces that both the Next.js frontend and all Express backends import. A change to an API response shape is a compile error everywhere simultaneously.

**Where it lives:**
- Every `apps/*/tsconfig.json` and `packages/*/tsconfig.json`
- `packages/shared-types/src/index.ts` — the single source of truth for all shared shapes

**How it helps:**
- Catches mismatches between what the backend sends and what the frontend expects at build time, not at runtime
- Express route handlers are typed via `req.user` extension (see `apps/provisioning-service/src/middleware/auth.ts`)
- Prisma generates fully typed client code that TypeScript validates against

---

## 4. Docker + BuildKit

**What it is:** Docker is the container runtime. BuildKit is Docker's next-generation builder with parallel stage execution, cache mounts, and smaller image layers.

**Why we use it:** All 4 microservices are packaged as Docker images so they run identically in development, CI, and production. BuildKit's `--mount=type=cache` keeps the pnpm store between builds so `pnpm install` only downloads what changed.

**Where it lives:**
- `apps/*/Dockerfile` — one per service, using `# syntax=docker/dockerfile:1.7` to opt into BuildKit
- `docker-compose.yml` — builds and runs all images with `DOCKER_BUILDKIT=1`
- `scripts/setup-local.sh` — exports `DOCKER_BUILDKIT=1` before any `docker compose build` call

**Key patterns in every Dockerfile:**
```dockerfile
# syntax=docker/dockerfile:1.7

# Builder stage — all dev deps, compile TS
FROM node:22-alpine AS builder
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Runtime stage — only prod deps, compiled JS, non-root user
FROM node:22-alpine AS runtime
RUN addgroup -S duckops && adduser -S duckops -G duckops
USER duckops
```

**How it helps:**
- Multi-stage builds keep runtime images small (no TypeScript compiler, dev tools, or build cache)
- Cache mounts mean `pnpm install` on rebuild only downloads changed packages
- Non-root user reduces attack surface
- `docker compose build --parallel` builds all 5 images at the same time on Colima

---

## 5. Colima

**What it is:** A lightweight, command-line Docker runtime for macOS (and Linux) that runs Docker inside a VM. An alternative to Docker Desktop that gives you full control over CPU, RAM, and disk allocation.

**Why we use it:** Docker Desktop's default resource limits are often too low for running k3d + Jenkins + 4 microservices simultaneously. Colima lets you allocate exactly what you need (e.g. 6 CPUs, 10 GB RAM).

**Where it lives:**
- `scripts/colima-start.sh` — starts Colima with the right resources and enables BuildKit in `~/.docker/daemon.json`

**Usage:**
```bash
# Start with defaults (6 CPU, 10 GB RAM, 80 GB disk)
./scripts/colima-start.sh

# Override resources
COLIMA_CPU=8 COLIMA_MEMORY=12 COLIMA_DISK=100 ./scripts/colima-start.sh
```

**How it helps:**
- Prevents OOM kills during parallel Docker builds
- `--vm-type vz --vz-rosetta` uses Apple's Virtualization Framework + Rosetta for near-native ARM performance on M-series chips
- `--max-concurrent-downloads 8 --max-concurrent-uploads 8` in `daemon.json` speeds up layer pulls and pushes
- Survives reboots — just re-run `colima-start.sh`

---

## 6. Docker Compose

**What it is:** A tool for defining and running multi-container Docker applications via a YAML file.

**Why we use it:** DuckOps has 8+ containers (postgres, redis, jenkins, 4 microservices, nginx). Compose manages their networking, volume mounts, env vars, health checks, build contexts, and startup order in a single file.

**Where it lives:**
- `docker-compose.yml` — root of the repo

**Key design decisions:**
- Services depend on `postgres: condition: service_healthy` so they never start before Postgres is ready
- The `k3d-duckops` network is declared `external: true` — it must exist before Compose starts (created by `setup-local.sh`)
- `provisioning-service` mounts `/var/run/docker.sock` so it can run `docker build` for scaffolded projects
- `develop.watch` sections enable hot-reload for local development via `docker compose watch`
- `BUILDKIT_INLINE_CACHE: "1"` is set on all service builds so layer cache metadata is embedded in the image

---

## 7. k3d (k3s in Docker)

**What it is:** k3d is a wrapper that runs k3s (a lightweight Kubernetes distribution) inside Docker containers. You get a real, fully functional Kubernetes cluster locally — without VMs, without minikube complexity.

**Why we use it:** DuckOps deploys every scaffolded project to Kubernetes. k3d gives us a local cluster with the same API surface as production K8s, plus a built-in container registry at `localhost:5111` that k3s can pull from directly.

**Where it lives:**
- `scripts/setup-local.sh` — creates the cluster and registry
- `infra/terraform/environments/local/` — Terraform provisions namespaces inside this cluster
- `infra/ansible/playbooks/deploy-app.yml` — Ansible applies manifests to this cluster
- `apps/provisioning-service/src/services/buildService.ts` — pushes images to `localhost:5111`
- `apps/pipeline-service/src/services/jenkinsService.ts` — Jenkins uses `kubectl` to update deployments

**Cluster layout:**
```
k3d-duckops cluster
├── server-0 (control plane)
├── agent-0  (worker)
├── agent-1  (worker)
└── k3d-duckops-registry:5111  (local Docker registry)

Network: k3d-duckops (Docker bridge, shared with compose services)
```

**How it helps:**
- Every project gets its own Kubernetes namespace (`project-<name>`)
- Apps are accessible at `http://<name>.localhost:8080` via the built-in Traefik ingress controller
- Jenkins pulls images from `k3d-duckops-registry:5111` (internal name) and pushes from `localhost:5111` (host name)
- `kubectl rollout status` confirms each deployment before marking the project as `RUNNING`

---

## 8. kubectl

**What it is:** The Kubernetes command-line tool for talking to a cluster's API server.

**Why we use it:**
- `deleteProject` in `projectService.ts` calls `kubectl delete namespace` to tear down a project's entire K8s footprint
- Jenkins pipelines call `kubectl set image` to do rolling updates
- The `setup-local.sh` script copies a patched kubeconfig (with k3d's internal Docker network IP instead of `0.0.0.0`) into the Jenkins container so it can reach the cluster

**Where it lives:**
- Referenced in `apps/provisioning-service/src/services/projectService.ts`
- `infra/jenkins/Dockerfile` — installs kubectl into the Jenkins image
- `scripts/setup-local.sh` — wires kubeconfig into Jenkins at startup

**kubeconfig patching (why it matters):**
k3d writes `https://0.0.0.0:<port>` as the cluster server in kubeconfig. That address works from your Mac but is unreachable from inside the Jenkins container. The setup script replaces it with the container's actual IP on the `k3d-duckops` Docker network:
```bash
k3d kubeconfig get duckops | sed "s|0.0.0.0:[0-9]*|${K3D_IP}:6443|" > /root/.kube/config
```

---

## 9. Terraform

**What it is:** An infrastructure-as-code tool from HashiCorp. You declare what infrastructure you want in HCL (HashiCorp Configuration Language) and Terraform figures out what to create, update, or delete.

**Why we use it:** Every DuckOps project needs a dedicated Kubernetes namespace and a `ConfigMap` for its configuration. Terraform tracks state — if you create 20 projects, Terraform knows about all 20 namespaces and can cleanly manage them.

**Where it lives:**
- `infra/terraform/modules/k8s-namespace/main.tf` — reusable module: creates namespace + configmap
- `infra/terraform/modules/k8s-deployment/main.tf` — reusable module: deployment scaffolding
- `infra/terraform/environments/local/main.tf` — wires modules for local k3d
- `apps/provisioning-service/src/services/terraformService.ts` — calls `terraform init`, `terraform workspace select/new`, `terraform apply` programmatically

**Workspace per project:**
```
terraform workspace new project-my-api
terraform apply -var="project_name=my-api" -var="namespace=project-my-api"
```

Each project gets its own Terraform workspace so state is isolated and `terraform destroy` only affects that project.

**How it helps:**
- Namespace creation is declarative and repeatable — no manual `kubectl create namespace`
- State file tracks what was provisioned so cleanup (`destroyTerraform`) removes exactly what was created
- Local module structure means adding a new resource type (e.g. a PersistentVolumeClaim) is a one-line change to the module

---

## 10. Ansible

**What it is:** An agentless IT automation tool. You write YAML playbooks describing the desired state of your systems; Ansible figures out how to get there via SSH or local connections.

**Why we use it:** After Terraform creates the namespace, Ansible applies the application-specific Kubernetes manifests — `Deployment`, `Service`, and Traefik `Ingress`. This separation of concerns keeps Terraform focused on infrastructure-level resources and Ansible on application deployment.

**Where it lives:**
- `infra/ansible/playbooks/deploy-app.yml` — main deployment playbook
- `infra/ansible/inventory/local.yml` — localhost inventory (uses `connection: local`)
- `apps/provisioning-service/src/services/ansibleService.ts` — runs ansible-playbook programmatically

**Security note:** Extra vars (project name, namespace, database URL) are passed via a temp JSON file using Ansible's `@<file>` syntax instead of inline shell interpolation — this prevents command injection if a project name contains special characters.

**How it helps:**
- `--connection=local` means Ansible runs directly on the provisioning service container without needing SSH
- The playbook uses the `kubernetes.core` collection to apply manifests via the K8s API — same result as `kubectl apply` but traceable and idempotent
- Ansible is a no-op if the deployment already exists (idempotent by design)

---

## 11. Jenkins

**What it is:** An open-source automation server. Runs CI/CD pipelines defined as `Jenkinsfile` (Groovy DSL).

**Why we use it:** Every scaffolded project gets its own Jenkins job that polls its GitHub repo every minute and triggers a full build-test-push-deploy pipeline on new commits. Jenkins stores GitHub credentials securely and has direct access to Docker and kubectl.

**Where it lives:**
- `infra/jenkins/Dockerfile` — custom Jenkins image with Docker CLI, kubectl, Node.js 22 pre-installed
- `infra/jenkins/disable-csrf.groovy` — init script to disable CSRF for API access
- `infra/jenkins/setup-kubeconfig.sh` + `entrypoint.sh` — patched kubeconfig at container startup
- `apps/pipeline-service/src/services/jenkinsService.ts` — creates/deletes jobs via Jenkins REST API, fetches build status and live console output
- `apps/provisioning-service/src/templates/devops/Jenkinsfile.hbs` — template Jenkinsfile injected into every scaffolded project

**Pipeline stages generated per project:**
```
Checkout → Install Dependencies → Run Tests → Build Image → Push Image → Deploy
```

**Credential management:** When a project is created, DuckOps automatically stores the user's GitHub token as a Jenkins `UsernamePasswordCredential` via the credentials REST API — no manual credential setup required.

**How it helps:**
- SCM polling means CI triggers on every git push without webhooks (which require a public URL)
- Build results are reported back to DuckOps via `curl` in the `post { success/failure }` blocks
- Live build logs stream from Jenkins to the DuckOps UI via SSE (Server-Sent Events) from the pipeline service

---

## 12. Nginx

**What it is:** A high-performance HTTP server and reverse proxy.

**Why we use it:** All 4 microservices run on different ports. Rather than hard-coding 4 different URLs in the frontend, Nginx acts as an API gateway — a single entry point at `:4000` that routes requests to the right service based on URL prefix.

**Where it lives:**
- `nginx/nginx.conf` — routing rules
- `docker-compose.yml` — `nginx` service, port 4000

**Routing:**
```
localhost:4000/api/catalog/…       → catalog-service:4001
localhost:4000/api/projects/…      → provisioning-service:4002
localhost:4000/api/auth/…          → provisioning-service:4002
localhost:4000/api/pipelines/…     → pipeline-service:4003
localhost:4000/api/health/…        → health-service:4004
localhost:4000/socket.io/…         → provisioning-service:4002 (WebSocket upgrade)
```

**How it helps:**
- Frontend only needs one base URL (`NEXT_PUBLIC_API_URL=http://localhost:4000`)
- WebSocket connections (Socket.io) are transparently proxied with `proxy_http_version 1.1` + `Upgrade` header
- Easy to extend — adding a new service is one `location` block

---

## 13. PostgreSQL + Prisma

**What it is:** PostgreSQL is the primary relational database. Prisma is a TypeScript ORM with a declarative schema, auto-generated migrations, and a fully typed client.

**Why we use it:** All project metadata (name, status, GitHub repo URL, namespace, health history, deployments) lives in Postgres. Prisma gives us type-safe queries, schema migrations that run automatically, and a visual DB browser (Prisma Studio).

**Where it lives:**
- `packages/db/prisma/schema.prisma` — single source of truth for the DB schema
- `packages/db/prisma/migrations/` — auto-generated SQL migrations
- `packages/db/prisma/seed.ts` — seeds template options (languages, frameworks, databases, ORMs)
- Every service imports `{ prisma }` from `@duckops/db`

**Schema overview:**
```
User → Project (1:many)
Project → Pipeline (1:1)
Project → Deployment (1:many)
Project → HealthCheck (1:many)
TemplateOption (standalone — seeded on startup)
```

**How it helps:**
- `pnpm prisma migrate deploy` in `setup-local.sh` applies all pending migrations idempotently
- `pnpm prisma generate` regenerates the typed client after schema changes
- `pnpm prisma studio` opens a browser-based DB editor for debugging
- All queries are typed — impossible to select a column that doesn't exist

---

## 14. Redis

**What it is:** An in-memory data structure store — key-value cache, pub/sub, session store.

**Why we use it:** Currently used as a cache layer and session store for the provisioning service. Redis is included in the stack for fast ephemeral storage (e.g. rate limiting, short-lived tokens, future job queuing).

**Where it lives:**
- `docker-compose.yml` — `redis` service, port 6379
- Referenced in `REDIS_URL` env var across services

**Configuration:** `--maxmemory 96mb --maxmemory-policy allkeys-lru` — bounded memory with LRU eviction, safe for a development machine.

---

## 15. Socket.io

**What it is:** A library for real-time, bidirectional event-based communication over WebSockets (with HTTP long-polling fallback).

**Why we use it:** The provisioning pipeline runs asynchronously (8 stages, 1-5 minutes total). Socket.io pushes live status updates to the browser as each stage completes — no polling required.

**Where it lives:**
- Server: `apps/provisioning-service/src/index.ts` — Socket.io attached to the Express server
- Server: `apps/provisioning-service/src/services/projectService.ts` — `emitStatus()` fires `io.emit(`project:${projectId}`, ...)`
- Client: `apps/web/src/lib/socket.ts` — singleton socket connection
- Client: `apps/web/src/hooks/useRealTimeStatus.ts` — React hook that subscribes to `project:<id>` events

**Event format:**
```typescript
// Emitted on every status change
io.emit(`project:${projectId}`, {
  status: "PROVISIONING",
  message: "Building Docker image...",
  subStep: "docker build",
})
```

**How it helps:**
- Users see each provisioning stage appear in real time without refreshing
- Health check results (`project:<id>:health`) also stream live
- The Nginx gateway proxies Socket.io connections with proper WebSocket upgrade headers

---

## 16. Handlebars (hbs)

**What it is:** A minimal templating language — `{{variable}}` interpolation and block helpers (`{{#if}}`, `{{#each}}`).

**Why we use it:** DuckOps generates different project code for every combination of language + framework + database + ORM. Handlebars templates allow a single `Dockerfile.hbs` to produce the right Dockerfile for Express + TypeScript + PostgreSQL + Prisma vs. Fastify + JavaScript + MySQL + Drizzle.

**Where it lives:**
- `apps/provisioning-service/src/templates/` — all `.hbs` template files
  - `devops/Dockerfile.hbs` — base Dockerfile template
  - `devops/Dockerfile.nextjs.hbs`, `Dockerfile.react.hbs`, etc. — framework-specific variants
  - `devops/Jenkinsfile.hbs` — CI/CD pipeline template
  - `devops/deployment.yaml.hbs` — K8s Deployment manifest
  - `devops/service.yaml.hbs`, `ingress.yaml.hbs` — K8s Service + Ingress
  - `frontend/` — React, Vue, Next.js, Turbo app scaffolds
- `apps/provisioning-service/src/services/scaffoldService.ts` — `loadTemplate()` compiles and renders `.hbs` files

**How it helps:**
- One template per concern, not one per combination — 6 templates cover 30+ stack combinations
- `{{{pmInstall}}}` triple-stache renders package manager install command without HTML escaping (safe since it's a shell command, not HTML)
- Adding support for a new framework only requires a new template + catalog seed entry

---

## 17. Traefik Ingress

**What it is:** Traefik is a cloud-native reverse proxy and load balancer. k3d ships with Traefik as the default Ingress Controller.

**Why we use it:** Every project deployed to the k3d cluster needs to be reachable at a URL. Traefik watches for Kubernetes `Ingress` resources and automatically routes `http://<name>.localhost:8080` to the right pod.

**Where it lives:**
- K8s Ingress manifests are generated from `apps/provisioning-service/src/templates/devops/` and applied by Ansible
- The k3d cluster is created with `--port "8080:80@loadbalancer"` mapping host port 8080 to the Traefik loadbalancer

**How it helps:**
- Zero manual routing config per project — just apply an Ingress manifest
- Wildcard hostname routing: `<project-name>.localhost:8080` works for every project automatically
- Turbo (full-stack) projects get two ingress rules: `<name>-api.localhost:8080` for the API and `<name>-web.localhost:8080` for the frontend

---

## 18. Winston

**What it is:** A structured logging library for Node.js with configurable transports and log levels.

**Why we use it:** 4 services logging in different formats is unreadable. Winston gives every service consistent, structured JSON logs with timestamps, log levels, and service name labels.

**Where it lives:**
- `packages/shared-utils/src/index.ts` — `createLogger(serviceName)` factory
- Every service: `const logger = createLogger("provisioning-service")` etc.

**Usage:**
```typescript
logger.info(`Creating GitHub repo: ${username}/${name}`);
logger.warn(`Push attempt ${attempt}/5 failed`);
logger.error(`Provisioning failed: ${error.message}`);
```

---

## 19. Zod

**What it is:** A TypeScript-first schema validation library. You define schemas with `.string()`, `.object()`, etc., and Zod validates input at runtime and infers TypeScript types statically.

**Why we use it:** Express doesn't validate request bodies by default. Without validation, a missing `displayName` field propagates into Prisma and crashes with an unhelpful error. Zod validates at the route boundary before any service logic runs.

**Where it lives:**
- `apps/provisioning-service/src/routes/projects.ts` — `createProjectSchema`
- `apps/pipeline-service/src/routes/pipelines.ts` — `createSchema`
- `apps/*/src/middleware/validate.ts` — Express middleware that calls `schema.parse(req.body)` and calls `next(err)` on validation failure

**How it helps:**
- Validation errors return a structured 400 response with field-level messages
- The inferred TypeScript type from `z.infer<typeof schema>` is used as the handler's request body type — no manual interface duplication

---

## 20. GitHub OAuth + API

**What it is:** GitHub's OAuth 2.0 flow for user authentication, plus the GitHub REST API for repository management.

**Why we use it:** DuckOps creates GitHub repos on behalf of the logged-in user. Using OAuth means we have the user's GitHub access token and can create repos, push code, and store credentials in Jenkins — all as that user.

**Where it lives:**
- `apps/provisioning-service/src/services/authService.ts` — OAuth flow: `getGitHubAuthUrl`, `exchangeCodeForToken`, `getGitHubUser`, `upsertUserAndCreateSession`
- `apps/provisioning-service/src/services/githubService.ts` — repo creation + push via GitHub API
- `apps/provisioning-service/src/routes/auth.ts` — `/api/auth/github` + `/api/auth/github/callback` endpoints

**Security:**
- GitHub access tokens are stored in the session JWT (signed HS256) and never persisted to the database
- When creating repos, the token is passed to git via `GIT_ASKPASS` (a temp script that echoes the token) rather than being embedded in the remote URL — this prevents the token appearing in process lists or logs
- Repos default to **private** visibility; users can opt into public in the project creation wizard

---

## 21. TanStack Query (React Query)

**What it is:** A data-fetching and server-state management library for React. Handles caching, background refetching, loading/error states, and mutations.

**Why we use it:** The DuckOps frontend has many server-state dependencies: project list, project details, templates, pipeline status. TanStack Query manages all of this — no manual `useEffect` + `useState` data fetching patterns.

**Where it lives:**
- `apps/web/src/hooks/useProjects.ts` — `useProjects`, `useProject`, `useCreateProject`, `useDeleteProject`, `useRetryProject`
- `apps/web/src/hooks/useTemplates.ts` — `useTemplates`, `useCompatibleTemplates`
- `apps/web/src/app/providers.tsx` — `QueryClientProvider` wrapping the app

**How it helps:**
- `useCreateProject` returns an `isPending` state used to show the loading spinner on the submit button
- Cache is automatically invalidated after a project is created or deleted
- `useCompatibleTemplates` fetches compatible frameworks/databases/ORMs as the user selects options — with `isCompatLoading` state to disable the form section while loading

---

## 22. Prometheus + Grafana

**What it is:** Prometheus scrapes metrics from services on a schedule and stores them in a time-series DB. Grafana visualizes those metrics in dashboards.

**Why we use it:** While the health-service handles application-level health checks (HTTP probes), Prometheus+Grafana provides infrastructure-level observability — CPU usage, memory, request latency, error rates.

**Where it lives:**
- `monitoring/` — Prometheus config (`prometheus.yml`) and Grafana provisioning files

**Note:** Monitoring is included in the stack configuration but not started by default in `setup-local.sh` to conserve resources on local machines. Start with:
```bash
docker compose --profile monitoring up -d
```

---

## 23. node-cron

**What it is:** A cron-like scheduler for Node.js — runs functions on a time-based schedule using cron syntax.

**Why we use it:** The health service needs to check every deployed project's `/health` endpoint periodically — without a cron-like mechanism, we'd need a separate process or polling loop.

**Where it lives:**
- `apps/health-service/src/services/healthCheckService.ts` — `startHealthCheckCron()` runs every 30 seconds
- Fetches `http://<project-liveUrl>/health` for each `RUNNING` project
- Records `HealthCheck` rows in Postgres with status, response time, and HTTP status code
- Emits `project:<id>:health` Socket.io events so the UI shows live health status

**How it helps:**
- Automated, zero-config health monitoring for every project — no per-project setup
- Historical health data (last 20 checks) is available in the project detail view
- `DEGRADED` status is set automatically when health checks start failing

---

*Last updated: April 2026*
