import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { register, Gauge } from "prom-client";
import { prisma } from "@duckops/db";
import { NotFoundError, stripAnsi } from "@duckops/shared-utils";
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

/**
 * Periodically records metrics for all platform services into the database.
 * This provides the historical data needed for time-series charts (Recharts).
 */
export function startMetricCollection() {
  setInterval(async () => {
    const metrics = await getPm2Metrics();
    if (metrics.length === 0) return;

    try {
      await prisma.serviceMetric.createMany({
        data: metrics.map(m => ({
          serviceName: m.name,
          cpu: m.cpu,
          memoryBytes: BigInt(m.memoryBytes),
          restarts: m.restarts,
          status: m.status,
        })),
      });
      
      // Cleanup: Keep only last 2 hours of metrics (2 hours * 60 min * 6 samples/min = 720 samples per service)
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await prisma.serviceMetric.deleteMany({
        where: { timestamp: { lt: cutoff } }
      });
    } catch (err) {
      console.error("Failed to save service metrics:", err);
    }
  }, 10000); // Every 10 seconds
}

// No local stripAnsi here

export interface ParsedLogLine {
  raw: string;      // cleaned text, no ANSI
  time?: string;    // "03:27:23"
  service?: string; // "provisioning-service"
  level: "error" | "warn" | "info" | "debug" | "http";
  method?: string;  // GET POST etc.
  path?: string;    // /api/...
  status?: number;  // 200 304 etc.
  duration?: string;// "376ms"
  message: string;  // human-readable summary
}

function parseLine(raw: string): ParsedLogLine {
  // PM2 HTTP access log: 03:27:23  ◆  provisioning-service  GET   /path  200  376ms  Chrome
  const httpMatch = raw.match(
    /^(\d{2}:\d{2}:\d{2})\s+◆\s+([\w-]+)\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\S+)\s+(\d{3})\s+([\d.]+ms)\s*(.*)$/,
  );
  if (httpMatch) {
    const status = Number(httpMatch[5]);
    return {
      raw,
      time: httpMatch[1],
      service: httpMatch[2],
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "http",
      method: httpMatch[3],
      path: httpMatch[4],
      status,
      duration: httpMatch[6],
      message: `${httpMatch[3]} ${httpMatch[4]} ${status} ${httpMatch[6]}`,
    };
  }
  // JSON structured log: {"level":"info","message":"...","timestamp":"..."}
  try {
    const p = JSON.parse(raw) as { level?: string; message?: string; timestamp?: string };
    if (p.message) {
      const lvl = (p.level ?? "info").toLowerCase() as ParsedLogLine["level"];
      return {
        raw,
        time: p.timestamp ? p.timestamp.slice(11, 19) : undefined,
        level: ["error", "warn", "info", "debug"].includes(lvl) ? lvl : "info",
        message: p.message,
      };
    }
  } catch { /* not JSON */ }
  // Fallback keyword detection
  const lower = raw.toLowerCase();
  const level: ParsedLogLine["level"] =
    lower.includes("error") || lower.includes("fail") ? "error"
    : lower.includes("warn") ? "warn"
    : lower.includes("debug") ? "debug"
    : "info";
  return { raw, level, message: raw };
}

async function getPm2Logs(serviceName: string, lines: number): Promise<ParsedLogLine[]> {
  try {
    const { stdout } = await execAsync(
      `pm2 logs ${serviceName} --lines ${lines} --nostream --raw 2>&1 || true`,
      { shell: "/bin/bash" },
    );
    return stdout
      .split("\n")
      .filter(Boolean)
      .map((l) => parseLine(stripAnsi(l)));
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

// Test DB Connection on startup
prisma.user.findFirst().then(user => {
  console.log("DB Connection Test: Success. Found user:", user?.email || "None");
}).catch(err => {
  console.error("DB Connection Test: FAILED.", err.message);
});

// ── Prometheus Metrics ───────────────────────────────────────────────────────

const cpuGauge = new Gauge({
  name: "duckops_service_cpu_percent",
  help: "CPU usage percentage of the service",
  labelNames: ["service"],
});

const memGauge = new Gauge({
  name: "duckops_service_memory_bytes",
  help: "Memory usage in bytes",
  labelNames: ["service"],
});

const restartGauge = new Gauge({
  name: "duckops_service_restarts_total",
  help: "Total number of service restarts",
  labelNames: ["service"],
});

const statusGauge = new Gauge({
  name: "duckops_service_status",
  help: "Service status (1 for online, 0 otherwise)",
  labelNames: ["service"],
});

platformRouter.get("/metrics/prometheus", async (_req, res) => {
  try {
    const metrics = await getPm2Metrics();
    metrics.forEach((m) => {
      cpuGauge.set({ service: m.name }, m.cpu);
      memGauge.set({ service: m.name }, m.memoryBytes);
      restartGauge.set({ service: m.name }, m.restarts);
      statusGauge.set({ service: m.name }, m.status === "online" ? 1 : 0);
    });

    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

platformRouter.get("/metrics", requireAuth, async (_req, res) => {
  const metrics = await getPm2Metrics();
  res.json({ services: SERVICES, metrics });
});

// GET /api/platform/metrics/history/:service — historical stats for a specific service
platformRouter.get("/metrics/history/:service", requireAuth, async (req, res) => {
  const history = await prisma.serviceMetric.findMany({
    where: { serviceName: req.params.service as string },
    orderBy: { timestamp: "desc" },
    take: 120, // ~20 minutes of data at 10s intervals
  });
  
  // Format BigInt for JSON response
  const formatted = history.reverse().map(h => ({
    ...h,
    memoryBytes: Number(h.memoryBytes),
    time: h.timestamp.toISOString().slice(11, 19),
  }));

  res.json({ history: formatted });
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

  // Poll for new lines every 2s by re-reading last 50 lines and diffing
  let lastRaw = initial[initial.length - 1]?.raw ?? "";
  const interval = setInterval(async () => {
    const recent = await getPm2Logs(service.name, 50);
    
    // Find where we left off by comparing the 'raw' string content
    const idx = recent.map(l => l.raw).lastIndexOf(lastRaw);
    const newLines = idx >= 0 ? recent.slice(idx + 1) : recent;
    
    if (newLines.length > 0) {
      lastRaw = newLines[newLines.length - 1].raw;
      send({ type: "lines", lines: newLines });
    }
  }, 2000);

  req.on("close", () => clearInterval(interval));
});
