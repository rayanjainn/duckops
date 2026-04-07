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

async function checkProjectHealth(project: {
  id: string;
  name: string;
  framework: string;
  liveUrl: string | null;
  namespace: string | null;
}) {
  if (!project.liveUrl) return;

  const startTime = Date.now();
  let status: HealthStatus;
  let statusCode: number | null = null;
  let message: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${project.liveUrl}${healthPath(project.framework)}`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = response.status;

    status = response.ok ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;
    message = response.ok ? "Service responding normally" : `HTTP ${statusCode}`;
  } catch (err: any) {
    if (err.name === "AbortError") {
      status = HealthStatus.TIMEOUT;
      message = "Health check timed out (5s)";
    } else {
      status = HealthStatus.UNHEALTHY;
      message = err.message;
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
    // Only degrade if the project has been healthy at least once before.
    // This prevents freshly provisioned projects (with no real app yet) from
    // immediately flipping to DEGRADED.
    const everHealthy = await prisma.healthCheck.findFirst({
      where: { projectId: project.id, status: HealthStatus.HEALTHY },
    });
    newProjectStatus = everHealthy ? ProjectStatus.DEGRADED : ProjectStatus.RUNNING;
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
  try {
    const { stdout } = await execAsync(
      `kubectl logs -l app=${projectName} -n project-${projectName} --tail=${lines}`,
    );
    return stdout;
  } catch (err: any) {
    logger.error(`Failed to get logs for ${projectName}: ${err.message}`);
    return `Error fetching logs: ${err.message}`;
  }
}
