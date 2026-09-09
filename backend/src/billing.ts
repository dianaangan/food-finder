import Stripe from "stripe";
import { AppError } from "./errors.js";
import { Store, DEMO_ID, type LockedUser } from "./store.js";
import { record, type Language } from "./products.js";
export interface BillingConfig {
  secretKey: string;
  webhookSecret: string;
  priceId: string;
  origin: string;
}
export class Billing {
  constructor(
    private store: Store,
    private stripe: Stripe,
    private config: BillingConfig,
  ) {}
  private async current(customer: string) {
    const subscriptions: Stripe.Subscription[] = [];
    for await (const subscription of this.stripe.subscriptions.list({
      customer,
      status: "all",
      limit: 100,
    })) {
      if (
        !subscription.livemode &&
        subscription.items.data.some((i) => i.price.id === this.config.priceId)
      )
        subscriptions.push(subscription);
    }
    // Prefer an active subscription even if an old canceled subscription is delivered later.
    return subscriptions.sort(
      (a, b) =>
        Number(b.status === "active") - Number(a.status === "active") ||
        b.created - a.created,
    )[0];
  }
  private async sync({ user, tx }: LockedUser) {
    if (!user.stripeCustomerId) return user;
    const subscription = await this.current(user.stripeCustomerId);
    return tx.demoUser.update({
      where: { id: DEMO_ID },
      data: {
        stripeSubscriptionId: subscription?.id ?? null,
        subscriptionStatus: subscription?.status ?? "none",
      },
    });
  }
  async refresh() {
    return this.store.locked((context) => this.sync(context));
  }

  async resetForTest(): Promise<void> {
    await this.store.locked(async ({ user, tx }) => {
      if (user.stripeSubscriptionId) {
        await this.stripe.subscriptions.cancel(user.stripeSubscriptionId);
      }
      await tx.demoUser.update({
        where: { id: DEMO_ID },
        data: { stripeSubscriptionId: null, subscriptionStatus: "none" },
      });
    });
  }
  async checkout(_language: Language): Promise<string> {
    const result = await this.store.locked(async (context) => {
      let user = await this.sync(context);
      if (
        [
          "active",
          "trialing",
          "past_due",
          "unpaid",
          "incomplete",
          "paused",
        ].includes(user.subscriptionStatus)
      )
        return new AppError(409, "SUBSCRIPTION_EXISTS");
      const price = await this.stripe.prices.retrieve(this.config.priceId);
      if (
        price.livemode ||
        !price.active ||
        price.recurring?.interval !== "month" ||
        price.recurring.interval_count !== 1
      )
        return new AppError(503, "BILLING_UNAVAILABLE");
      if (!user.stripeCustomerId) {
        const customer = await this.stripe.customers.create(
          { metadata: { demoUserId: DEMO_ID } },
          { idempotencyKey: `food-finder-customer-${DEMO_ID}` },
        );
        user = await context.tx.demoUser.update({
          where: { id: DEMO_ID },
          data: { stripeCustomerId: customer.id },
        });
      }
      if (user.checkoutSessionId) {
        const existing = await this.stripe.checkout.sessions.retrieve(
          user.checkoutSessionId,
        );
        if (existing.status === "open" && existing.url) return existing.url;
        // An unsettled Checkout must not create another payable subscription.
        if (
          existing.status === "complete" &&
          existing.payment_status === "unpaid"
        )
          return new AppError(409, "SUBSCRIPTION_PENDING");
        user = await context.tx.demoUser.update({
          where: { id: DEMO_ID },
          data: { checkoutSessionId: null, checkoutAttempt: { increment: 1 } },
        });
      }
      const session = await this.stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: user.stripeCustomerId!,
          line_items: [{ price: this.config.priceId, quantity: 1 }],
          client_reference_id: DEMO_ID,
          subscription_data: { metadata: { demoUserId: DEMO_ID } },
          // Stable parameters allow safe retry after a network failure, even if the app language changes.
          success_url: `${this.config.origin}/?checkout=success`,
          cancel_url: `${this.config.origin}/?checkout=cancel`,
          locale: "auto",
        },
        {
          idempotencyKey: `food-finder-checkout-${DEMO_ID}-${user.checkoutAttempt}`,
        },
      );
      if (!session.url) throw new AppError(502, "BILLING_UNAVAILABLE");
      await context.tx.demoUser.update({
        where: { id: DEMO_ID },
        data: { checkoutSessionId: session.id },
      });
      return session.url;
    });
    // Commit refreshed status even when Checkout is refused (for example, past_due).
    if (result instanceof AppError) throw result;
    return result;
  }
  async webhook(body: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        this.config.webhookSecret,
      );
    } catch {
      throw new AppError(400, "INVALID_SIGNATURE");
    }
    if (event.livemode) throw new AppError(400, "TEST_MODE_REQUIRED");
    const relevant = [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
    ];
    if (!relevant.includes(event.type)) return;
    const object = record(event.data.object);
    const customer =
      typeof object.customer === "string"
        ? object.customer
        : record(object.customer).id;
    await this.store.locked(async (context) => {
      if (
        !context.user.stripeCustomerId ||
        customer !== context.user.stripeCustomerId
      )
        return;
      // Read current Stripe state under the row lock: duplicates and out-of-order payloads are harmless.
      await this.sync(context);
    });
  }
}
