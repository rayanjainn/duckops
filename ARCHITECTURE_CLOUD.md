# DuckOps Cloud Architecture

> **Decisions locked in:**
> - Region: `ap-south-1` (Mumbai)
> - Domain: `raycode.tech` (live, EC2 IP: 13.204.92.146)
> - Local + Cloud both work simultaneously (2 GitHub OAuth apps)
> - AI: Ollama cloud API (existing, via API key)
> - Concurrent users: ~5 (t3.large sufficient)
> - Jenkins: shared instance
> - BullMQ + Redis: yes, for AI generation and provisioning queues
> - URL format: `{project}-{github}-duckops.raycode.tech`
> - Database: **Neon.tech (free tier Postgres)** — no RDS, no extra AWS cost
> - All activity stored in DB: Jenkins builds, deployments, commits, generated code, AI sessions

---

## Overview

Two distinct contexts run on the same EC2:

1. **DuckOps Platform** — the SaaS itself (backends on EC2 via PM2, frontend on Vercel)
2. **User Workloads** — each GitHub user gets a Linux user account on EC2; their projects
   run as K8s workloads (K3s) inside isolated namespaces

---

## High-Level Diagram

```
                        Internet
                           │
              ┌────────────┴───────────────────────┐
              │                                     │
        Vercel (free)                        EC2 t3.large  ←── Elastic IP
        ┌──────────────┐                   ┌────────────────────────────────────────┐
        │ Next.js      │                   │                                        │
        │  (DuckOps    │◄──HTTPS──────────►│  nginx :80/:443                        │
        │   frontend)  │                   │   ├─ api.raycode.tech  → PM2 svcs   │
        │              │                   │   ├─ *.raycode.tech   → K3s Traefik │
        │ catalog-svc  │                   │   └─ SSL: wildcard Let's Encrypt        │
        │  (Vercel fn) │                   │                                        │
        └──────────────┘                   │  PM2 — DuckOps backends                │
                                           │   ├─ provisioning  :4002               │
                                           │   ├─ pipeline      :4003               │
                                           │   ├─ health        :4004               │
                                           │   ├─ ai            :4005               │
                                           │   └─ Redis         :6379               │
                                           │                                        │
                                           │  BullMQ Queues (backed by Redis)       │
                                           │   ├─ provisioning-queue                │
                                           │   │   └─ worker in provisioning-svc    │
                                           │   └─ ai-queue                          │
                                           │       └─ worker in ai-svc              │
                                           │                                        │
                                           │  K3s (single-node cluster)             │
                                           │   └─ Traefik ingress (wildcard TLS)    │
                                           │                                        │
                                           │  Linux Users (per DuckOps GitHub user) │
                                           │   ├─ /home/rayan/                      │
                                           │   │   ├─ myapp/  (namespace+manifests) │
                                           │   │   └─ blog/                         │
                                           │   └─ /home/alice/                      │
                                           │       └─ api/                          │
                                           │                                        │
                                           │  Linux User: _duckops-ai               │
                                           │   └─ AI code gen workspaces            │
                                           │      (isolated, cleaned after each job)│
                                           │                                        │
                                           │  Jenkins (shared)                      │
                                           │   └─ jobs: rayan-myapp, alice-api ...  │
                                           │                                        │
                                           │  ECR (AWS)                             │
                                           │   └─ images per project                │
                                           └────────────────────────────────────────┘

                                           Neon.tech (free tier)
                                           └─ Postgres — serverless, no EC2 cost
                                              DB stores everything: builds, deploys,
                                              commits, generated code, AI sessions
```

---

## Domain Structure

Replace `raycode.tech` with your actual domain once confirmed.

| Subdomain | Points to | Purpose |
|---|---|---|
| `app.raycode.tech` | Vercel | DuckOps frontend (Next.js) |
| `api.raycode.tech` | EC2 Elastic IP | All DuckOps backend services |
| `{project}-{github}-duckops.raycode.tech` | EC2 → K3s Traefik | User's deployed app |

**Example:** User `rayan` creates project `myapp`
→ App lives at `myapp-rayan-duckops.raycode.tech` (HTTPS)

**SSL:** Single Certbot wildcard cert `*.raycode.tech` — covers all subdomains, auto-renewed every 90 days.

---

## URL Format Detail

```
{projectName}-{githubUsername}-duckops.raycode.tech
     ↑               ↑              ↑
  "myapp"          "rayan"     hardcoded suffix
                                (identifies this is
                                 a DuckOps-hosted app)
```

