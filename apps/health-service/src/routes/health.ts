import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { prisma } from "@duckops/db";
import { NotFoundError } from "@duckops/shared-utils";
import {
  getProjectHealthHistory,
  getProjectLogs,
} from "../services/healthCheckService";
import { requireAuth } from "../middleware/auth";

const execAsync = promisify(exec);

const SERVICES = [
  { name: "duckops-provisioning", label: "Provisioning", port: 4002 },
  { name: "duckops-pipeline",     label: "Pipeline",     port: 4003 },
  { name: "duckops-health",       label: "Health",       port: 4004 },
  { name: "duckops-ai",           label: "AI",           port: 4005 },
  { name: "duckops-catalog",      label: "Catalog",      port: 4001 },
];

async function getPm2Metrics() {
  try {
    const { stdout } = await execAsync("pm2 jlist");
    const list = JSON.parse(stdout) as any[];
    return list.map((p: any) => ({
      name: p.name as string,
      status: p.pm2_env?.status as string,
      cpu: p.monit?.cpu ?? 0,
      memoryBytes: p.monit?.memory ?? 0,
      restarts: p.pm2_env?.restart_time ?? 0,
      uptime: p.pm2_env?.pm_uptime ?? 0,
      pid: p.pid,
    }));
  } catch {
    return [];
  }
}

async function getPm2Logs(serviceName: string, lines: number): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `pm2 logs ${serviceName} --lines ${lines} --nostream --raw 2>&1 || true`,
      { shell: "/bin/bash" },
    );
    return stdout.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export const healthRouter = Router();
export const logsRouter = Router();

// GET /api/health/:projectId — auth required, ownership enforced
healthRouter.get("/:projectId", requireAuth, async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId as string },
      select: { id: true, name: true, status: true, liveUrl: true, userId: true },
    });

    if (!project) throw new NotFoundError("Project");
    if (project.userId !== (req as any).user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const history = await getProjectHealthHistory(project.id, 20);
    const latest = history[0] || null;

    res.json({ project, latest, history });
  } catch (err) {
    next(err);
  }
});

// GET /api/logs/:projectId — auth required, ownership enforced
logsRouter.get("/:projectId", requireAuth, async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId as string },
      select: { id: true, name: true, namespace: true, userId: true },
    });

    if (!project) throw new NotFoundError("Project");
    if (project.userId !== (req as any).user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const lines = Math.min(Number(req.query.lines) || 100, 500);
    const logs = await getProjectLogs(project.name, project.namespace ?? `project-${project.name}`, lines);

    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

// GET /api/platform/metrics — PM2 stats for all backend services (auth via query token)
export const platformRouter = Router();

platformRouter.get("/metrics", requireAuth, async (_req, res) => {
  const metrics = await getPm2Metrics();
  res.json({ services: SERVICES, metrics });
});

// GET /api/platform/logs/:service — SSE stream of PM2 logs for one service (auth via query token)
platformRouter.get("/logs/:service", requireAuth, async (req, res) => {
  const service = SERVICES.find((s) => s.name === req.params.service);
  if (!service) { res.status(404).json({ error: "Unknown service" }); return; }

  (res as any).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.status(200);

  const send = (data: unknown) => (res as any).write(`data: ${JSON.stringify(data)}\n\n`);

  // Send initial backlog
  const initial = await getPm2Logs(service.name, 200);
  send({ type: "backlog", lines: initial });

  // Poll for new lines every 2s by re-reading last 5 lines and diffing
  let lastLine = initial[initial.length - 1] ?? "";
  const interval = setInterval(async () => {
    const recent = await getPm2Logs(service.name, 20);
    const idx = recent.lastIndexOf(lastLine);
    const newLines = idx >= 0 ? recent.slice(idx + 1) : recent;
    if (newLines.length > 0) {
      lastLine = newLines[newLines.length - 1];
      send({ type: "lines", lines: newLines });
    }
  }, 2000);

  req.on("close", () => clearInterval(interval));
});
