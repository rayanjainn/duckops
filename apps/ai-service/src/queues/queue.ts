import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { createLogger } from "@duckops/shared-utils";

const logger = createLogger("ai-queue");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

// Separate subscriber connection — IORedis can't multiplex pub/sub + commands
export const subConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

export interface AiJobData {
  projectId: string;
  prompt: string;
  sessionId?: string;
  channelId: string;
  userId: string;
}

export const aiQueue = new Queue<AiJobData>("ai-queue", { connection });

export function publishChunk(channelId: string, event: string, data: object) {
  return connection.publish(`ai-chunks:${channelId}`, JSON.stringify({ event, data }));
}

export function subscribeToChannel(
  channelId: string,
  onMessage: (event: string, data: object) => void,
  onDone: () => void,
): () => void {
  const channel = `ai-chunks:${channelId}`;
  const sub = subConnection.duplicate();

  sub.subscribe(channel).catch((e) => logger.error("subscribe error", e));

  sub.on("message", (_chan: string, raw: string) => {
    try {
      const { event, data } = JSON.parse(raw);
      onMessage(event, data);
      if (event === "done" || event === "error") {
        onDone();
        sub.unsubscribe(channel).catch(() => {});
        sub.disconnect();
      }
    } catch { /* ignore parse errors */ }
  });

  // Return cleanup fn
  return () => {
    sub.unsubscribe(channel).catch(() => {});
    sub.disconnect();
  };
}

export function startAiWorker(
  processJob: (job: Job<AiJobData>) => Promise<void>,
) {
  const worker = new Worker<AiJobData>("ai-queue", processJob, {
    connection,
    concurrency: 3,
  });

  worker.on("completed", (job) => {
    logger.info(`[job ${job.id}] AI job completed for project ${job.data.projectId}`);
  });

  worker.on("failed", async (job, err) => {
    logger.error(`[job ${job?.id}] AI job failed: ${err.message}`);
    if (job?.data?.channelId) {
      await publishChunk(job.data.channelId, "error", { message: err.message });
    }
  });

  logger.info("AI worker started (concurrency=3)");
  return worker;
}
