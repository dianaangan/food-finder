import { expect, it } from "vitest";
import { readConfig } from "../src/config.js";
it("rejects live Stripe keys and partial billing configuration", () => {
  expect(() =>
    readConfig({
      DATABASE_URL: "mysql://localhost/demo",
      STRIPE_SECRET_KEY: "sk_live_fake",
      STRIPE_WEBHOOK_SECRET: "whsec_fake",
      STRIPE_PRICE_ID: "price_fake",
    }),
  ).toThrow("test secret");
  expect(() =>
    readConfig({
      DATABASE_URL: "mysql://localhost/demo",
      STRIPE_SECRET_KEY: "sk_test_fake",
    }),
  ).toThrow("all three");
});
it("allows public search without configuring billing", () =>
  expect(
    readConfig({ DATABASE_URL: "mysql://localhost/demo" }).billing,
  ).toBeUndefined());
