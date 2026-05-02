import { prisma } from "@duckops/db";
import { createLogger } from "@duckops/shared-utils";
import jwt from "jsonwebtoken";

const logger = createLogger("auth-service");

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const JWT_SECRET = process.env.JWT_SECRET || "duckops-dev-secret-change-in-prod";
const JWT_EXPIRES_IN = "7d";

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string | null;
  avatar_url: string;
}

// Step 1 — redirect URL for GitHub OAuth
export function getGitHubAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${process.env.API_URL || "http://localhost:4002"}/api/auth/github/callback`,
    scope: "user:email repo delete_repo",  // delete_repo needed to remove repos on project delete
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

// Step 2 — exchange code for access token
export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = (await res.json()) as { access_token?: string; error?: string };

  if (!data.access_token) {
    throw new Error(`GitHub OAuth failed: ${data.error || "no access_token"}`);
  }

  return data.access_token;
}

// Step 3 — fetch GitHub user profile
export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch GitHub user: ${res.statusText}`);
  }

  const user = (await res.json()) as GitHubUser;

  // If email is not public, fetch primary verified email
  if (!user.email) {
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (emailRes.ok) {
      const emails = (await emailRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified);
      if (primary) user.email = primary.email;
    }
  }

  return user;
}

// Step 4 — upsert user in DB and return JWT
export async function upsertUserAndCreateSession(
  githubUser: GitHubUser,
  accessToken: string,
): Promise<{ jwt: string; user: Awaited<ReturnType<typeof prisma.user.upsert>> }> {
  const user = await prisma.user.upsert({
    where: { githubId: String(githubUser.id) },
    update: {
      name: githubUser.name || githubUser.login,
      email: githubUser.email || `${githubUser.login}@users.noreply.github.com`,
      githubUsername: githubUser.login,
      githubAccessToken: accessToken,
      avatarUrl: githubUser.avatar_url,
    },
    create: {
      githubId: String(githubUser.id),
      name: githubUser.name || githubUser.login,
      email: githubUser.email || `${githubUser.login}@users.noreply.github.com`,
      githubUsername: githubUser.login,
      githubAccessToken: accessToken,
      avatarUrl: githubUser.avatar_url,
    },
  });

  const token = jwt.sign(
    { userId: user.id, githubUsername: user.githubUsername },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  logger.info(`User authenticated: ${user.githubUsername}`);
  return { jwt: token, user };
}

// Verify a JWT and return the userId
export function verifyJwt(token: string): { userId: string; githubUsername: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string; githubUsername: string };
}

// Get user by ID (used in auth middleware)
export async function getUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}
