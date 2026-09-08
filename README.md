# Food Finder

A small full-stack hiring assessment: search packaged foods, switch between English, Dutch, German and French, revisit recent searches, and unlock available nutrition through a monthly Stripe test subscription.

The required stack is preserved: **Next.js / React / TypeScript / Tailwind CSS** on the frontend and **Express / TypeScript / Prisma / MySQL / Stripe** on the backend. Product records come from Open Food Facts through Express.

## Quick start

Prerequisites: Node.js 22.12+ (verified with Node 24), pnpm 11, MySQL 8.4, and a Stripe test account for billing. The application can search with billing disabled. Stripe CLI is needed for local webhook forwarding.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm db:generate
```

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`. On PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

Create a MySQL database and application user using your MySQL administrator account. Replace the example password below and use the same value in `DATABASE_URL`:

```sql
CREATE DATABASE food_finder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'food'@'localhost' IDENTIFIED BY 'replace-with-a-local-password';
GRANT ALL PRIVILEGES ON food_finder.* TO 'food'@'localhost';
```

Then:

```sh
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [localhost:3000](http://localhost:3000). The API listens on `127.0.0.1:4000`. `pnpm dev` runs both applications. To run separately, use `pnpm --filter frontend dev` and `pnpm --filter backend dev` in separate terminals.

This checkout also has a portable MySQL instance prepared in the ignored `work/` directory, listening on port **3307**, and a generated local password already saved in `backend/.env`. These local files are not part of the Git deliverable. See `docs/LOCAL_SETUP.md` for restarting this machine's instance. A fresh clone should follow the standard setup above.

## Environment variables

Backend settings belong only in `backend/.env`:

- `DATABASE_URL`: MySQL connection string. URL-encode special characters in credentials.
- `PORT`: Express port; default `4000`.
- `APP_ORIGIN`: browser origin, default `http://localhost:3000`, without a trailing slash. Used for Checkout redirects and Origin checks.
- `STRIPE_SECRET_KEY`: `sk_test_...` secret key; live keys are rejected.
- `STRIPE_WEBHOOK_SECRET`: signing secret for the webhook endpoint or the current CLI forwarding session.
- `STRIPE_PRICE_ID`: the ID of one active monthly test price.
- `OFF_USER_AGENT`: application name/version and your contact address. Replace the example contact before operating the integration.

Leave **all three** Stripe values empty to disable billing. Partial billing configuration fails at startup instead of silently misbehaving.

Frontend setting in `frontend/.env.local`:

- `API_ORIGIN`: Express destination for the server-side Next.js rewrite, default `http://127.0.0.1:4000`.

There are no `NEXT_PUBLIC_` secrets. Environment files are ignored; examples are committed. Restart the backend after changing Stripe settings. Rebuild/restart Next.js after changing its production proxy destination.

## Architecture and file responsibilities

```text
Browser → Next.js /api rewrite → Express → Open Food Facts
                                  ├── Prisma → MySQL
                                  └── Stripe Checkout / subscription reconciliation
Stripe signed webhooks ────────────┘
```

The Next.js rewrite is a same-origin proxy, not a second business backend. Express owns all business decisions. Browser requests never retrieve product records directly from Open Food Facts. Product front-image files load from the provider's image host.

```text
frontend/
  app/page.tsx                 Main search screen
  app/layout.tsx               Document metadata and global styling
  app/globals.css              Tailwind and shared visual styles
  hooks/useFoodFinder.ts       Search, language, history and billing state
  components/ProductCard.tsx   Basic fields, missing data and nutrition/lock state
  components/SubscriptionPanel.tsx
  lib/api.ts                  Same-origin HTTP client and safe error codes
  lib/i18n.ts                 Complete translation dictionaries and fallback messages
  lib/types.ts                Small frontend API contract
  tests/                      UI behavior tests
backend/
  src/server.ts               Startup, dependency wiring and shutdown
  src/app.ts                  Routes, validation, HTTP errors and response authorization
  src/products.ts             Provider request and explicit product normalization
  src/store.ts                MySQL persistence and single-user row locking
  src/billing.ts              Checkout and verified subscription reconciliation
  src/config.ts               Environment validation
  src/errors.ts               Safe application errors
  prisma/schema.prisma        Two-model database schema
  prisma/migrations/          Versioned MySQL migration
  prisma/seed.ts              Idempotent demo-user seed
  tests/                      API, integration boundary and real-database tests
docs/
  REQUIREMENT_AUDIT.md         Requirement-by-requirement evidence
  CODE_REVIEW.md               Review findings, fixes and remaining limits
  INTERVIEW_GUIDE.md           Explanations and suggested review walkthrough
```

## Database and recent searches

`DemoUser` contains the fixed demo identity, Stripe customer/subscription IDs, subscription status, and Checkout retry state. Stripe identifiers are unique. `RecentSearch` references that user and has a unique constraint over user, term, and language, plus a recency index.

Queries are Unicode-normalized, trimmed, whitespace-collapsed, and limited to 120 characters. Successful provider responses, including no results, save a search. Upstream failures do not. Repeated term/language pairs move to the top; at most ten rows are retained. MySQL's case-insensitive collation also deduplicates case variants. Clicking history repeats the term in the currently selected language.

