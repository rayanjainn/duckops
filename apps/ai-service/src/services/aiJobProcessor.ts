import fs from "fs/promises";
import path from "path";
import os from "os";
import simpleGit from "simple-git";
import { prisma } from "@duckops/db";
import { createLogger } from "@duckops/shared-utils";
import { generateCodeStream, applyActionsToRepo, commitAndPush } from "./codeGenerator.js";

const logger = createLogger("ai-job-processor");

export interface AiJobParams {
  projectId: string;
  prompt: string;
  channelId: string;
  userId: string;
  publishChunk: (channelId: string, event: string, data: object) => Promise<number>;
}

export async function processAiJob({ projectId, prompt, channelId, userId, publishChunk }: AiJobParams): Promise<void> {
  let repoDir: string | null = null;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { user: true },
  });

  if (!project || !project.githubRepoUrl) {
    await publishChunk(channelId, "error", { message: "Project not found or no GitHub repo" });
    return;
  }

  try {
    await publishChunk(channelId, "status", { stage: "cloning", message: "Cloning repository..." });

    repoDir = await fs.mkdtemp(path.join(os.tmpdir(), "duckops-ai-"));
    const user = project.user as any;
    const authedUrl = project.githubRepoUrl.replace(
      "https://",
      `https://x-access-token:${user.githubAccessToken}@`,
    );
    await simpleGit().clone(authedUrl, repoDir, ["--depth", "1"]);

    await publishChunk(channelId, "status", { stage: "generating", message: "Generating code..." });

    let fullAiResponse = "";
    const onChunk = async (chunk: string) => {
      fullAiResponse += chunk;
      await publishChunk(channelId, "chunk", { text: chunk });
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
      messageHistory: [],
      onChunk,
    });

    const fileCount = actions.filter((a: any) => a.type === "file").length;
    await publishChunk(channelId, "status", { stage: "writing", message: `Writing ${fileCount} file(s)...` });

    const modifiedFiles = await applyActionsToRepo(repoDir, actions, project.framework);
    await publishChunk(channelId, "files", { files: modifiedFiles });

    const commitMsg = `feat(ai): ${prompt.slice(0, 72).replace(/\n/g, " ")}`;
    let committedFiles: string[] = [];

    if (modifiedFiles.length > 0) {
      await publishChunk(channelId, "status", { stage: "committing", message: "Committing and pushing..." });
      const sha = await commitAndPush({
        repoDir,
        files: modifiedFiles,
        commitMessage: commitMsg,
        githubAccessToken: user.githubAccessToken,
        repoUrl: project.githubRepoUrl,
      });
      if (sha) {
        committedFiles = modifiedFiles;
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
        } catch { /* model may not be migrated yet */ }
      }
    }

    // Persist session + messages
    try {
      const session = await (prisma as any).aiSession.create({
        data: { projectId, title: prompt.slice(0, 80) },
      });
      await (prisma as any).aiMessage.createMany({
        data: [
          { sessionId: session.id, role: "user", content: prompt },
          { sessionId: session.id, role: "assistant", content: fullAiResponse },
        ],
      });
    } catch { /* skip if tables not yet migrated */ }

    await publishChunk(channelId, "done", {
      filesChanged: committedFiles,
      commitMessage: commitMsg,
      message: committedFiles.length > 0
        ? `${committedFiles.length} file(s) committed. Jenkins will deploy within 60 seconds.`
        : "AI responded but no files were changed.",
    });
  } finally {
    if (repoDir) fs.rm(repoDir, { recursive: true, force: true }).catch(() => {});
  }
}
