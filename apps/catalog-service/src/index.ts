import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

import { templateRouter } from "./routes/templates";
import { errorHandler } from "./middleware/errorHandler";
import { createLogger, httpLogger } from "@duckops/shared-utils";

const logger = createLogger("catalog-service");
const app = express();
const httpServer = createServer(app);

export const io = new SocketServer(httpServer, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(helmet());
app.use(httpLogger("catalog-service"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "catalog-service" });
});

app.use("/api/templates", templateRouter);

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4001;

if (process.env.VERCEL !== "1") {
  httpServer.listen(PORT, () => {
    logger.info(`Catalog Service running on port ${PORT}`);
  });
}

export default app;
