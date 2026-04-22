import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { prisma, ProjectStatus } from "@duckops/db";
import { createLogger } from "@duckops/shared-utils";
import { scaffoldProject } from "./scaffoldService";
import { runTerraform } from "./terraformService";
import { runAnsible } from "./ansibleService";
import { buildAndPushImage } from "./buildService";
import { createAndPushRepo, deleteRepo } from "./githubService";
import { io } from "../index";

const logger = createLogger("project-service");

export interface CreateProjectInput {
  name: string;
  displayName: string;
  description?: string;
  language: string;
  framework: string;
  database: string;
  orm: string;
  packageManager: string;
  repoVisibility?: "public" | "private";
  aiPrompt?: string;
  userId: string;
  githubUsername: string;
  githubAccessToken: string;
}

export async function createProject(input: CreateProjectInput) {
  const project = await prisma.project.create({
    data: {
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      language: input.language,
      framework: input.framework,
      database: input.database,
      orm: input.orm,
      packageManager: input.packageManager,
      repoVisibility: input.repoVisibility ?? "private",
      aiPrompt: input.aiPrompt,
      userId: input.userId,
      status: ProjectStatus.INITIALIZING,
      statusMessage: "Project registered. Starting scaffold...",
    },
  });

  emitStatus(project.id, ProjectStatus.INITIALIZING, "Project registered");

  provisionProject(project.id, input).catch((error: Error) => {
    logger.error(`Provisioning failed for ${project.id}:`, error);
    prisma.project
      .update({
        where: { id: project.id },
        data: { status: ProjectStatus.FAILED, statusMessage: error.message },
      })
      .catch(logger.error);
    emitStatus(project.id, ProjectStatus.FAILED, error.message);
  });

  return project;
}

