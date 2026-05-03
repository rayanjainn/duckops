import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@duckops/db";
import { createLogger } from "@duckops/shared-utils";

const logger = createLogger("auth-middleware");
const JWT_SECRET = process.env.JWT_SECRET || "duckops-dev-secret-change-in-prod";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : (req.query.token as string | undefined);

  if (!token) {
    logger.warn("Auth rejected: no token provided");
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      logger.warn(`Auth rejected: user ${payload.userId} not found in DB`);
      return res.status(401).json({ error: "User not found" });
    }
    (req as any).user = user;
    next();
  } catch (err: any) {
    logger.warn(`Auth rejected: JWT error — ${err.message}`);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
