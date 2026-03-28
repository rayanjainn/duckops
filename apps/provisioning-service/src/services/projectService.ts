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
  await updateStatus(projectId, ProjectStatus.SCAFFOLDING, "Assembling project files...");
  const { outputDir } = await scaffoldProject({
    projectName: input.name,
    language: input.language,
    framework: input.framework,
    database: input.database,
    orm: input.orm,
  });

  // Step 2: Create private GitHub repo and push scaffolded code
  await updateStatus(
    projectId,
    ProjectStatus.CREATING_REPO,
    "Creating private GitHub repository...",
  );
  const repoResult = await createAndPushRepo({
    projectName: input.name,
    displayName: input.displayName,
    description: input.description,
    githubUsername: input.githubUsername,
    githubAccessToken: input.githubAccessToken,
    scaffoldDir: outputDir,
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
  );

  // Step 3: Build Docker image and push to local registry
  await updateStatus(projectId, ProjectStatus.PROVISIONING, "Building Docker image...");
  await buildAndPushImage(input.name, outputDir);

  // Step 4: Terraform
  await updateStatus(projectId, ProjectStatus.PROVISIONING, "Creating infrastructure...");
  const terraformResult = await runTerraform({
    projectName: input.name,
    namespace: `project-${input.name}`,
    database: input.database,
  });

  // Step 5: Ansible — deploy to Kubernetes (image already in registry)
  await updateStatus(projectId, ProjectStatus.CONFIGURING, "Deploying to Kubernetes...");
  await runAnsible({
    projectName: input.name,
    namespace: terraformResult.namespace,
  });

  // Step 6: Mark pipeline ready and create Jenkins job
  await prisma.project.update({
    where: { id: projectId },
    data: {
      namespace: terraformResult.namespace,
      liveUrl: `http://${input.name}.localhost:8080`,
      internalPort: 3000,
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
  await updateStatus(projectId, ProjectStatus.DEPLOYING, "Creating CI/CD pipeline...");

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
  } catch (err: any) {
    logger.warn(`Pipeline creation failed (non-fatal): ${err.message}`);
  }

  // Step 8: Mark as running
  await updateStatus(
    projectId,
    ProjectStatus.RUNNING,
    `Project running at http://${input.name}.localhost:8080`,
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

export async function deleteProject(id: string, githubAccessToken?: string) {
  const project = await prisma.project.findUnique({ where: { id } });

  if (project?.githubRepoFullName && githubAccessToken) {
    await deleteRepo(project.githubRepoFullName, githubAccessToken).catch(logger.error);
  }

  return prisma.project.delete({ where: { id } });
}

async function updateStatus(projectId: string, status: ProjectStatus, message: string) {
  await prisma.project.update({
    where: { id: projectId },
    data: { status, statusMessage: message },
  });
  emitStatus(projectId, status, message);
}

function emitStatus(projectId: string, status: ProjectStatus, message: string) {
  io.emit(`project:${projectId}`, { status, message });
}
