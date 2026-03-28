# DuckOps — Implementation Progress

## Session 3 — 2026-03-28 — GitHub OAuth Auth + Private Repo Creation

### What changed

**Backend — provisioning-service**
- `packages/db/prisma/schema.prisma` — replaced `password` field on User with GitHub OAuth fields (`githubId`, `githubUsername`, `githubAccessToken`, `avatarUrl`). Added `CREATING_REPO` to `ProjectStatus` enum. Added `githubRepoUrl`, `githubRepoName`, `githubRepoFullName` to Project model.
- `apps/provisioning-service/src/services/authService.ts` — full GitHub OAuth + JWT logic: `getGitHubAuthUrl`, `exchangeCodeForToken`, `getGitHubUser`, `upsertUserAndCreateSession`, `verifyJwt`, `getUserById`. Handles private GitHub emails via fallback to `/user/emails`.
- `apps/provisioning-service/src/middleware/auth.ts` — `requireAuth` middleware: extracts Bearer token, verifies JWT, loads full user from DB, attaches to `req.user`.
- `apps/provisioning-service/src/routes/auth.ts` — `GET /api/auth/github` (redirect), `GET /api/auth/github/callback` (exchange → upsert → JWT → redirect to frontend), `GET /api/auth/me`, `POST /api/auth/logout`.
- `apps/provisioning-service/src/services/githubService.ts` — `createAndPushRepo`: creates private GitHub repo via API, writes README + .gitignore to scaffold output, runs `git init/add/commit/push` with token-authenticated remote. `deleteRepo` for cleanup on project delete.
- `apps/provisioning-service/src/services/projectService.ts` — provisioning pipeline now has 5 steps: SCAFFOLDING → **CREATING_REPO** → PROVISIONING → CONFIGURING → PIPELINE_READY. Stores GitHub repo URL/name/fullName in DB after creation. `deleteProject` also deletes the GitHub repo. All routes scoped to `req.user!.id`.
- `apps/provisioning-service/src/routes/projects.ts` — all routes require auth. POST uses `req.user!.githubUsername/githubAccessToken`. GET/DELETE enforce ownership check (403 if `project.userId !== req.user!.id`).
- `nginx/nginx.conf` — added `/api/auth` location block routing to provisioning-service.

**Frontend — apps/web**
- `src/lib/auth.ts` — localStorage session helpers + sets/clears a `duckops_session` cookie for Next.js middleware detection.
- `src/contexts/AuthContext.tsx` — `AuthProvider` with `useAuth()` hook. On mount: restores stored user optimistically, validates with `GET /api/auth/me`. `setAuthFromCallback(token)` called by callback page. `logout()` clears session + redirects.
- `src/lib/api.ts` — request interceptor attaches `Authorization: Bearer <token>`. Response interceptor clears session and redirects to `/login` on 401.
- `src/app/login/page.tsx` — dark login page with "Continue with GitHub" button linking to `${API_URL}/api/auth/github`. Redirects to `/dashboard` if already authenticated.
- `src/app/auth/callback/page.tsx` — reads `?token=` from URL, calls `setAuthFromCallback`, redirects to `/dashboard`. Handles `?error=auth_failed` case.
- `src/middleware.ts` — Next.js edge middleware: protects all routes except `/login` and `/auth/callback`. Checks for `duckops_session` cookie; redirects to `/login` if missing.
- `src/app/providers.tsx` — added `AuthProvider` wrapping `QueryClientProvider`.
- `src/app/layout.tsx` — now uses `AppShell` component instead of always rendering `Sidebar`.
- `src/components/layout/AppShell.tsx` — hides sidebar on `/login` and `/auth/callback` paths.
- `src/components/layout/Sidebar.tsx` — footer now shows logged-in user's avatar, name, `@username`, and logout button (via `useAuth()`).

