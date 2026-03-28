import { Router } from "express";
import { prisma } from "@duckops/db";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { NotFoundError } from "@duckops/shared-utils";

export const templateRouter = Router();

// GET /api/templates — all options grouped by layer
templateRouter.get("/", async (req, res, next) => {
  try {
    const options = await prisma.templateOption.findMany({
      where: { isActive: true },
      orderBy: { layer: "asc" },
    });

    const grouped = options.reduce(
      (acc, option) => {
        const layer = option.layer as string;
        if (!acc[layer]) acc[layer] = [];
        acc[layer].push(option);
        return acc;
      },
      {} as Record<string, typeof options>,
    );

    res.json(grouped);
  } catch (err) {
    next(err);
  }
});

// GET /api/templates/compatible — filter by current selections
templateRouter.get("/compatible", async (req, res, next) => {
  try {
    const { language, framework, database, orm } = req.query as Record<
      string,
      string
    >;

    const allOptions = await prisma.templateOption.findMany({
      where: { isActive: true },
    });

    const compatible = allOptions.filter((option) => {
      const compat = option.compatibleWith as Record<string, string[]>;
      if (!compat || Object.keys(compat).length === 0) return true;

      for (const [key, values] of Object.entries(compat)) {
        const selectedValue = req.query[key] as string;
        if (selectedValue && !values.includes(selectedValue)) return false;
      }
      return true;
    });

    const grouped = compatible.reduce(
      (acc, option) => {
        const layer = option.layer as string;
        if (!acc[layer]) acc[layer] = [];
        acc[layer].push(option);
        return acc;
      },
      {} as Record<string, typeof compatible>,
    );

    res.json(grouped);
  } catch (err) {
    next(err);
  }
});

// GET /api/templates/:layer — options for a specific layer
templateRouter.get("/:layer", async (req, res, next) => {
  try {
    const layer = (req.params.layer as string).toUpperCase();
    const validLayers = ["LANGUAGE", "FRAMEWORK", "DATABASE", "ORM"];

    if (!validLayers.includes(layer)) {
      throw new NotFoundError(`Layer ${layer}`);
    }

    const options = await prisma.templateOption.findMany({
      where: { isActive: true, layer: layer as any },
    });

    res.json(options);
  } catch (err) {
    next(err);
  }
});

// POST /api/templates — add a new template option (admin)
const createTemplateSchema = z.object({
  layer: z.enum(["LANGUAGE", "FRAMEWORK", "DATABASE", "ORM"]),
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().optional(),
  version: z.string().min(1),
  compatibleWith: z.record(z.array(z.string())).default({}),
});

templateRouter.post("/", validate(createTemplateSchema), async (req, res, next) => {
  try {
    const option = await prisma.templateOption.create({ data: req.body });
    res.status(201).json(option);
  } catch (err) {
    next(err);
  }
});
