import cron from "node-cron";
import { prisma, ProjectStatus, HealthStatus } from "@duckops/db";
import { exec } from "child_process";
import { promisify } from "util";
import { createLogger } from "@duckops/shared-utils";
import { io } from "../index";

const execAsync = promisify(exec);
const logger = createLogger("health-check-service");

export function startHealthCheckCron() {
  // Every 30 seconds
  cron.schedule("*/30 * * * * *", async () => {
    logger.info("Running health checks...");

    const activeProjects = await prisma.project.findMany({
      where: {
        status: { in: [ProjectStatus.RUNNING, ProjectStatus.DEGRADED] },
      },
      select: { id: true, name: true, framework: true, liveUrl: true, namespace: true },
    });

    await Promise.allSettled(
      activeProjects.map((p) =>
        checkProjectHealth(p).catch((err) =>
          logger.error(`Health check failed for ${p.name}: ${err.message}`),
        ),
      ),
    );
  });

  logger.info("Health check cron started (every 30 seconds)");
}

function healthPath(framework: string): string {
  return framework === "nextjs" ? "/api/health" : "/health";
}

// Run a health check by executing curl inside the k3d cluster via kubectl.
//
// Why: health-service runs in Docker Compose (outside the k3d cluster).
// The k3d serverlb only forwards NodePorts 30000-30100 to the host — port 80
// is only bound on the macOS host, not on the Docker network. There is no
// direct HTTP path from Docker Compose containers into Traefik's port 80.
//
// kubectl exec runs curl inside a running pod in the target namespace.
// That pod IS in the cluster, so K8s service DNS works perfectly.
// The pod that's already running (the app itself) is used — no extra pods needed.
async function execHealthCheck(project: {
  name: string;
  namespace: string | null;
  framework: string;
}): Promise<{ statusCode: number; body: string }> {
  if (!project.namespace) throw new Error("No namespace");

  const path = healthPath(project.framework);
  const serviceUrl = `http://${project.name}.${project.namespace}.svc.cluster.local${path}`;

  // Run curl inside the app pod — available in the node:alpine base image
  const { stdout } = await execAsync(
    `kubectl exec -n ${project.namespace} deploy/${project.name} -- wget -qO- -T 4 "${serviceUrl}" 2>/dev/null`,
    { timeout: 6000 },
  );

  return { statusCode: 200, body: stdout.trim() };
}

// Number of consecutive non-healthy checks required before flipping to DEGRADED.
// A single blip (pod restart, GC pause) should not degrade the project.
const DEGRADE_THRESHOLD = 3;

async function checkProjectHealth(project: {
  id: string;
  name: string;
  framework: string;
  liveUrl: string | null;
  namespace: string | null;
}) {
  if (!project.namespace) return;

  const startTime = Date.now();
  let status: HealthStatus;
  let statusCode: number | null = null;
  let message: string | null = null;

  try {
    const { statusCode: code, body } = await execHealthCheck(project);
    statusCode = code;
    // A valid JSON body with status:ok means healthy; any 2xx response is healthy
    const isOk = body.includes('"ok"') || body.includes('"healthy"') || body.length > 0;
    status = isOk ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;
    message = isOk ? "Service responding normally" : `Unexpected response: ${body.slice(0, 100)}`;
  } catch (err: any) {
    const msg: string = err.message || "";
    if (msg.includes("timeout") || err.killed) {
      status = HealthStatus.TIMEOUT;
      message = "Health check timed out (5s)";
    } else {
      status = HealthStatus.UNHEALTHY;
      message = msg.slice(0, 200);
    }
  }

  const responseTime = Date.now() - startTime;

  await prisma.healthCheck.create({
    data: { projectId: project.id, status, responseTime, statusCode, message },
  });

  let newProjectStatus: ProjectStatus;
  if (status === HealthStatus.HEALTHY) {
    newProjectStatus = ProjectStatus.RUNNING;
  } else {
    // Require DEGRADE_THRESHOLD consecutive non-healthy checks before degrading.
    // This prevents a single pod restart or network blip from flipping the project.
    const recentChecks = await prisma.healthCheck.findMany({
      where: { projectId: project.id },
      orderBy: { checkedAt: "desc" },
      take: DEGRADE_THRESHOLD,
      select: { status: true },
    });

    const allRecentUnhealthy =
      recentChecks.length >= DEGRADE_THRESHOLD &&
      recentChecks.every((c) => c.status !== HealthStatus.HEALTHY);

    newProjectStatus = allRecentUnhealthy ? ProjectStatus.DEGRADED : ProjectStatus.RUNNING;
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { status: newProjectStatus },
  });

  io.emit(`project:${project.id}:health`, {
    status,
    responseTime,
    statusCode,
    message,
    checkedAt: new Date(),
  });
}

export async function getProjectHealthHistory(
  projectId: string,
  limit = 50,
) {
  return prisma.healthCheck.findMany({
    where: { projectId },
    orderBy: { checkedAt: "desc" },
    take: limit,
  });
}

export async function getProjectLogs(
  projectName: string,
  lines = 100,
): Promise<string> {
  // Sanitize: only allow lowercase alphanumeric and hyphens (matches k8s naming rules)
  const safeName = projectName.replace(/[^a-z0-9-]/g, "");
  const safeLines = Math.min(Math.max(1, Math.floor(lines)), 500);
  if (!safeName) return "Invalid project name";

  try {
    const { stdout, stderr } = await execAsync(
      `kubectl logs -l app=${safeName} -n project-${safeName} --tail=${safeLines} --timestamps=true 2>&1`,
      { timeout: 10000 },
    );
    const out = stdout || stderr || "";
    if (!out.trim()) return "(no output — pod may not have logged anything yet)";
    return out;
  } catch (err: any) {
    logger.error(`Failed to get logs for ${safeName}: ${err.message}`);
    return err.stderr || err.message || "Error fetching logs";
  }
}
