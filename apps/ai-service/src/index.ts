import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createLogger, httpLogger } from "@duckops/shared-utils";
import { stackRouter } from "./routes/stack.js";
import { generateRouter } from "./routes/generate.js";
import { startAiWorker } from "./queues/queue.js";

const logger = createLogger("ai-service");
const app = express();
const PORT = process.env.AI_SERVICE_PORT || 4005;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*" }));
app.use(httpLogger("ai-service"));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "ai-service" }));

app.use("/api/stack", stackRouter);
app.use("/api/generate", generateRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  logger.info(`AI service running on port ${PORT}`);
  // Start BullMQ worker for queued AI jobs (used when DEPLOY_MODE=cloud)
  startAiWorker(async (job) => {
    const { projectId, prompt, channelId, userId } = job.data;
    const { publishChunk } = await import("./queues/queue.js");
    try {
      // Delegate to the same generation logic used by the SSE route
      const { processAiJob } = await import("./services/aiJobProcessor.js");
      await processAiJob({ projectId, prompt, channelId, userId, publishChunk });
    } catch (err: any) {
      await publishChunk(channelId, "error", { message: err.message });
      throw err;
    }
  });
});
