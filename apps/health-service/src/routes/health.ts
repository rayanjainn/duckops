import { Router } from "express";
import { prisma } from "@duckops/db";
import { NotFoundError } from "@duckops/shared-utils";
import {
  getProjectHealthHistory,
  getProjectLogs,
} from "../services/healthCheckService";

export const healthRouter = Router();

// GET /api/health/:projectId
healthRouter.get("/:projectId", async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId as string },
      select: { id: true, name: true, status: true, liveUrl: true },
    });

    if (!project) throw new NotFoundError("Project");

    const history = await getProjectHealthHistory(project.id, 20);
    const latest = history[0] || null;

    res.json({
      project,
      latest,
      history,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/logs/:projectId
healthRouter.get("/logs/:projectId", async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId as string },
      select: { id: true, name: true },
    });

    if (!project) throw new NotFoundError("Project");

    const lines = Number(req.query.lines) || 100;
    const logs = await getProjectLogs(project.name, lines);

    res.json({ logs });
  } catch (err) {
    next(err);
  }
});
