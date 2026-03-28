import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

import { templateRouter } from "./routes/templates";
import { errorHandler } from "./middleware/errorHandler";
import { createLogger } from "@duckops/shared-utils";

const logger = createLogger("catalog-service");
const app = express();
const httpServer = createServer(app);

export const io = new SocketServer(httpServer, {
  cors: { origin: "*" },
});

// ─── MIDDLEWARE ──────────────────────────────────────────────────
app.use(cors());
app.use(helmet());
app.use(morgan("combined"));
app.use(express.json());

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "catalog-service" });
});

// ─── ROUTES ───────────────────────────────────────────────────
app.use("/api/templates", templateRouter);

// ─── ERROR HANDLER (must be last) ────────────────────────────
app.use(errorHandler);

// ─── START SERVER ─────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 4001;

httpServer.listen(PORT, () => {
  logger.info(`Catalog Service running on port ${PORT}`);
});
