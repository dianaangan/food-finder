import { afterAll, beforeAll, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { Store } from "../src/store.js";
import { Billing } from "../src/billing.js";
// Deliberately require a separate test database: this suite deletes its own test rows.
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "Set TEST_DATABASE_URL to a migrated MySQL database whose name ends in _test.",
  );
const db = new PrismaClient({ datasourceUrl: url });
const store = new Store(db);
beforeAll(async () => {
  await db.demoUser.upsert({
    where: { id: "demo" },
    create: { id: "demo" },
    update: {},
  });
  await db.recentSearch.deleteMany({ where: { userId: "demo" } });
});
it("commits a revoked subscription status even when Checkout is refused", async () => {
  await db.demoUser.update({
    where: { id: "demo" },
    data: { stripeCustomerId: "cus_test", subscriptionStatus: "active" },
  });
  const stripe = new Stripe("sk_test_fake");
  vi.spyOn(stripe.subscriptions, "list").mockReturnValue({
    async *[Symbol.asyncIterator]() {
      yield {
        id: "sub_test",
        status: "past_due",
        created: 1,
        livemode: false,
        items: { data: [{ price: { id: "price_test" } }] },
      };
    },
  } as unknown as ReturnType<typeof stripe.subscriptions.list>);
  const billing = new Billing(store, stripe, {
    secretKey: "sk_test_fake",
    webhookSecret: "whsec_fake",
    priceId: "price_test",
    origin: "http://localhost:3000",
  });
  await expect(billing.checkout("en")).rejects.toMatchObject({ status: 409 });
  expect((await store.user()).subscriptionStatus).toBe("past_due");
});
afterAll(async () => {
  await db.recentSearch.deleteMany({ where: { userId: "demo" } });
  await db.$disconnect();
});
it("persists, deduplicates, orders, and bounds history under concurrent writes", async () => {
  await Promise.all(
    Array.from({ length: 12 }, (_, i) => store.saveSearch(`food-${i}`, "en")),
  );
  expect(await db.recentSearch.count({ where: { userId: "demo" } })).toBe(10);
  await store.saveSearch("final oats", "en");
  await store.saveSearch("final oats", "en");
  const history = await store.recent();
  expect(history).toHaveLength(10);
  expect(history[0].term).toBe("final oats");
  expect(
    await db.recentSearch.count({
      where: { userId: "demo", term: "final oats" },
    }),
  ).toBe(1);
});
