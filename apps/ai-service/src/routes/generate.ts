import { Router } from "express";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import os from "os";
import simpleGit from "simple-git";
import { prisma } from "@duckops/db";
import { createLogger } from "@duckops/shared-utils";
import {
  generateCodeStream,
  applyActionsToRepo,
  commitAndPush,
} from "../services/codeGenerator.js";

const logger = createLogger("generate-route");
export const generateRouter = Router();

const generateSchema = z.object({
  projectId: z.string(),
  prompt: z.string().min(1).max(4000),
  sessionId: z.string().optional(),
});

// ─── Session endpoints ──────────────────────────────────────────────────────

generateRouter.get("/sessions/:projectId", async (req, res) => {
  try {
    const sessions = await (prisma as any).aiSession.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    res.json(sessions);
  } catch (error) {
    logger.error("Failed to fetch sessions", error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

generateRouter.get("/sessions/:projectId/:sessionId", async (req, res) => {
  try {
    const messages = await (prisma as any).aiMessage.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, createdAt: true },
    });
    res.json(messages);
  } catch (error) {
    logger.error("Failed to fetch messages", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ─── POST /api/generate/stream — SSE endpoint ──────────────────────────────
generateRouter.post("/stream", async (req, res, next) => {
  let repoDir: string | null = null;

  try {
    const { projectId, prompt, sessionId } = generateSchema.parse(req.body);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { user: true, pipeline: true },
    });

    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!project.githubRepoUrl) return res.status(400).json({ error: "No GitHub repo attached to project" });

    // --- Billing / AI Prompt Limits ---
    // Skip quota check for internal server-to-server calls (provisioning triggering initial prompt)
    const isInternal = req.headers["x-internal-call"] === process.env.JWT_SECRET;
    const user = project.user as any;
    if (!isInternal && user.plan === "FREE" && !user.devMode) {
      const now = new Date();
      let remaining = user.aiPromptsRemaining;
      let resetAt = new Date(user.aiPromptsResetAt);
      if (now >= resetAt) {
        remaining = 3;
        resetAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      }
      if (remaining <= 0) {
        return res.status(403).json({ error: "Free tier limit reached. You get 3 AI prompts every 6 hours." });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { aiPromptsRemaining: remaining - 1, aiPromptsResetAt: resetAt },
      });
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (event: string, data: object) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Session handling
    let activeSessionId = sessionId;
    let messageHistory: { role: "user" | "assistant"; content: string }[] = [];

    if (activeSessionId) {
      const msgs = await (prisma as any).aiMessage.findMany({
        where: { sessionId: activeSessionId },
        orderBy: { createdAt: "asc" },
      }).catch(() => []);
      messageHistory = msgs.map((m: any) => ({ role: m.role, content: m.content }));
    } else {
      try {
        const session = await (prisma as any).aiSession.create({
          data: { projectId, title: prompt.slice(0, 80) },
        });
        activeSessionId = session.id;
      } catch { /* table may not exist yet in older migrations */ }
    }

    send("status", { stage: "cloning", message: "Cloning repository..." });

    // Clone repo to temp dir
    repoDir = await fs.mkdtemp(path.join(os.tmpdir(), "duckops-ai-"));
    const authedUrl = project.githubRepoUrl.replace(
      "https://",
      `https://x-access-token:${project.user.githubAccessToken}@`,
    );
    await simpleGit().clone(authedUrl, repoDir, ["--depth", "1"]);
    logger.info(`Cloned ${project.githubRepoUrl} to ${repoDir}`);

    send("status", { stage: "generating", message: "Generating code..." });

    let fullAiResponse = "";
    const onChunk = (chunk: string) => {
      fullAiResponse += chunk;
      send("chunk", { text: chunk });
    };

    const { actions } = await generateCodeStream({
      projectName: project.name,
      framework: project.framework,
      language: project.language,
      database: project.database,
      orm: project.orm,
      packageManager: project.packageManager,
      repoDir,
      userPrompt: prompt,
      messageHistory,
      onChunk,
    });

    const fileCount = actions.filter((a: any) => a.type === "file").length;
    send("status", { stage: "writing", message: `Writing ${fileCount} file${fileCount !== 1 ? "s" : ""}...` });

    const modifiedFiles = await applyActionsToRepo(repoDir, actions, project.framework);
    send("files", { files: modifiedFiles });

    const commitMsg = `feat(ai): ${prompt.slice(0, 72).replace(/\n/g, " ")}`;
    let committedFiles: string[] = [];

    if (modifiedFiles.length > 0) {
      send("status", { stage: "committing", message: "Committing and pushing to GitHub..." });
      const sha = await commitAndPush({
        repoDir,
        files: modifiedFiles,
        commitMessage: commitMsg,
        githubAccessToken: project.user.githubAccessToken,
        repoUrl: project.githubRepoUrl,
      });
      if (sha) {
        committedFiles = modifiedFiles;
        logger.info(`Push succeeded: ${sha}`);

        // Store commit in DB
        try {
          await (prisma as any).commit.create({
            data: {
              projectId,
              sha,
              message: commitMsg,
              author: user.githubUsername,
              authorAvatar: user.avatarUrl,
              filesChanged: modifiedFiles.length,
              committedAt: new Date(),
            },
          });
        } catch { /* new model, may not be migrated yet */ }

        const pipelineUrl = process.env.PIPELINE_SERVICE_URL || "http://localhost:4003";
        fetch(`${pipelineUrl}/api/pipelines/project/${project.id}/trigger`, {
          method: "POST",
        }).catch((e) => logger.warn(`Trigger build failed: ${e.message}`));
      } else {
        logger.warn("No changes were committed (nothing staged)");
      }
    } else {
      logger.warn("AI returned no file actions — nothing to commit");
    }

    // Save messages to DB
    if (activeSessionId) {
      try {
        await (prisma as any).aiMessage.createMany({
          data: [
            { sessionId: activeSessionId, role: "user", content: prompt },
            { sessionId: activeSessionId, role: "assistant", content: fullAiResponse },
          ],
        });
      } catch { /* skip if table missing */ }
    }

    send("done", {
      sessionId: activeSessionId,
      filesChanged: committedFiles,
      commitMessage: commitMsg,
      message: committedFiles.length > 0
        ? `${committedFiles.length} file(s) committed and pushed. Jenkins will deploy within 60 seconds.`
        : "AI responded but no files were changed.",
    });

    res.end();
  } catch (err) {
    logger.error("Generation error:", err);
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`);
      res.end();
    } catch { /* already ended */ }
  } finally {
    if (repoDir) {
      fs.rm(repoDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});