Why the `-duckops` suffix: avoids collisions if someone has project `myapp` and user `rayan`, and makes it clear to users their app is DuckOps-hosted.

---

## Linux User Isolation Model

### On first project created by a GitHub user

```bash
# Run on EC2 via SSH from provisioning-service
useradd -m -s /bin/false rayan   # no shell login, just for file ownership
mkdir -p /home/rayan/{projects,logs}
chown -R rayan:rayan /home/rayan
```

### When a project is created (`myapp` by user `rayan`)

```bash
# K3s namespace
kubectl create namespace rayan-myapp

# Project directory
mkdir -p /home/rayan/projects/myapp/{manifests,logs}

# Jenkins job name: rayan-myapp
# ECR repo: {account}.dkr.ecr.ap-south-1.amazonaws.com/duckops/rayan-myapp

# Traefik IngressRoute created automatically by K3s manifest:
# myapp-rayan-duckops.raycode.tech → svc/rayan-myapp in namespace rayan-myapp
```

### When a project is deleted

```bash
# 1. Delete K8s namespace (kills pods, services, ingress — everything)
kubectl delete namespace rayan-myapp --wait=false

# 2. Delete Jenkins job
curl -X POST http://localhost:8085/job/rayan-myapp/doDelete \
  --user admin:$JENKINS_TOKEN

# 3. Delete ECR repository + all images
aws ecr delete-repository \
  --repository-name duckops/rayan-myapp \
  --force \
  --region ap-south-1

# 4. Delete project directory
rm -rf /home/rayan/projects/myapp

# 5. DB cascade: Project → Pipeline, Deployments, HealthChecks, AiSessions all deleted
```

### When a user deletes their account

```bash
# 1. Run project-delete for every project they own (steps above)
# 2. Remove Linux user + wipe home dir
userdel -r rayan
# /home/rayan and everything in it — gone permanently
# 3. DB cascade: User → all Projects → all related records
```

---

## BullMQ + Redis Queue Architecture

Redis runs as a PM2 process on EC2 (or Docker container). BullMQ uses Redis for job persistence.

### Why queues here

| Without queue | With queue |
|---|---|
| Provisioning runs inline in HTTP request, ties up a connection for 2-5 min | HTTP returns immediately with job ID, worker provisions async |
| AI generation blocks the SSE connection, one per user | Multiple AI jobs queued, `_duckops-ai` worker processes sequentially |
| If service crashes mid-provision, job is lost | Job stays in Redis, worker retries on restart |

### Queue: `provisioning-queue`

**Producer:** `provisioning-service` — when `POST /api/projects` is called, creates DB record, then enqueues job and returns `{ projectId, jobId }` immediately.

**Worker:** runs inside `provisioning-service` process, picks up jobs and runs the full scaffold → GitHub → K8s → Jenkins flow.

```
POST /api/projects
       │
       ▼
  Create DB record (status: INITIALIZING)
       │
       ▼
  Enqueue { projectId, input } → provisioning-queue
       │
       ▼
  Return 201 { projectId } to frontend immediately
       
  [Worker picks up job]
       │
       ├─ scaffold templates
       ├─ create GitHub repo
       ├─ SSH to EC2: useradd if needed, mkdir project
       ├─ K3s namespace + manifests
       ├─ Jenkins job
       ├─ ECR repo
       └─ Emit Socket.io status updates throughout
```

**Retry policy:** 3 attempts, exponential backoff (30s, 5min, 30min). On final failure → project status = FAILED, user notified via Socket.io.

### Queue: `ai-queue`

**Producer:** `ai-service` — when `POST /api/generate/stream` is called.

**Worker:** runs as `_duckops-ai` Linux user on EC2. Since SSE needs to stream back to the browser in real-time, this is handled differently:

- SSE connection opens immediately and stays open
- Job is added to `ai-queue` with a `channelId`
- Worker processes job, publishes chunk events to Redis pub/sub channel
- `ai-service` SSE endpoint subscribes to that channel and forwards chunks to browser

```
POST /api/generate/stream
       │
       ▼
  Open SSE connection (headers flushed)
       │
       ├─ Create job in ai-queue { projectId, prompt, channelId }
       │
       ├─ Subscribe to Redis channel: ai-chunks:{channelId}
       │
       │   [Worker picks up job]
       │       ├─ Clone repo (as _duckops-ai user)
       │       ├─ Call Ollama API (streaming)
       │       ├─ Publish each chunk → ai-chunks:{channelId}
       │       ├─ Apply file changes
       │       ├─ Commit + push
       │       └─ Publish "done" event
       │
       └─ SSE forwards everything to browser, closes when "done" received
```

