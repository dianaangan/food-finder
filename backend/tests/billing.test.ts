import { describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { Billing } from "../src/billing.js";
import { Store, type LockedUser } from "../src/store.js";
const config = {
  secretKey: "sk_test_fake",
  webhookSecret: "whsec_fake",
  priceId: "price_monthly",
  origin: "http://localhost:3000",
};
function setup(status = "none") {
  let user = {
    id: "demo",
    stripeCustomerId: "cus_demo" as string | null,
    stripeSubscriptionId: status === "active" ? "sub_demo" : null,
    subscriptionStatus: status,
    checkoutSessionId: null as string | null,
    checkoutAttempt: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const update = vi.fn(async ({ data }: { data: Partial<typeof user> }) => {
    user = { ...user, ...data };
    return user;
  });
  const store = {
    locked: async <T>(action: (context: LockedUser) => Promise<T>) =>
      action({
        user,
        tx: { demoUser: { update } } as unknown as LockedUser["tx"],
      }),
  } as Store;
  const stripe = new Stripe(config.secretKey);
  const list = vi.spyOn(stripe.subscriptions, "list");
  function subscriptions(
    status: Stripe.Subscription.Status,
    price = config.priceId,
    livemode = false,
  ) {
    list.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield {
          id: "sub_demo",
          status,
          created: 1,
          livemode,
          items: { data: [{ price: { id: price } }] },
        };
      },
    } as unknown as ReturnType<typeof stripe.subscriptions.list>);
  }
  subscriptions("canceled");
  return {
    billing: new Billing(store, stripe, config),
    stripe,
    update,
    subscriptions,
    getUser: () => user,
  };
}
function event(
  stripe: Stripe,
  customer = "cus_demo",
  type = "customer.subscription.updated",
) {
  const payload = JSON.stringify({
    id: "evt_repeat",
    type,
    livemode: false,
    data: { object: { customer, status: "active" } },
  });
  return [
    Buffer.from(payload),
    stripe.webhooks.generateTestHeaderString({
      payload,
      secret: config.webhookSecret,
    }),
  ] as const;
}
describe("verified subscription reconciliation", () => {
  it("rejects invalid signatures before touching the database", async () => {
    const { billing, update } = setup();
    await expect(
      billing.webhook(Buffer.from("{}"), "invalid"),
    ).rejects.toMatchObject({ status: 400 });
    expect(update).not.toHaveBeenCalled();
  });
  it("ignores events for another customer", async () => {
    const { billing, stripe, update } = setup();
    await billing.webhook(...event(stripe, "cus_other"));
    expect(update).not.toHaveBeenCalled();
  });
  it("uses current Stripe state even when the signed payload says active", async () => {
    const { billing, stripe, getUser } = setup();
    await billing.webhook(...event(stripe));
    expect(getUser().subscriptionStatus).toBe("canceled");
  });
  it("safely processes the same event twice", async () => {
    const { billing, stripe, subscriptions, getUser } = setup();
    subscriptions("active");
    const e = event(stripe);
    await billing.webhook(...e);
    await billing.webhook(...e);
    expect(getUser().subscriptionStatus).toBe("active");
  });
  it("does not restore access when an old activation arrives after cancellation", async () => {
    const { billing, stripe, subscriptions, getUser } = setup();
    subscriptions("active");
    await billing.webhook(...event(stripe));
    subscriptions("canceled");
    await billing.webhook(...event(stripe));
    expect(getUser().subscriptionStatus).toBe("canceled");
  });
  it.each([
    ["price_other", false],
    ["price_monthly", true],
  ] as const)(
    "does not grant access for an unrelated price or live subscription",
    async (price, live) => {
      const { billing, subscriptions, getUser } = setup();
      subscriptions("active", price, live);
      await billing.refresh();
      expect(getUser().subscriptionStatus).toBe("none");
    },
  );
  it("blocks a second subscription when one already exists", async () => {
    const { billing, stripe, subscriptions } = setup();
    subscriptions("active");
    const create = vi.spyOn(stripe.checkout.sessions, "create");
    await expect(billing.checkout("en")).rejects.toMatchObject({ status: 409 });
    expect(create).not.toHaveBeenCalled();
  });
  it("creates Checkout using only the configured monthly price", async () => {
    const { billing, stripe, getUser } = setup();
    vi.spyOn(stripe.prices, "retrieve").mockResolvedValue({
      livemode: false,
      active: true,
      recurring: { interval: "month", interval_count: 1 },
    } as Stripe.Response<Stripe.Price>);
    const create = vi
      .spyOn(stripe.checkout.sessions, "create")
      .mockResolvedValue({
        id: "cs_test_1",
        url: "https://checkout.stripe.com/test",
      } as Stripe.Response<Stripe.Checkout.Session>);
    expect(await billing.checkout("fr")).toBe(
      "https://checkout.stripe.com/test",
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        locale: "auto",
        customer: "cus_demo",
        line_items: [{ price: "price_monthly", quantity: 1 }],
      }),
      expect.objectContaining({
        idempotencyKey: "food-finder-checkout-demo-0",
      }),
    );
    expect(getUser().checkoutSessionId).toBe("cs_test_1");
  });
  it("schedules cancellation for an active subscription", async () => {
    const { billing, stripe } = setup("active");
    const update = vi
      .spyOn(stripe.subscriptions, "update")
      .mockResolvedValue({} as Stripe.Response<Stripe.Subscription>);
    await billing.cancel();
    expect(update).toHaveBeenCalledWith("sub_demo", {
      cancel_at_period_end: true,
    });
  });
});