A short transaction locks the demo-user row before history upsert/pruning, preventing concurrent requests from exceeding the limit. If history cannot be saved, product results still return with a visible warning. Failure to read authorization returns an error with no products.

The committed migration creates both tables, constraints, and the relationship. `pnpm db:migrate` uses `prisma migrate deploy`, which applies committed migrations; it does not regenerate them or use `db push`. During future schema development, use `pnpm --filter backend exec prisma migrate dev --name descriptive_change` with an appropriately privileged local development database.

## Product search and incomplete data

Text search uses `/cgi/search.pl`, which Open Food Facts documents as the legacy full-text endpoint; v2 structured/tag search is not equivalent. Requests are submitted explicitly, limited to 20 results, and time out after ten seconds. A process-wide limit allows ten upstream searches per minute, matching a single server's shared outbound IP. This is intentionally not a distributed rate limiter.

External JSON is treated as untrusted. Invalid product entries are skipped; missing fields become `null`; malformed nutrition values are unavailable rather than zero. Only finite, nonnegative numeric per-100g values are accepted. Missing kcal values are not guessed from other energy fields. Images must be HTTPS URLs on `images.openfoodfacts.org`; failed image loads get a translated placeholder.

Nutrition covers energy in kcal and fat, saturated fat, carbohydrates, sugars, fiber, protein, and salt in grams. The provider's `_100g` convention covers per-100g/per-100ml reporting. Missing values display an em dash; genuine zero remains zero. No nutrition scores, ingredients, or raw provider objects are exposed.

## Internationalization

The UI has typed, centralized dictionaries for `en`, `nl`, `de`, and `fr`. English is the default; browser storage remembers a manual selection. Selecting a language updates the document language and repeats the current search. Currency/price display is left to Stripe Checkout, so the application does not invent an amount.

Product-name fallback:

1. Selected-language product name.
2. Default product name.
3. English product name.
4. Translated unavailable placeholder.

Localized front images fall back to the default front image. Brands remain as provided. Nutrient labels and UI errors translate; numbers use `Intl.NumberFormat`. Missing localization never triggers machine translation. A response from an older search cannot overwrite the newest search/language selection.

Stripe's separately hosted Checkout uses its automatic browser-locale selection. Its creation parameters stay stable across network retries, even if the application's language changes. The app and its product results still follow the manual language selection.

## Stripe test setup

1. Open Stripe in **test mode** or a test sandbox. Create a product and a recurring price with a **one-month** interval, no trial required. Choose any assessment-appropriate amount/currency.
2. Save its `price_...` ID and your `sk_test_...` secret key in `backend/.env`.
3. Authenticate the Stripe CLI locally:

   ```sh
   stripe login
   stripe listen --events customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed --forward-to http://127.0.0.1:4000/api/stripe/webhook
   ```

4. Copy the CLI's `whsec_...` signing secret into `backend/.env`, then restart Express. Keep the CLI running. CLI and dashboard endpoint secrets are different.
5. Select Subscribe in the app. Checkout uses the server-configured price and demo user's customer. The backend validates that the price is active, test-mode, and monthly.
6. Use Stripe's successful test card `4242 4242 4242 4242`, a future expiry, and any valid test CVC/postal code. Do not use real card details in this test.
7. After returning, the app reconciles subscription status and briefly polls sequentially, up to six attempts. The return URL itself grants nothing. Search again or use Refresh status to reload product details.

To verify revocation, cancel the demo subscription immediately in the Stripe test dashboard, allow the forwarded event to finish, and search again. If cancellation is scheduled for the period end, access remains while Stripe reports `active`.

If a failed/incomplete subscription exists, resolve or cancel it in the Stripe dashboard before attempting a replacement. A billing portal is intentionally outside scope. Reuse the same database and Stripe test account together; manually deleting local customer/Checkout state can invalidate retry assumptions.

### Webhook and authorization details

- The webhook route receives raw bytes **before** JSON middleware and verifies the Stripe signature with the official SDK. Unsigned, invalid, and live-mode events are rejected.
- Relevant events must match the stored customer. The backend then fetches current subscriptions for that customer, selecting only the configured test price. A qualifying active subscription takes precedence over older canceled ones.
- Reconciliation happens while holding the demo-user row lock, so two server processes cannot write Stripe snapshots in reverse order. Duplicate and stale event payloads re-read current state. No email, credit, or other additive side effect is performed, so a processed-event table is unnecessary.
- Current state is also reconciled when the user explicitly refreshes status and before Checkout. Database/Stripe processing failures return non-2xx so Stripe can retry. Reconciled status commits even when an existing subscription causes Checkout to be refused.
- Open Checkout sessions are reused. Stored attempt numbers and stable Stripe idempotency keys protect retries. The button also disables while a request is pending.
- Only `active` grants nutrition. `trialing`, `past_due`, `unpaid`, `incomplete`, `paused`, `canceled`, and all other statuses do not.
- `/api/products` selects its response fields according to the database status after fetching upstream data. Unsubscribed responses do not contain a `nutrition` property. Adding `premium=true`, another user ID, or calling the endpoint directly has no effect.
- API responses use `Cache-Control: no-store`. DB failures fail closed. Checkout checks the browser Origin, and Express binds to loopback for this local demo.

