import { Request, Response, NextFunction } from "express";
import { verifyJwt, getUserById } from "../services/authService";

// Extend express Request to carry user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        githubUsername: string;
        githubAccessToken: string;
        name: string;
        email: string;
        avatarUrl: string | null;
      };
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = verifyJwt(token);
    const user = await getUserById(payload.userId);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = {
      id: user.id,
      githubUsername: user.githubUsername,
      githubAccessToken: user.githubAccessToken,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };

    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
