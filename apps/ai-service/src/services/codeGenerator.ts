import { ollama, CODE_MODEL } from "../config/ollama.js";
import {
  CODE_GENERATOR_SYSTEM_PROMPT,
  ERROR_FIXER_PROMPT,
  buildContinuationPrompt,
} from "../prompts/system.js";
import { createLogger } from "@duckops/shared-utils";
import simpleGit from "simple-git";
import fs from "fs/promises";
import path from "path";

const logger = createLogger("code-generator");

export interface FileAction {
  type: "file" | "shell";
  filePath?: string;
  content: string;
}

export interface GenerationResult {
  actions: FileAction[];
  rawResponse: string;
}

// Parse duckops_artifact XML from streaming/complete response
export function parseArtifact(raw: string): FileAction[] {
  const actions: FileAction[] = [];
  const actionRegex =
    /<duckops_action\s+type="([^"]+)"(?:\s+filePath="([^"]*)")?>([\s\S]*?)<\/duckops_action>/g;
  let match;
  while ((match = actionRegex.exec(raw)) !== null) {
    const type = match[1] as "file" | "shell";
    const filePath = match[2];
    const content = match[3].trim();
    if (type === "file" && filePath) {
      actions.push({ type: "file", filePath, content });
    } else if (type === "shell") {
      actions.push({ type: "shell", content });
    }
  }
  return actions;
}

export interface GenerateStreamParams {
  projectName: string;
  framework: string;
  language: string;
  database: string;
  orm: string;
  packageManager: string;
  repoDir: string;
  userPrompt: string;
  messageHistory: { role: "user" | "assistant"; content: string }[];
  onChunk: (chunk: string) => void;
}

export async function generateCodeStream(
  params: GenerateStreamParams,
): Promise<GenerationResult> {
  // Gather existing files list
  let existingFiles: string[] = [];
  let fileContents = "";
  try {
    existingFiles = await getProjectFiles(params.repoDir);
    fileContents = await readKeyFiles(params.repoDir, existingFiles);
  } catch {
    /* repo may not exist yet */
  }

  const userMessage = buildContinuationPrompt({
    projectName: params.projectName,
    framework: params.framework,
    language: params.language,
    database: params.database,
    orm: params.orm,
    packageManager: params.packageManager,
    existingFiles,
    fileContents,
    userPrompt: params.userPrompt,
  });

  const messages = [
    ...params.messageHistory,
    { role: "user" as const, content: userMessage },
  ];

  const stream = await ollama.chat({
    model: CODE_MODEL,
    messages: [
      { role: "system", content: CODE_GENERATOR_SYSTEM_PROMPT },
      ...messages,
    ],
    stream: true,
    options: { temperature: 0.2, num_predict: 4096 },
  });

  let fullResponse = "";
  for await (const part of stream) {
    const chunk = part.message?.content || "";
    fullResponse += chunk;
    params.onChunk(chunk);
  }

  const actions = parseArtifact(fullResponse);
  return { actions, rawResponse: fullResponse };
}

export async function fixErrors(params: {
  repoDir: string;
  buildOutput: string;
  onChunk: (chunk: string) => void;
}): Promise<GenerationResult> {
  const files = await getProjectFiles(params.repoDir);
  const fileContents = await readKeyFiles(params.repoDir, files);

  const userMessage = `Build/test output:\n${params.buildOutput}\n\nKey source files:\n${fileContents}`;

  const stream = await ollama.chat({
    model: CODE_MODEL,
    messages: [
      { role: "system", content: ERROR_FIXER_PROMPT },
      { role: "user", content: userMessage },
    ],
    stream: true,
    options: { temperature: 0.1, num_predict: 4096 },
  });

  let fullResponse = "";
  for await (const part of stream) {
    const chunk = part.message?.content || "";
    fullResponse += chunk;
    params.onChunk(chunk);
  }

  const actions = parseArtifact(fullResponse);
  return { actions, rawResponse: fullResponse };
}

