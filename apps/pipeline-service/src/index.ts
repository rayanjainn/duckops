import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

import { pipelineRouter } from "./routes/pipelines";
import { errorHandler } from "./middleware/errorHandler";
import { createLogger, httpLogger } from "@duckops/shared-utils";

const logger = createLogger("pipeline-service");
const app = express();
const httpServer = createServer(app);

export const io = new SocketServer(httpServer, { cors: { origin: "*" } });

app.use(cors());
app.use(helmet());
app.use(httpLogger("pipeline-service"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "pipeline-service" });
});

app.use("/api/pipelines", pipelineRouter);

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4003;

httpServer.listen(PORT, () => {
  logger.info(`Pipeline Service running on port ${PORT}`);
});