**Concurrency:** `ai-queue` worker concurrency = 3 (3 simultaneous AI jobs for 5 users is fine).

---

## AI User Isolation (`_duckops-ai`)

```bash
# Created once during EC2 setup
useradd -m -s /bin/false _duckops-ai
# Has Git configured with a DuckOps bot GitHub account
# Workspace: /home/_duckops-ai/workspaces/{jobId}/
# Cleaned up after each job
```

Each AI job gets its own directory:
```
/home/_duckops-ai/workspaces/
├── job_abc123/   ← clone of rayan's myapp repo
├── job_def456/   ← clone of alice's api repo
└── ...           ← cleaned up when job completes
```

No cross-user access possible since each job uses a fresh clone authenticated via the user's GitHub token (passed as job data, not stored on disk).

---

## Account Settings Page

New page: `/settings`

**Sections:**

1. **Profile** — name, GitHub username, avatar (read-only from GitHub)
2. **Usage** — projects used (X/2 or X/∞), AI prompts remaining, reset time
3. **Plan** — current plan badge, upgrade/portal button (reuses billing logic)
4. **Danger Zone** — Delete Account button (requires typing "DELETE" to confirm)
   - Deletes all projects (K8s namespaces, Jenkins jobs, ECR repos, directories)
   - Deletes Linux user on EC2
   - Deletes all DB records
   - Revokes GitHub OAuth token
   - Cancels Stripe subscription if active

**Sidebar:** User avatar/name in footer becomes a link to `/settings` instead of just showing logout. Logout button stays.

---

## EC2 Setup (installed once via `scripts/ec2-setup.sh`)

```
EC2 t3.large — Ubuntu 24.04 — ap-south-1 — 50GB gp3 SSD — Elastic IP
├── Node.js 22 + pnpm
├── PM2 (process manager for backends)
├── Redis 7 (BullMQ backend)
├── K3s (replaces K3d — production-grade single-node K8s)
├── Traefik (built into K3s, handles wildcard ingress + TLS)
├── Jenkins (CI/CD, same as local)
├── Docker (for building images)
├── AWS CLI + ECR credential helper
├── nginx (reverse proxy for api.raycode.tech)
├── Certbot (wildcard SSL cert for *.raycode.tech)
└── Git
```

**RAM budget (t3.large = 8GB):**
```
OS + system                ~300MB
nginx + Certbot            ~50MB
Redis                      ~100MB   (BullMQ only — DB is Neon.tech, off-EC2)
PM2 backends (5 services)  ~600MB
K3s + system pods          ~800MB
Jenkins                    ~512MB
Available for user pods    ~5.6GB  ✓ (5 users × ~1GB each = fine)
```

---

## nginx on EC2

```nginx
# api.raycode.tech — DuckOps platform backends
server {
    listen 443 ssl;
    server_name api.raycode.tech;
    ssl_certificate     /etc/letsencrypt/live/raycode.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/raycode.tech/privkey.pem;

    location /api/auth        { proxy_pass http://localhost:4002; ... }
    location /api/projects    { proxy_pass http://localhost:4002; ... }
    location /api/billing     { proxy_pass http://localhost:4002; ... }
    location /api/pipelines   {
        proxy_pass http://localhost:4003;
        proxy_buffering off;          # SSE
        proxy_read_timeout 300s;
    }
    location /api/health      { proxy_pass http://localhost:4004; }
    location /api/logs        { proxy_pass http://localhost:4004; }
    location /api/ai          {
        proxy_pass http://localhost:4005;
        proxy_buffering off;          # SSE
        proxy_read_timeout 300s;
    }
    location /api/templates   { proxy_pass http://localhost:4001; }
    location /socket.io/ {
        proxy_pass http://localhost:4002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# *.raycode.tech — user-deployed apps → K3s Traefik
server {
    listen 443 ssl;
    server_name ~^.+-duckops\.yourdomain\.tech$;
    ssl_certificate     /etc/letsencrypt/live/raycode.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/raycode.tech/privkey.pem;

    location / {
        proxy_pass http://localhost:80;   # Traefik NodePort inside K3s
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}

# HTTP → HTTPS redirect for everything
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
```

---

## DNS Setup (in your domain registrar)

