import { Router } from "express";
import { prisma } from "@duckops/db";
import { NotFoundError } from "@duckops/shared-utils";
import {
  getProjectHealthHistory,
  getProjectLogs,
} from "../services/healthCheckService";
import { requireAuth } from "../middleware/auth";

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
      select: { id: true, name: true, userId: true },
    });

    if (!project) throw new NotFoundError("Project");
    if (project.userId !== (req as any).user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const lines = Math.min(Number(req.query.lines) || 100, 500);
    const logs = await getProjectLogs(project.name, lines);

    res.json({ logs });
  } catch (err) {
    next(err);
  }
});
