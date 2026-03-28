import winston from "winston";

// ─── Logger Factory ──────────────────────────────────────────────

export function createLogger(service: string) {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      process.env.NODE_ENV === "production"
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr =
                Object.keys(meta).length > 0
                  ? " " + JSON.stringify(meta)
                  : "";
              return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
            }),
          ),
    ),
    transports: [new winston.transports.Console()],
  });
}

// ─── Custom Error Classes ────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

// ─── Environment Config ──────────────────────────────────────────

type Environment = "local" | "cloud";

interface Config {
  environment: Environment;
  database: { url: string };
  redis: { url: string };
  kubernetes: { context: string; registry: string };
  jenkins: { url: string; user: string; token: string };
  terraform: { workingDir: string };
}

const configs: Record<Environment, Config> = {
  local: {
    environment: "local",
    database: {
      url:
        process.env.DATABASE_URL ||
        "postgresql://duckops:duckops123@localhost:5432/duckops",
    },
    redis: { url: process.env.REDIS_URL || "redis://localhost:6379" },
    kubernetes: {
      context: "k3d-duckops",
      registry: "k3d-duckops-registry:5111",
    },
    jenkins: {
      url: process.env.JENKINS_URL || "http://localhost:8085",
      user: process.env.JENKINS_USER || "admin",
      token: process.env.JENKINS_TOKEN || "",
    },
    terraform: { workingDir: "infra/terraform/environments/local" },
  },
  cloud: {
    environment: "cloud",
    database: { url: process.env.DATABASE_URL || "" },
    redis: { url: process.env.REDIS_URL || "" },
    kubernetes: {
      context: process.env.K8S_CONTEXT || "default",
      registry: process.env.REGISTRY_URL || "",
    },
    jenkins: {
      url: process.env.JENKINS_URL || "",
      user: process.env.JENKINS_USER || "",
      token: process.env.JENKINS_TOKEN || "",
    },
    terraform: { workingDir: "infra/terraform/environments/cloud" },
  },
};

const ENV = (process.env.DUCKOPS_ENV as Environment) || "local";
export const config = configs[ENV];

// ─── Helpers ─────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
