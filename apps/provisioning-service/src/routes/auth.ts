import { Router } from "express";
import { randomBytes } from "crypto";
import {
  getGitHubAuthUrl,
  exchangeCodeForToken,
  getGitHubUser,
  upsertUserAndCreateSession,
} from "../services/authService";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// GET /api/auth/github — redirect to GitHub
authRouter.get("/github", (req, res) => {
  const state = randomBytes(16).toString("hex");
  // In production store state in redis/session to verify on callback
  res.redirect(getGitHubAuthUrl(state));
});

// GET /api/auth/github/callback — GitHub redirects here
authRouter.get("/github/callback", async (req, res, next) => {
  try {
    const { code, error } = req.query as Record<string, string>;

    if (error || !code) {
      return res.redirect(`${FRONTEND_URL}/login?error=github_denied`);
    }

    const accessToken = await exchangeCodeForToken(code);
    const githubUser = await getGitHubUser(accessToken);
    const { jwt } = await upsertUserAndCreateSession(githubUser, accessToken);

    // Redirect to frontend with token in query param
    // Frontend stores it in localStorage then strips from URL
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
