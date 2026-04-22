import { ollama, STACK_MODEL } from "../config/ollama.js";
import { STACK_RECOMMENDER_PROMPT } from "../prompts/system.js";
import { createLogger } from "@duckops/shared-utils";

const logger = createLogger("stack-recommender");

export interface StackRecommendation {
  language: string;
  framework: string;
  database: string;
  orm: string;
  packageManager: string;
  reasoning: string;
}

export async function recommendStack(prompt: string): Promise<StackRecommendation> {
  const response = await ollama.chat({
    model: STACK_MODEL,
    messages: [
      { role: "system", content: STACK_RECOMMENDER_PROMPT },
      { role: "user", content: prompt },
    ],
    options: { temperature: 0.1, num_predict: 200 },
  });

  const raw = response.message.content.trim();
  logger.info(`Stack recommendation raw: ${raw}`);

  // Extract JSON even if there's stray text
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.warn("Stack recommender returned no JSON, using defaults");
    return defaultStack(prompt);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as StackRecommendation;
    return {
      language: parsed.language || "typescript",
      framework: parsed.framework || "express",
      database: parsed.database || "postgresql",
      orm: parsed.orm || "prisma",
      packageManager: parsed.packageManager || "npm",
      reasoning: parsed.reasoning || "",
    };
  } catch {
    logger.warn("Failed to parse stack recommendation JSON, using defaults");
    return defaultStack(prompt);
  }
}

function defaultStack(prompt: string): StackRecommendation {
  const lower = prompt.toLowerCase();
  const isFrontend = /\b(react|vue|next|landing|portfolio|ui|frontend)\b/.test(lower);
  const isFullstack = /\b(fullstack|full.stack|dashboard|saas|app|platform)\b/.test(lower) && !isFrontend;

  if (isFrontend) {
    return { language: "typescript", framework: "react", database: "none", orm: "none", packageManager: "npm", reasoning: "Frontend-only project" };
  }
  if (isFullstack) {
    return { language: "typescript", framework: "turbo", database: "postgresql", orm: "prisma", packageManager: "npm", reasoning: "Full-stack monorepo" };
  }
  return { language: "typescript", framework: "express", database: "postgresql", orm: "prisma", packageManager: "npm", reasoning: "Backend API" };
}
