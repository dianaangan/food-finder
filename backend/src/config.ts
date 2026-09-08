import "dotenv/config";
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!env.DATABASE_URL?.startsWith("mysql://"))
    throw new Error("DATABASE_URL must be a MySQL connection URL.");
  const origin = env.APP_ORIGIN || "http://localhost:3000";
  if (new URL(origin).origin !== origin)
    throw new Error("APP_ORIGIN must be an origin without a trailing slash.");
  const port = Number(env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT is invalid.");
  const secretKey = env.STRIPE_SECRET_KEY || "";
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET || "";
  const priceId = env.STRIPE_PRICE_ID || "";
  if (
    [secretKey, webhookSecret, priceId].some(Boolean) &&
    ![secretKey, webhookSecret, priceId].every(Boolean)
  )
    throw new Error("Configure all three Stripe settings or leave all empty.");
  if (
    secretKey &&
    (!secretKey.startsWith("sk_test_") ||
      !webhookSecret.startsWith("whsec_") ||
      !priceId.startsWith("price_"))
  )
    throw new Error(
      "Stripe requires a test secret key, webhook secret, and price ID.",
    );
  return {
    port,
    origin,
    userAgent:
      env.OFF_USER_AGENT || "FoodFinder/1.0 (local technical assessment)",
    billing: secretKey
      ? { secretKey, webhookSecret, priceId, origin }
      : undefined,
  };
}
