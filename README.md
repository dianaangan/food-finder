# Food Finder

A small full-stack hiring assessment: search packaged foods, switch between English, Dutch, German and French, revisit recent searches, and unlock available nutrition through a monthly Stripe test subscription.

The required stack is preserved: **Next.js / React / TypeScript / Tailwind CSS** on the frontend and **Express / TypeScript / Prisma / MySQL / Stripe** on the backend. Product records come from Open Food Facts through Express.

## Evaluator quick path

After setup, the shortest review is:

1. Open `http://localhost:3000`; the catalog should load without a search.
2. Search for `peanut`, use **Next** and **Previous**, then choose a recent search.
3. Switch among English, Dutch, German, and French.
4. Confirm basic access never receives nutrition fields in the API response.
5. If Stripe is configured, complete test Checkout and confirm nutrition appears after the subscription refresh.
6. Use **Reset test subscription** to return the shared demo user to basic access.

## Setup

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

## Stripe setup

1. In Stripe test mode, copy a test secret key into `STRIPE_SECRET_KEY`.
2. Create a product with a recurring monthly price. Copy its `price_...` ID into `STRIPE_PRICE_ID`.
3. Run Stripe CLI with a test key from **the same account**. In PowerShell, set `$env:STRIPE_API_KEY` locally to that key, then run:

```powershell
stripe listen --forward-to http://127.0.0.1:4000/api/stripe/webhook
```

4. Copy the listener's `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET`, restart Express, and keep the listener running.

The secret key, price, and webhook secret must belong to the same Stripe test account. The server rejects live keys, live prices, one-time prices, and partial Stripe configuration.

## User guide

- Opening the page loads the first page of popular products. Use **Next** and **Previous** to browse more products, including within search results. Each page shows up to 20 products. Enter a product name to search; the clear button returns to the catalog.
- Change the language at the top. Missing translations fall back to the product's original name or English.
- The account panel above the search shows access status. **Subscribe monthly** opens Stripe test Checkout.
- Use test card `4242 4242 4242 4242`, any future expiry and any three-digit CVC. After returning, **Refresh status** checks access and reloads products.
- An active subscription unlocks available nutrition. **Reset test subscription** ends the demo subscription immediately so you can test checkout again.
- Notifications appear in the bottom corner; dismiss them with ×. If products fail to load, choose **Try again**.
- Everyone uses one shared demo account. Product information may be incomplete; nutrition is available only when supplied by Open Food Facts.

## Implementation notes

- Next.js rewrites same-origin `/api` requests to Express. The browser never calls Open Food Facts or Stripe with a secret.
- Express validates search, language, page, origin, and webhook signatures. It checks subscription access immediately before serializing every product response.
- Open Food Facts catalog pages are cached briefly as raw data. Nutrition is added only after the current database subscription state is read, so cached data cannot bypass access control.
- Prisma stores the one demo user and its recent searches in MySQL. Row locking serializes checkout, refresh, webhook, and reset updates for that shared user.
- Product requests use cancellation and request IDs so a slow older response cannot overwrite a newer search.
- Comments are reserved for concurrency, authorization, caching, and provider behavior that is not clear from the code itself.

Main code locations:

- `frontend/app/page.tsx`: page composition and localized UI states.
- `frontend/hooks/useFoodFinder.ts`: product, language, history, and billing flow.
- `backend/src/app.ts`: HTTP validation, routes, and response authorization.
- `backend/src/products.ts`: Open Food Facts requests, pagination, caching, and normalization.
- `backend/src/billing.ts`: Stripe Checkout and subscription synchronization.

## Known limits

- Open Food Facts data is community-maintained, so names, images, translations, and nutrition may be missing.
- The provider limits request rates; the API returns a retryable error instead of inventing product data.
- The project intentionally uses one shared demo user and has no authentication flow.
- Local subscription updates require the Stripe CLI listener or a manual **Refresh status**.

## Checks and production run

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For optional MySQL integration tests, set `TEST_DATABASE_URL` to a separate migrated test database, then run `pnpm --filter backend test:db`. Never use the application database for this test.

After building, run `pnpm --filter backend start` and `pnpm --filter frontend start` in separate terminals. Keep MySQL running. Stop each terminal with Ctrl+C.