**Config**
- `.env.example` — added `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `JWT_SECRET`, `APP_URL`, `FRONTEND_URL` with instructions.
- `docker-compose.yml` — added those env vars to `provisioning-service` environment block.
- `COMMANDS.md` — added Step 3: GitHub OAuth App setup with exact URLs and `openssl rand -hex 32` for JWT secret.

### What it achieved
- Users must sign in with GitHub — no password auth exists.
- After OAuth, a 7-day JWT is issued and stored in localStorage + session cookie.
- Every project is scoped to the authenticated user; cross-user access returns 403.
- On project creation, a **private GitHub repository** is automatically created under the user's account and the scaffolded code is pushed to it. The repo URL is stored in the DB and will be shown in the project detail page.
- On project deletion, the GitHub repo is also deleted.
- The frontend is fully protected: unauthenticated users are redirected to `/login` by Next.js middleware before any page loads.

---

## Session 2 — 2026-03-28 — Commands Reference

### What changed
- Created `COMMANDS.md` — full startup guide for Linux, macOS, and Windows (WSL2)

### What it achieved
One file answers "how do I run this?" for any OS. Covers prerequisites, first-time setup, dev mode (per-terminal or turbo), Docker production mode, all access URLs, database tools, Jenkins token setup, K3d/Terraform/Ansible/monitoring as optional extras, daily workflow, and troubleshooting.

---

## Session 1 — 2026-03-28 — Initial Full Implementation

### What was built

All foundational code for the DuckOps platform was implemented from scratch based on PROJECT.md.

---

### Monorepo Setup
**Files created:** `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.env.example`, `.gitignore`

**Achieved:** Full pnpm + Turborepo monorepo structure with build/dev/test pipelines wired up. Single `pnpm turbo dev` starts everything.

---

### Shared Packages

#### `packages/db`
**Files:** `prisma/schema.prisma`, `prisma/seed.ts`, `src/index.ts`, `package.json`, `tsconfig.json`

**Achieved:** Complete Prisma schema with all 9 models (User, TemplateOption, Project, Pipeline, Deployment, HealthCheck) and all enums. Seed file populates Node.js, Express, Fastify, PostgreSQL, MySQL, Prisma, Drizzle, Raw SQL options. Singleton Prisma client shared across all services.

#### `packages/shared-types`
**Files:** `src/index.ts`, `package.json`, `tsconfig.json`

**Achieved:** All TypeScript interfaces shared across frontend and backend — Project, Pipeline, HealthCheck, Deployment, TemplateOption, API request/response types, Socket.io event payloads.

#### `packages/shared-utils`
**Files:** `src/index.ts`, `package.json`, `tsconfig.json`

**Achieved:** Winston logger factory, custom error classes (AppError, NotFoundError, ValidationError, ConflictError), environment config switcher (local/cloud), slug and sleep utilities.

---

### Microservices

#### Catalog Service (port 4001)
**Files:** `src/index.ts`, `src/routes/templates.ts`, `src/middleware/errorHandler.ts`, `src/middleware/validate.ts`, `Dockerfile`, `package.json`, `tsconfig.json`

**Achieved:**
- `GET /api/templates` — all options grouped by layer (LANGUAGE/FRAMEWORK/DATABASE/ORM)
- `GET /api/templates/compatible` — filtered by current selections (drives the cascading form UI)
- `GET /api/templates/:layer` — options for a specific layer
- `POST /api/templates` — create new template option (admin)
- Full Zod validation, error handling, Socket.io, health check endpoint

#### Provisioning Service (port 4002)
**Files:** `src/index.ts`, `src/routes/projects.ts`, `src/services/projectService.ts`, `src/services/scaffoldService.ts`, `src/services/terraformService.ts`, `src/services/ansibleService.ts`, all middleware, Handlebars templates, `Dockerfile`

**Achieved:**
- `POST /api/projects` — creates project, kicks off full async provisioning pipeline
- `GET /api/projects` / `GET /api/projects/:id` / `DELETE /api/projects/:id`
- Full 5-step async provisioning: INITIALIZING → SCAFFOLDING → PROVISIONING → CONFIGURING → PIPELINE_READY
- Real-time Socket.io events emitted at every status change
- **Handlebars scaffold templates** for:
  - Express + Prisma/Drizzle/Raw SQL app
  - Fastify + Prisma/Drizzle/Raw SQL app
  - PostgreSQL Prisma schema, Drizzle schema, raw pg client
  - Dockerfile (with conditional Prisma generate)
  - Kubernetes deployment.yaml + service.yaml with readiness/liveness probes
  - Jenkinsfile with full 6-stage pipeline
  - package.json and tsconfig.json generation
- **Terraform service**: runs `init → workspace → plan → apply`, passes project_name/namespace as TF vars
- **Ansible service**: runs `deploy-app.yml` playbook with project vars

#### Pipeline Service (port 4003)
**Files:** `src/index.ts`, `src/routes/pipelines.ts`, `src/services/jenkinsService.ts`, `src/services/pipelineService.ts`, middleware, `Dockerfile`

**Achieved:**
- `POST /api/pipelines` — creates Jenkins job via REST API, stores pipeline in DB
- `POST /api/pipelines/:id/build` — trigger a build
- `POST /api/pipelines/:id/sync` — sync last build status from Jenkins
- `GET /api/pipelines/:id` / `GET /api/pipelines/project/:projectId` / `DELETE`
- Jenkins job XML config generated dynamically (Checkout → Install → Test → Docker Build → Push → K8s Deploy)
- Full Jenkins REST API integration with Basic auth

#### Health Service (port 4004)
**Files:** `src/index.ts`, `src/routes/health.ts`, `src/services/healthCheckService.ts`, middleware, `Dockerfile`

**Achieved:**
- `GET /api/health/:projectId` — latest health + history
- `GET /api/logs/:projectId` — kubectl pod logs
- `node-cron` job runs every 30 seconds: pings all RUNNING/DEGRADED projects, saves HealthCheck records, updates project status (RUNNING ↔ DEGRADED), emits Socket.io events to frontend

---

### Frontend (Next.js 15 + TypeScript)

**Files:** `src/app/layout.tsx`, `src/app/page.tsx` (→ redirect), `src/app/providers.tsx`, `src/app/dashboard/page.tsx`, `src/app/projects/page.tsx`, `src/app/projects/new/page.tsx`, `src/app/projects/[id]/page.tsx`, `src/app/templates/page.tsx`

**Components:** `ui/badge`, `ui/button`, `ui/card`, `ui/input`, `ui/label`, `layout/Sidebar`, `layout/Header`, `projects/StatusBadge`, `projects/ProjectCard`, `projects/CreateProjectForm`

**Hooks:** `useProjects`, `useProject`, `useCreateProject`, `useDeleteProject`, `useTemplates`, `useCompatibleTemplates`, `useRealTimeStatus`

**Store:** `projectStore` (Zustand — tracks selected project ID and live status overrides from Socket.io)

**Achieved:**
- Full sidebar navigation with active state
- **Dashboard** — 4 stats cards (total/running/in-progress/failed), recent projects grid
- **Projects list** — searchable grid with live status badges
- **Create Project form** — cascading selector (language → framework → database → ORM), compatible options filter, slug preview, summary card, submit with loading state
- **Project detail** — progress stepper (INITIALIZING→RUNNING), tech stack cards, infrastructure info, pipeline status, health check history, deployment history, real-time Socket.io status updates
- **Templates browser** — all available options organized by layer
- TanStack React Query for all data fetching with auto-refetch
- Socket.io client with real-time status updates on project detail page

---

### Infrastructure

#### Docker Compose
**File:** `docker-compose.yml`

**Achieved:** Full local stack — postgres:16, redis:7, jenkins:lts (with Docker socket mounted), all 4 microservices, nginx gateway. Health checks on postgres/redis. All services wired together.

#### Nginx Gateway
**File:** `nginx/nginx.conf`

**Achieved:** Routes `/api/templates` → catalog, `/api/projects` → provisioning, `/api/pipelines` → pipeline, `/api/health` + `/api/logs` → health. WebSocket upgrade support for Socket.io.

#### Scripts
**Files:** `scripts/setup-local.sh`, `scripts/teardown-local.sh`, `scripts/build-all.sh`, `scripts/deploy-k8s.sh`

**Achieved:** One-command local setup (checks prereqs, installs deps, creates K3d cluster, runs migrations + seed), teardown, Docker image build+push, K8s deploy.

#### Terraform
**Files:** `infra/terraform/environments/local/main.tf` (+ variables, outputs, tfvars), `infra/terraform/environments/cloud/main.tf`, `infra/terraform/modules/k8s-namespace/main.tf`, `infra/terraform/modules/k8s-deployment/main.tf`

**Achieved:** Kubernetes provider config for local K3d. Per-project namespaces and config maps. Workspace per project. Cloud OCI provider stub.

#### Ansible
**Files:** `infra/ansible/inventory/local.yml`, `infra/ansible/inventory/cloud.yml`, `infra/ansible/playbooks/setup-node.yml`, `infra/ansible/playbooks/deploy-app.yml`, `infra/ansible/playbooks/configure-monitoring.yml`

**Achieved:** Local + cloud inventory, Docker+K3s+Node.js setup playbook, app deploy playbook (applies K8s manifests from scaffold output), monitoring (Prometheus+Grafana via Helm) playbook.

#### Kubernetes Manifests
**Files:** `infra/kubernetes/base/namespace.yaml`, `infra/kubernetes/base/registry.yaml`, `infra/kubernetes/services/catalog/`, + provisioning/pipeline/health (written by background agent)

**Achieved:** Base namespace + registry config. Per-service deployments with readiness probes, resource limits, secret references.

#### Monitoring
**Files:** `monitoring/prometheus/prometheus.yml`, `monitoring/grafana/dashboards/duckops-dashboard.json` (written by background agent)

---

### What's ready to run

```bash
# 1. Install deps
pnpm install

# 2. Start postgres + redis
docker compose up postgres redis -d

# 3. Run migrations + seed
cd packages/db && pnpm prisma migrate dev --name init && pnpm prisma db seed

# 4. Start all services in dev mode
pnpm turbo dev
```

Access points:
- Frontend: http://localhost:3000
- API Gateway: http://localhost:4000
- Catalog: http://localhost:4001
- Provisioning: http://localhost:4002
- Pipeline: http://localhost:4003
- Health: http://localhost:4004
- Jenkins: http://localhost:8085

---

### Next steps / what requires external tools to be running
- `k3d` cluster must be running for Terraform provisioning to work
- `terraform` CLI must be installed for `terraformService.ts`
- `ansible-playbook` must be installed for `ansibleService.ts`
- Jenkins token must be set in `.env` as `JENKINS_TOKEN`
- Run `pnpm dlx shadcn@latest init` in `apps/web` if you want full shadcn component library
