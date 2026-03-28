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

// GET /api/pipelines/:id
pipelineRouter.get("/:id", async (req, res, next) => {
  try {
    const pipeline = await getPipeline(req.params.id as string);
    res.json(pipeline);
  } catch (err) {
    next(err);
  }
});

// GET /api/pipelines/project/:projectId
pipelineRouter.get("/project/:projectId", async (req, res, next) => {
  try {
    const pipeline = await getPipelineByProject(req.params.projectId as string);
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
