import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { prisma, ProjectStatus } from "@duckops/db";
import { createLogger } from "@duckops/shared-utils";
import { scaffoldProject } from "./scaffoldService";
import { runTerraform } from "./terraformService";
import { runAnsible } from "./ansibleService";
import { buildAndPushImage, deleteEcrImage } from "./buildService";
import { createAndPushRepo, deleteRepo } from "./githubService";
import { ensureLinuxUser, createProjectDir, removeProjectDir, sshKubectl } from "./sshService";
import { io } from "../index";

const logger = createLogger("project-service");

const IS_CLOUD = process.env.DEPLOY_MODE === "cloud";
const DOMAIN = process.env.DOMAIN || "yourdomain.tech";

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

  // Enqueue via BullMQ — worker picks it up asynchronously
  const { provisioningQueue } = await import("../queues/queue");
  await provisioningQueue.add(
    "provision",
    { projectId: project.id, input },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    },
  );

  return project;
}

export async function provisionProject(
  projectId: string,
  input: CreateProjectInput,
): Promise<void> {
  // Step 1: Scaffold project files locally
  await updateStatus(projectId, ProjectStatus.SCAFFOLDING, "Assembling project files...", "Render Handlebars templates");

  // Pre-compute namespace so scaffolded K8s manifests use the correct value
  const scaffoldNamespace = IS_CLOUD
    ? `${input.githubUsername.toLowerCase().replace(/[^a-z0-9]/g, "")}-${input.name}`
    : `project-${input.name}`;
  const scaffoldRegistry = IS_CLOUD
    ? `${process.env.AWS_ACCOUNT_ID}.dkr.ecr.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/duckops`
    : "k3d-duckops-registry:5111";

  const { outputDir } = await scaffoldProject({
    projectName: input.name,
    language: input.language,
    framework: input.framework,
    database: input.database,
    orm: input.orm,
    packageManager: input.packageManager,
    namespace: scaffoldNamespace,
    githubUsername: input.githubUsername,
    registry: scaffoldRegistry,
    domain: DOMAIN,
    isCloud: IS_CLOUD,
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

  // Step 2.5 (cloud only): ensure Linux user exists and create project directory
  if (IS_CLOUD) {
    await updateStatus(projectId, ProjectStatus.SCAFFOLDING, "Setting up user environment...", "useradd on EC2");
    await ensureLinuxUser(input.githubUsername);
    await createProjectDir(input.githubUsername, input.name);
    emitStatus(projectId, ProjectStatus.SCAFFOLDING, "User environment ready");
  }

  // Step 3: Build Docker image and push to registry (k3d local or ECR in cloud)
  await updateStatus(projectId, ProjectStatus.PROVISIONING, "Building Docker image...", "docker build");
  const imageTag = await buildAndPushImage(input.name, outputDir);
  emitStatus(projectId, ProjectStatus.PROVISIONING, `Image pushed: ${imageTag}`, IS_CLOUD ? "docker push → ECR" : "docker push → k3d registry");

  // Step 4: Terraform — create K8s namespace
  // Namespace format: local = "project-{name}", cloud = "{github}-{project}"
  const namespace = IS_CLOUD
    ? `${input.githubUsername.toLowerCase().replace(/[^a-z0-9]/g, "")}-${input.name}`
    : `project-${input.name}`;

  await updateStatus(projectId, ProjectStatus.PROVISIONING, "Creating infrastructure...", "terraform init");
  const terraformResult = await runTerraform({
    projectName: input.name,
    namespace,
    database: input.database,
  });

  emitStatus(projectId, ProjectStatus.PROVISIONING, "K8s namespace created", "terraform apply → K8s namespace");

  // Step 5: Ansible — deploy to Kubernetes
  await updateStatus(projectId, ProjectStatus.CONFIGURING, "Deploying to Kubernetes...", "Run Ansible playbook");
  await runAnsible({
    projectName: input.name,
    namespace: terraformResult.namespace,
    databaseUrl: IS_CLOUD ? process.env.DATABASE_URL : undefined,
    isCloud: IS_CLOUD,
    githubUsername: input.githubUsername,
    platformDomain: DOMAIN,
  });

  emitStatus(projectId, ProjectStatus.CONFIGURING, "Pod rolled out", "kubectl rollout status");

  // Step 6: Mark pipeline ready and create Jenkins job
  const isTurbo = input.framework === "turbo";

  // URL format: local = "http://{name}.localhost:8080"
  //             cloud = "https://{name}-{github}-duckops.{DOMAIN}"
  const liveUrl = IS_CLOUD
    ? `https://${input.name}-${input.githubUsername.toLowerCase()}.${DOMAIN}`
    : isTurbo
      ? `http://${input.name}-api.localhost:8080`
      : `http://${input.name}.localhost:8080`;

  const webUrl = isTurbo
    ? IS_CLOUD
      ? `https://${input.name}-web-${input.githubUsername.toLowerCase()}.${DOMAIN}`
      : `http://${input.name}-web.localhost:8080`
    : null;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      namespace: terraformResult.namespace,
      liveUrl,
      webUrl,
      internalPort: isTurbo ? 4000 : 3000,
      externalPort: IS_CLOUD ? 443 : 8080,
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

    // Trigger the first build immediately after pipeline creation
    try {
      const triggerRes = await fetch(`${PIPELINE_SERVICE}/api/pipelines/project/${projectId}/trigger`, {
        method: "POST",
      });
      if (triggerRes.ok) {
        logger.info(`Initial Jenkins build triggered for project ${projectId}`);
        emitStatus(projectId, ProjectStatus.DEPLOYING, "Initial build triggered", "Trigger initial build");
      } else {
        logger.warn(`Failed to trigger initial build: HTTP ${triggerRes.status}`);
      }
    } catch (triggerErr: any) {
      logger.warn(`Could not trigger initial build (non-fatal): ${triggerErr.message}`);
    }
  } catch (err: any) {
    logger.warn(`Pipeline creation failed (non-fatal): ${err.message}`);
  }

  // Step 8: Mark as running
  await updateStatus(
    projectId,
    ProjectStatus.RUNNING,
    isTurbo
      ? `API: ${liveUrl} · Web: ${webUrl}`
      : `Project running at ${liveUrl}`,
  );

  // Step 9: Apply initial AI prompt now that the project is fully running
  // Fire-and-forget — the user will see results in the AI Builder tab
  if (input.aiPrompt) {
    const AI_SERVICE = process.env.AI_SERVICE_URL || "http://localhost:4005";
    logger.info(`Triggering initial AI prompt for ${projectId}`);
    fetch(`${AI_SERVICE}/api/generate/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-call": process.env.JWT_SECRET || "",
      },
      body: JSON.stringify({ projectId, prompt: input.aiPrompt }),
    })
      .then(async (res) => {
        // Drain the stream so the request completes and the commit+push happens
        if (res.ok && res.body) {
          const reader = res.body.getReader();
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
          logger.info(`Initial AI prompt completed for ${projectId}`);
        } else {
          logger.warn(`Initial AI prompt failed: ${res.status} ${res.statusText}`);
        }
      })
      .catch((err: Error) => logger.warn(`Initial AI prompt error (non-fatal): ${err.message}`));
  }
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
  const project = await prisma.project.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!project) return;

  const safeNamespace = (project.namespace ?? "").replace(/[^a-z0-9-]/g, "");
  const safeImageName = project.name.replace(/[^a-z0-9._-]/g, "");
  const PIPELINE_SERVICE = process.env.PIPELINE_SERVICE_URL || "http://pipeline-service:4003";
  const githubUsername = (project as any).user?.githubUsername as string | undefined;

  // Run all independent cleanup tasks in parallel
  await Promise.allSettled([
    // 1. Delete GitHub repo
    project.githubRepoFullName && githubAccessToken
      ? deleteRepo(project.githubRepoFullName, githubAccessToken).catch((e) => logger.error(e))
      : Promise.resolve(),

    // 2. Delete K8s namespace
    safeNamespace
      ? IS_CLOUD
        ? sshKubectl(`delete namespace ${safeNamespace} --ignore-not-found=true`)
            .then(() => logger.info(`Deleted K8s namespace (cloud): ${safeNamespace}`))
            .catch((e: Error) => logger.warn(`Failed to delete K8s namespace ${safeNamespace}: ${e.message}`))
        : execAsync(`kubectl delete namespace ${safeNamespace} --ignore-not-found=true`, { timeout: 30000 })
            .then(() => logger.info(`Deleted K8s namespace: ${safeNamespace}`))
            .catch((e: Error) => logger.warn(`Failed to delete K8s namespace ${safeNamespace}: ${e.message}`))
      : Promise.resolve(),

    // 3. Delete images — ECR in cloud, local Docker registry in local mode
    IS_CLOUD
      ? deleteEcrImage(safeImageName)
      : execAsync(
          [
            `docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "^(localhost:5111|k3d-duckops-registry:5111)/${safeImageName}:" | xargs -r docker rmi --force`,
            "docker image prune --force",
          ].join(" && "),
          { timeout: 30000 },
        )
          .then(() => logger.info(`Deleted local Docker images for: ${safeImageName}`))
          .catch((e: Error) => logger.warn(`Failed to delete Docker images for ${safeImageName}: ${e.message}`)),

    // 4. Delete project dir — cloud: /home/u_{github}/projects/{name}, local: /tmp/duckops-projects/{name}
    IS_CLOUD && githubUsername
      ? removeProjectDir(githubUsername, safeImageName)
      : fs.rm(`/tmp/duckops-projects/${safeImageName}`, { recursive: true, force: true }).catch(() => {}),

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
