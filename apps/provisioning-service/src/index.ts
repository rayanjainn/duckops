import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

import { projectRouter } from "./routes/projects";
import { authRouter } from "./routes/auth";
import { errorHandler } from "./middleware/errorHandler";
import { createLogger } from "@duckops/shared-utils";

const logger = createLogger("provisioning-service");
const app = express();
const httpServer = createServer(app);

export const io = new SocketServer(httpServer, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(helmet());
app.use(morgan("combined"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "provisioning-service" });
});

app.use("/api/auth", authRouter);
app.use("/api/projects", projectRouter);

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4002;

httpServer.listen(PORT, () => {
  logger.info(`Provisioning Service running on port ${PORT}`);
});

io.on("connection", (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});
