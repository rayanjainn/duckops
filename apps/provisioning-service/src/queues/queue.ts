import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { createLogger } from "@duckops/shared-utils";
import { provisionProject } from "../services/projectService";
import type { CreateProjectInput } from "../services/projectService";
import { prisma, ProjectStatus } from "@duckops/db";
import { io } from "../index";

const logger = createLogger("provisioning-queue");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const provisioningQueue = new Queue<{ projectId: string; input: CreateProjectInput }>(
  "provisioning-queue",
  { connection },
);

export function startProvisioningWorker() {
  const worker = new Worker<{ projectId: string; input: CreateProjectInput }>(
    "provisioning-queue",
    async (job: Job) => {
      const { projectId, input } = job.data;
      logger.info(`[job ${job.id}] Starting provisioning for project ${projectId}`);
      await provisionProject(projectId, input);
    },
    {
      connection,
      concurrency: 2,
      lockDuration: 600_000,   // 10 min — provisioning can take up to 5 min
      lockRenewTime: 120_000,  // renew lock every 2 min
    },
  );

  worker.on("completed", (job) => {
    logger.info(`[job ${job.id}] Provisioning completed for ${job.data.projectId}`);
  });

  worker.on("failed", async (job, err) => {
    logger.error(`[job ${job?.id}] Provisioning failed: ${err.message}`);
    if (job?.data?.projectId) {
      await prisma.project
        .update({
          where: { id: job.data.projectId },
          data: { status: ProjectStatus.FAILED, statusMessage: err.message },
        })
        .catch(() => {});
      io.emit(`project:${job.data.projectId}`, {
        status: ProjectStatus.FAILED,
        message: err.message,
      });
    }
  });

  logger.info("Provisioning worker started");
  return worker;
}
