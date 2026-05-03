import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireInternalAuth } from "../middleware/auth";
import {
  createPipeline,
  triggerPipelineBuild,
  syncPipelineStatus,
  syncDeployments,
  getPipeline,
  getPipelineByProject,
  deletePipeline,
  deletePipelineByProjectId,
} from "../services/pipelineService";
import { getLiveBuildInfo } from "../services/jenkinsService";
import { prisma, DeploymentStatus } from "@duckops/db";

export const pipelineRouter = Router();

const createSchema = z.object({
  projectId: z.string().min(1),
  gitRepoUrl: z.string().url(),
  branch: z.string().default("main"),
  githubUsername: z.string().optional(),
  githubAccessToken: z.string().optional(),
});

// POST /api/pipelines — internal (provisioning-service calls this, no user auth)
pipelineRouter.post("/", requireInternalAuth, async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const pipeline = await createPipeline(data);
    res.status(201).json(pipeline);
  } catch (err) {
    next(err);
  }
});

// GET /api/pipelines/project/:projectId — auth + ownership check
pipelineRouter.get("/project/:projectId", requireAuth, async (req, res, next) => {
  try {
    const pipeline = await getPipelineByProject(req.params.projectId as string);
    if (pipeline) {
      const project = await prisma.project.findUnique({ where: { id: req.params.projectId as string }, select: { userId: true } });
      if (project && project.userId !== (req as any).user.id) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
    }
    res.json(pipeline);
  } catch (err) {
    next(err);
  }
});

// GET /api/pipelines/project/:projectId/live — SSE stream, auth via query token
pipelineRouter.get("/project/:projectId/live", requireAuth, async (req, res) => {
  const pipeline = await getPipelineByProject(req.params.projectId as string).catch(() => null);
  if (!pipeline) { res.status(404).json({ error: "No pipeline for project" }); return; }

  // Ownership check
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId as string }, select: { userId: true } });
  if (project && project.userId !== (req as any).user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const sseReq = req as any;
  const sseRes = res as any;
  sseRes.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (data: unknown) => sseRes.write(`data: ${JSON.stringify(data)}\n\n`);

  const poll = async () => {
    try { send(await getLiveBuildInfo(pipeline.jenkinsJobName)); }
    catch { send({ error: "jenkins_unreachable" }); }
  };

  await poll();
  const interval = (globalThis as any).setInterval(poll, 2000);
  sseReq.on("close", () => { (globalThis as any).clearInterval(interval); sseRes.end(); });
});

// GET /api/pipelines/project/:projectId/snapshot — one-shot, auth required
pipelineRouter.get("/project/:projectId/snapshot", requireAuth, async (req, res, next) => {
  try {
    const pipeline = await getPipelineByProject(req.params.projectId as string);
    if (!pipeline) { res.json(null); return; }
    const info = await getLiveBuildInfo(pipeline.jenkinsJobName);
    res.json(info);
  } catch (err) { next(err); }
});

// POST /api/pipelines/project/:projectId/sync-deployments — backfill from Jenkins
pipelineRouter.post("/project/:projectId/sync-deployments", requireAuth, async (req, res, next) => {
  try {
    const projectId = req.params.projectId as string;
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } });
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (project.userId !== (req as any).user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    const deployments = await syncDeployments(projectId);
    res.json(deployments);
  } catch (err) { next(err); }
});

// POST /api/pipelines/project/:projectId/trigger — internal (ai-service calls this)
pipelineRouter.post("/project/:projectId/trigger", requireInternalAuth, async (req, res, next) => {
  try {
    const pipeline = await getPipelineByProject(req.params.projectId as string);
    if (!pipeline) { res.status(404).json({ error: "Pipeline not found for project" }); return; }
    const result = await triggerPipelineBuild(pipeline.id);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/pipelines/:id — auth required
pipelineRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const pipeline = await getPipeline(req.params.id as string);
    if (pipeline && pipeline.project.userId !== (req as any).user.id) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    res.json(pipeline);
  } catch (err) { next(err); }
});

// POST /api/pipelines/:id/build — auth required
pipelineRouter.post("/:id/build", requireAuth, async (req, res, next) => {
  try {
    const result = await triggerPipelineBuild(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/pipelines/:id/sync
pipelineRouter.post("/:id/sync", requireAuth, async (req, res, next) => {
  try {
    const pipeline = await syncPipelineStatus(req.params.id as string);
    res.json(pipeline);
  } catch (err) { next(err); }
});

// DELETE /api/pipelines/:id
pipelineRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await deletePipeline(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

// DELETE /api/pipelines/project/:projectId — internal (provisioning-service)
pipelineRouter.delete("/project/:projectId", requireInternalAuth, async (req, res, next) => {
  try {
    await deletePipelineByProjectId(req.params.projectId as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

// POST /api/pipelines/deployments — called by Jenkinsfile post block
// Accepts X-Internal-Secret header OR X-Jenkins-Secret (set as Jenkins global env var)
pipelineRouter.post("/deployments", (req, res, next) => {
  const secret = process.env.INTERNAL_API_SECRET || process.env.JWT_SECRET || "duckops-dev-secret-change-in-prod";
  const jenkinsSecret = process.env.JENKINS_CALLBACK_SECRET || secret;
  const provided = (req.headers["x-internal-secret"] || req.headers["x-jenkins-secret"]) as string | undefined;
  if (!provided || (provided !== secret && provided !== jenkinsSecret)) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}, async (req, res, next) => {
  try {
    const { projectName, buildNumber, imageTag, status, buildLogs, deployLogs } = req.body as {
      projectName: string; buildNumber: string; imageTag: string;
      status: "SUCCESS" | "FAILED"; buildLogs?: string; deployLogs?: string;
    };
    const project = await prisma.project.findUnique({ where: { name: projectName } });
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    const deploymentStatus = status === "SUCCESS" ? DeploymentStatus.SUCCESS : DeploymentStatus.FAILED;
    const deployment = await prisma.deployment.create({
      data: {
        projectId: project.id,
        version: `build-${buildNumber}`,
        imageTag,
        status: deploymentStatus,
        triggeredBy: "jenkins",
        buildLogs: buildLogs ?? null,
        deployLogs: deployLogs ?? null,
        completedAt: new Date(),
      },
    });
    res.status(201).json(deployment);
  } catch (err) { next(err); }
});
