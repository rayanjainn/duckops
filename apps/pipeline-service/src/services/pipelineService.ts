import { prisma, PipelineStatus } from "@duckops/db";
import { createLogger, NotFoundError } from "@duckops/shared-utils";
import {
  createJenkinsPipeline,
  triggerBuild,
  getLastBuildInfo,
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
  });

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

export async function deletePipeline(pipelineId: string) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
  });
  if (!pipeline) throw new NotFoundError("Pipeline");

  await deleteJenkinsPipeline(pipeline.jenkinsJobName).catch(logger.error);
  await prisma.pipeline.delete({ where: { id: pipelineId } });
}