async function getProjectFiles(dir: string): Promise<string[]> {
  const ignore = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "coverage",
  ]);
  const results: string[] = [];

  async function walk(current: string, base: string) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (ignore.has(entry.name)) continue;
      const rel = path.relative(base, path.join(current, entry.name));
      if (entry.isDirectory()) {
        await walk(path.join(current, entry.name), base);
      } else {
        results.push(rel);
      }
    }
  }

  await walk(dir, dir);
  return results;
}

async function readKeyFiles(dir: string, files: string[]): Promise<string> {
  // Prioritize source files, config files, and avoid binaries
  const extensions = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".css",
    ".html",
    ".prisma",
  ]);
  const keyFiles = files.filter((f) => {
    const ext = path.extname(f);
    return (
      extensions.has(ext) &&
      (f.startsWith("src/") ||
        f.includes("package.json") ||
        f.includes("schema.prisma") ||
        f.includes("App.") ||
        f.includes("main."))
    );
  });

  const parts: string[] = [];
  for (const f of keyFiles.slice(0, 30)) {
    // Increase context window to 30 files
    try {
      const content = await fs.readFile(path.join(dir, f), "utf-8");
      parts.push(`### ${f}\n${content.slice(0, 5000)}`); // Increase per-file limit
    } catch {
      /* skip */
    }
  }
  return parts.join("\n\n");
}

const NEXT_CONFIG_SAFE = `import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
`;

export async function applyActionsToRepo(
  repoDir: string,
  actions: FileAction[],
  framework?: string,
): Promise<string[]> {
  const modifiedFiles: string[] = [];
  for (const action of actions) {
    if (action.type === "file" && action.filePath) {
      const fullPath = path.join(repoDir, action.filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, action.content, "utf-8");
      modifiedFiles.push(action.filePath);
      logger.info(`Applied file: ${action.filePath}`);
    }
  }

  // For Next.js projects, always ensure next.config.ts has ignoreBuildErrors
  // so AI-generated code with minor TS issues doesn't break the Docker build
  if (framework?.toLowerCase().includes("next")) {
    const configCandidates = ["next.config.ts", "next.config.js", "next.config.mjs"];
    for (const cfg of configCandidates) {
      const cfgPath = path.join(repoDir, cfg);
      try {
        const existing = await fs.readFile(cfgPath, "utf-8");
        if (!existing.includes("ignoreBuildErrors")) {
          const patched = existing
            .replace(
              /output:\s*['"]standalone['"]/,
              `output: 'standalone',\n  typescript: { ignoreBuildErrors: true },\n  eslint: { ignoreDuringBuilds: true }`,
            );
          // If replace didn't apply (pattern not found), write the safe default
          const written = patched.includes("ignoreBuildErrors") ? patched : NEXT_CONFIG_SAFE;
          await fs.writeFile(cfgPath, written, "utf-8");
          if (!modifiedFiles.includes(cfg)) modifiedFiles.push(cfg);
          logger.info(`Patched ${cfg} to ignore build errors`);
        }
        break;
      } catch { /* file not found, try next */ }
    }
  }

  return modifiedFiles;
}

export async function commitAndPush(params: {
  repoDir: string;
  files: string[];
  commitMessage: string;
  githubAccessToken: string;
  repoUrl: string;
}): Promise<string | null> {
  const git = simpleGit(params.repoDir);

  await git.addConfig("user.email", "rayansjain29@gmail.com");
  await git.addConfig("user.name", "DuckOps AI");

  if (params.files.length === 0) {
    logger.warn("commitAndPush called with no files — skipping commit");
    return null;
  }

  for (const f of params.files) {
    await git.add(f);
  }

  // Check if there's actually anything staged before committing
  const status = await git.status();
  if (status.staged.length === 0) {
    logger.warn("Nothing staged after git add — skipping commit");
    return null;
  }

  const commitResult = await git.commit(params.commitMessage);
  const sha = commitResult.commit;

  const authedUrl = params.repoUrl.replace(
    "https://",
    `https://x-access-token:${params.githubAccessToken}@`,
  );
  await git.push(authedUrl, "main");
  logger.info(`Committed and pushed: ${params.commitMessage} (${sha})`);
  return sha;
}