async function provisionProject(
  projectId: string,
  input: CreateProjectInput,
): Promise<void> {
  // Step 1: Scaffold project files locally
  await updateStatus(projectId, ProjectStatus.SCAFFOLDING, "Assembling project files...", "Render Handlebars templates");
  const { outputDir } = await scaffoldProject({
    projectName: input.name,
    language: input.language,
    framework: input.framework,
    database: input.database,
    orm: input.orm,
    packageManager: input.packageManager,
  });
  emitStatus(projectId, ProjectStatus.SCAFFOLDING, "Files generated", "Write Dockerfile & K8s manifests");

  // Step 2: Create private GitHub repo and push scaffolded code
  await updateStatus(
    projectId,
    ProjectStatus.CREATING_REPO,
    "Creating private GitHub repository...",
    "Create GitHub repo via API",
  );
  const repoResult = await createAndPushRepo({
    projectName: input.name,
    displayName: input.displayName,
    description: input.description,
    githubUsername: input.githubUsername,
    githubAccessToken: input.githubAccessToken,
    scaffoldDir: outputDir,
    repoVisibility: input.repoVisibility ?? "private",
  });

  await prisma.project.update({
    where: { id: projectId },
    data: {
      githubRepoUrl: repoResult.repoUrl,
      githubRepoName: repoResult.repoName,
      githubRepoFullName: repoResult.repoFullName,
    },
  });

  emitStatus(
    projectId,
    ProjectStatus.CREATING_REPO,
    `Repository ready: ${repoResult.repoUrl}`,
    "Push scaffolded code to GitHub",
  );

  // ── NEW: Apply AI Prompt if present ──
  if (input.aiPrompt) {
    await updateStatus(projectId, ProjectStatus.PROVISIONING, "AI is customizing your project...", "Invoking AI Service");
    try {
      const AI_SERVICE = process.env.AI_SERVICE_URL || "http://localhost:4005";
      const aiRes = await fetch(`${AI_SERVICE}/api/generate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          prompt: input.aiPrompt,
        }),
      });

      if (!aiRes.ok) {
        logger.warn(`AI customization failed: ${aiRes.statusText}`);
      } else {
        // Wait for streaming to finish (basic drain)
        const reader = aiRes.body?.getReader();
        if (reader) {
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }
        logger.info(`AI customization complete for ${projectId}`);
      }
    } catch (err: any) {
      logger.warn(`AI service call failed: ${err.message}`);
    }
  }

  // Step 3: Build Docker image and push to local registry
  await updateStatus(projectId, ProjectStatus.PROVISIONING, "Building Docker image...", "docker build");
  await buildAndPushImage(input.name, outputDir);
  emitStatus(projectId, ProjectStatus.PROVISIONING, "Image pushed to registry", "docker push → k3d registry");

  // Step 4: Terraform
  await updateStatus(projectId, ProjectStatus.PROVISIONING, "Creating infrastructure...", "terraform init");
  const terraformResult = await runTerraform({
    projectName: input.name,
    namespace: `project-${input.name}`,
    database: input.database,
  });

  emitStatus(projectId, ProjectStatus.PROVISIONING, "K8s namespace created", "terraform apply → K8s namespace");

  // Step 5: Ansible — deploy to Kubernetes (image already in registry)
  await updateStatus(projectId, ProjectStatus.CONFIGURING, "Deploying to Kubernetes...", "Run Ansible playbook");
  await runAnsible({
    projectName: input.name,
    namespace: terraformResult.namespace,
  });

  emitStatus(projectId, ProjectStatus.CONFIGURING, "Pod rolled out", "kubectl rollout status");

  // Step 6: Mark pipeline ready and create Jenkins job
  const isTurbo = input.framework === "turbo";
  await prisma.project.update({
    where: { id: projectId },
    data: {
      namespace: terraformResult.namespace,
      liveUrl: isTurbo
        ? `http://${input.name}-api.localhost:8080`
        : `http://${input.name}.localhost:8080`,
      webUrl: isTurbo ? `http://${input.name}-web.localhost:8080` : null,
      internalPort: isTurbo ? 4000 : 3000,
      externalPort: 8080,
      status: ProjectStatus.PIPELINE_READY,
      statusMessage: "Infrastructure ready. Creating CI/CD pipeline...",
    },
  });

  emitStatus(
    projectId,
    ProjectStatus.PIPELINE_READY,
    "Infrastructure ready. Creating CI/CD pipeline...",
  );

  // Step 7: Create Jenkins pipeline via pipeline service
  const PIPELINE_SERVICE = process.env.PIPELINE_SERVICE_URL || "http://localhost:4003";
  await updateStatus(projectId, ProjectStatus.DEPLOYING, "Creating CI/CD pipeline...", "Store GitHub credentials in Jenkins");

  try {
    const pipelineRes = await fetch(`${PIPELINE_SERVICE}/api/pipelines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        gitRepoUrl: repoResult.repoUrl,
        branch: "main",
        githubUsername: input.githubUsername,
        githubAccessToken: input.githubAccessToken,
      }),
    });

    if (!pipelineRes.ok) {
      const errText = await pipelineRes.text();
      throw new Error(`Pipeline service error ${pipelineRes.status}: ${errText}`);
    }
    emitStatus(projectId, ProjectStatus.DEPLOYING, "Jenkins job created", "Create Jenkins job & configure SCM polling");
  } catch (err: any) {
    logger.warn(`Pipeline creation failed (non-fatal): ${err.message}`);
  }

  // Step 8: Mark as running
  await updateStatus(
    projectId,
    ProjectStatus.RUNNING,
    isTurbo
      ? `API: http://${input.name}-api.localhost:8080 · Web: http://${input.name}-web.localhost:8080`
      : `Project running at http://${input.name}.localhost:8080`,
  );
}

export async function retryProject(
  projectId: string,
  user: { githubUsername: string; githubAccessToken: string },
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  await updateStatus(projectId, ProjectStatus.INITIALIZING, "Retrying provisioning...");

  const input: CreateProjectInput = {
    name: project.name,
    displayName: project.displayName,
    description: project.description ?? undefined,
    language: project.language,
    framework: project.framework,
    database: project.database,
    orm: project.orm,
    packageManager: project.packageManager,
    aiPrompt: project.aiPrompt ?? undefined,
    userId: project.userId,
    githubUsername: user.githubUsername,
    githubAccessToken: user.githubAccessToken,
  };

  provisionProject(projectId, input).catch((error: Error) => {
    logger.error(`Retry provisioning failed for ${projectId}:`, error);
    prisma.project
      .update({
        where: { id: projectId },
        data: { status: ProjectStatus.FAILED, statusMessage: error.message },
      })
      .catch(logger.error);
    emitStatus(projectId, ProjectStatus.FAILED, error.message);
  });

  return prisma.project.findUnique({ where: { id: projectId } });
}

export async function listProjects(userId?: string) {
  return prisma.project.findMany({
    where: userId ? { userId } : {},
    include: { pipeline: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      pipeline: true,
      deployments: { orderBy: { startedAt: "desc" }, take: 10 },
      healthChecks: { orderBy: { checkedAt: "desc" }, take: 20 },
    },
  });
}

const execAsync = promisify(exec);

export async function deleteProject(id: string, githubAccessToken?: string) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return;

  const safeNamespace = (project.namespace ?? "").replace(/[^a-z0-9-]/g, "");
  const safeImageName = project.name.replace(/[^a-z0-9._-]/g, "");
  const PIPELINE_SERVICE = process.env.PIPELINE_SERVICE_URL || "http://pipeline-service:4003";

  // Run all independent cleanup tasks in parallel
  await Promise.allSettled([
    // 1. Delete GitHub repo
    project.githubRepoFullName && githubAccessToken
      ? deleteRepo(project.githubRepoFullName, githubAccessToken).catch((e) => logger.error(e))
      : Promise.resolve(),

    // 2. Delete K8s namespace
    safeNamespace
      ? execAsync(`kubectl delete namespace ${safeNamespace} --ignore-not-found=true`, { timeout: 30000 })
          .then(() => logger.info(`Deleted K8s namespace: ${safeNamespace}`))
          .catch((e) => logger.warn(`Failed to delete K8s namespace ${safeNamespace}: ${e.message}`))
      : Promise.resolve(),

    // 3. Delete Docker images from registry + prune dangling layers left by this project's builds
    execAsync(
      [
        // Remove all tagged variants: latest + any numbered build tags
        `docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "^(localhost:5111|k3d-duckops-registry:5111)/${safeImageName}:" | xargs -r docker rmi --force`,
        // Prune dangling (untagged) images — these are layers orphaned by the deletions above
        "docker image prune --force",
      ].join(" && "),
      { timeout: 30000 },
    )
      .then(() => logger.info(`Deleted Docker images for: ${safeImageName}`))
      .catch((e) => logger.warn(`Failed to delete Docker images for ${safeImageName}: ${e.message}`)),

    // 4. Delete scaffolded temp directory
    fs.rm(`/tmp/duckops-projects/${safeImageName}`, { recursive: true, force: true }).catch(() => {}),

    // 5. Delete Jenkins pipeline via pipeline service
    fetch(`${PIPELINE_SERVICE}/api/pipelines/project/${id}`, { method: "DELETE" }).catch(logger.error),
  ]);

  // 6. Delete child DB records then project (must be sequential — FK constraints)
  await Promise.all([
    prisma.deployment.deleteMany({ where: { projectId: id } }),
    prisma.healthCheck.deleteMany({ where: { projectId: id } }),
    prisma.pipeline.deleteMany({ where: { projectId: id } }),
  ]);

  return prisma.project.delete({ where: { id } });
}

async function updateStatus(projectId: string, status: ProjectStatus, message: string, subStep?: string) {
  await prisma.project.update({
    where: { id: projectId },
    data: { status, statusMessage: message },
  });
  emitStatus(projectId, status, message, subStep);
}

function emitStatus(projectId: string, status: ProjectStatus, message: string, subStep?: string) {
  io.emit(`project:${projectId}`, { status, message, subStep });
}
