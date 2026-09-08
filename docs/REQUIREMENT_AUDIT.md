# Requirement audit

Date: 2026-09-08. This audit separates implemented behavior from verification that needs the owner's Stripe test account. PASS means implemented with the evidence listed; it does not imply every possible edge case or browser/device was tested.

| Requirement | Implementation | Status | Evidence |
| --- | --- | --- | --- |
| TypeScript frontend and backend | Strict TypeScript in both applications | PASS | Both type checks and builds pass |
| Next.js and React | Next.js App Router and interactive React page | PASS | `frontend/package.json`, production build, HTTP 200 preview |
| Tailwind CSS | Tailwind 4 with shared styles and responsive utilities | PASS | `frontend/app/globals.css`, component markup, build |
| Express backend | Express 5 API owns integrations and business rules | PASS | `backend/src/app.ts`, HTTP integration tests |
| Prisma and MySQL | Two Prisma models and real MySQL 8.4.11 | PASS | Migration applied to development and dedicated test databases |
| Search by title/term | Backend full-text Open Food Facts search | PASS | `products.ts`, provider unit tests, real proxied search returned 20 products |
| Retrieve products through backend | Browser calls same-origin API; Express calls provider | PASS | Next rewrite, API client, live frontend-proxy → Express → provider request |
| Normalize third-party data | Explicit DTO with defensive field checks | PASS | `normalizeProduct`, malformed/missing-field tests |
| Handle no results | Successful empty results with translated guidance | PASS | Empty API test, main page empty state |
| Handle incomplete names, brands and images | Nullable fields, translated placeholders, image error fallback | PASS | Product normalization and ProductCard tests |
| English, Dutch, German and French | Complete typed UI dictionaries | PASS | Translation-key parity test and language-switch UI test |
| Manual language selector | Native select updates state, document language and current search | PASS | `useFoodFinder`, React Testing Library interaction test |
| Localized product information where available | Selected name/image, default and English fallback | PASS | Backend locale-fallback and localized-image tests; live French-language request |
| Basic name, brand and image public | Always part of normalized basic DTO | PASS | Direct API tests for seven non-active statuses |
| Detailed nutrition restricted to active subscription | Added only on backend `active` branch | PASS | Active and non-active API tests; live unsubscribed response contained no nutrition |
| Prevent direct API bypass | No trusted user ID or premium parameter from client | PASS | API test submits `premium=true&userId=admin` without gaining access |
| One demo user | Fixed seeded server-selected `demo` user | PASS | Seed completed on real database; no authentication system |
| Recent searches in MySQL | Unique upsert and ten-entry history under transaction lock | PASS | Real MySQL persistence, duplicate, ordering and concurrency test |
| Do not save invalid searches | Validation runs before provider/persistence calls | PASS | Invalid-query tests verify neither service is called |
| Monthly Stripe Checkout subscription | Configured test price, customer/session reuse and idempotency | PARTIAL | Implemented and SDK-mocked Checkout test passes; account settings and real payment walkthrough remain pending |
| Stripe test mode | Key validation, price test-mode validation and live-event rejection | PASS | Config and qualifying-subscription tests; implementation guards |
| Stripe webhook processing | Relevant events reconcile current customer subscription state | PARTIAL | Signed SDK-generated fixtures pass; real Stripe forwarding not yet exercised |
| Verify webhook signatures | Raw-body route and official Stripe verifier | PASS | Invalid signature rejected; raw bytes preserved; valid fixture processing tested |
| Duplicate/repeated delivery safety | Serialized current-state reconciliation, no additive side effects | PASS | Duplicate and stale-event tests; real database transaction regression |
| Stripe account configuration | Three private backend environment fields | PARTIAL | Examples and setup instructions exist; fields were empty at verification time |
| Responsive, clean interface | Search workspace, responsive grid and stacking panels | PASS | Implemented CSS, production render; no browser layout audit claimed |
| Loading, locked, empty and error states | Central translated feedback and disabled pending actions | PASS | Component/API tests and UI implementation |
| Provider/database/Stripe failures handled | Safe errors, upstream timeouts, history warning and fail-closed authorization | PASS | Provider, timeout, database, raw-signature and network-error tests |
| Secrets in environment variables | Backend-only settings and Git ignores | PASS | `.env.example` files; no frontend secret configuration |
| Meaningful automated tests | Backend, frontend and separate real MySQL suite | PASS | 46 isolated application tests and 2 real-database tests passed |
| Source in Git repository | Local repository contains source and lockfile | PASS | Initial local commit uses the owner's supplied Git identity; no remote publication requested |
| Prisma migration | Initial checked-in SQL and migration lock | PASS | Applied successfully; database-to-schema diff reports no difference |
| `.env.example` | Separate backend and frontend examples | PASS | `backend/.env.example`, `frontend/.env.example` |
| README setup/decisions/i18n/limitations | Complete installation and review documentation | PASS | Root README and supporting guides |
| Type, lint and build checks | Both apps checked independently | PASS | `pnpm typecheck`, `pnpm lint`, `pnpm build` |
| Dependency review | Patched Prisma tooling and pinned lockfile | PASS | Full `pnpm audit`: no known vulnerabilities at verification time |

## Outstanding verification

The source is implemented, public search works with the real provider and database, and automated checks pass. **Do not call the Stripe integration submission-ready until the owner's real test Checkout, forwarded webhook, activation, and cancellation walkthrough succeeds.**

No deployed URL, remote Git push, browser screenshot audit, real card transaction, or completed Stripe account configuration is claimed.
