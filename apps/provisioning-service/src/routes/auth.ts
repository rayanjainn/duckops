import { Router } from "express";
import { randomBytes } from "crypto";
import {
  getGitHubAuthUrl,
  exchangeCodeForToken,
  getGitHubUser,
  upsertUserAndCreateSession,
} from "../services/authService";
import { requireAuth } from "../middleware/auth";
import { prisma } from "@duckops/db";
import { deleteProject } from "../services/projectService";
import { createLogger } from "@duckops/shared-utils";

const logger = createLogger("auth-route");
export const authRouter = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// In-memory OAuth state store with 10-minute TTL (no Redis dependency)
const oauthStates = new Map<string, number>();
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [state, ts] of oauthStates) if (ts < cutoff) oauthStates.delete(state);
}, 60_000);

// GET /api/auth/github — redirect to GitHub
authRouter.get("/github", (req, res) => {
  const state = randomBytes(16).toString("hex");
  oauthStates.set(state, Date.now());
  res.redirect(getGitHubAuthUrl(state));
});

// GET /api/auth/github/callback — GitHub redirects here
authRouter.get("/github/callback", async (req, res, next) => {
  try {
    const { code, error, state } = req.query as Record<string, string>;

    if (error || !code) {
      return res.redirect(`${FRONTEND_URL}/login?error=github_denied`);
    }

    // Validate OAuth state to prevent CSRF
    if (!state || !oauthStates.has(state)) {
      return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
    }
    oauthStates.delete(state);

    const accessToken = await exchangeCodeForToken(code);
    const githubUser = await getGitHubUser(accessToken);
    const { jwt } = await upsertUserAndCreateSession(githubUser, accessToken);

    res.redirect(`${FRONTEND_URL}/auth/callback?token=${jwt}`);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — get current user from JWT
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout — client just drops the JWT, nothing to do server-side
authRouter.post("/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

// DELETE /api/auth/account — full cascade: projects → K8s, Jenkins, ECR, Linux user, DB
authRouter.delete("/account", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const githubAccessToken = req.user!.githubAccessToken;

    // 1. Delete all user projects (K8s, Jenkins, GitHub repos, ECR, DB cascades)
    const projects = await prisma.project.findMany({ where: { userId } });
    await Promise.allSettled(
      projects.map((p) =>
        deleteProject(p.id, githubAccessToken).catch((e) =>
          logger.warn(`Failed to delete project ${p.id}: ${e.message}`),
        ),
      ),
    );

    // 2. Cancel Stripe subscription if active
    const user = await prisma.user.findUnique({ where: { id: userId } }) as any;
    if (user?.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
      try {
        const Stripe = require("stripe");
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" });
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (e: any) {
        logger.warn(`Failed to cancel Stripe subscription: ${e.message}`);
      }
    }

    // 3. Delete DB user (cascades to remaining records via FK)
    await prisma.user.delete({ where: { id: userId } });

    logger.info(`Account deleted: ${userId} (@${req.user!.githubUsername})`);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
