import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import Stripe from "stripe";
import { AppError } from "./errors.js";
import {
  languages,
  normalizeProduct,
  parseSearch,
  parsePage,
  type ProductPage,
  type Language,
} from "./products.js";
import type { Store } from "./store.js";
import type { Billing } from "./billing.js";
export interface Dependencies {
  store: Pick<Store, "user" | "recent" | "saveSearch">;
  billing?: Pick<Billing, "checkout" | "webhook" | "refresh" | "resetForTest">;
  search: (
    term: string,
    language: Language,
    page: number,
  ) => Promise<ProductPage>;
  origin: string;
  log?: (error: unknown) => void;
}
export function createApp({
  store,
  billing,
  search,
  origin,
  log = console.error,
}: Dependencies) {
  const app = express();
  const allowedOrigins = new Set([
    origin,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json", limit: "256kb" }),
    async (req, res) => {
      if (!billing) throw new AppError(503, "BILLING_UNAVAILABLE");
      const signature = req.get("stripe-signature");
      if (!signature || !Buffer.isBuffer(req.body))
        throw new AppError(400, "INVALID_SIGNATURE");
      await billing.webhook(req.body, signature);
      res.json({ received: true });
    },
  );
  app.use(express.json({ limit: "8kb" }));
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  // A single server-side window matches the provider's shared outbound-IP search limit.
  let windowStart = 0;
  let searches = 0;
  app.get("/api/products", async (req, res) => {
    const { term, language } = parseSearch(req.query);
    const page = parsePage(req.query.page);
    if (Date.now() - windowStart >= 60_000) {
      windowStart = Date.now();
      searches = 0;
    }
    if (++searches > 10) {
      res.setHeader("Retry-After", "60");
      throw new AppError(429, "TOO_MANY_SEARCHES");
    }
    const raw = await search(term, language, page);
    // Read authorization after the slow upstream request, as close to serialization as possible.
    const user = await store.user();
    const premium = user.subscriptionStatus === "active";
    let warning: string | null = null;
    try {
      if (page === 1) await store.saveSearch(term, language);
    } catch (error) {
      log(error);
      warning = "HISTORY_NOT_SAVED";
    }
    res.json({
      products: raw.products.map((p, i) =>
        normalizeProduct(p, language, premium, i),
      ),
      page,
      hasNext: raw.hasNext,
      premium,
      warning,
    });
  });
  app.get("/api/featured", async (req, res) => {
    const { language } = parseSearch({
      q: "catalog",
      lang: req.query.lang ?? "en",
    });
    const page = parsePage(req.query.page);
    const raw = await search("", language, page);
    const user = await store.user();
    const premium = user.subscriptionStatus === "active";
    res.json({
      products: raw.products.map((p, i) =>
        normalizeProduct(p, language, premium, i),
      ),
      page,
      hasNext: raw.hasNext,
      premium,
      warning: null,
    });
  });
  app.get("/api/recent-searches", async (_req, res) => {
    res.json({ searches: await store.recent() });
  });
  app.get("/api/subscription", async (req, res) => {
    const user =
      req.query.refresh === "1" && billing
        ? await billing.refresh()
        : await store.user();
    res.json({
      active: user.subscriptionStatus === "active",
      status: user.subscriptionStatus,
      billingAvailable: Boolean(billing),
    });
  });
  app.post("/api/checkout", async (req, res) => {
    if (!allowedOrigins.has(req.get("origin") ?? ""))
      throw new AppError(403, "INVALID_ORIGIN");
    if (!billing) throw new AppError(503, "BILLING_UNAVAILABLE");
    const language: unknown = req.body?.language;
    if (
      typeof language !== "string" ||
      !languages.includes(language as Language)
    )
      throw new AppError(400, "INVALID_LANGUAGE");
    res.json({ url: await billing.checkout(language as Language) });
  });
  app.post("/api/subscription/reset-test", async (req, res) => {
    if (!allowedOrigins.has(req.get("origin") ?? ""))
      throw new AppError(403, "INVALID_ORIGIN");
    if (!billing) throw new AppError(503, "BILLING_UNAVAILABLE");
    await billing.resetForTest();
    res.json({ ok: true });
  });
  app.use((_req, _res, next) => next(new AppError(404, "NOT_FOUND")));
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof AppError) {
      res.status(error.status).json({ error: { code: error.code } });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ error: { code: "INVALID_REQUEST" } });
      return;
    }
    log(error);
    if (error instanceof Stripe.errors.StripeError) {
      res.status(502).json({ error: { code: "BILLING_UNAVAILABLE" } });
      return;
    }
    if (
      error instanceof Error &&
      "type" in error &&
      error.type === "entity.too.large"
    ) {
      res.status(413).json({ error: { code: "INVALID_REQUEST" } });
      return;
    }
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  };
  app.use(errors);
  return app;
}
