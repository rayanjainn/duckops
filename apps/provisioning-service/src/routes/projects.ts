import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import {
  createProject,
  listProjects,
  getProject,
  deleteProject,
  retryProject,
} from "../services/projectService";
import { NotFoundError, slugify } from "@duckops/shared-utils";

export const projectRouter = Router();

const createProjectSchema = z.object({
  displayName: z.string().min(1).max(100),
  description: z.string().optional(),
  language: z.string().min(1),
  framework: z.string().min(1),
  database: z.string().min(1),
  orm: z.string().min(1),
  packageManager: z.string().min(1),
  repoVisibility: z.enum(["public", "private"]).default("private"),
  aiPrompt: z.string().optional(),
});

// POST /api/projects — requires auth
projectRouter.post(
  "/",
  requireAuth,
  validate(createProjectSchema),
  async (req, res, next) => {
    try {
      const { displayName, ...rest } = req.body;
      const name = slugify(displayName);

      const project = await createProject({
        name,
        displayName,
        ...rest,
        userId: req.user!.id,
        githubUsername: req.user!.githubUsername,
        githubAccessToken: req.user!.githubAccessToken,
      });

      res.status(201).json(project);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/projects — requires auth, only returns user's own projects
projectRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const projects = await listProjects(req.user!.id);
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id — requires auth
projectRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const project = await getProject(id);
    if (!project) throw new NotFoundError("Project");
    // Ensure user can only access their own projects
    if (project.userId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/retry — re-run provisioning on a FAILED project
projectRouter.post("/:id/retry", requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const project = await getProject(id);
    if (!project) throw new NotFoundError("Project");
    if (project.userId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const updated = await retryProject(id, {
      githubUsername: req.user!.githubUsername,
      githubAccessToken: req.user!.githubAccessToken,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id — requires auth, also deletes GitHub repo
projectRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const project = await getProject(id);
    if (!project) throw new NotFoundError("Project");
    if (project.userId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await deleteProject(id, req.user!.githubAccessToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
