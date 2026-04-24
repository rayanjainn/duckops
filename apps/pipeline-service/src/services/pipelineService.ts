import { prisma, PipelineStatus, DeploymentStatus } from "@duckops/db";
import { createLogger, NotFoundError } from "@duckops/shared-utils";
import {
  createJenkinsPipeline,
  triggerBuild,
  getLastBuildInfo,
  getAllBuilds,
  deleteJenkinsPipeline,
} from "./jenkinsService";

const logger = createLogger("pipeline-service");

export interface CreatePipelineInput {
  projectId: string;
  gitRepoUrl: string;
  branch?: string;
  githubUsername?: string;
  githubAccessToken?: string;
}

export async function createPipeline(input: CreatePipelineInput) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
  });
  if (!project) throw new NotFoundError("Project");

  const { jobName, jobUrl } = await createJenkinsPipeline({
    projectName: project.name,
    gitRepoUrl: input.gitRepoUrl,
    branch: input.branch || "main",
    githubUsername: input.githubUsername,
    githubAccessToken: input.githubAccessToken,
    packageManager: project.packageManager,
  });

  await prisma.pipeline.deleteMany({ where: { projectId: input.projectId } });

  const pipeline = await prisma.pipeline.create({
    data: {
      projectId: input.projectId,
      jenkinsJobName: jobName,
      jenkinsJobUrl: jobUrl,
      gitRepoUrl: input.gitRepoUrl,
      branch: input.branch || "main",
      status: PipelineStatus.ACTIVE,
    },
  });

  logger.info(`Pipeline created for project: ${project.name}`);
  return pipeline;
}

export async function triggerPipelineBuild(pipelineId: string) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
  });
  if (!pipeline) throw new NotFoundError("Pipeline");

  await triggerBuild(pipeline.jenkinsJobName);

  return { message: "Build triggered", jobName: pipeline.jenkinsJobName };
}

export async function syncPipelineStatus(pipelineId: string) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
  });
  if (!pipeline) throw new NotFoundError("Pipeline");

  const lastBuild = await getLastBuildInfo(pipeline.jenkinsJobName);
  if (!lastBuild) return pipeline;

  const updated = await prisma.pipeline.update({
    where: { id: pipelineId },
    data: {
      lastBuildNumber: lastBuild.number,
      lastBuildStatus: lastBuild.result,
      lastBuildAt: new Date(),
    },
  });

  return updated;
}

export async function getPipeline(pipelineId: string) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: { project: true },
  });
  if (!pipeline) throw new NotFoundError("Pipeline");
  return pipeline;
}

export async function getPipelineByProject(projectId: string) {
  return prisma.pipeline.findUnique({
    where: { projectId },
  });
}

export async function syncDeployments(projectId: string) {
  const pipeline = await prisma.pipeline.findUnique({ where: { projectId } });
  if (!pipeline) return [];

  const builds = await getAllBuilds(pipeline.jenkinsJobName);
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
  if (!project) return [];

  const registry = process.env.HOST_REGISTRY_URL || "localhost:5111";

  for (const build of builds) {
    if (!build.result) continue; // still running

    const version = `build-${build.number}`;
    const existing = await prisma.deployment.findFirst({ where: { projectId, version } });
    if (existing) continue;

    const status = build.result === "SUCCESS" ? DeploymentStatus.SUCCESS : DeploymentStatus.FAILED;
    await prisma.deployment.create({
      data: {
        projectId,
        version,
        imageTag: `${registry}/${project.name}:${build.number}`,
        status,
        triggeredBy: "jenkins",
        completedAt: build.timestamp ? new Date(build.timestamp + build.duration) : new Date(),
      },
    });
    logger.info(`Backfilled deployment record: ${version} (${status})`);
  }

  // Also update pipeline last build info
  if (builds.length > 0) {
    const latest = builds[0];
    await prisma.pipeline.update({
      where: { id: pipeline.id },
      data: {
        lastBuildNumber: latest.number,
        lastBuildStatus: latest.result ?? undefined,
        lastBuildAt: latest.timestamp ? new Date(latest.timestamp) : undefined,
      },
    });
  }

  return prisma.deployment.findMany({
    where: { projectId },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
}

export async function deletePipeline(pipelineId: string) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
  });
  if (!pipeline) throw new NotFoundError("Pipeline");

  await deleteJenkinsPipeline(pipeline.jenkinsJobName).catch(logger.error);
  await prisma.pipeline.delete({ where: { id: pipelineId } });
}

export async function deletePipelineByProjectId(projectId: string) {
  const pipeline = await prisma.pipeline.findFirst({ where: { projectId } });
  if (!pipeline) return; // no pipeline, nothing to clean up

  await deleteJenkinsPipeline(pipeline.jenkinsJobName).catch(logger.error);
  await prisma.pipeline.deleteMany({ where: { projectId } });
}
