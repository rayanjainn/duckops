import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { recommendStack } from "../services/stackRecommender.js";

export const stackRouter = Router();

const recommendSchema = z.object({ prompt: z.string().min(1).max(2000) });

stackRouter.post("/recommend", requireAuth, async (req, res, next) => {
  try {
    const { prompt } = recommendSchema.parse(req.body);
    const recommendation = await recommendStack(prompt);
    res.json(recommendation);
  } catch (err) {
    next(err);
  }
});
