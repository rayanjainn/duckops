import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

import { healthRouter } from "./routes/health";
import { errorHandler } from "./middleware/errorHandler";
import { startHealthCheckCron } from "./services/healthCheckService";
import { createLogger } from "@duckops/shared-utils";

const logger = createLogger("health-service");
const app = express();
const httpServer = createServer(app);

export const io = new SocketServer(httpServer, { cors: { origin: "*" } });

app.use(cors());
app.use(helmet());
app.use(morgan("combined"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "health-service" });
});

app.use("/api/health", healthRouter);
app.use("/api/logs", healthRouter);

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4004;

httpServer.listen(PORT, () => {
  logger.info(`Health Service running on port ${PORT}`);
  startHealthCheckCron();
});