```
Type    Name                    Value               TTL
A       api                     <EC2 Elastic IP>    300
A       app                     75.2.60.5           300   ← Vercel's IP (use CNAME instead)
CNAME   app                     cname.vercel-dns.com  300
A       *                       <EC2 Elastic IP>    300   ← wildcard for user apps
```

The wildcard `*` A record catches all `{project}-{github}-duckops.raycode.tech` subdomains and routes them to EC2 where nginx hands them to K3s Traefik.

---

## Environment Variables (cloud vs local)

The same codebase runs locally and in cloud — only env vars differ.

```env
# ── Shared (same in both modes) ──────────────────
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
JWT_SECRET=...
STRIPE_SECRET_KEY=...
OLLAMA_API_KEY=...
OLLAMA_HOST=...

# ── Local mode ───────────────────────────────────
DATABASE_URL=postgresql://duckops:duckops123@localhost:5432/duckops
JENKINS_URL=http://localhost:8085
REGISTRY_URL=k3d-duckops-registry:5111
K8S_CONTEXT=k3d-duckops
REDIS_URL=redis://localhost:6379
EC2_SSH_HOST=                          # empty = local mode
DEPLOY_MODE=local

# ── Cloud mode ───────────────────────────────────
DATABASE_URL=postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/duckops?sslmode=require
JENKINS_URL=http://localhost:8085      # same, runs on EC2
REGISTRY_URL=123456789.dkr.ecr.ap-south-1.amazonaws.com
K8S_CONTEXT=default                    # K3s default
REDIS_URL=redis://localhost:6379       # same, Redis on EC2
EC2_SSH_HOST=ec2-xx-xx.ap-south-1.compute.amazonaws.com
EC2_SSH_KEY_PATH=/home/ubuntu/.ssh/duckops-ec2.pem
DEPLOY_MODE=cloud
DOMAIN=raycode.tech
AWS_REGION=ap-south-1
AWS_ACCOUNT_ID=123456789012
```

`DEPLOY_MODE=cloud` is the single flag that tells all services to:
- Use Neon.tech Postgres instead of local Postgres (just a different `DATABASE_URL`)
- SSH to EC2 for kubectl/useradd commands (health-service, provisioning-service)
- Use ECR instead of local registry
- Build project URLs as `{project}-{github}-duckops.raycode.tech`

---

## "Connect AWS" Flow (sidebar button)

This feature is for the **DuckOps operator** (you), not end users.
End users just use the platform — they never touch AWS directly.

1. Sidebar shows **"Connect AWS"** button (only visible to admin/operator account)
2. Clicking opens a modal → enter Access Key ID + Secret Access Key + Region
3. Backend calls `sts:GetCallerIdentity` to verify
4. On success → saves credentials to DB (AES-256 encrypted) → shows **Connected ✓**
5. **"Provision Infrastructure"** button appears → click → backend:
   - Launches EC2 t3.large (Ubuntu 24.04, ap-south-1, key pair auto-generated)
   - Creates ECR registry
   - Runs `ec2-setup.sh` via SSE userdata or SSH
   - Saves EC2 IP, SSH key to DB
   - (No RDS — Neon.tech Postgres is pre-created and its URL pasted into env vars)
6. **"Switch to Cloud"** toggle appears in sidebar
7. Clicking it switches `DEPLOY_MODE` → all new projects provision to cloud

**Stop Cloud:** stops EC2 (data preserved in Neon.tech DB, cost ≈ $0)
**Destroy Cloud:** terminates EC2 + deletes all ECR repos (cost = $0, irreversible — Neon DB unaffected unless manually deleted)

---

## What Changes in the Codebase

| Area | Change |
|---|---|
| `provisioning-service/createProject` | Enqueue to BullMQ instead of inline async |
| `provisioning-service` | Add BullMQ worker that runs provisioning steps |
| `provisioning-service` | In cloud mode: SSH to EC2 for `useradd`, namespace naming |
| `ai-service/stream` | Enqueue to BullMQ, use Redis pub/sub for SSE chunks |
| `health-service/getLogs` | In cloud mode: SSH to EC2, run kubectl there |
| `projectService/deleteProject` | In cloud mode: SSH cleanup (namespace, Jenkins, ECR, dir) |
| `auth routes` | Add `DELETE /api/auth/account` (delete everything) |
| `billing routes` | Add `GET /api/billing/aws-status`, `POST /api/billing/aws-connect` |
| Sidebar | Add "Connect AWS" button + Local/Cloud toggle |
| New page: `/settings` | Profile, usage stats, plan, danger zone (delete account) |
| Schema | Add `AwsConnection` model |
| Namespace format | `rayan-myapp` instead of `project-myapp` |
| URL format | `myapp-rayan-duckops.raycode.tech` instead of `myapp.localhost:8080` |

