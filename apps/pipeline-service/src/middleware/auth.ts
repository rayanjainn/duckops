import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@duckops/db";

const JWT_SECRET = process.env.JWT_SECRET || "duckops-dev-secret-change-in-prod";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : req.query.token as string | undefined;

  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ error: "User not found" });
    (req as any).user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Internal service-to-service auth — validates X-Internal-Secret header
export function requireInternalAuth(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.INTERNAL_API_SECRET || process.env.JWT_SECRET || "duckops-dev-secret-change-in-prod";
  const provided = req.headers["x-internal-secret"] as string | undefined;
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: "Internal authentication required" });
  }
  next();
}

// Looser variant — attaches user if token present but doesn't block if missing
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : req.query.token as string | undefined;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (user) (req as any).user = user;
    } catch {}
  }
  next();
}
