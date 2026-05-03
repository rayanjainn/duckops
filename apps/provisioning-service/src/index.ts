import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

import { projectRouter } from "./routes/projects";
import { authRouter } from "./routes/auth";
import { billingRouter } from "./routes/billing";
import { errorHandler } from "./middleware/errorHandler";
import { createLogger, httpLogger } from "@duckops/shared-utils";
import { startProvisioningWorker } from "./queues/queue";

const logger = createLogger("provisioning-service");
const app = express();
const httpServer = createServer(app);

const corsOrigins = (process.env.CORS_ORIGINS || "https://app.raycode.tech,https://raycode.tech,http://localhost:3000").split(",");

export const io = new SocketServer(httpServer, {
  cors: { origin: corsOrigins, credentials: true },
});

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
app.use(helmet());
app.use(httpLogger("provisioning-service"));

// Stripe webhook needs raw body — mount BEFORE express.json()
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "provisioning-service" });
});

app.use("/api/auth", authRouter);
app.use("/api/projects", projectRouter);
app.use("/api/billing", billingRouter);

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4002;

httpServer.listen(PORT, () => {
  logger.info(`Provisioning Service running on port ${PORT}`);
  startProvisioningWorker();
});

io.on("connection", (socket) => {
  logger.debug(`Socket connected: ${socket.id}`);
  socket.on("disconnect", () => {
    logger.debug(`Socket disconnected: ${socket.id}`);
  });
});