---

## Database (Neon.tech — Free Tier Postgres)

**Why Neon instead of RDS:**
- Free tier: 512MB storage, 0.5 CPU, always-on — more than enough for 5 users
- No EC2 cost — Neon is a separate SaaS, billed independently (free)
- Same Postgres, same `DATABASE_URL` — zero code changes, just swap the URL
- Serverless: scales to zero when idle, no idle compute charges

**Setup:** Go to [neon.tech](https://neon.tech), create a free project, copy the connection string into `DATABASE_URL`.

### Everything Stored in the Database

The platform keeps a full historical record of all activity. Nothing lives only in Jenkins/K8s/filesystem — all important data is synced back to Postgres.

| Data | Prisma model | Notes |
|---|---|---|
| Users | `User` | GitHub profile, plan, Stripe customer, devMode |
| Projects | `Project` | name, status, github repo URL, namespace, URL |
| **Jenkins builds** | `Build` | job name, build number, status, triggered at, finished at, duration |
| **Jenkins console logs** | `BuildLog` | full console output per build (stored after build ends) |
| **Deployments** | `Deployment` | build ref, image tag, deployed at, status, rollback info |
| **Git commits** | `Commit` | sha, message, author, timestamp, files changed — synced from GitHub webhook |
| **Generated code** | `AiSession` | prompt, files changed, diff, model used, tokens, timestamp |
| **AI messages** | `AiMessage` | per-session chat history (prompt + response chunks) |
| K8s pod events | `PodEvent` | pod name, event type, message, timestamp (from kubectl events) |
| Health checks | `HealthCheck` | endpoint, status, latency, checked at |
| Billing events | `BillingEvent` | Stripe webhook events (subscription created/cancelled, payments) |
| AWS connection | `AwsConnection` | access key (encrypted), region, EC2 IP, SSH key (encrypted) |

### New Prisma Models to Add

```prisma
model Build {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  buildNumber Int
  jobName     String
  status      String   // QUEUED, RUNNING, SUCCESS, FAILURE, ABORTED
  triggeredAt DateTime @default(now())
  finishedAt  DateTime?
  duration    Int?     // seconds
  gitCommit   String?
  gitBranch   String?
  logs        BuildLog[]
  createdAt   DateTime @default(now())
}

model BuildLog {
  id        String   @id @default(cuid())
  buildId   String
  build     Build    @relation(fields: [buildId], references: [id], onDelete: Cascade)
  content   String   // full console output (text, can be large)
  fetchedAt DateTime @default(now())
}

model Deployment {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  buildId     String?
  imageTag    String
  status      String   // DEPLOYING, LIVE, ROLLED_BACK, FAILED
  deployedAt  DateTime @default(now())
  rolledBackAt DateTime?
  url         String?  // the live URL at time of deploy
}

model Commit {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sha         String
  message     String
  author      String
  authorAvatar String?
  filesChanged Int?
  additions   Int?
  deletions   Int?
  committedAt DateTime
  pushedAt    DateTime @default(now())
}

model AiSession {
  id          String      @id @default(cuid())
  projectId   String
  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId      String
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  prompt      String      // original user request
  filesChanged String[]   // list of files modified
  diff        String?     // full git diff of changes made
  model       String      // e.g. qwen3-coder:480b
  tokensUsed  Int?
  status      String      // QUEUED, RUNNING, DONE, FAILED
  createdAt   DateTime    @default(now())
  completedAt DateTime?
  messages    AiMessage[]
}

model AiMessage {
  id        String    @id @default(cuid())
  sessionId String
  session   AiSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      String    // user | assistant
  content   String
  createdAt DateTime  @default(now())
}

model AwsConnection {
  id              String  @id @default(cuid())
  userId          String  @unique
  user            User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessKeyId     String  // stored encrypted
  secretAccessKey String  // stored encrypted (AES-256)
  region          String
  ec2InstanceId   String?
  ec2PublicIp     String?
  sshPrivateKey   String? // stored encrypted
  ecrRegistryUrl  String?
  deployMode      String  @default("local") // local | cloud
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Sync Strategy

| Event | How data gets to DB |
|---|---|
| Jenkins build starts | BullMQ job or webhook from Jenkins → `Build` record created |
| Jenkins build finishes | Jenkins webhook (`/api/pipelines/webhook`) → update `Build`, fetch + store console log |
| App deployed to K8s | Provisioning worker → `Deployment` record created |
| Git push to repo | GitHub webhook → `Commit` records synced |
| AI generation done | `ai-queue` worker → `AiSession` + `AiMessage` records saved |
| Stripe event | Stripe webhook → `BillingEvent` record, `User.stripeSubStatus` updated |

**Frontend benefit:** Build history, deployment history, commit log, and AI history all load instantly from Postgres — no round-trip to Jenkins/GitHub/K8s required.

---

## IAM User Setup (for your friend to do)

See the section below.

---

## Implementation Phases

### Phase 0 — Account Settings + Delete Account (do now, no AWS needed)
- [ ] `DELETE /api/auth/account` route in provisioning-service
- [ ] `/settings` page — profile, usage, plan, delete account
- [ ] BullMQ + Redis install in provisioning-service and ai-service
- [ ] Wrap existing provisioning flow in BullMQ worker
- [ ] Wrap AI generation in BullMQ + Redis pub/sub

### Phase 1 — EC2 Setup Script
- [ ] `scripts/ec2-setup.sh` — full automated install
- [ ] `ecosystem.config.js` for PM2
- [ ] `scripts/nginx-cloud.conf`
- [ ] Test on fresh EC2

### Phase 2 — Cloud Provisioning
- [ ] `AwsConnection` schema + migration
- [ ] Connect AWS modal + credential verify
- [ ] EC2 + ECR provisioning via AWS SDK (no RDS — using Neon.tech)
- [ ] SSH exec utility (used by provisioning + health services)
- [ ] Neon.tech Postgres setup: create project at neon.tech, copy connection string into env

### Phase 3 — Per-user Linux Isolation
- [ ] `DEPLOY_MODE=cloud` branching in provisioning-service
- [ ] SSH-based `useradd`, project dir creation
- [ ] Namespace format: `{github}-{project}`
- [ ] URL format: `{project}-{github}-duckops.raycode.tech`
- [ ] Full cleanup on project + account delete

### Phase 4 — Vercel Deployment
- [ ] Two GitHub OAuth apps (local + cloud)
- [ ] Vercel deploy of Next.js
- [ ] Vercel deploy of catalog-service
- [ ] Update all env vars

### Phase 5 — Connect AWS UI + Local/Cloud Toggle
- [ ] Sidebar "Connect AWS" button
- [ ] Infrastructure provisioning UI
- [ ] Stop/Destroy cloud buttons

---

## IAM User Setup — What to Tell Your Friend

Tell your friend to do **exactly these steps** in the AWS console:

### Step 1 — Create IAM User

1. Go to **IAM → Users → Create user**
2. Username: `duckops-admin`
3. **Do NOT** check "Provide user access to the AWS Management Console"
4. Click **Next**
5. Select **"Attach policies directly"**
6. Search and attach these policies:
   - `AmazonEC2FullAccess`
   - `AmazonECRFullAccess`
   - `AmazonVPCFullAccess`
   - `IAMReadOnlyAccess`
   - `AmazonSSMFullAccess` (for running commands on EC2 without SSH if needed)
   
   > **No RDS policy needed** — database is Neon.tech (external, no AWS)
7. Click **Next → Create user**

### Step 2 — Create Access Keys

1. Click on the newly created user `duckops-admin`
2. Go to **Security credentials** tab
3. Scroll to **Access keys → Create access key**
4. Select **"Application running outside AWS"**
5. Click **Next → Create access key**
6. **Copy both values immediately** (Secret is shown only once):
   - Access Key ID: `AKIA...`
   - Secret Access Key: `xxxx...`
7. Send these to you securely (Signal/WhatsApp, not email)

### Step 3 — Set Default Region

Tell your friend to also set the default region to `ap-south-1` (Mumbai) in the AWS console top-right dropdown, so any manual console work is in the right region.

---

## AWS CLI Setup (you do this on your Mac)

Once you have the Access Key ID + Secret from your friend:

```bash
# Install AWS CLI (if not installed)
brew install awscli

# Configure
aws configure
# AWS Access Key ID: AKIA...
# AWS Secret Access Key: xxxx...
# Default region: ap-south-1
# Default output format: json

# Verify it works
aws sts get-caller-identity
# Should return your account ID, user ARN, etc.
```

That's it — you're connected. The DuckOps "Connect AWS" feature will use these same credentials (you'll paste them into the UI modal, and the backend stores them encrypted).