This is an application access boundary, not exclusive ownership of Open Food Facts data. Open Food Facts remains a public database independent of this application.

## Error handling

API errors have the form `{ "error": { "code": "PRODUCTS_UNAVAILABLE" } }`. The browser maps codes to translated messages. Invalid queries return 400; forbidden Checkout origins 403; existing/pending subscriptions 409; oversized bodies 413; search throttling 429; provider/Stripe errors 502/503; provider timeouts 504; unexpected or database failures 500. Unknown endpoints return 404. Stack traces and upstream responses are not sent to the browser.

Errors are logged server-side. An isolated history write failure becomes a visible warning, preserving usable search results. Browser preference storage is optional; if unavailable, language switching continues for the current visit.

## Tests and production checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter backend exec prisma validate
pnpm audit
```

`pnpm test` runs backend tests with mocked Stripe/Open Food Facts and frontend React Testing Library tests. They need no running MySQL or real API credentials. Webhook tests generate real test signatures with the Stripe SDK while mocking subscription retrieval.

The real MySQL suite is separate and requires a dedicated migrated database whose name ends in `_test`. It deletes only its test history rows; never point it at a real application database.

Create `food_finder_test` and grant the application user access, then in a separate PowerShell terminal:

```powershell
$env:TEST_DATABASE_URL = 'mysql://food:YOUR_PASSWORD@127.0.0.1:3306/food_finder_test'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
pnpm db:migrate
pnpm --filter backend test:db
Remove-Item Env:DATABASE_URL
Remove-Item Env:TEST_DATABASE_URL
```

Coverage focuses on backend authorization, missing data, input validation, upstream failures, history persistence, webhook signatures/duplicates/ordering, and the subscription transaction boundary. UI tests cover language selection, locked nutrition, missing values, API search, and network errors. Builds independently validate both applications.

For production-style local execution after building, run `pnpm --filter backend start` and `pnpm --filter frontend start` in separate terminals. Keep MySQL available. Hosting is not part of the assignment; a future deployment needs a Node-capable runtime and MySQL, not a static-only host.

## Technical decisions and dependency choices

- Two apps in a pnpm workspace: a small shared install/lockfile without a monorepo framework.
- Plain React state and one page-specific hook: no global store or data-fetching framework.
- Two Prisma models: no full authentication, subscription-history, or webhook-event tables.
- Express 5 async handlers: centralized error handling without route-wrapper dependencies.
- Official Stripe SDK: signature verification, typed API calls, and idempotency support.
- Native `fetch`: no provider SDK or extra HTTP client.
- Helmet: a small standard HTTP security-header dependency.
- dotenv: explicit local backend environment loading.
- Vitest, Supertest, React Testing Library and jsdom: fast isolated tests of API/UI behavior.
- ESLint and TypeScript: basic static checks, with no disabled type errors or `any` in source.
- Prisma 6.19.3 is pinned rather than a major prerelease. Its `deepmerge-ts` configuration-tool dependency is overridden to patched version 8; generation, migration, validation, and schema diff were checked after the override. The lockfile pins the resolved dependency graph.

## Simplifications and known limitations

- Everyone shares the one demo user, searches, and subscription access. This intentionally does not authenticate individuals and is unsuitable for a public multi-user product.
- Subscription reads use webhook-maintained database state. If webhook delivery is lost, state can remain stale until Stripe retries or Refresh status reconciles it. There is no scheduled reconciliation worker. A production system would add freshness policy and monitoring.
- Stripe API calls hold a short database lock. This trades throughput for understandable ordering in a one-user demo; it should not become the architecture for a large billing system.
- The limiter is per process and search results are capped at 20. Multiple processes would require coordinated rate limiting.
- The provider is community-maintained, occasionally slow/unavailable, and translations/nutrition can be missing. The legacy text-search endpoint may eventually require replacement.
- No authentication, pagination, billing portal, price selector, automatic translation, caching service, or deployment automation.
- Stripe Checkout browser-locale selection is separate from the app's manual selector.
- Product DTO types are deliberately small and repeated between apps; no shared-package build complexity.
- A real Stripe payment/webhook walkthrough still requires your account's test configuration. See the audit for the exact verification status; passing mocked tests is not evidence of a completed real payment.
- Responsive layout and accessibility semantics are implemented and component-tested; an automated browser layout/accessibility audit has not been performed.

## Reference documentation

- [Open Food Facts API, search behavior and limits](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [Stripe Checkout sessions](https://docs.stripe.com/api/checkout/sessions/create)
- [Stripe webhook verification, ordering and retries](https://docs.stripe.com/webhooks)
- [Stripe subscription events](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe test payment methods](https://docs.stripe.com/testing)

Data attribution is displayed in the application. Open Food Facts database, individual contents, and images have separate reuse terms described in its documentation.
