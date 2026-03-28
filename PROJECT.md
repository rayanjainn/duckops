# 🦆 DuckOps — Complete Project Guide

## A Self-Service Internal Developer Platform for Automated Cloud-Native Application Provisioning

---

## Table of Contents

- [1. What is DuckOps?](#1-what-is-duckops)
- [2. Why Does This Exist?](#2-why-does-this-exist)
- [3. What Happens When a User Clicks "Create"?](#3-what-happens-when-a-user-clicks-create)
- [4. Architecture](#4-architecture)
- [5. Tech Stack](#5-tech-stack)
- [6. Project Folder Structure](#6-project-folder-structure)
- [7. Environment Setup — All Operating Systems](#7-environment-setup--all-operating-systems)
  - [7.1 Windows Setup](#71-windows-setup)
  - [7.2 macOS Setup](#72-macos-setup)
  - [7.3 Linux (Ubuntu/Debian) Setup](#73-linux-ubuntudebian-setup)
  - [7.4 Cross-Platform Tools (Same on All OS)](#74-cross-platform-tools-same-on-all-os)
- [8. Infrastructure Setup](#8-infrastructure-setup)
  - [8.1 Docker & Docker Compose](#81-docker--docker-compose)
  - [8.2 Local Kubernetes (K3d)](#82-local-kubernetes-k3d)
  - [8.3 Local Docker Registry](#83-local-docker-registry)
  - [8.4 Jenkins](#84-jenkins)
  - [8.5 PostgreSQL + Redis](#85-postgresql--redis)
  - [8.6 Terraform](#86-terraform)
  - [8.7 Ansible](#87-ansible)
  - [8.8 Monitoring Stack (Prometheus + Grafana)](#88-monitoring-stack-prometheus--grafana)
- [9. Database Schema](#9-database-schema)
- [10. Backend Microservices — Detailed](#10-backend-microservices--detailed)
- [11. Frontend Application — Detailed](#11-frontend-application--detailed)
- [12. Template System — How Scaffolding Works](#12-template-system--how-scaffolding-works)
- [13. Terraform Configuration](#13-terraform-configuration)
- [14. Ansible Playbooks](#14-ansible-playbooks)
- [15. Jenkins Pipeline Setup](#15-jenkins-pipeline-setup)
- [16. Kubernetes Manifests](#16-kubernetes-manifests)
- [17. Docker Configuration](#17-docker-configuration)
- [18. Local to Cloud Switch](#18-local-to-cloud-switch)
- [19. Running Everything Locally — Full Walkthrough](#19-running-everything-locally--full-walkthrough)
- [20. Free Cloud Deployment (Oracle Cloud)](#20-free-cloud-deployment-oracle-cloud)
- [21. Demo Script](#21-demo-script)
- [22. 2-Week Sprint Plan](#22-2-week-sprint-plan)
- [23. Troubleshooting](#23-troubleshooting)

---

## 1. What is DuckOps?

DuckOps is a website where a developer fills out a form, picks a tech stack (like Node.js + Express + PostgreSQL + Prisma), clicks one button, and gets:

- A fully scaffolded project with all boilerplate code
- A running database
- A CI/CD pipeline on Jenkins
- A containerized deployment on Kubernetes
- A live URL to access the application

Think of it as an "app store for developer environments." Instead of spending hours setting up infrastructure manually, DuckOps does it in minutes.

### Who is this for?

- Developers in a company who want to start new projects quickly
- DevOps teams who want to standardize how projects are created
- Platform engineering teams building golden paths for developers

---

## 2. Why Does This Exist?

### The Problem

Every time a developer starts a new project, they have to:

1. **Create a Git repository** — set up folder structure, configs, linting rules
2. **Choose and configure a database** — install locally, create schemas, set up connections
3. **Write a Dockerfile** — figure out the right base image, multi-stage builds, etc.
4. **Write Kubernetes manifests** — deployment, service, ingress, configmaps
5. **Set up CI/CD** — write a Jenkinsfile, configure webhooks, set up build triggers
6. **Configure monitoring** — set up health checks, logging, metrics

This takes 1-3 days of work and every developer does it differently, leading to inconsistency across teams.

### The Solution

DuckOps automates all 6 steps into a single click. The platform ensures every project follows the same standards, uses approved technologies, and has proper DevOps setup from day one.

---

## 3. What Happens When a User Clicks "Create"?

Here is the exact flow, step by step:

```
Step 1: User opens DuckOps dashboard (Next.js frontend)
   │
   ▼
Step 2: User fills the "Create Project" form
        - Project name: "my-todo-api"
        - Language: Node.js
        - Framework: Express
        - Database: PostgreSQL
        - ORM: Prisma
   │
   ▼
Step 3: Frontend sends POST request to Provisioning Service
        POST /api/projects { name, language, framework, database, orm }
   │
   ▼
Step 4: Provisioning Service saves project to database
        Status: "INITIALIZING"
        (Emits Socket.io event → frontend shows "Creating project...")
   │
   ▼
Step 5: Scaffold Service assembles project files
        - Picks the right skeleton files based on user choices
        - Replaces placeholders ({{PROJECT_NAME}}, {{DATABASE_URL}})
        - Merges dependencies from all selected options
        - Generates package.json, Dockerfile, Jenkinsfile, K8s manifests
        Status: "SCAFFOLDING"
   │
   ▼
Step 6: Terraform runs to create infrastructure
        - Creates Kubernetes namespace
        - Creates database (or database schema within shared DB)
        - Sets up networking rules
        Status: "PROVISIONING"
   │
   ▼
Step 7: Ansible configures the environment
        - Installs any required dependencies
        - Sets environment variables
        - Configures secrets
        Status: "CONFIGURING"
   │
   ▼
Step 8: Pipeline Service calls Jenkins API
        - Creates a new Jenkins pipeline job
        - Configures it to watch the project's Git repo
        - Sets up build → test → docker build → deploy stages
        Status: "PIPELINE_READY"
   │
   ▼
Step 9: First deployment triggers automatically
        - Jenkins builds the Docker image
        - Pushes to local registry
        - Deploys to K3s cluster
        Status: "DEPLOYING"
   │
   ▼
Step 10: Health Service starts monitoring
         - Periodically pings the deployed app
         - Collects logs from Kubernetes
         - Reports health status to dashboard
         Status: "RUNNING"
   │
   ▼
Step 11: User sees on dashboard:
         "✅ my-todo-api is live at http://my-todo-api.local:8080"
```

---

## 4. Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DUCKOPS PLATFORM                             │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    FRONTEND LAYER                              │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │              Next.js 15 + TypeScript                      │  │  │
│  │  │              Tailwind CSS + shadcn/ui                     │  │  │
│  │  │                                                          │  │  │
│  │  │   Pages:                                                 │  │  │
│  │  │   /              → Landing & Login                       │  │  │
│  │  │   /dashboard     → Overview of all projects              │  │  │
│  │  │   /projects/new  → Create project form (stack selector)  │  │  │
│  │  │   /projects/:id  → Project detail (logs, health, URL)    │  │  │
│  │  │   /templates     → Browse available templates            │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                    REST API + WebSocket                               │
│                              │                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                   API GATEWAY (Nginx)                          │  │
│  │                                                                │  │
│  │   /api/templates/*  → Catalog Service     (port 4001)         │  │
│  │   /api/projects/*   → Provisioning Service (port 4002)        │  │
│  │   /api/pipelines/*  → Pipeline Service    (port 4003)         │  │
│  │   /api/health/*     → Health Service      (port 4004)         │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  MICROSERVICES LAYER                           │  │
│  │                                                                │  │
│  │  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌─────────────┐  │  │
│  │  │ CATALOG  │ │ PROVISIONING │ │ PIPELINE │ │   HEALTH    │  │  │
│  │  │ SERVICE  │ │   SERVICE    │ │ SERVICE  │ │  SERVICE    │  │  │
│  │  │          │ │              │ │          │ │             │  │  │
│  │  │ Express  │ │  Express     │ │ Express  │ │  Express    │  │  │
│  │  │ Prisma   │ │  Prisma      │ │ Prisma   │ │  Prisma     │  │  │
│  │  │ TypeScript│ │  Terraform  │ │ Jenkins  │ │  node-cron  │  │  │
│  │  │          │ │  Ansible     │ │  API     │ │  Socket.io  │  │  │
│  │  │ :4001    │ │  :4002       │ │ :4003    │ │  :4004      │  │  │
│  │  └────┬─────┘ └──────┬──────┘ └────┬─────┘ └──────┬──────┘  │  │
│  │       │              │             │               │          │  │
│  └───────┼──────────────┼─────────────┼───────────────┼──────────┘  │
│          │              │             │               │              │
│  ┌───────┴──────────────┴─────────────┴───────────────┴──────────┐  │
│  │                      DATA LAYER                                │  │
│  │  ┌────────────────┐          ┌────────────────────┐           │  │
│  │  │  PostgreSQL 16  │          │     Redis 7        │           │  │
│  │  │  (via Prisma)   │          │  (cache + pub/sub) │           │  │
│  │  │  Port: 5432     │          │  Port: 6379        │           │  │
│  │  └────────────────┘          └────────────────────┘           │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                 INFRASTRUCTURE LAYER                            │  │
│  │                                                                │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │Terraform │ │ Ansible  │ │ Jenkins  │ │  K3s Cluster     │  │  │
│  │  │          │ │          │ │          │ │                  │  │  │
│  │  │ Creates  │ │Configures│ │ Builds & │ │  Runs all        │  │  │
│  │  │K8s names-│ │servers & │ │ deploys  │ │  containers      │  │  │
│  │  │paces,    │ │apps after│ │ via      │ │  via pods &      │  │  │
│  │  │resources │ │Terraform │ │ pipeline │ │  services        │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │  │
│  │                                                                │  │
│  │  ┌──────────────────┐  ┌────────────────────────────────────┐  │  │
│  │  │  Docker Registry  │  │  Monitoring (Prometheus + Grafana) │  │  │
│  │  │  (Local :5000)    │  │  Prometheus :9090 / Grafana :3001  │  │  │
│  │  └──────────────────┘  └────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Service Communication Flow

```
Frontend ──HTTP──▶ Nginx Gateway ──routes──▶ Microservices ──Prisma──▶ PostgreSQL
    ▲                                             │
    │                                             │
    └──────── Socket.io (real-time updates) ──────┘
                                                  │
                                  Provisioning ───┤──▶ Terraform CLI
                                                  ├──▶ Ansible CLI
                                                  └──▶ kubectl CLI

                                  Pipeline ────────▶ Jenkins REST API

                                  Health ──────────▶ kubectl + HTTP pings
```

---

## 5. Tech Stack

### Frontend

| Technology                 | Why We Chose It                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Next.js 15**             | Industry-standard React framework. App Router gives us server components, layouts, and API routes. Used by Netflix, TikTok, Notion. |
| **TypeScript 5**           | Catches bugs at compile time instead of runtime. Every serious project uses it.                                                     |
| **Tailwind CSS 4**         | Write styles directly in HTML. No switching between files. Much faster development.                                                 |
| **shadcn/ui**              | Beautiful, accessible components. Not a library — you own the code. Copy-paste components you can customize.                        |
| **TanStack React Query 5** | Handles all API calls, caching, loading states, and error states. Eliminates 90% of state management complexity.                    |
| **Zustand 5**              | Dead-simple global state. One file, a few lines, done. No boilerplate like Redux.                                                   |
| **Socket.io Client**       | Real-time updates. When a project status changes, the dashboard updates instantly without refreshing.                               |

### Backend (Each Microservice)

| Technology         | Why We Chose It                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| **Node.js 22 LTS** | JavaScript everywhere (same language as frontend). Huge ecosystem. Non-blocking I/O perfect for API services.   |
| **Express 5**      | Minimal, flexible, battle-tested. The most popular Node.js framework. Easy to learn, hard to outgrow.           |
| **TypeScript 5**   | Type safety across the entire stack. Shared types between frontend and backend via monorepo.                    |
| **Prisma 6**       | Best TypeScript ORM. Auto-generates types from your database schema. Migrations, seeding, studio UI built in.   |
| **Zod 3**          | Runtime validation that generates TypeScript types. Validates every API request body before it hits your logic. |
| **Socket.io 4**    | Server-side real-time events. Pushes status updates to all connected frontend clients instantly.                |
| **Winston 3**      | Structured logging with levels (info, warn, error). Outputs JSON logs that monitoring tools can parse.          |

### Database

| Technology        | Why We Chose It                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL 16** | The most advanced open-source relational database. Handles JSON, full-text search, and complex queries. Industry standard.                                     |
| **Redis 7**       | In-memory data store. Used for caching frequently accessed data (templates), job queues (provisioning tasks), and pub/sub (real-time events between services). |

### DevOps & Infrastructure Tools

| Tool               | What It Does In Our Project                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker**         | Packages each microservice into a container. "Works on my machine" becomes "works everywhere."                                                                |
| **Docker Compose** | Runs all containers locally with one command. Defines how services connect to each other.                                                                     |
| **K3s (via K3d)**  | Lightweight Kubernetes. Runs inside Docker. Identical to production Kubernetes but uses minimal resources.                                                    |
| **kubectl**        | CLI to interact with Kubernetes. Deploy, inspect, debug containers in the cluster.                                                                            |
| **Helm**           | Package manager for Kubernetes. Like npm but for K8s deployments. Makes complex deployments reusable.                                                         |
| **Terraform**      | Infrastructure as Code. Instead of clicking buttons in AWS console, you write code that creates infrastructure. Reproducible, version-controlled, reviewable. |
| **Ansible**        | Configuration management. After Terraform creates a server, Ansible configures it — installs software, sets up users, configures files.                       |
| **Jenkins**        | CI/CD server. Automatically builds, tests, and deploys code every time someone pushes to Git.                                                                 |
| **Nginx**          | Reverse proxy / API gateway. Routes incoming requests to the correct microservice. Handles SSL, load balancing.                                               |
| **Prometheus**     | Collects metrics from all services. CPU usage, request count, error rates, response times.                                                                    |
| **Grafana**        | Visualizes Prometheus metrics in beautiful dashboards.                                                                                                        |

---

## 6. Project Folder Structure

```
duckops/
│
├── .github/                          # GitHub Actions (optional CI)
│   └── workflows/
│       └── ci.yml
│
├── apps/                             # All applications live here
│   │
│   ├── web/                          # ── FRONTEND ──
│   │   ├── src/
│   │   │   ├── app/                  # Next.js App Router pages
│   │   │   │   ├── layout.tsx        # Root layout (sidebar, header)
│   │   │   │   ├── page.tsx          # Landing page / login
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx      # Main dashboard
│   │   │   │   ├── projects/
│   │   │   │   │   ├── page.tsx      # All projects list
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx  # Create new project form
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx  # Single project detail
│   │   │   │   └── templates/
│   │   │   │       └── page.tsx      # Browse templates
│   │   │   │
│   │   │   ├── components/           # React components
│   │   │   │   ├── ui/               # shadcn/ui base components
│   │   │   │   ├── layout/           # Sidebar, Header, Footer
│   │   │   │   ├── dashboard/        # Dashboard-specific components
│   │   │   │   ├── projects/         # Project-specific components
│   │   │   │   └── common/           # Shared components
│   │   │   │
│   │   │   ├── lib/                  # Utility functions
│   │   │   │   ├── api.ts            # Axios/fetch API client
│   │   │   │   ├── socket.ts         # Socket.io connection
│   │   │   │   └── utils.ts          # Helper functions
│   │   │   │
│   │   │   ├── hooks/                # Custom React hooks
│   │   │   │   ├── useProjects.ts    # Fetch & manage projects
│   │   │   │   ├── useTemplates.ts   # Fetch templates
│   │   │   │   └── useRealTimeStatus.ts  # Socket.io hook
│   │   │   │
│   │   │   ├── stores/               # Zustand state stores
│   │   │   │   └── projectStore.ts
│   │   │   │
│   │   │   └── types/                # TypeScript type definitions
│   │   │       └── index.ts
│   │   │
│   │   ├── public/                   # Static assets
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts
│   │   ├── next.config.ts
│   │   └── Dockerfile
│   │
│   ├── catalog-service/              # ── MICROSERVICE 1 ──
│   │   ├── src/
│   │   │   ├── index.ts              # Express app entry point
│   │   │   ├── routes/
│   │   │   │   ├── templates.ts      # GET /templates, POST /templates
│   │   │   │   └── options.ts        # GET /options (languages, ORMs, etc.)
│   │   │   ├── controllers/
│   │   │   │   └── templateController.ts
│   │   │   ├── services/
│   │   │   │   └── templateService.ts
│   │   │   └── middleware/
│   │   │       ├── errorHandler.ts
│   │   │       └── validate.ts       # Zod validation middleware
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   ├── provisioning-service/         # ── MICROSERVICE 2 ──
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   └── projects.ts       # POST /projects, GET /projects/:id
│   │   │   ├── controllers/
│   │   │   │   └── projectController.ts
│   │   │   ├── services/
│   │   │   │   ├── projectService.ts      # Orchestrates the full flow
│   │   │   │   ├── scaffoldService.ts     # Assembles project files
│   │   │   │   ├── terraformService.ts    # Runs Terraform commands
│   │   │   │   └── ansibleService.ts      # Runs Ansible playbooks
│   │   │   └── templates/                 # Skeleton code files
│   │   │       ├── nodejs/
│   │   │       │   ├── express/
│   │   │       │   │   └── index.ts.hbs   # Handlebars template
│   │   │       │   └── fastify/
│   │   │       │       └── index.ts.hbs
│   │   │       ├── databases/
│   │   │       │   └── postgresql/
│   │   │       │       ├── prisma/
│   │   │       │       │   ├── schema.prisma.hbs
│   │   │       │       │   └── client.ts.hbs
│   │   │       │       ├── drizzle/
│   │   │       │       │   ├── schema.ts.hbs
│   │   │       │       │   └── client.ts.hbs
│   │   │       │       └── raw/
│   │   │       │           └── client.ts.hbs
│   │   │       └── devops/
│   │   │           ├── Dockerfile.hbs
│   │   │           ├── Jenkinsfile.hbs
│   │   │           ├── deployment.yaml.hbs
│   │   │           └── service.yaml.hbs
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   ├── pipeline-service/             # ── MICROSERVICE 3 ──
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   └── pipelines.ts      # POST /pipelines, GET /pipelines/:id
│   │   │   ├── controllers/
│   │   │   │   └── pipelineController.ts
│   │   │   └── services/
│   │   │       ├── jenkinsService.ts  # Talks to Jenkins REST API
│   │   │       └── pipelineService.ts # Pipeline CRUD
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── health-service/               # ── MICROSERVICE 4 ──
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/
│       │   │   ├── health.ts          # GET /health/:projectId
│       │   │   └── logs.ts            # GET /logs/:projectId
│       │   ├── controllers/
│       │   │   └── healthController.ts
│       │   └── services/
│       │       ├── healthCheckService.ts   # Cron job that pings apps
│       │       └── logService.ts           # Fetches K8s pod logs
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
│
├── packages/                         # Shared code across services
│   │
│   ├── db/                           # ── SHARED DATABASE PACKAGE ──
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Single source of truth for DB
│   │   │   ├── migrations/           # Auto-generated by Prisma
│   │   │   └── seed.ts               # Seeds initial templates
│   │   ├── src/
│   │   │   └── index.ts              # Exports Prisma client
│   │   └── package.json
│   │
│   ├── shared-types/                 # ── SHARED TYPESCRIPT TYPES ──
│   │   ├── src/
│   │   │   └── index.ts              # Project, Template, Pipeline types
│   │   └── package.json
│   │
│   └── shared-utils/                 # ── SHARED UTILITY FUNCTIONS ──
│       ├── src/
│       │   └── index.ts              # Logger factory, error classes
│       └── package.json
│
├── infra/                            # ── INFRASTRUCTURE AS CODE ──
│   │
│   ├── terraform/
│   │   ├── environments/
│   │   │   ├── local/                # Local K3d cluster resources
│   │   │   │   ├── main.tf
│   │   │   │   ├── variables.tf
│   │   │   │   ├── outputs.tf
│   │   │   │   └── terraform.tfvars
│   │   │   └── cloud/                # Oracle Cloud / AWS resources
│   │   │       ├── main.tf
│   │   │       ├── variables.tf
│   │   │       ├── outputs.tf
│   │   │       └── terraform.tfvars
│   │   └── modules/                  # Reusable Terraform modules
│   │       ├── k8s-namespace/
│   │       │   └── main.tf
│   │       ├── k8s-deployment/
│   │       │   └── main.tf
│   │       └── k8s-database/
│   │           └── main.tf
│   │
│   ├── ansible/
│   │   ├── inventory/
│   │   │   ├── local.yml             # localhost targets
│   │   │   └── cloud.yml             # Cloud VM targets
│   │   ├── playbooks/
│   │   │   ├── setup-node.yml        # Install Docker, K3s on a server
│   │   │   ├── deploy-app.yml        # Deploy an app to K3s
│   │   │   └── configure-monitoring.yml
│   │   └── roles/
│   │       ├── docker/
│   │       │   └── tasks/main.yml
│   │       ├── k3s/
│   │       │   └── tasks/main.yml
│   │       └── common/
│   │           └── tasks/main.yml
│   │
│   └── kubernetes/
│       ├── base/                     # Cluster-level resources
│       │   ├── namespace.yaml
│       │   ├── ingress.yaml
│       │   └── registry.yaml
│       └── services/                 # Per-service K8s manifests
│           ├── catalog/
│           │   ├── deployment.yaml
│           │   └── service.yaml
│           ├── provisioning/
│           │   ├── deployment.yaml
│           │   └── service.yaml
│           ├── pipeline/
│           │   ├── deployment.yaml
│           │   └── service.yaml
│           └── health/
│               ├── deployment.yaml
│               └── service.yaml
│
├── nginx/                            # ── API GATEWAY CONFIG ──
│   └── nginx.conf
│
├── monitoring/                       # ── OBSERVABILITY ──
│   ├── prometheus/
│   │   └── prometheus.yml
│   └── grafana/
│       └── dashboards/
│           └── duckops-dashboard.json
│
├── scripts/                          # ── HELPER SCRIPTS ──
│   ├── setup-local.sh                # One-command local setup
│   ├── teardown-local.sh             # Clean up everything
│   ├── build-all.sh                  # Build all Docker images
│   └── deploy-k8s.sh                # Deploy to K3d cluster
│
├── docker-compose.yml                # Local development (hot reload)
├── docker-compose.prod.yml           # Production-like local setup
├── pnpm-workspace.yaml               # Monorepo workspace config
├── turbo.json                        # Turborepo build config
├── package.json                      # Root package.json
├── .env.example                      # Environment variable template
├── .gitignore
└── README.md
```

---

## 7. Environment Setup — All Operating Systems

### Important Note Before Starting

Every team member must complete the setup for their OS. After completing the OS-specific setup, everyone follows the same "Cross-Platform Tools" section.

**Minimum System Requirements:**

- 8 GB RAM (16 GB recommended — Docker + K3s + Jenkins are memory hungry)
- 20 GB free disk space
- Stable internet connection for initial downloads

---

### 7.1 Windows Setup

Windows requires WSL2 (Windows Subsystem for Linux). All our tools run inside a Linux environment on Windows.

#### Step 1: Enable WSL2

**What is WSL2?** It runs a real Linux kernel inside Windows. Docker, K3s, and most DevOps tools are built for Linux, so WSL2 gives us native Linux performance without dual-booting.

Open PowerShell as Administrator and run:

```powershell
# This single command installs WSL2 with Ubuntu
wsl --install

# Restart your computer after this completes
```

After restart, Ubuntu will open automatically. Set your username and password when prompted.

#### Step 2: Update Ubuntu inside WSL2

```bash
# Open the Ubuntu terminal from Start Menu
sudo apt update && sudo apt upgrade -y
```

#### Step 3: Install Docker Desktop for Windows

1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/
2. Run the installer
3. During installation, check **"Use WSL 2 instead of Hyper-V"**
4. After installation, open Docker Desktop
5. Go to Settings → Resources → WSL Integration → Enable for your Ubuntu distro
6. Click "Apply & Restart"

Verify Docker works inside WSL2:

```bash
# In your Ubuntu terminal
docker --version
# Expected: Docker version 27.x.x

docker compose version
# Expected: Docker Compose version v2.x.x

# Test Docker works
docker run hello-world
```

#### Step 4: Install Git for Windows

```bash
# Inside WSL2 Ubuntu terminal
sudo apt install -y git
git --version
# Expected: git version 2.x.x

# Configure Git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

#### Step 5: Install essential build tools

```bash
sudo apt install -y curl wget unzip build-essential
```

#### Step 6: Set up your working directory

```bash
# Create your project folder inside WSL2 file system (NOT in /mnt/c/)
# Working in /mnt/c/ is extremely slow for Docker
mkdir -p ~/projects
cd ~/projects
```

**IMPORTANT FOR WINDOWS USERS:** Always work inside the WSL2 file system (`~/projects`), NOT in `/mnt/c/Users/...`. Docker performance is 5-10x faster in the WSL2 file system.

#### Accessing WSL2 files from Windows

You can access WSL2 files in Windows Explorer at: `\\wsl$\Ubuntu\home\yourusername\projects`

#### Using VS Code with WSL2

```bash
# Install VS Code on Windows normally, then inside WSL2 terminal:
code .
# This opens VS Code connected to WSL2 — all terminal commands run in Linux
```

---

### 7.2 macOS Setup

#### Step 1: Install Homebrew

**What is Homebrew?** It's the package manager for macOS — like apt for Ubuntu. Almost every developer tool on macOS is installed via Homebrew.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# After installation, add Homebrew to your PATH
# For Apple Silicon Macs (M1/M2/M3/M4):
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc

# For Intel Macs:
echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc

# Verify
brew --version
```

#### Step 2: Install Docker Desktop for macOS

```bash
brew install --cask docker

# OR download from: https://www.docker.com/products/docker-desktop/
# Choose the correct chip: Apple Silicon (M1/M2/M3/M4) or Intel
```

After installing, open Docker Desktop from Applications. Wait for it to start (whale icon in menu bar).

```bash
# Verify
docker --version
docker compose version
docker run hello-world
```

**Docker Desktop Settings for macOS:**

1. Open Docker Desktop → Settings → Resources
2. Set Memory to at least 4 GB (6 GB recommended)
3. Set CPU to at least 4 cores
4. Click "Apply & Restart"

#### Step 3: Install Git

```bash
# macOS usually has Git pre-installed, but install latest:
brew install git
git --version

git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

#### Step 4: Install essential tools

```bash
brew install curl wget
```

#### Step 5: Set up your working directory

```bash
mkdir -p ~/projects
cd ~/projects
```

---

### 7.3 Linux (Ubuntu/Debian) Setup

#### Step 1: Update your system

```bash
sudo apt update && sudo apt upgrade -y
```

#### Step 2: Install essential tools

```bash
sudo apt install -y \
  curl \
  wget \
  unzip \
  git \
  build-essential \
  apt-transport-https \
  ca-certificates \
  gnupg \
  lsb-release \
  software-properties-common
```

#### Step 3: Install Docker

```bash
# Remove any old versions
sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to the docker group (so you don't need sudo)
sudo usermod -aG docker $USER

# IMPORTANT: Log out and log back in for group change to take effect
# Or run: newgrp docker

# Verify
docker --version
docker compose version
docker run hello-world
```

#### Step 4: Configure Git

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

#### Step 5: Set up your working directory

```bash
mkdir -p ~/projects
cd ~/projects
```

---

### 7.4 Cross-Platform Tools (Same on All OS)

From this point, ALL commands are the same whether you're on Windows (inside WSL2), macOS, or Linux.

#### 1. Node.js 22 LTS (via nvm)

**What is nvm?** Node Version Manager lets you install and switch between multiple Node.js versions. Essential because different projects may need different Node versions.

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Reload your shell
source ~/.bashrc    # Linux/WSL2
# OR
source ~/.zshrc     # macOS

# Verify nvm installed
nvm --version
# Expected: 0.40.1

# Install Node.js 22 LTS
nvm install 22

# Set it as default
nvm alias default 22

# Verify
node --version
# Expected: v22.x.x

npm --version
# Expected: 10.x.x
```

#### 2. pnpm (Fast Package Manager)

**What is pnpm?** It's like npm but 2-3x faster and uses disk space more efficiently. It creates hard links instead of copying node_modules, saving gigabytes on large monorepos.

```bash
# Install pnpm globally
npm install -g pnpm

# Verify
pnpm --version
# Expected: 9.x.x
```

#### 3. K3d (K3s in Docker)

**What is K3d?** It runs K3s (lightweight Kubernetes) inside Docker containers. This means you get a fully functional Kubernetes cluster without installing K3s directly on your machine. Perfect for local development. Works on all operating systems because Docker handles the Linux part.

```bash
# Install K3d
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

# Verify
k3d --version
# Expected: k3d version v5.x.x
```

**Why K3d over Minikube?**

- K3d is 10x faster to start (seconds vs minutes)
- Uses much less RAM
- Multiple clusters possible
- K3s is certified Kubernetes — identical behavior to production
- Your professor said no Minikube anyway

#### 4. kubectl (Kubernetes CLI)

**What is kubectl?** It's the command-line tool to interact with any Kubernetes cluster. You use it to deploy apps, inspect pods, check logs, and manage everything in your cluster.

```bash
# Linux/WSL2
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl

# macOS
brew install kubectl
# OR
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/darwin/arm64/kubectl"
sudo install -m 0755 kubectl /usr/local/bin/kubectl

# Verify
kubectl version --client
# Expected: Client Version: v1.3x.x
```

#### 5. Helm (Kubernetes Package Manager)

**What is Helm?** Think of it as npm for Kubernetes. Instead of writing 10 YAML files to deploy an app, you install a Helm "chart" that contains all the YAML pre-configured. We'll use it to install Jenkins, Prometheus, and Grafana into our cluster.

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Verify
helm version
# Expected: version.BuildInfo{Version:"v3.x.x"...}
```

#### 6. Terraform

**What is Terraform?** It lets you define infrastructure (servers, databases, networks) as code in `.tf` files. Instead of clicking through the AWS/Oracle console, you write what you want and Terraform creates it. If you delete the code, Terraform destroys the infrastructure. Everything is version-controlled and reproducible.

```bash
# Linux/WSL2
sudo apt-get update && sudo apt-get install -y gnupg software-properties-common

wget -O- https://apt.releases.hashicorp.com/gpg | \
gpg --dearmor | \
sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg > /dev/null

echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] \
https://apt.releases.hashicorp.com $(lsb_release -cs) main" | \
sudo tee /etc/apt/sources.list.d/hashicorp.list

sudo apt update && sudo apt install terraform

# macOS
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Verify
terraform --version
# Expected: Terraform v1.9.x
```

#### 7. Ansible

**What is Ansible?** It's a configuration management tool. After Terraform creates a server, Ansible SSH-es into it and configures it — installs Docker, sets up users, copies config files, starts services. It uses simple YAML files called "playbooks" that describe the desired state of a machine.

```bash
# Linux/WSL2
sudo apt install -y ansible

# macOS
brew install ansible

# Verify
ansible --version
# Expected: ansible [core 2.17.x]
```

#### 8. Turborepo (Monorepo Build System)

**What is Turborepo?** When you have 6 apps in one repo (frontend + 4 services + shared packages), building them individually is slow. Turborepo builds them in parallel, caches results, and only rebuilds what changed. A single `turbo build` command builds everything in the right order.

```bash
pnpm install -g turbo

# Verify
turbo --version
```

---

## 8. Infrastructure Setup

Now let's set up all the infrastructure services locally.

### 8.1 Docker & Docker Compose

Already installed in the OS-specific steps above. Just verify:

```bash
docker --version
docker compose version
```

### 8.2 Local Kubernetes (K3d)

#### Create the DuckOps Cluster

```bash
# Create a K3d cluster named "duckops"
# --port flags expose the cluster's ports to your machine
# --agents 2 creates 2 worker nodes (like real production)
k3d cluster create duckops \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer" \
  --port "30000-30100:30000-30100@server:0" \
  --agents 2

# Verify the cluster is running
kubectl get nodes
# Expected output:
# NAME                   STATUS   ROLES                  AGE   VERSION
# k3d-duckops-server-0   Ready    control-plane,master   30s   v1.3x.x
# k3d-duckops-agent-0    Ready    <none>                 25s   v1.3x.x
# k3d-duckops-agent-1    Ready    <none>                 25s   v1.3x.x

# Check all system pods are running
kubectl get pods -A
```

#### Useful K3d Commands

```bash
# Stop the cluster (saves resources when not working)
k3d cluster stop duckops

# Start it again
k3d cluster start duckops

# Delete the cluster entirely
k3d cluster delete duckops

# List all clusters
k3d cluster list
```

### 8.3 Local Docker Registry

**Why a local registry?** When Kubernetes pulls Docker images, it pulls from a registry. Docker Hub has rate limits and requires internet. A local registry is instant, free, and works offline.

```bash
# Create a local registry that K3d can access
k3d registry create duckops-registry --port 5111

# If you already created a cluster, delete and recreate with registry:
k3d cluster delete duckops

k3d cluster create duckops \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer" \
  --port "30000-30100:30000-30100@server:0" \
  --agents 2 \
  --registry-use k3d-duckops-registry:5111

# Verify registry works
curl http://localhost:5111/v2/_catalog
# Expected: {"repositories":[]}

# To push images to this registry, tag them as:
# k3d-duckops-registry:5111/image-name:tag
```

### 8.4 Jenkins

#### Option A: Run Jenkins via Docker Compose (Recommended for Development)

This will be included in our `docker-compose.yml` — see section 17.

#### Option B: Run Jenkins Standalone (For Testing Jenkins Separately)

```bash
# Run Jenkins in Docker
docker run -d \
  --name jenkins \
  --restart unless-stopped \
  -p 8085:8080 \
  -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins/jenkins:lts

# Wait 30 seconds for Jenkins to start, then get the admin password
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
# Copy this password

# Open Jenkins in browser: http://localhost:8085
# Paste the admin password
# Install suggested plugins
# Create your admin user
```

#### Install Required Jenkins Plugins

After logging into Jenkins:

1. Go to **Manage Jenkins → Plugins → Available Plugins**
2. Search and install these plugins:
   - **Pipeline** (should already be installed)
   - **Docker Pipeline**
   - **Kubernetes**
   - **Git**
   - **GitHub**
   - **Blue Ocean** (beautiful pipeline UI)
   - **Pipeline REST API** (our Pipeline Service uses this)

#### Get Jenkins API Token

1. Click your username (top right) → **Configure**
2. Under **API Token** → Click **Add new Token**
3. Name it "duckops" → Click **Generate**
4. Copy and save this token — you'll need it in your `.env` file

### 8.5 PostgreSQL + Redis

#### Via Docker (Standalone for Development)

```bash
# PostgreSQL
docker run -d \
  --name duckops-postgres \
  --restart unless-stopped \
  -p 5432:5432 \
  -e POSTGRES_USER=duckops \
  -e POSTGRES_PASSWORD=duckops123 \
  -e POSTGRES_DB=duckops \
  -v duckops_pgdata:/var/lib/postgresql/data \
  postgres:16-alpine

# Redis
docker run -d \
  --name duckops-redis \
  --restart unless-stopped \
  -p 6379:6379 \
  -v duckops_redis:/data \
  redis:7-alpine

# Verify PostgreSQL
docker exec -it duckops-postgres psql -U duckops -c "SELECT version();"
# Expected: PostgreSQL 16.x

# Verify Redis
docker exec -it duckops-redis redis-cli ping
# Expected: PONG
```

### 8.6 Terraform

Terraform is already installed. For local development, we use the **Kubernetes provider** to create resources in our K3d cluster.

#### Verify Terraform Can Talk to Your K3d Cluster

```bash
cd ~/projects/duckops/infra/terraform/environments/local

# Initialize Terraform (downloads required providers)
terraform init

# See what Terraform would create
terraform plan

# Apply changes
terraform apply
```

We'll write the actual Terraform files in Section 13.

### 8.7 Ansible

Ansible is already installed. For local development, we use `connection: local` to configure the local machine.

#### Verify Ansible Works

```bash
# Test Ansible can run locally
ansible localhost -m ping
# Expected:
# localhost | SUCCESS => {
#     "changed": false,
#     "ping": "pong"
# }
```

### 8.8 Monitoring Stack (Prometheus + Grafana)

#### Install via Helm into K3d Cluster

```bash
# Add the Prometheus community Helm chart repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Create a monitoring namespace
kubectl create namespace monitoring

# Install Prometheus + Grafana together (kube-prometheus-stack)
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.service.type=NodePort \
  --set grafana.service.nodePort=30001 \
  --set prometheus.service.type=NodePort \
  --set prometheus.service.nodePort=30002

# Wait for all pods to be ready (takes 2-3 minutes)
kubectl get pods -n monitoring -w

# Access Grafana
# URL: http://localhost:30001
# Username: admin
# Password: prom-operator
# (You can change this in the Helm values)

# Access Prometheus
# URL: http://localhost:30002
```

---

## 9. Database Schema

This is the single Prisma schema shared by all microservices. Located at `packages/db/prisma/schema.prisma`.

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── USER MANAGEMENT ────────────────────────────────────────────

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String   // hashed
  role      Role     @default(DEVELOPER)
  projects  Project[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role {
  ADMIN
  DEVELOPER
}

// ─── TEMPLATE SYSTEM ────────────────────────────────────────────

model TemplateOption {
  id           String   @id @default(cuid())
  layer        Layer    // LANGUAGE, FRAMEWORK, DATABASE, ORM
  name         String   // "nodejs", "express", "prisma"
  displayName  String   // "Node.js", "Express", "Prisma"
  description  String?
  icon         String?  // URL or icon name
  version      String   // "22.x", "5.x", "6.x"
  compatibleWith Json   // {"database": ["postgresql", "mysql"]}
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  @@unique([layer, name])
}

enum Layer {
  LANGUAGE
  FRAMEWORK
  DATABASE
  ORM
}

// ─── PROJECT MANAGEMENT ─────────────────────────────────────────

model Project {
  id            String        @id @default(cuid())
  name          String        @unique  // "my-todo-api"
  displayName   String        // "My Todo API"
  description   String?

  // Tech stack choices
  language      String        // "nodejs"
  framework     String        // "express"
  database      String        // "postgresql"
  orm           String        // "prisma"

  // Status tracking
  status        ProjectStatus @default(INITIALIZING)
  statusMessage String?       // Human-readable status detail

  // Infrastructure details
  namespace     String?       // K8s namespace
  liveUrl       String?       // "http://my-todo-api.local:8080"
  internalPort  Int?          // Port inside the container
  externalPort  Int?          // Port exposed to the user

  // Relationships
  userId        String
  user          User          @relation(fields: [userId], references: [id])
  pipeline      Pipeline?
  deployments   Deployment[]
  healthChecks  HealthCheck[]

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

enum ProjectStatus {
  INITIALIZING     // Just created in DB
  SCAFFOLDING      // Assembling project files
  PROVISIONING     // Terraform running
  CONFIGURING      // Ansible running
  PIPELINE_READY   // Jenkins pipeline created
  DEPLOYING        // First deployment in progress
  RUNNING          // App is live and healthy
  DEGRADED         // App is live but health checks failing
  STOPPED          // Manually stopped
  FAILED           // Something went wrong
}

// ─── CI/CD PIPELINE ─────────────────────────────────────────────

model Pipeline {
  id            String        @id @default(cuid())
  projectId     String        @unique
  project       Project       @relation(fields: [projectId], references: [id])

  jenkinsJobName String       // Name of the Jenkins job
  jenkinsJobUrl  String?      // URL to Jenkins job dashboard

  // Pipeline configuration
  gitRepoUrl    String?       // Git repo URL being watched
  branch        String        @default("main")

  status        PipelineStatus @default(CREATING)
  lastBuildNumber Int?
  lastBuildStatus String?     // "SUCCESS", "FAILURE", "UNSTABLE"
  lastBuildAt   DateTime?

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

enum PipelineStatus {
  CREATING
  ACTIVE
  PAUSED
  FAILED
}

// ─── DEPLOYMENT HISTORY ─────────────────────────────────────────

model Deployment {
  id            String   @id @default(cuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id])

  version       String   // "1.0.0", "1.0.1"
  imageTag      String   // Docker image tag used

  status        DeploymentStatus @default(PENDING)
  triggeredBy   String   // "jenkins", "manual"

  // Logs and details
  buildLogs     String?  @db.Text
  deployLogs    String?  @db.Text

  startedAt     DateTime @default(now())
  completedAt   DateTime?
}

enum DeploymentStatus {
  PENDING
  BUILDING
  PUSHING
  DEPLOYING
  SUCCESS
  FAILED
  ROLLED_BACK
}

// ─── HEALTH MONITORING ─────────────────────────────────────────

model HealthCheck {
  id            String   @id @default(cuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id])

  status        HealthStatus
  responseTime  Int?     // milliseconds
  statusCode    Int?     // HTTP status code
  message       String?

  checkedAt     DateTime @default(now())

  @@index([projectId, checkedAt])
}

enum HealthStatus {
  HEALTHY
  UNHEALTHY
  TIMEOUT
  UNKNOWN
}
```

### Running Prisma Migrations

```bash
# Navigate to the db package
cd packages/db

# Generate Prisma client (creates TypeScript types from schema)
pnpm prisma generate

# Create and run migrations
pnpm prisma migrate dev --name init

# Open Prisma Studio (visual database browser)
pnpm prisma studio
# Opens at http://localhost:5555
```

### Seed Data

```typescript
// packages/db/prisma/seed.ts

import { PrismaClient, Layer } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed Languages
  await prisma.templateOption.createMany({
    data: [
      {
        layer: Layer.LANGUAGE,
        name: "nodejs",
        displayName: "Node.js",
        description: "JavaScript runtime built on Chrome's V8 engine",
        version: "22.x LTS",
        compatibleWith: {},
      },
    ],
  });

  // Seed Frameworks
  await prisma.templateOption.createMany({
    data: [
      {
        layer: Layer.FRAMEWORK,
        name: "express",
        displayName: "Express",
        description: "Fast, minimal web framework for Node.js",
        version: "5.x",
        compatibleWith: { language: ["nodejs"] },
      },
      {
        layer: Layer.FRAMEWORK,
        name: "fastify",
        displayName: "Fastify",
        description: "High-performance web framework focused on speed",
        version: "5.x",
        compatibleWith: { language: ["nodejs"] },
      },
    ],
  });

  // Seed Databases
  await prisma.templateOption.createMany({
    data: [
      {
        layer: Layer.DATABASE,
        name: "postgresql",
        displayName: "PostgreSQL",
        description: "Advanced open-source relational database",
        version: "16",
        compatibleWith: {},
      },
      {
        layer: Layer.DATABASE,
        name: "mysql",
        displayName: "MySQL",
        description: "Popular open-source relational database",
        version: "8.4",
        compatibleWith: {},
      },
    ],
  });

  // Seed ORMs
  await prisma.templateOption.createMany({
    data: [
      {
        layer: Layer.ORM,
        name: "prisma",
        displayName: "Prisma",
        description: "Next-generation TypeScript ORM with auto-generated types",
        version: "6.x",
        compatibleWith: { database: ["postgresql", "mysql"] },
      },
      {
        layer: Layer.ORM,
        name: "drizzle",
        displayName: "Drizzle",
        description: "Lightweight TypeScript ORM with SQL-like syntax",
        version: "0.36.x",
        compatibleWith: { database: ["postgresql", "mysql"] },
      },
      {
        layer: Layer.ORM,
        name: "raw",
        displayName: "Raw SQL (pg driver)",
        description: "Direct database queries without ORM overhead",
        version: "latest",
        compatibleWith: { database: ["postgresql", "mysql"] },
      },
    ],
  });

  console.log("✅ Seed data inserted successfully");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run the seed:

```bash
pnpm prisma db seed
```

---

## 10. Backend Microservices — Detailed

### Shared Express Setup (Used by Every Service)

Every microservice follows the same pattern. Here's the boilerplate:

```typescript
// Example: apps/catalog-service/src/index.ts

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

import { templateRouter } from "./routes/templates";
import { optionRouter } from "./routes/options";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: "*" },
});

// ─── MIDDLEWARE ──────────────────────────────────────────────
app.use(cors()); // Allow cross-origin requests
app.use(helmet()); // Security headers
app.use(morgan("combined")); // HTTP request logging
app.use(express.json()); // Parse JSON bodies

// ─── HEALTH CHECK ───────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "catalog-service" });
});

// ─── ROUTES ─────────────────────────────────────────────────
app.use("/api/templates", templateRouter);
app.use("/api/options", optionRouter);

// ─── ERROR HANDLER (must be last) ───────────────────────────
app.use(errorHandler);

// ─── START SERVER ───────────────────────────────────────────
const PORT = process.env.PORT || 4001;

httpServer.listen(PORT, () => {
  logger.info(`Catalog Service running on port ${PORT}`);
});

export { io };
```

### Service 1: Catalog Service (Port 4001)

**Job:** Stores and serves all available tech stack options and their compatibility rules.

**API Endpoints:**

| Method | Endpoint                | Description                                                 |
| ------ | ----------------------- | ----------------------------------------------------------- |
| GET    | /api/templates          | Get all template options grouped by layer                   |
| GET    | /api/templates/:layer   | Get options for a specific layer (e.g., /api/templates/ORM) |
| POST   | /api/templates          | Add a new template option (admin only)                      |
| GET    | /api/options/compatible | Get compatible options based on selections                  |

```typescript
// apps/catalog-service/src/routes/templates.ts

import { Router } from "express";
import { prisma } from "@duckops/db";
import { z } from "zod";

export const templateRouter = Router();

// Get all template options grouped by layer
templateRouter.get("/", async (req, res) => {
  const options = await prisma.templateOption.findMany({
    where: { isActive: true },
    orderBy: { layer: "asc" },
  });

  // Group by layer
  const grouped = options.reduce(
    (acc, option) => {
      const layer = option.layer;
      if (!acc[layer]) acc[layer] = [];
      acc[layer].push(option);
      return acc;
    },
    {} as Record<string, typeof options>,
  );

  res.json(grouped);
});

// Get compatible options based on current selections
// Example: GET /api/options/compatible?database=postgresql
templateRouter.get("/compatible", async (req, res) => {
  const { language, framework, database } = req.query;

  const allOptions = await prisma.templateOption.findMany({
    where: { isActive: true },
  });

  // Filter options that are compatible with current selections
  const compatible = allOptions.filter((option) => {
    const compat = option.compatibleWith as Record<string, string[]>;

    // If option has no compatibility rules, it's compatible with everything
    if (!compat || Object.keys(compat).length === 0) return true;

    // Check each compatibility rule
    for (const [key, values] of Object.entries(compat)) {
      const selectedValue = req.query[key] as string;
      if (selectedValue && !values.includes(selectedValue)) {
        return false;
      }
    }
    return true;
  });

  const grouped = compatible.reduce(
    (acc, option) => {
      const layer = option.layer;
      if (!acc[layer]) acc[layer] = [];
      acc[layer].push(option);
      return acc;
    },
    {} as Record<string, typeof compatible>,
  );

  res.json(grouped);
});
```

### Service 2: Provisioning Service (Port 4002)

**Job:** The brain of DuckOps. Receives project creation requests, assembles scaffold code, runs Terraform, triggers Ansible, and orchestrates the entire flow.

**API Endpoints:**

| Method | Endpoint                   | Description            |
| ------ | -------------------------- | ---------------------- |
| POST   | /api/projects              | Create a new project   |
| GET    | /api/projects              | List all projects      |
| GET    | /api/projects/:id          | Get project details    |
| DELETE | /api/projects/:id          | Destroy a project      |
| POST   | /api/projects/:id/redeploy | Trigger a redeployment |

```typescript
// apps/provisioning-service/src/services/projectService.ts

import { prisma } from "@duckops/db";
import { ProjectStatus } from "@prisma/client";
import { scaffoldProject } from "./scaffoldService";
import { runTerraform } from "./terraformService";
import { runAnsible } from "./ansibleService";
import { io } from "../index";
import { logger } from "../utils/logger";

interface CreateProjectInput {
  name: string;
  displayName: string;
  description?: string;
  language: string;
  framework: string;
  database: string;
  orm: string;
  userId: string;
}

export async function createProject(input: CreateProjectInput) {
  // Step 1: Save to database
  const project = await prisma.project.create({
    data: {
      ...input,
      status: ProjectStatus.INITIALIZING,
      statusMessage: "Project registered. Starting scaffold...",
    },
  });

  // Emit real-time update to frontend
  io.emit(`project:${project.id}`, {
    status: ProjectStatus.INITIALIZING,
    message: "Project registered",
  });

  // Step 2: Run the provisioning pipeline asynchronously
  // We don't await this — it runs in the background
  provisionProject(project.id, input).catch((error) => {
    logger.error(`Provisioning failed for ${project.id}:`, error);
    prisma.project.update({
      where: { id: project.id },
      data: {
        status: ProjectStatus.FAILED,
        statusMessage: error.message,
      },
    });
    io.emit(`project:${project.id}`, {
      status: ProjectStatus.FAILED,
      message: error.message,
    });
  });

  return project;
}

async function provisionProject(projectId: string, input: CreateProjectInput) {
  // Step 2: Scaffold project files
  await updateStatus(
    projectId,
    ProjectStatus.SCAFFOLDING,
    "Assembling project files...",
  );
  const scaffoldResult = await scaffoldProject({
    projectName: input.name,
    language: input.language,
    framework: input.framework,
    database: input.database,
    orm: input.orm,
  });

  // Step 3: Run Terraform
  await updateStatus(
    projectId,
    ProjectStatus.PROVISIONING,
    "Creating infrastructure...",
  );
  const terraformResult = await runTerraform({
    projectName: input.name,
    namespace: `project-${input.name}`,
    database: input.database,
  });

  // Step 4: Run Ansible
  await updateStatus(
    projectId,
    ProjectStatus.CONFIGURING,
    "Configuring environment...",
  );
  await runAnsible({
    projectName: input.name,
    namespace: terraformResult.namespace,
  });

  // Step 5: Update project with infrastructure details
  await prisma.project.update({
    where: { id: projectId },
    data: {
      namespace: terraformResult.namespace,
      liveUrl: `http://${input.name}.localhost:8080`,
      status: ProjectStatus.PIPELINE_READY,
      statusMessage: "Infrastructure ready. Creating CI/CD pipeline...",
    },
  });

  io.emit(`project:${projectId}`, {
    status: ProjectStatus.PIPELINE_READY,
    message: "Infrastructure ready",
  });
}

async function updateStatus(
  projectId: string,
  status: ProjectStatus,
  message: string,
) {
  await prisma.project.update({
    where: { id: projectId },
    data: { status, statusMessage: message },
  });
  io.emit(`project:${projectId}`, { status, message });
}
```

### Service 3: Pipeline Service (Port 4003)

**Job:** Creates and manages Jenkins CI/CD pipelines via the Jenkins REST API.

```typescript
// apps/pipeline-service/src/services/jenkinsService.ts

import { logger } from "../utils/logger";

const JENKINS_URL = process.env.JENKINS_URL || "http://localhost:8085";
const JENKINS_USER = process.env.JENKINS_USER || "admin";
const JENKINS_TOKEN = process.env.JENKINS_TOKEN || "";

// Base64 encode credentials for Jenkins API
const authHeader = `Basic ${Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString("base64")}`;

export async function createJenkinsPipeline(config: {
  projectName: string;
  gitRepoUrl: string;
  branch: string;
}) {
  const jobName = `duckops-${config.projectName}`;

  // Jenkins Job Config XML
  const jobConfigXml = `<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>Auto-generated by DuckOps for ${config.projectName}</description>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition" plugin="workflow-cps">
    <script>
pipeline {
    agent any
    
    environment {
        REGISTRY = 'k3d-duckops-registry:5111'
        IMAGE_NAME = '${config.projectName}'
        NAMESPACE = 'project-${config.projectName}'
    }
    
    stages {
        stage('Checkout') {
            steps {
                git branch: '${config.branch}', url: '${config.gitRepoUrl}'
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }
        
        stage('Run Tests') {
            steps {
                sh 'npm test || true'
            }
        }
        
        stage('Build Docker Image') {
            steps {
                sh "docker build -t \${REGISTRY}/\${IMAGE_NAME}:\${BUILD_NUMBER} ."
                sh "docker tag \${REGISTRY}/\${IMAGE_NAME}:\${BUILD_NUMBER} \${REGISTRY}/\${IMAGE_NAME}:latest"
            }
        }
        
        stage('Push to Registry') {
            steps {
                sh "docker push \${REGISTRY}/\${IMAGE_NAME}:\${BUILD_NUMBER}"
                sh "docker push \${REGISTRY}/\${IMAGE_NAME}:latest"
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                sh """
                    kubectl set image deployment/\${IMAGE_NAME} \
                      \${IMAGE_NAME}=\${REGISTRY}/\${IMAGE_NAME}:\${BUILD_NUMBER} \
                      -n \${NAMESPACE}
                """
            }
        }
    }
    
    post {
        success {
            echo "Deployment successful!"
        }
        failure {
            echo "Deployment failed!"
        }
    }
}
    </script>
    <sandbox>true</sandbox>
  </definition>
</flow-definition>`;

  // Create the Jenkins job via REST API
  const response = await fetch(`${JENKINS_URL}/createItem?name=${jobName}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/xml",
    },
    body: jobConfigXml,
  });

  if (!response.ok && response.status !== 400) {
    // 400 might mean job already exists
    throw new Error(`Failed to create Jenkins job: ${response.statusText}`);
  }

  logger.info(`Jenkins pipeline created: ${jobName}`);

  return {
    jobName,
    jobUrl: `${JENKINS_URL}/job/${jobName}`,
  };
}

export async function triggerBuild(jobName: string) {
  const response = await fetch(`${JENKINS_URL}/job/${jobName}/build`, {
    method: "POST",
    headers: { Authorization: authHeader },
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger build: ${response.statusText}`);
  }

  logger.info(`Build triggered for: ${jobName}`);
}

export async function getBuildStatus(jobName: string, buildNumber: number) {
  const response = await fetch(
    `${JENKINS_URL}/job/${jobName}/${buildNumber}/api/json`,
    {
      headers: { Authorization: authHeader },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to get build status: ${response.statusText}`);
  }

  return response.json();
}
```

### Service 4: Health Service (Port 4004)

**Job:** Monitors all deployed projects. Runs periodic health checks, collects logs from Kubernetes, and pushes real-time status updates.

```typescript
// apps/health-service/src/services/healthCheckService.ts

import cron from "node-cron";
import { prisma } from "@duckops/db";
import { ProjectStatus, HealthStatus } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";
import { io } from "../index";
import { logger } from "../utils/logger";

const execAsync = promisify(exec);

// Run health checks every 30 seconds
export function startHealthCheckCron() {
  cron.schedule("*/30 * * * * *", async () => {
    logger.info("Running health checks...");

    const activeProjects = await prisma.project.findMany({
      where: {
        status: {
          in: [ProjectStatus.RUNNING, ProjectStatus.DEGRADED],
        },
      },
    });

    for (const project of activeProjects) {
      try {
        await checkProjectHealth(project);
      } catch (error) {
        logger.error(`Health check failed for ${project.name}:`, error);
      }
    }
  });

  logger.info("Health check cron started (every 30 seconds)");
}

async function checkProjectHealth(project: {
  id: string;
  name: string;
  liveUrl: string | null;
  namespace: string | null;
}) {
  if (!project.liveUrl) return;

  const startTime = Date.now();
  let status: HealthStatus;
  let statusCode: number | null = null;
  let message: string | null = null;

  try {
    // HTTP health check
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${project.liveUrl}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = response.status;

    if (response.ok) {
      status = HealthStatus.HEALTHY;
      message = "Service responding normally";
    } else {
      status = HealthStatus.UNHEALTHY;
      message = `HTTP ${statusCode}`;
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      status = HealthStatus.TIMEOUT;
      message = "Health check timed out (5s)";
    } else {
      status = HealthStatus.UNHEALTHY;
      message = error.message;
    }
  }

  const responseTime = Date.now() - startTime;

  // Save health check result
  await prisma.healthCheck.create({
    data: {
      projectId: project.id,
      status,
      responseTime,
      statusCode,
      message,
    },
  });

  // Update project status if health changed
  const newProjectStatus =
    status === HealthStatus.HEALTHY
      ? ProjectStatus.RUNNING
      : ProjectStatus.DEGRADED;

  await prisma.project.update({
    where: { id: project.id },
    data: { status: newProjectStatus },
  });

  // Real-time update
  io.emit(`project:${project.id}:health`, {
    status,
    responseTime,
    statusCode,
    message,
    checkedAt: new Date(),
  });
}

// Get Kubernetes pod logs for a project
export async function getProjectLogs(projectName: string, lines: number = 100) {
  try {
    const { stdout } = await execAsync(
      `kubectl logs -l app=${projectName} -n project-${projectName} --tail=${lines}`,
    );
    return stdout;
  } catch (error: any) {
    logger.error(`Failed to get logs for ${projectName}:`, error);
    return `Error fetching logs: ${error.message}`;
  }
}
```

---

## 11. Frontend Application — Detailed

### Setting Up Next.js with shadcn/ui

```bash
cd apps/web

# Initialize Next.js (if not done via monorepo)
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir

# Install shadcn/ui
pnpm dlx shadcn@latest init

# When prompted, choose:
# - Style: New York
# - Base color: Neutral
# - CSS variables: Yes

# Install specific shadcn components we need
pnpm dlx shadcn@latest add button card input label select badge
pnpm dlx shadcn@latest add dialog dropdown-menu tabs toast
pnpm dlx shadcn@latest add form table skeleton separator

# Install additional dependencies
pnpm add @tanstack/react-query zustand socket.io-client axios
pnpm add lucide-react  # Icon library
```

### Key Frontend Components

#### API Client Setup

```typescript
// apps/web/src/lib/api.ts

import axios from "axios";

// In development, Nginx gateway runs on port 80
// In production, this would be your domain
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// API functions
export const templateApi = {
  getAll: () => api.get("/api/templates").then((r) => r.data),
  getCompatible: (params: Record<string, string>) =>
    api.get("/api/templates/compatible", { params }).then((r) => r.data),
};

export const projectApi = {
  create: (data: CreateProjectInput) =>
    api.post("/api/projects", data).then((r) => r.data),
  getAll: () => api.get("/api/projects").then((r) => r.data),
  getById: (id: string) => api.get(`/api/projects/${id}`).then((r) => r.data),
  delete: (id: string) => api.delete(`/api/projects/${id}`).then((r) => r.data),
};

export const healthApi = {
  getHealth: (projectId: string) =>
    api.get(`/api/health/${projectId}`).then((r) => r.data),
  getLogs: (projectId: string, lines?: number) =>
    api
      .get(`/api/logs/${projectId}`, { params: { lines } })
      .then((r) => r.data),
};

interface CreateProjectInput {
  name: string;
  displayName: string;
  description?: string;
  language: string;
  framework: string;
  database: string;
  orm: string;
}
```

#### Socket.io Real-Time Hook

```typescript
// apps/web/src/hooks/useRealTimeStatus.ts

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4002";

let socket: Socket | null = null;

function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL);
  }
  return socket;
}

export function useRealTimeStatus(projectId: string | null) {
  const [status, setStatus] = useState<{
    status: string;
    message: string;
  } | null>(null);

  const [health, setHealth] = useState<{
    status: string;
    responseTime: number;
  } | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const s = getSocket();

    // Listen for project status updates
    s.on(`project:${projectId}`, (data) => {
      setStatus(data);
    });

    // Listen for health check updates
    s.on(`project:${projectId}:health`, (data) => {
      setHealth(data);
    });

    return () => {
      s.off(`project:${projectId}`);
      s.off(`project:${projectId}:health`);
    };
  }, [projectId]);

  return { status, health };
}
```

#### Create Project Form (The Main Feature)

```typescript
// apps/web/src/components/projects/CreateProjectForm.tsx

"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { templateApi, projectApi } from "@/lib/api";
import { useRouter } from "next/navigation";

type TemplateOption = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  version: string;
};

type GroupedOptions = Record<string, TemplateOption[]>;

export function CreateProjectForm() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    description: "",
    language: "",
    framework: "",
    database: "",
    orm: "",
  });

  // Fetch all template options
  const { data: allOptions } = useQuery<GroupedOptions>({
    queryKey: ["templates"],
    queryFn: templateApi.getAll,
  });

  // Fetch compatible options when selections change
  const { data: compatibleOptions } = useQuery<GroupedOptions>({
    queryKey: [
      "templates",
      "compatible",
      formData.language,
      formData.database,
    ],
    queryFn: () =>
      templateApi.getCompatible({
        language: formData.language,
        database: formData.database,
      }),
    enabled: !!(formData.language || formData.database),
  });

  // Use compatible options if available, else all options
  const options = compatibleOptions || allOptions;

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: projectApi.create,
    onSuccess: (project) => {
      router.push(`/projects/${project.id}`);
    },
  });

  const handleSelect = (layer: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [layer]: value };

      // Reset dependent selections when parent changes
      if (layer === "language") {
        next.framework = "";
      }
      if (layer === "database") {
        next.orm = "";
      }

      return next;
    });
  };

  const handleSubmit = () => {
    // Auto-generate name from displayName
    const name = formData.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    createMutation.mutate({
      ...formData,
      name,
    });
  };

  const isReady =
    formData.displayName &&
    formData.language &&
    formData.framework &&
    formData.database &&
    formData.orm;

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Project</h1>
        <p className="text-muted-foreground mt-2">
          Pick your tech stack and we will handle the rest.
        </p>
      </div>

      {/* Project Info */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Project Info</h2>
        <div>
          <Label htmlFor="displayName">Project Name</Label>
          <Input
            id="displayName"
            placeholder="My Todo API"
            value={formData.displayName}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                displayName: e.target.value,
              }))
            }
          />
        </div>
        <div>
          <Label htmlFor="description">Description (optional)</Label>
          <Input
            id="description"
            placeholder="A simple REST API for managing todos"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
          />
        </div>
      </Card>

      {/* Language Selection */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Language</h2>
        <div className="grid grid-cols-2 gap-3">
          {options?.LANGUAGE?.map((opt) => (
            <button
              key={opt.name}
              onClick={() => handleSelect("language", opt.name)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                formData.language === opt.name
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="font-medium">{opt.displayName}</div>
              <div className="text-sm text-muted-foreground">
                {opt.version}
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Framework Selection */}
      {formData.language && (
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Framework</h2>
          <div className="grid grid-cols-2 gap-3">
            {options?.FRAMEWORK?.map((opt) => (
              <button
                key={opt.name}
                onClick={() => handleSelect("framework", opt.name)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  formData.framework === opt.name
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium">{opt.displayName}</div>
                <div className="text-sm text-muted-foreground">
                  {opt.description}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Database Selection */}
      {formData.framework && (
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Database</h2>
          <div className="grid grid-cols-2 gap-3">
            {options?.DATABASE?.map((opt) => (
              <button
                key={opt.name}
                onClick={() => handleSelect("database", opt.name)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  formData.database === opt.name
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium">{opt.displayName}</div>
                <div className="text-sm text-muted-foreground">
                  v{opt.version}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ORM Selection */}
      {formData.database && (
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">ORM / Query Layer</h2>
          <div className="grid grid-cols-3 gap-3">
            {options?.ORM?.map((opt) => (
              <button
                key={opt.name}
                onClick={() => handleSelect("orm", opt.name)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  formData.orm === opt.name
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium">{opt.displayName}</div>
                <div className="text-sm text-muted-foreground">
                  {opt.description}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Submit */}
      {isReady && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Summary</h2>
          <div className="text-sm space-y-1 mb-6">
            <p>Language: <strong>{formData.language}</strong></p>
            <p>Framework: <strong>{formData.framework}</strong></p>
            <p>Database: <strong>{formData.database}</strong></p>
            <p>ORM: <strong>{formData.orm}</strong></p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="w-full"
            size="lg"
          >
            {createMutation.isPending
              ? "Creating project..."
              : "🚀 Create Project"}
          </Button>
        </Card>
      )}
    </div>
  );
}
```

---

## 12. Template System — How Scaffolding Works

The scaffolding service uses **Handlebars** templates. These are skeleton code files with placeholders that get replaced with actual values.

### Install Handlebars

```bash
cd apps/provisioning-service
pnpm add handlebars
```

### Example Template Files

#### Express Server Template

```handlebars
// templates/nodejs/express/index.ts.hbs import express from "express"; import
cors from "cors"; import { db } from "./db"; const app = express(); const PORT =
process.env.PORT || 3000; app.use(cors()); app.use(express.json()); // Health
check endpoint app.get("/health", (req, res) => { res.json({ status: "ok",
project: "{{projectName}}" }); }); // Example CRUD routes app.get("/api/items",
async (req, res) => {
{{#if (eq orm "prisma")}}
  const items = await db.item.findMany();
{{else if (eq orm "drizzle")}}
  const items = await db.select().from(items);
{{else}}
  const { rows: items } = await db.query("SELECT * FROM items");
{{/if}}
res.json(items); }); app.listen(PORT, () => { console.log(`{{projectName}}
running on port ${PORT}`); });
```

#### Prisma Schema Template

```handlebars
// templates/databases/postgresql/prisma/schema.prisma.hbs generator client {
provider = "prisma-client-js" } datasource db { provider = "{{database}}" url =
env("DATABASE_URL") } model Item { id Int @id @default(autoincrement()) title
String completed Boolean @default(false) createdAt DateTime @default(now())
updatedAt DateTime @updatedAt }
```

#### Dockerfile Template

```handlebars
// templates/devops/Dockerfile.hbs FROM node:22-alpine AS builder WORKDIR /app
COPY package*.json ./ RUN npm ci COPY . .
{{#if (eq orm "prisma")}}
  RUN npx prisma generate
{{/if}}
RUN npm run build FROM node:22-alpine AS runner WORKDIR /app COPY --from=builder
/app/dist ./dist COPY --from=builder /app/node_modules ./node_modules COPY
--from=builder /app/package*.json ./
{{#if (eq orm "prisma")}}
  COPY --from=builder /app/prisma ./prisma
{{/if}}

EXPOSE
{{port}}
CMD ["node", "dist/index.js"]
```

#### Kubernetes Deployment Template

```handlebars
// templates/devops/deployment.yaml.hbs apiVersion: apps/v1 kind: Deployment
metadata: name:
{{projectName}}
namespace: project-{{projectName}}
labels: app:
{{projectName}}
spec: replicas: 1 selector: matchLabels: app:
{{projectName}}
template: metadata: labels: app:
{{projectName}}
spec: containers: - name:
{{projectName}}
image: k3d-duckops-registry:5111/{{projectName}}:latest ports: - containerPort:
{{port}}
env: - name: DATABASE_URL value:
"postgresql://duckops:duckops123@postgres.project-{{projectName}}.svc.cluster.local:5432/{{projectName}}"
- name: PORT value: "{{port}}" readinessProbe: httpGet: path: /health port:
{{port}}
initialDelaySeconds: 5 periodSeconds: 10 livenessProbe: httpGet: path: /health
port:
{{port}}
initialDelaySeconds: 15 periodSeconds: 20
```

### The Scaffold Service

```typescript
// apps/provisioning-service/src/services/scaffoldService.ts

import Handlebars from "handlebars";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger";

const execAsync = promisify(exec);

// Register Handlebars helpers
Handlebars.registerHelper("eq", (a, b) => a === b);

interface ScaffoldInput {
  projectName: string;
  language: string;
  framework: string;
  database: string;
  orm: string;
}

export async function scaffoldProject(input: ScaffoldInput) {
  const outputDir = path.join("/tmp/duckops-projects", input.projectName);

  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });

  const templateContext = {
    projectName: input.projectName,
    language: input.language,
    framework: input.framework,
    database: input.database,
    orm: input.orm,
    port: 3000,
  };

  // 1. Generate main application file
  const appTemplate = await loadTemplate(
    `nodejs/${input.framework}/index.ts.hbs`,
  );
  await writeFile(
    path.join(outputDir, "src", "index.ts"),
    appTemplate(templateContext),
  );

  // 2. Generate database client file
  const dbTemplate = await loadTemplate(
    `databases/${input.database}/${input.orm}/client.ts.hbs`,
  );
  await writeFile(
    path.join(outputDir, "src", "db.ts"),
    dbTemplate(templateContext),
  );

  // 3. Generate ORM-specific schema if needed
  if (input.orm === "prisma") {
    const schemaTemplate = await loadTemplate(
      `databases/${input.database}/prisma/schema.prisma.hbs`,
    );
    await writeFile(
      path.join(outputDir, "prisma", "schema.prisma"),
      schemaTemplate(templateContext),
    );
  }

  // 4. Generate Dockerfile
  const dockerfileTemplate = await loadTemplate("devops/Dockerfile.hbs");
  await writeFile(
    path.join(outputDir, "Dockerfile"),
    dockerfileTemplate(templateContext),
  );

  // 5. Generate Kubernetes manifests
  const deploymentTemplate = await loadTemplate("devops/deployment.yaml.hbs");
  await writeFile(
    path.join(outputDir, "k8s", "deployment.yaml"),
    deploymentTemplate(templateContext),
  );

  const serviceTemplate = await loadTemplate("devops/service.yaml.hbs");
  await writeFile(
    path.join(outputDir, "k8s", "service.yaml"),
    serviceTemplate(templateContext),
  );

  // 6. Generate Jenkinsfile
  const jenkinsTemplate = await loadTemplate("devops/Jenkinsfile.hbs");
  await writeFile(
    path.join(outputDir, "Jenkinsfile"),
    jenkinsTemplate(templateContext),
  );

  // 7. Generate package.json with merged dependencies
  const packageJson = generatePackageJson(input);
  await writeFile(
    path.join(outputDir, "package.json"),
    JSON.stringify(packageJson, null, 2),
  );

  // 8. Generate tsconfig.json
  await writeFile(
    path.join(outputDir, "tsconfig.json"),
    JSON.stringify(generateTsConfig(), null, 2),
  );

  logger.info(`Project scaffolded at: ${outputDir}`);
  return { outputDir };
}

async function loadTemplate(templatePath: string) {
  const fullPath = path.join(__dirname, "..", "templates", templatePath);
  const content = await fs.readFile(fullPath, "utf-8");
  return Handlebars.compile(content);
}

async function writeFile(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

function generatePackageJson(input: ScaffoldInput) {
  const baseDeps: Record<string, string> = {
    express: "^5.0.0",
    cors: "^2.8.5",
    dotenv: "^16.4.0",
  };

  // Add ORM-specific dependencies
  const ormDeps: Record<string, Record<string, string>> = {
    prisma: {
      "@prisma/client": "^6.0.0",
      prisma: "^6.0.0",
    },
    drizzle: {
      "drizzle-orm": "^0.36.0",
      "drizzle-kit": "^0.28.0",
      pg: "^8.13.0",
    },
    raw: {
      pg: "^8.13.0",
    },
  };

  return {
    name: input.projectName,
    version: "1.0.0",
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsc",
      start: "node dist/index.js",
      test: "vitest run",
    },
    dependencies: {
      ...baseDeps,
      ...ormDeps[input.orm],
    },
    devDependencies: {
      typescript: "^5.7.0",
      tsx: "^4.19.0",
      "@types/node": "^22.0.0",
      "@types/express": "^5.0.0",
      "@types/cors": "^2.8.17",
      vitest: "^2.1.0",
    },
  };
}

function generateTsConfig() {
  return {
    compilerOptions: {
      target: "ES2022",
      module: "commonjs",
      lib: ["ES2022"],
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  };
}
```

---

## 13. Terraform Configuration

### Local Environment — Kubernetes Provider

```hcl
# infra/terraform/environments/local/main.tf

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.35"
    }
  }
}

# Connect to the local K3d cluster
provider "kubernetes" {
  config_path = "~/.kube/config"
  config_context = "k3d-duckops"
}

# Use our reusable modules
module "project_namespace" {
  source       = "../../modules/k8s-namespace"
  project_name = var.project_name
}

module "project_deployment" {
  source         = "../../modules/k8s-deployment"
  project_name   = var.project_name
  namespace      = module.project_namespace.namespace_name
  image          = var.image
  container_port = var.container_port
  database_url   = var.database_url
  depends_on     = [module.project_namespace]
}
```

```hcl
# infra/terraform/environments/local/variables.tf

variable "project_name" {
  description = "Name of the project to deploy"
  type        = string
}

variable "image" {
  description = "Docker image to deploy"
  type        = string
  default     = "k3d-duckops-registry:5111/default-app:latest"
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 3000
}

variable "database_url" {
  description = "PostgreSQL connection string"
  type        = string
  sensitive   = true
}
```

```hcl
# infra/terraform/modules/k8s-namespace/main.tf

variable "project_name" {
  type = string
}

resource "kubernetes_namespace" "project" {
  metadata {
    name = "project-${var.project_name}"
    labels = {
      managed-by = "duckops"
      project    = var.project_name
    }
  }
}

output "namespace_name" {
  value = kubernetes_namespace.project.metadata[0].name
}
```

```hcl
# infra/terraform/modules/k8s-deployment/main.tf

variable "project_name" { type = string }
variable "namespace" { type = string }
variable "image" { type = string }
variable "container_port" { type = number }
variable "database_url" { type = string }

resource "kubernetes_deployment" "app" {
  metadata {
    name      = var.project_name
    namespace = var.namespace
    labels = {
      app = var.project_name
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = var.project_name
      }
    }

    template {
      metadata {
        labels = {
          app = var.project_name
        }
      }

      spec {
        container {
          name  = var.project_name
          image = var.image

          port {
            container_port = var.container_port
          }

          env {
            name  = "DATABASE_URL"
            value = var.database_url
          }

          env {
            name  = "PORT"
            value = tostring(var.container_port)
          }

          resources {
            limits = {
              cpu    = "250m"
              memory = "256Mi"
            }
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "app" {
  metadata {
    name      = var.project_name
    namespace = var.namespace
  }

  spec {
    selector = {
      app = var.project_name
    }

    port {
      port        = 80
      target_port = var.container_port
    }

    type = "ClusterIP"
  }
}
```

### Running Terraform

```bash
cd infra/terraform/environments/local

# Initialize (first time only)
terraform init

# Preview what will be created
terraform plan -var="project_name=my-todo-api" -var="database_url=postgresql://..."

# Apply (creates the resources)
terraform apply -var="project_name=my-todo-api" -var="database_url=postgresql://..."

# Destroy (removes the resources)
terraform destroy -var="project_name=my-todo-api" -var="database_url=postgresql://..."
```

---

## 14. Ansible Playbooks

### Local Inventory

```yaml
# infra/ansible/inventory/local.yml

all:
  hosts:
    localhost:
      ansible_connection: local
  vars:
    environment: local
    k8s_context: k3d-duckops
    registry: k3d-duckops-registry:5111
```

### Deploy App Playbook

```yaml
# infra/ansible/playbooks/deploy-app.yml
---
- name: Deploy application to Kubernetes
  hosts: localhost
  connection: local
  vars:
    project_name: "{{ project_name }}"
    image_tag: "{{ image_tag | default('latest') }}"
    namespace: "project-{{ project_name }}"

  tasks:
    - name: Verify kubectl is available
      command: kubectl version --client
      register: kubectl_check
      changed_when: false

    - name: Check namespace exists
      command: "kubectl get namespace {{ namespace }}"
      register: ns_check
      ignore_errors: true
      changed_when: false

    - name: Create namespace if it doesn't exist
      command: "kubectl create namespace {{ namespace }}"
      when: ns_check.rc != 0

    - name: Apply Kubernetes deployment
      command: >
        kubectl apply -f /tmp/duckops-projects/{{ project_name }}/k8s/deployment.yaml
        -n {{ namespace }}
      register: deploy_result

    - name: Apply Kubernetes service
      command: >
        kubectl apply -f /tmp/duckops-projects/{{ project_name }}/k8s/service.yaml
        -n {{ namespace }}
      register: service_result

    - name: Wait for deployment to be ready
      command: >
        kubectl rollout status deployment/{{ project_name }}
        -n {{ namespace }}
        --timeout=120s
      register: rollout_status
      retries: 3
      delay: 10

    - name: Get service URL
      command: >
        kubectl get service {{ project_name }}
        -n {{ namespace }}
        -o jsonpath='{.spec.clusterIP}'
      register: service_ip

    - name: Display deployment info
      debug:
        msg: |
          Deployment successful!
          Project: {{ project_name }}
          Namespace: {{ namespace }}
          Internal URL: http://{{ service_ip.stdout }}:80
```

### Running Ansible

```bash
# Deploy a specific project
ansible-playbook infra/ansible/playbooks/deploy-app.yml \
  -i infra/ansible/inventory/local.yml \
  -e "project_name=my-todo-api" \
  -e "image_tag=1"
```

---

## 15. Jenkins Pipeline Setup

Jenkins is accessed at `http://localhost:8085` after running it via Docker.

### Configuring Jenkins for DuckOps

1. **Install plugins** (from Manage Jenkins → Plugins):
   - Pipeline
   - Docker Pipeline
   - Kubernetes CLI
   - Git
   - Pipeline REST API

2. **Add credentials** (from Manage Jenkins → Credentials):
   - Docker Registry: `k3d-duckops-registry:5111` (no auth needed for local)
   - Kubernetes: kubeconfig file

3. **Configure Jenkins to talk to K3d**:

```bash
# Copy kubeconfig into Jenkins container
docker cp ~/.kube/config jenkins:/var/jenkins_home/.kube/config

# Install kubectl inside Jenkins container
docker exec -u root jenkins bash -c "
  curl -LO 'https://dl.k8s.io/release/\$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl' && \
  install -m 0755 kubectl /usr/local/bin/kubectl
"

# Install Docker CLI inside Jenkins container
docker exec -u root jenkins bash -c "
  apt-get update && apt-get install -y docker.io
"
```

---

## 16. Kubernetes Manifests

### DuckOps Platform Namespace

```yaml
# infra/kubernetes/base/namespace.yaml

apiVersion: v1
kind: Namespace
metadata:
  name: duckops
  labels:
    app: duckops
    managed-by: duckops
```

### Catalog Service Deployment

```yaml
# infra/kubernetes/services/catalog/deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog-service
  namespace: duckops
spec:
  replicas: 1
  selector:
    matchLabels:
      app: catalog-service
  template:
    metadata:
      labels:
        app: catalog-service
    spec:
      containers:
        - name: catalog-service
          image: k3d-duckops-registry:5111/catalog-service:latest
          ports:
            - containerPort: 4001
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: duckops-secrets
                  key: database-url
            - name: PORT
              value: "4001"
          readinessProbe:
            httpGet:
              path: /health
              port: 4001
            initialDelaySeconds: 5
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 250m
              memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: catalog-service
  namespace: duckops
spec:
  selector:
    app: catalog-service
  ports:
    - port: 4001
      targetPort: 4001
```

### Apply All Manifests

```bash
# Create namespace
kubectl apply -f infra/kubernetes/base/namespace.yaml

# Create secrets
kubectl create secret generic duckops-secrets \
  --from-literal=database-url="postgresql://duckops:duckops123@duckops-postgres:5432/duckops" \
  -n duckops

# Deploy all services
kubectl apply -f infra/kubernetes/services/catalog/
kubectl apply -f infra/kubernetes/services/provisioning/
kubectl apply -f infra/kubernetes/services/pipeline/
kubectl apply -f infra/kubernetes/services/health/

# Check status
kubectl get pods -n duckops
kubectl get services -n duckops
```

---

## 17. Docker Configuration

### docker-compose.yml (Local Development with Hot Reload)

```yaml
# docker-compose.yml

version: "3.8"

services:
  # ── DATABASE ────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: duckops-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: duckops
      POSTGRES_PASSWORD: duckops123
      POSTGRES_DB: duckops
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U duckops"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: duckops-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── JENKINS ─────────────────────────────────────────
  jenkins:
    image: jenkins/jenkins:lts
    container_name: duckops-jenkins
    restart: unless-stopped
    ports:
      - "8085:8080"
      - "50000:50000"
    volumes:
      - jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      JAVA_OPTS: "-Xmx512m"

  # ── NGINX API GATEWAY ──────────────────────────────
  nginx:
    image: nginx:alpine
    container_name: duckops-gateway
    restart: unless-stopped
    ports:
      - "4000:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - catalog-service
      - provisioning-service
      - pipeline-service
      - health-service

  # ── MICROSERVICES ───────────────────────────────────
  catalog-service:
    build:
      context: .
      dockerfile: apps/catalog-service/Dockerfile
    container_name: duckops-catalog
    restart: unless-stopped
    ports:
      - "4001:4001"
    environment:
      DATABASE_URL: postgresql://duckops:duckops123@postgres:5432/duckops
      REDIS_URL: redis://redis:6379
      PORT: "4001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  provisioning-service:
    build:
      context: .
      dockerfile: apps/provisioning-service/Dockerfile
    container_name: duckops-provisioning
    restart: unless-stopped
    ports:
      - "4002:4002"
    environment:
      DATABASE_URL: postgresql://duckops:duckops123@postgres:5432/duckops
      REDIS_URL: redis://redis:6379
      JENKINS_URL: http://jenkins:8080
      JENKINS_USER: admin
      JENKINS_TOKEN: ${JENKINS_TOKEN}
      PORT: "4002"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /tmp/duckops-projects:/tmp/duckops-projects
      - ${HOME}/.kube/config:/root/.kube/config:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  pipeline-service:
    build:
      context: .
      dockerfile: apps/pipeline-service/Dockerfile
    container_name: duckops-pipeline
    restart: unless-stopped
    ports:
      - "4003:4003"
    environment:
      DATABASE_URL: postgresql://duckops:duckops123@postgres:5432/duckops
      REDIS_URL: redis://redis:6379
      JENKINS_URL: http://jenkins:8080
      JENKINS_USER: admin
      JENKINS_TOKEN: ${JENKINS_TOKEN}
      PORT: "4003"
    depends_on:
      postgres:
        condition: service_healthy

  health-service:
    build:
      context: .
      dockerfile: apps/health-service/Dockerfile
    container_name: duckops-health
    restart: unless-stopped
    ports:
      - "4004:4004"
    environment:
      DATABASE_URL: postgresql://duckops:duckops123@postgres:5432/duckops
      REDIS_URL: redis://redis:6379
      PORT: "4004"
    volumes:
      - ${HOME}/.kube/config:/root/.kube/config:ro
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
  redisdata:
  jenkins_home:
```

### Nginx Configuration

```nginx
# nginx/nginx.conf

events {
    worker_connections 1024;
}

http {
    upstream catalog {
        server catalog-service:4001;
    }

    upstream provisioning {
        server provisioning-service:4002;
    }

    upstream pipeline {
        server pipeline-service:4003;
    }

    upstream health {
        server health-service:4004;
    }

    server {
        listen 80;

        # Catalog Service routes
        location /api/templates {
            proxy_pass http://catalog;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /api/options {
            proxy_pass http://catalog;
            proxy_set_header Host $host;
        }

        # Provisioning Service routes
        location /api/projects {
            proxy_pass http://provisioning;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Pipeline Service routes
        location /api/pipelines {
            proxy_pass http://pipeline;
            proxy_set_header Host $host;
        }

        # Health Service routes
        location /api/health {
            proxy_pass http://health;
            proxy_set_header Host $host;
        }

        location /api/logs {
            proxy_pass http://health;
            proxy_set_header Host $host;
        }

        # WebSocket support for real-time updates
        location /socket.io/ {
            proxy_pass http://provisioning;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
```

### Sample Microservice Dockerfile

```dockerfile
# apps/catalog-service/Dockerfile

FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

# Copy the specific app and shared packages
COPY apps/catalog-service ./apps/catalog-service
COPY packages ./packages

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN cd packages/db && pnpm prisma generate

# Build the service
RUN pnpm turbo build --filter=catalog-service

# ── Production stage ──
FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app/apps/catalog-service/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/prisma ./prisma

EXPOSE 4001

CMD ["node", "dist/index.js"]
```

---

## 18. Local to Cloud Switch

### The Config File Approach

Create an environment config that controls where everything runs:

```typescript
// packages/shared-utils/src/config.ts

type Environment = "local" | "cloud";

interface Config {
  environment: Environment;
  database: {
    url: string;
  };
  kubernetes: {
    context: string;
    registry: string;
  };
  jenkins: {
    url: string;
    user: string;
    token: string;
  };
  terraform: {
    workingDir: string;
  };
}

const configs: Record<Environment, Config> = {
  local: {
    environment: "local",
    database: {
      url: "postgresql://duckops:duckops123@localhost:5432/duckops",
    },
    kubernetes: {
      context: "k3d-duckops",
      registry: "k3d-duckops-registry:5111",
    },
    jenkins: {
      url: "http://localhost:8085",
      user: "admin",
      token: process.env.JENKINS_TOKEN || "",
    },
    terraform: {
      workingDir: "infra/terraform/environments/local",
    },
  },
  cloud: {
    environment: "cloud",
    database: {
      url: process.env.DATABASE_URL || "",
    },
    kubernetes: {
      context: process.env.K8S_CONTEXT || "default",
      registry: process.env.REGISTRY_URL || "",
    },
    jenkins: {
      url: process.env.JENKINS_URL || "",
      user: process.env.JENKINS_USER || "",
      token: process.env.JENKINS_TOKEN || "",
    },
    terraform: {
      workingDir: "infra/terraform/environments/cloud",
    },
  },
};

const ENV = (process.env.DUCKOPS_ENV as Environment) || "local";
export const config = configs[ENV];
```

### Switching Between Local and Cloud

```bash
# Run locally (default)
DUCKOPS_ENV=local docker compose up

# Run pointing to cloud
DUCKOPS_ENV=cloud docker compose -f docker-compose.prod.yml up
```

### .env.example

```bash
# .env.example

# Environment: "local" or "cloud"
DUCKOPS_ENV=local

# Database
DATABASE_URL=postgresql://duckops:duckops123@localhost:5432/duckops

# Redis
REDIS_URL=redis://localhost:6379

# Jenkins
JENKINS_URL=http://localhost:8085
JENKINS_USER=admin
JENKINS_TOKEN=your_jenkins_api_token_here

# Kubernetes
K8S_CONTEXT=k3d-duckops
REGISTRY_URL=k3d-duckops-registry:5111

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4002
```

---

## 19. Running Everything Locally — Full Walkthrough

### One-Time Setup (Do This Once)

```bash
# 1. Clone the repo
git clone https://github.com/your-team/duckops.git
cd duckops

# 2. Copy environment file
cp .env.example .env
# Edit .env with your values

# 3. Install all dependencies
pnpm install

# 4. Create K3d cluster with local registry
k3d registry create duckops-registry --port 5111
k3d cluster create duckops \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer" \
  --port "30000-30100:30000-30100@server:0" \
  --agents 2 \
  --registry-use k3d-duckops-registry:5111

# 5. Start infrastructure (database, redis, jenkins)
docker compose up postgres redis jenkins -d

# 6. Wait for PostgreSQL to be ready (10-15 seconds)
sleep 15

# 7. Run database migrations
cd packages/db
pnpm prisma migrate dev --name init
pnpm prisma db seed
cd ../..

# 8. Verify everything is running
docker ps                  # Should show postgres, redis, jenkins
kubectl get nodes          # Should show K3d nodes
```

### Daily Development (Do This Every Day)

```bash
# Start the infrastructure
docker compose up postgres redis jenkins -d

# Start K3d cluster (if stopped)
k3d cluster start duckops

# Start all microservices in development mode (with hot reload)
# Terminal 1:
cd apps/catalog-service && pnpm dev

# Terminal 2:
cd apps/provisioning-service && pnpm dev

# Terminal 3:
cd apps/pipeline-service && pnpm dev

# Terminal 4:
cd apps/health-service && pnpm dev

# Terminal 5:
cd apps/web && pnpm dev

# OR use Turborepo to start everything at once:
pnpm turbo dev
```

### Accessing the Services

| Service              | URL                                                             |
| -------------------- | --------------------------------------------------------------- |
| Frontend             | http://localhost:3000                                           |
| API Gateway (Nginx)  | http://localhost:4000                                           |
| Catalog Service      | http://localhost:4001                                           |
| Provisioning Service | http://localhost:4002                                           |
| Pipeline Service     | http://localhost:4003                                           |
| Health Service       | http://localhost:4004                                           |
| Jenkins              | http://localhost:8085                                           |
| Prisma Studio        | http://localhost:5555 (run `pnpm prisma studio` in packages/db) |
| Grafana              | http://localhost:30001 (after Helm install)                     |
| Prometheus           | http://localhost:30002 (after Helm install)                     |

### Full Docker Compose Mode (Production-Like)

```bash
# Build all images and start everything
docker compose up --build

# This starts: postgres, redis, jenkins, nginx, all 4 microservices
# Frontend still runs separately with `pnpm dev` in apps/web for hot reload
```

### Shutting Down

```bash
# Stop Docker Compose services
docker compose down

# Stop K3d cluster (preserves data)
k3d cluster stop duckops

# Nuclear option — destroy everything
docker compose down -v         # Remove volumes too
k3d cluster delete duckops     # Delete K3d cluster
k3d registry delete duckops-registry
```

---

## 20. Free Cloud Deployment (Oracle Cloud)

### Why Oracle Cloud?

Oracle Cloud gives you **4 ARM CPU cores and 24GB RAM for free, forever.** No other cloud provider comes close.

### What You Get for Free

- 2 ARM VMs (2 cores + 12GB RAM each) — forever
- 2 AMD VMs (1 core + 1GB RAM each) — forever
- 200GB boot volume storage — forever
- 10TB outbound data transfer/month — forever
- 1 Load Balancer (10 Mbps) — forever
- 20GB Object Storage — forever

### Setup Steps

1. Sign up at cloud.oracle.com (credit card needed for verification, NOT charged)
2. Pick **Mumbai region** (ap-mumbai-1)
3. Create 2 ARM VMs (split the 4 cores: 2+2)
4. VM 1: K3s cluster + microservices
5. VM 2: Jenkins + PostgreSQL
6. Install K3s, Docker, and deploy the same way as local but pointing to cloud IPs
7. Update `.env` with `DUCKOPS_ENV=cloud` and cloud IPs

### Terraform Cloud Configuration

```hcl
# infra/terraform/environments/cloud/main.tf

terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

# This creates the VMs, VCN, subnets, security lists, etc.
# Full cloud Terraform config would go here
```

---

## 21. Demo Script

### What to Show in Your Presentation (5-7 Minutes)

1. **Open the DuckOps dashboard** — show the clean UI
2. **Click "Create New Project"** — fill in the form:
   - Name: "demo-todo-api"
   - Language: Node.js
   - Framework: Express
   - Database: PostgreSQL
   - ORM: Prisma
3. **Click Create** — show real-time status updates:
   - "Scaffolding project..." → "Provisioning infrastructure..." → "Creating pipeline..." → "Deploying..." → "Running!"
4. **Show the live URL** — open it in a browser, show the health endpoint responding
5. **Show Jenkins** — the pipeline was auto-created
6. **Show Kubernetes** — run `kubectl get pods -n project-demo-todo-api` to show the running container
7. **Show Grafana** — monitoring dashboard with metrics
8. **Show the Terraform state** — infrastructure as code, not manual clicks
9. **Create a second project** with a different stack (Fastify + Drizzle) to show flexibility

---

## 22. 2-Week Sprint Plan

### Week 1: Build the Core

| Day | Person A                             | Person B                                            | Person C                                 | Person D (if 4)          |
| --- | ------------------------------------ | --------------------------------------------------- | ---------------------------------------- | ------------------------ |
| 1   | Set up monorepo + tooling            | Design DB schema + Prisma setup                     | Set up K3d + Docker Compose              | Set up Jenkins in Docker |
| 2   | Build Catalog Service API            | Build Provisioning Service (scaffold logic)         | Start Frontend: layout + dashboard       | Write Terraform modules  |
| 3   | Build Catalog Service tests          | Build Terraform integration in Provisioning         | Frontend: Create Project form            | Write Ansible playbooks  |
| 4   | Build Pipeline Service (Jenkins API) | Build scaffold templates (Express, Prisma, Drizzle) | Frontend: Project detail page            | Dockerize all services   |
| 5   | Integration: Pipeline + Provisioning | Integration: Scaffold → Terraform → Ansible         | Frontend: real-time status via Socket.io | Deploy platform to K3d   |

### Week 2: Polish and Deploy

| Day | Person A              | Person B                              | Person C                                | Person D (if 4)             |
| --- | --------------------- | ------------------------------------- | --------------------------------------- | --------------------------- |
| 6   | Build Health Service  | Add more templates (Fastify, raw SQL) | Frontend: logs viewer, health dashboard | Set up Prometheus + Grafana |
| 7   | End-to-end testing    | Error handling across all services    | Frontend: polish UI, loading states     | Write Kubernetes manifests  |
| 8   | Fix bugs from testing | Fix bugs from testing                 | Fix bugs from testing                   | Fix bugs from testing       |
| 9   | Write project report  | Deploy to Oracle Cloud (if using)     | Create demo script + practice           | Prepare presentation slides |
| 10  | Practice presentation | Practice presentation                 | Practice presentation                   | Practice presentation       |

---

## 23. Troubleshooting

### K3d Cluster Won't Start

```bash
# Check Docker is running
docker ps

# Delete and recreate
k3d cluster delete duckops
k3d cluster create duckops --port "8080:80@loadbalancer" --agents 2
```

### PostgreSQL Connection Refused

```bash
# Check if container is running
docker ps | grep postgres

# Check logs
docker logs duckops-postgres

# Restart
docker restart duckops-postgres
```

### Jenkins Can't Access Docker

```bash
# Make sure Docker socket is mounted
docker exec -u root jenkins bash -c "ls -la /var/run/docker.sock"

# Fix permissions if needed
docker exec -u root jenkins bash -c "chmod 666 /var/run/docker.sock"
```

### Prisma Migration Fails

```bash
# Reset the database completely
cd packages/db
pnpm prisma migrate reset

# Regenerate client
pnpm prisma generate
```

### kubectl: "The connection to the server was refused"

```bash
# K3d cluster might be stopped
k3d cluster start duckops

# Verify kubeconfig is correct
kubectl config current-context
# Should show: k3d-duckops

# If wrong context:
kubectl config use-context k3d-duckops
```

### Docker Images Not Found in K3d

```bash
# Make sure you're pushing to the local registry
docker tag my-image:latest k3d-duckops-registry:5111/my-image:latest
docker push k3d-duckops-registry:5111/my-image:latest

# Verify
curl http://localhost:5111/v2/_catalog
```

### Out of Memory

```bash
# Check Docker resource usage
docker stats

# K3d and Jenkins together need ~4GB RAM minimum
# Close other applications or reduce K3d agents:
k3d cluster delete duckops
k3d cluster create duckops --port "8080:80@loadbalancer" --agents 1
```

---

## Summary

DuckOps demonstrates mastery of:

- **Platform Engineering** — the hottest trend in DevOps
- **Microservices Architecture** — 4 independent services communicating via API
- **Infrastructure as Code** — Terraform provisioning
- **Configuration Management** — Ansible playbooks
- **CI/CD Automation** — Jenkins pipeline auto-creation
- **Container Orchestration** — Kubernetes (K3s) deployments
- **Monitoring & Observability** — Prometheus + Grafana
- **Full-Stack Development** — Next.js + Express + TypeScript + Prisma + PostgreSQL
- **Real-Time Communication** — Socket.io for live status updates

Total cost: **Zero. Every single tool is free and open-source.**
