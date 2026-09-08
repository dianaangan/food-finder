# Senior code review

Review scope: the completed source, response authorization, Stripe transaction behavior, database constraints, translations, test evidence, and setup documentation. Performed locally; no external review service was used.

## CRITICAL

No known unresolved critical code findings from this review. This is a scoped review, not a guarantee that no vulnerability exists.

## HIGH

### Fixed: Checkout refusal could roll back revoked access

The initial Checkout transaction refreshed the stored subscription, then threw when a subscription already existed. That throw could roll back an `active` → `past_due` update, leaving stale access in MySQL. Expected Checkout refusals now return an error value from the transaction; the HTTP error is thrown after the reconciliation commits.

Evidence: `backend/tests/database.test.ts` starts with active access, mocks Stripe as past due, expects a refused Checkout, and verifies that MySQL retains `past_due`.

### Fixed: vulnerable Prisma configuration dependencies

The first dependency audit found advisories in `effect` and `deepmerge-ts` under Prisma's configuration tooling. Prisma was patched to 6.19.3 and the remaining nested `deepmerge-ts` dependency was overridden to patched version 8. Generation, migration, schema validation/diff, type checks and tests were run with the patched graph. The full dependency audit reports no known vulnerabilities at the recorded check time.

### Outstanding verification blocker: real Stripe account walkthrough

Checkout and webhook code are implemented and tested with the official SDK plus mocked remote services. The actual owner's monthly test price, successful test payment, webhook forwarding, activation and cancellation have not yet been verified. This is a release-readiness gap rather than an identified code defect. Finish the README walkthrough before presenting the payment integration as verified.

## MEDIUM

### Fixed: language changes could alter idempotent retry parameters

Checkout used the selected application language as a creation parameter while reusing a stable retry key. If a request succeeded remotely but its response was lost, changing languages could make Stripe reject the retry for different parameters. Hosted Checkout now uses `locale: auto`, keeping parameters stable. The app's UI and product language remain manually selected. This small limitation is documented.

### Fixed: overlapping subscription polling

The return page originally used an interval that could start another reconciliation before the previous one finished. It now schedules the next bounded poll after the previous request completes and stops scheduling on unmount.

### Accepted demo limitation: stale state when webhooks are unavailable

Nutrition authorization uses stored webhook-maintained status. A lost webhook can leave stale state until a retry or explicit status reconciliation. No periodic worker or status-expiry policy was added because the assessment is a small demo. For production, add reconciliation scheduling, freshness limits, and operational alerting before relying on this for paid access.

### Accepted demo limitation: one shared identity

All visitors share subscription access and recent searches. This follows the one-demo-user requirement but must not be confused with real authentication. Multi-user deployment would require server-verified identities and scoped database queries.

### Accepted throughput tradeoff: row lock during remote calls

Billing serializes on the demo-user row while calling Stripe. Requests and transactions are bounded, but a slow call can delay other operations for that user. This is explainable for one user. A larger service needs a different synchronization strategy.

## LOW

- Product text search uses a legacy provider endpoint because v2 structured search does not provide equivalent full-text behavior. Keep the integration isolated for a future endpoint migration.
- Search rate limiting is per process, results are bounded, and there is no pagination. These are documented scope decisions.
- Native image loading has safe URL filtering and an error fallback, but no image optimization pipeline.
- The frontend's small API types are manually duplicated from the backend DTO shape. A shared package was avoided; change both contracts together.
- Responsive utilities and semantic controls are present. A full browser/accessibility audit has not been performed.

## Checks and evidence

- 41 backend isolated tests, 5 frontend component tests, and 2 real-MySQL tests passed.
- Type checks and ESLint passed.
- Next.js and Express production builds passed.
- Real MySQL migration succeeded and database/schema diff was empty.
- Full dependency audit reported no known vulnerabilities.
- Live public search through the Next.js proxy returned 20 products with no protected nutrition fields.
- No raw provider objects, client-trusted subscription flags, or live Stripe keys are used.

The documentation intentionally records the remaining Stripe verification gap. No known critical/high code defect remains from this review; payment readiness still depends on completing that account-specific test.
