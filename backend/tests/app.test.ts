import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp, type Dependencies } from "../src/app.js";
import { AppError } from "../src/errors.js";
const user = {
  id: "demo",
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  subscriptionStatus: "none",
  checkoutSessionId: null,
  checkoutAttempt: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};
function setup(status = "none") {
  const deps: Dependencies = {
    origin: "http://localhost:3000",
    log: vi.fn(),
    store: {
      user: vi.fn().mockResolvedValue({ ...user, subscriptionStatus: status }),
      recent: vi.fn().mockResolvedValue([]),
      saveSearch: vi.fn().mockResolvedValue(undefined),
    },
    search: vi
      .fn()
      .mockResolvedValue([
        { product_name: "Oats", nutriments: { fat_100g: 8 } },
      ]),
  };
  return { deps, app: createApp(deps) };
}
describe("API security and behavior", () => {
  it.each([
    "none",
    "canceled",
    "past_due",
    "trialing",
    "unpaid",
    "incomplete",
    "paused",
  ])("does not leak premium data for %s", async (status) => {
    const { app } = setup(status);
    const response = await request(app).get(
      "/api/products?q=oats&lang=en&premium=true&userId=admin",
    );
    expect(response.status).toBe(200);
    expect(response.body.premium).toBe(false);
    expect(response.body.products[0]).not.toHaveProperty("nutrition");
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it("includes nutrition for active users and persists the normalized search", async () => {
    const { app, deps } = setup("active");
    const response = await request(app).get(
      "/api/products?q=%20oats%20&lang=fr",
    );
    expect(response.body.products[0].nutrition.fat).toBe(8);
    expect(deps.store.saveSearch).toHaveBeenCalledWith("oats", "fr");
  });
  it("does not call external services or persist invalid searches", async () => {
    const { app, deps } = setup();
    expect((await request(app).get("/api/products?q=&lang=en")).status).toBe(
      400,
    );
    expect(deps.search).not.toHaveBeenCalled();
    expect(deps.store.saveSearch).not.toHaveBeenCalled();
  });
  it("saves zero-result searches", async () => {
    const { app, deps } = setup();
    vi.mocked(deps.search).mockResolvedValue([]);
    expect(
      (await request(app).get("/api/products?q=nothing&lang=en")).body.products,
    ).toEqual([]);
    expect(deps.store.saveSearch).toHaveBeenCalled();
  });
  it("does not save failed provider requests", async () => {
    const { app, deps } = setup();
    vi.mocked(deps.search).mockRejectedValue(
      new AppError(502, "PRODUCTS_UNAVAILABLE"),
    );
    expect(
      (await request(app).get("/api/products?q=oats&lang=en")).status,
    ).toBe(502);
    expect(deps.store.saveSearch).not.toHaveBeenCalled();
  });
  it("fails closed and does not expose raw database errors", async () => {
    const { app, deps } = setup("active");
    vi.mocked(deps.store.user).mockRejectedValue(new Error("mysql://secret"));
    const response = await request(app).get("/api/products?q=oats&lang=en");
    expect(response.status).toBe(500);
    expect(response.text).not.toContain("secret");
    expect(response.body).not.toHaveProperty("products");
  });
  it("returns results with a warning when history persistence fails", async () => {
    const { app, deps } = setup();
    vi.mocked(deps.store.saveSearch).mockRejectedValue(new Error("db down"));
    const response = await request(app).get("/api/products?q=oats&lang=en");
    expect(response.status).toBe(200);
    expect(response.body.warning).toBe("HISTORY_NOT_SAVED");
    expect(deps.log).toHaveBeenCalled();
  });
  it("requires the configured Origin for Checkout", async () => {
    const { deps } = setup();
    deps.billing = {
      checkout: vi.fn().mockResolvedValue("https://checkout.stripe.com/test"),
      webhook: vi.fn(),
      refresh: vi.fn(),
    };
    const app = createApp(deps);
    expect(
      (
        await request(app)
          .post("/api/checkout")
          .set("Origin", "https://attacker.example")
          .send({ language: "en" })
      ).status,
    ).toBe(403);
    expect(deps.billing.checkout).not.toHaveBeenCalled();
    expect(
      (
        await request(app)
          .post("/api/checkout")
          .set("Origin", deps.origin)
          .send({ language: "fr", price: "evil" })
      ).status,
    ).toBe(200);
    expect(deps.billing.checkout).toHaveBeenCalledWith("fr");
  });
  it("passes untouched raw bytes to webhook verification and retries failures", async () => {
    const { deps } = setup();
    deps.billing = {
      checkout: vi.fn(),
      webhook: vi
        .fn()
        .mockRejectedValue(new AppError(400, "INVALID_SIGNATURE")),
      refresh: vi.fn(),
    };
    const app = createApp(deps);
    const payload = '{ "type": "example" }';
    const response = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "bad")
      .send(payload);
    expect(response.status).toBe(400);
    expect(deps.billing.webhook).toHaveBeenCalledWith(
      Buffer.from(payload),
      "bad",
    );
    vi.mocked(deps.billing.webhook).mockRejectedValue(new Error("temporary"));
    expect(
      (
        await request(app)
          .post("/api/stripe/webhook")
          .set("Content-Type", "application/json")
          .set("stripe-signature", "bad")
          .send(payload)
      ).status,
    ).toBe(500);
  });
  it("limits upstream searches", async () => {
    const { app } = setup();
    for (let i = 0; i < 10; i++)
      await request(app).get("/api/products?q=oats&lang=en");
    expect(
      (await request(app).get("/api/products?q=oats&lang=en")).status,
    ).toBe(429);
  });
});
