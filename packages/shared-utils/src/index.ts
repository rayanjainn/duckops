import winston from "winston";
import type { Request, Response, NextFunction } from "express";

// ANSI color helpers (no extra dep — just escape codes)
const c = {
  reset:   "\x1b[0m",
  dim:     "\x1b[2m",
  bold:    "\x1b[1m",
  red:     "\x1b[31m",
  yellow:  "\x1b[33m",
  cyan:    "\x1b[36m",
  green:   "\x1b[32m",
  magenta: "\x1b[35m",
  blue:    "\x1b[34m",
  white:   "\x1b[37m",
  gray:    "\x1b[90m",
};

const SERVICE_COLORS: Record<string, string> = {
  "provisioning-service": c.cyan,
  "pipeline-service":     c.blue,
  "health-service":       c.green,
  "ai-service":           c.magenta,
  "catalog-service":      c.yellow,
  "jenkins-service":      c.yellow,
  "project-service":      c.cyan,
  "scaffold-service":     c.cyan,
  "generate-route":       c.magenta,
  "code-generator":       c.magenta,
};

function levelIcon(level: string): string {
  switch (level) {
    case "error": return `${c.red}✖${c.reset}`;
    case "warn":  return `${c.yellow}▲${c.reset}`;
    case "info":  return `${c.green}●${c.reset}`;
    case "debug": return `${c.gray}◌${c.reset}`;
    default:      return `${c.gray}·${c.reset}`;
  }
}

function fmtTime(ts: string): string {
  // "2026-04-23T08:23:12.016Z" → "08:23:12"
  return ts.slice(11, 19);
}

// ─── Logger Factory ──────────────────────────────────────────────

export function createLogger(service: string) {
  const svcColor = SERVICE_COLORS[service] || c.white;
  const svcTag = `${svcColor}${c.bold}${service}${c.reset}`;

  return winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      process.env.NODE_ENV === "production"
        ? winston.format.json()
        : winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
            const time = `${c.gray}${fmtTime(String(timestamp))}${c.reset}`;
            const icon = levelIcon(level);
            const msg = level === "error"
              ? `${c.red}${message}${c.reset}`
              : level === "warn"
              ? `${c.yellow}${message}${c.reset}`
              : String(message);
            const metaKeys = Object.keys(meta).filter(k => k !== "service");
            const metaStr = metaKeys.length > 0
              ? `  ${c.gray}${JSON.stringify(meta)}${c.reset}`
              : "";
            const stackStr = stack ? `\n${c.gray}${stack}${c.reset}` : "";
            return `${time}  ${icon}  ${svcTag}  ${msg}${metaStr}${stackStr}`;
          }),
    ),
    transports: [new winston.transports.Console()],
  });
}

// ─── HTTP Request Logger (replaces morgan) ───────────────────────

const METHOD_COLOR: Record<string, string> = {
  GET:    c.green,
  POST:   c.cyan,
  PUT:    c.blue,
  PATCH:  c.yellow,
  DELETE: c.red,
};

function statusColor(code: number): string {
  if (code >= 500) return c.red;
  if (code >= 400) return c.yellow;
  if (code >= 300) return c.gray;
  return c.green;
}

function parseUserAgent(ua: string): string {
  if (ua.includes("Brave"))   return "Brave";
  if (ua.includes("Chrome"))  return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari"))  return "Safari";
  if (ua.includes("curl"))    return "curl";
  if (ua.includes("node"))    return "node-fetch";
  if (ua.includes("axios"))   return "axios";
  return "http";
}

// Skip health-check polling and SSE keep-alive noise
const SKIP_PATHS = new Set(["/health"]);
const SKIP_PATH_PATTERNS = ["/live", "/snapshot"];

// Returns `any` so it works with both Express 4 and Express 5 type definitions
export function httpLogger(service: string): any {
  const svcColor = SERVICE_COLORS[service] || c.white;
  const svcTag = `${svcColor}${c.bold}${service}${c.reset}`;

  return (req: Request, res: Response, next: NextFunction) => {
    if (SKIP_PATHS.has(req.path)) return next();
    if (SKIP_PATH_PATTERNS.some(p => req.path.endsWith(p))) return next();

    const start = Date.now();
    res.on("finish", () => {

      const ms = Date.now() - start;
      const method = req.method;
      const mColor = METHOD_COLOR[method] || c.white;
      const sColor = statusColor(res.statusCode);
      const ua = parseUserAgent(req.headers["user-agent"] || "");

      // Trim query params for cleanliness (token= etc)
      const path = req.path.length > 60 ? req.path.slice(0, 57) + "…" : req.path;

      const time = `${c.gray}${fmtTime(new Date().toISOString())}${c.reset}`;
      const methodStr = `${mColor}${c.bold}${method.padEnd(6)}${c.reset}`;
      const statusStr = `${sColor}${res.statusCode}${c.reset}`;
      const msStr = ms > 500
        ? `${c.red}${ms}ms${c.reset}`
        : ms > 150
        ? `${c.yellow}${ms}ms${c.reset}`
        : `${c.gray}${ms}ms${c.reset}`;
      const agentStr = `${c.gray}${ua}${c.reset}`;

      process.stdout.write(
        `${time}  ${c.green}◆${c.reset}  ${svcTag}  ${methodStr} ${path}  ${statusStr}  ${msStr}  ${agentStr}\n`
      );
    });
    next();
  };
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

/**
 * Strips all ANSI/VT100 escape sequences from a string.
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E]|\x1B[\x20-\x2F]*[\x40-\x5F]|\x9B[\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E]|\r/g, "");
}
