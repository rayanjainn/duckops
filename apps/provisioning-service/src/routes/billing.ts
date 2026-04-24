import { Router } from "express";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require("stripe");
import { requireAuth } from "../middleware/auth";
import { prisma } from "@duckops/db";
import { createLogger } from "@duckops/shared-utils";

const logger = createLogger("billing");
export const billingRouter = Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-03-31.basil" });
}

const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

// GET /api/billing/status — current plan + usage stats
billingRouter.get("/status", requireAuth, async (req, res, next) => {
  try {
    const user = await (prisma.user.findUnique as any)({
      where: { id: req.user!.id },
      select: { plan: true, devMode: true, aiPromptsRemaining: true, aiPromptsResetAt: true },
    }) as any;
    const projectCount = await prisma.project.count({ where: { userId: req.user!.id } });
    res.json({
      plan: user?.plan || "FREE",
      devMode: user?.devMode || false,
      aiPromptsRemaining: user?.aiPromptsRemaining ?? 3,
      aiPromptsResetAt: user?.aiPromptsResetAt,
      projectCount,
    });
  } catch (err) { next(err); }
});

// POST /api/billing/checkout — create Stripe checkout session
billingRouter.post("/checkout", requireAuth, async (req, res, next) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Payment not configured" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.plan === "PRO") return res.status(400).json({ error: "Already on Pro plan" });

    const stripeClient = getStripe()!;
    let customerId = (user as any).stripeCustomerId as string | null;
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id, githubUsername: user.githubUsername },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId } as any,
      });
    }

    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      success_url: `${APP_URL}/billing?success=1`,
      cancel_url: `${APP_URL}/billing?cancelled=1`,
      metadata: { userId: user.id },
    });

    res.json({ url: session.url });
  } catch (err) { next(err); }
});

// POST /api/billing/portal — Stripe customer portal
billingRouter.post("/portal", requireAuth, async (req, res, next) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Payment not configured" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } }) as any;
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: "No billing account found" });
    }

    const session = await getStripe()!.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${APP_URL}/billing`,
    });

    res.json({ url: session.url });
  } catch (err) { next(err); }
});

// POST /api/billing/dev-mode — toggle dev mode (FREE users only, for local dev)
billingRouter.post("/dev-mode", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } }) as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    const newDevMode = !user.devMode;
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { devMode: newDevMode } as any,
    });

    logger.info(`Dev mode ${newDevMode ? "enabled" : "disabled"} for ${user.githubUsername}`);
    res.json({ devMode: newDevMode });
  } catch (err) { next(err); }
});

// POST /api/billing/webhook — Stripe webhook (raw body required)
billingRouter.post(
  "/webhook",
  // Note: this route needs raw body — mount it BEFORE express.json() in index.ts
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    let event: any;

    try {
      const s = getStripe();
      if (!s) { res.status(503).json({ error: "Payment not configured" }); return; }
      event = s.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } catch (err: any) {
      logger.warn(`Webhook signature verification failed: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as any;
          const userId = session.metadata?.userId;
          if (userId && session.subscription) {
            await prisma.user.update({
              where: { id: userId },
              data: {
                plan: "PRO",
                stripeSubscriptionId: session.subscription as string,
                stripeSubStatus: "active",
              } as any,
            });
            logger.info(`User ${userId} upgraded to PRO`);
          }
          break;
        }

        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const sub = event.data.object as any;
          const user = await prisma.user.findFirst({
            where: { stripeCustomerId: sub.customer as string } as any,
          }) as any;
          if (user) {
            const isActive = sub.status === "active" || sub.status === "trialing";
            await prisma.user.update({
              where: { id: user.id },
              data: {
                plan: isActive ? "PRO" : "FREE",
                stripeSubStatus: sub.status,
              } as any,
            });
            logger.info(`Subscription ${sub.status} for user ${user.id}`);
          }
          break;
        }
      }
    } catch (err) {
      logger.error("Webhook handler error:", err);
    }

    res.json({ received: true });
  },
);
