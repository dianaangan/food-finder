import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { createApp } from "./app.js";
import { Billing } from "./billing.js";
import { readConfig } from "./config.js";
import { createProductSearch } from "./products.js";
import { Store } from "./store.js";
const config = readConfig();
const db = new PrismaClient();
const store = new Store(db);
await db.$connect();
await store.user(); // Fail early with a useful startup error if migration/seed was skipped.
const billing = config.billing
  ? new Billing(
      store,
      new Stripe(config.billing.secretKey, {
        timeout: 5000,
        maxNetworkRetries: 0,
      }),
      config.billing,
    )
  : undefined;
const server = createApp({
  store,
  billing,
  origin: config.origin,
  search: createProductSearch(config.userAgent),
}).listen(config.port, "127.0.0.1", () =>
  console.log(`API ready at http://127.0.0.1:${config.port}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.close(() => {
      void db.$disconnect();
    });
  });
