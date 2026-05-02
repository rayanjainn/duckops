# DuckOps — Command Reference

Day-to-day local development commands.

---

## Quick Start

```bash
# First time ever
./scripts/setup-local.sh

# Already set up — start everything
docker compose up -d
pnpm turbo dev
```

---

## Setup & Teardown

```bash
# Full idempotent setup (safe to re-run anytime)
./scripts/setup-local.sh

# Stop everything (keep volumes/data)
docker compose stop

# Stop and wipe all data (DB + Jenkins reset)
docker compose down -v

# Nuclear wipe — containers, images, volumes, k3d cluster, tmp files
docker compose down -v --remove-orphans
k3d cluster delete duckops
k3d registry delete duckops-registry
docker image prune -af
docker volume prune -f
rm -rf /tmp/duckops-projects
```

---

## Development

```bash
# All services with hot reload (Turborepo)
pnpm turbo dev

# Single service
pnpm --filter @duckops/web dev
pnpm --filter @duckops/provisioning-service dev
pnpm --filter @duckops/catalog-service dev
pnpm --filter @duckops/pipeline-service dev
pnpm --filter @duckops/health-service dev
pnpm --filter @duckops/ai-service dev

# Build everything
pnpm build

# Type-check all packages
pnpm typecheck

# Lint
pnpm lint
```

---

## Docker Compose

```bash
docker compose up -d                          # start all (detached)
docker compose up -d --build                  # rebuild images and start
docker compose ps                             # service status
docker compose logs -f                        # all logs
docker compose logs -f provisioning-service   # one service
docker compose restart provisioning-service   # restart one service
docker compose stop                           # stop, keep data
docker compose down -v                        # stop + delete volumes
```

---

## Database

```bash
# Run pending migrations
cd packages/db && pnpm prisma migrate deploy

# Reset DB (drops everything and re-runs from scratch)
cd packages/db && pnpm prisma migrate reset

# Re-seed
cd packages/db && pnpm prisma db seed

# Open Prisma Studio (browser DB GUI at http://localhost:5555)
cd packages/db && pnpm prisma studio

# Open psql shell
docker exec -it duckops-postgres psql -U duckops -d duckops

# Generate Prisma client after schema change
cd packages/db && pnpm prisma generate
```

---

## Kubernetes (k3d)

```bash
# Cluster management
k3d cluster list
k3d cluster start duckops
k3d cluster stop duckops
k3d cluster delete duckops

# Create fresh cluster (run after delete)
k3d registry create duckops-registry --port 5111
k3d cluster create duckops \
  --port "8080:80@loadbalancer" \
  --port "30000-30100:30000-30100@server:0" \
  --agents 2 \
  --network k3d-duckops \
  --registry-use k3d-duckops-registry:5111

# Project namespaces
kubectl get namespaces | grep project-
kubectl get all -n project-<name>
kubectl get pods -n project-<name>
kubectl logs -n project-<name> deploy/<name> --tail=100

# Registry
curl http://localhost:5111/v2/_catalog           # list all images
curl http://localhost:5111/v2/<name>/tags/list   # tags for an image
```

---

## Jenkins

```bash
# Get initial admin password (first time only)
docker exec duckops-jenkins cat /var/jenkins_home/secrets/initialAdminPassword

# Copy kubeconfig into Jenkins (if kubectl fails inside pipelines)
K3D_IP=$(docker inspect k3d-duckops-server-0 \
  --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
k3d kubeconfig get duckops \
  | sed "s|https://0.0.0.0:[0-9]*|https://${K3D_IP}:6443|g" \
  | docker exec -i duckops-jenkins tee /root/.kube/config

# Trigger a build manually
curl -X POST -u admin:$JENKINS_TOKEN \
  "http://localhost:8085/job/duckops-<name>/build"
```

---

## BullMQ Queue

```bash
# Check queue state
redis-cli llen bull:provisioning-queue:wait
redis-cli llen bull:provisioning-queue:active
redis-cli llen bull:provisioning-queue:failed

# Flush failed jobs
redis-cli del bull:provisioning-queue:failed
```

---

## Manual Project Cleanup

```bash
# Delete all DB records for a project
docker exec duckops-postgres psql -U duckops -d duckops -c "
  DO \$\$ DECLARE pid TEXT := '<project-id>';
  BEGIN
    DELETE FROM \"HealthCheck\" WHERE \"projectId\" = pid;
    DELETE FROM \"Deployment\" WHERE \"projectId\" = pid;
    DELETE FROM \"Pipeline\" WHERE \"projectId\" = pid;
    DELETE FROM \"BuildLog\" WHERE \"buildId\" IN (SELECT id FROM \"Build\" WHERE \"projectId\" = pid);
    DELETE FROM \"Build\" WHERE \"projectId\" = pid;
    DELETE FROM \"Commit\" WHERE \"projectId\" = pid;
    DELETE FROM \"AiMessage\" WHERE \"sessionId\" IN (SELECT id FROM \"AiSession\" WHERE \"projectId\" = pid);
    DELETE FROM \"AiSession\" WHERE \"projectId\" = pid;
    DELETE FROM \"Project\" WHERE id = pid;
  END \$\$;"

# Delete K8s namespace
kubectl delete namespace project-<name> --ignore-not-found

# Delete Jenkins job
curl -X POST -u admin:$JENKINS_TOKEN \
  "http://localhost:8085/job/duckops-<name>/doDelete"

# Remove Docker images
docker images | grep "<name>" | awk '{print $1":"$2}' | xargs docker rmi --force
```

---

## Service URLs

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
| Prisma Studio | http://localhost:5555 |
| Deployed apps | http://\<name\>.localhost:8080 |

---

## Troubleshooting

```bash
# Docker / Colima not running
colima start --profile duckops

# k3d cluster gone after restart
k3d cluster start duckops

# Postgres unhealthy
docker compose restart postgres

# Services crashed after Postgres restart
docker compose restart provisioning-service pipeline-service health-service catalog-service ai-service

# Jenkins unreachable
docker compose restart jenkins
# wait 30s then: curl -I http://localhost:8085/login

# Disk full
docker system df
docker image prune -af && docker builder prune -af

# Port conflict
lsof -ti:4002 | xargs kill -9

# pnpm install fails
pnpm store prune && rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install

# Prisma migration fails
cd packages/db && pnpm prisma migrate reset
```
