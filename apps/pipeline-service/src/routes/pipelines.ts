import { Router } from "express";
import { z } from "zod";
import {
  createPipeline,
  triggerPipelineBuild,
  syncPipelineStatus,
  getPipeline,
  getPipelineByProject,
  deletePipeline,
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

// POST /api/pipelines
pipelineRouter.post("/", async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const pipeline = await createPipeline(data);
    res.status(201).json(pipeline);
  } catch (err) {
    next(err);
  }
});

// GET /api/pipelines/project/:projectId — must be before /:id
pipelineRouter.get("/project/:projectId", async (req, res, next) => {
  try {
    const pipeline = await getPipelineByProject(req.params.projectId as string);
    res.json(pipeline);
  } catch (err) {
    next(err);
  }
});

// GET /api/pipelines/project/:projectId/live — SSE stream of live build info
pipelineRouter.get("/project/:projectId/live", async (req, res) => {
  const pipeline = await getPipelineByProject(req.params.projectId as string).catch(() => null);
  if (!pipeline) {
    res.status(404).json({ error: "No pipeline for project" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const poll = async () => {
    try {
      const info = await getLiveBuildInfo(pipeline.jenkinsJobName);
      send(info);
    } catch {
      send({ error: "jenkins_unreachable" });
    }
  };

  await poll();
  const interval = setInterval(poll, 2000);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});

// GET /api/pipelines/project/:projectId/snapshot — one-shot live build info
pipelineRouter.get("/project/:projectId/snapshot", async (req, res, next) => {
  try {
    const pipeline = await getPipelineByProject(req.params.projectId as string);
    if (!pipeline) { res.json(null); return; }
    const info = await getLiveBuildInfo(pipeline.jenkinsJobName);
    res.json(info);
  } catch (err) {
    next(err);
  }
});

// GET /api/pipelines/:id
pipelineRouter.get("/:id", async (req, res, next) => {
  try {
    const pipeline = await getPipeline(req.params.id as string);
    res.json(pipeline);
  } catch (err) {
    next(err);
  }
});

// POST /api/pipelines/:id/build
pipelineRouter.post("/:id/build", async (req, res, next) => {
  try {
    const result = await triggerPipelineBuild(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/pipelines/:id/sync
pipelineRouter.post("/:id/sync", async (req, res, next) => {
  try {
    const pipeline = await syncPipelineStatus(req.params.id as string);
    res.json(pipeline);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/pipelines/:id
pipelineRouter.delete("/:id", async (req, res, next) => {
  try {
    await deletePipeline(req.params.id as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/pipelines/deployments — called by Jenkinsfile to record a deployment
pipelineRouter.post("/deployments", async (req, res, next) => {
  try {
    const { projectName, buildNumber, imageTag, status, buildLogs, deployLogs } = req.body as {
      projectName: string;
      buildNumber: string;
      imageTag: string;
      status: "SUCCESS" | "FAILED";
      buildLogs?: string;
      deployLogs?: string;
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
  } catch (err) {
    next(err);
  }
});
