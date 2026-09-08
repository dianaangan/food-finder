# Explain the project

## A useful five-minute walkthrough

1. Start at `frontend/app/page.tsx`: show the search form, manual language selector, and subscription panel.
2. Follow `useFoodFinder` into `lib/api.ts`: the browser calls `/api/products`.
3. Show the Next.js rewrite, then `backend/src/app.ts`: Express validates the query and owns authorization.
4. Open `products.ts`: explain normalization and show that nutrition is only added in the premium branch.
5. Open `schema.prisma` and `store.ts`: explain the demo user, history uniqueness and bounded recent list.
6. Open `billing.ts`: explain Checkout, signature verification, current-state reconciliation and locking.
7. Run `pnpm test` and point to an unsubscribed response test and a duplicate webhook test.
8. Explain the remaining live Stripe setup honestly. Do not imply that a mocked test charged a real test card.

## Why did you structure it this way?

“The assignment requires Next.js and Express, so I kept two clear applications. Express contains the business rules, integrations and persistence. The frontend handles presentation and interaction. I used a few domain files and two tables because the scope is small.”

## Why does Open Food Facts go through your backend?

“That is an explicit requirement, and it gives me one place to validate input, handle upstream failures, normalize inconsistent data and filter nutrition by subscription. The frontend receives only the fields it needs.”

## How does your language fallback work?

“The UI uses complete dictionaries for four languages. Product names use the selected-language field first, then the default name, then English. If there is no name, the UI shows a translated placeholder. I do not pretend that untranslated provider data is translated.”

## How do you handle missing API data?

“I treat the response as unknown data and select fields explicitly. Wrong types and missing values become null. A real zero stays zero, and missing nutrition shows a dash. Images have a safe host check and a load-error fallback.”

## How do recent searches work?

“A valid successful search is upserted for the demo user and selected language. Repeating it updates its timestamp. I keep ten rows. A transaction locks the user's row so simultaneous upserts and pruning cannot leave extra rows.”

## How does Stripe Checkout work?

“The backend uses one configured monthly test price and one stored Stripe customer. It checks for an existing subscription and reuses open Checkout sessions. Idempotency keys help retries avoid creating duplicates. The browser only redirects to Stripe; it cannot choose the trusted price or activate access.”

## How do webhooks work?

“Stripe sends an HTTP request describing a change. I verify the signature using the original raw bytes. For relevant events belonging to our customer, I retrieve current subscriptions from Stripe and save the resulting status. Failures return an error so Stripe can retry.”

## What prevents a non-subscriber calling the API directly?

“The backend reads the user's stored status and only adds nutrition when it is active. An unsubscribed response does not include those values at all. Changing frontend state or adding a premium query parameter does nothing. There are API tests proving this.”

## Why did you not implement authentication?

“The assessment explicitly requires one demo user. Everyone intentionally shares that identity. Authentication would add unrelated work. For a real product I would replace the fixed identity with verified sessions and scope every query to the authenticated user.”

## What happens if Stripe sends the same webhook twice?

“The operation recomputes current subscription state rather than incrementing something. Repeating it is harmless. I do not need an event table because there are no one-time emails or credits to deduplicate. If I added those side effects, I would revisit that decision.”

## What about events arriving out of order?

“I do not trust event delivery order or just compare event timestamps. I read current Stripe state while holding a database row lock. The lock also stops concurrent handlers from writing snapshots in reverse order. An old canceled-subscription event cannot disable a newer active subscription for the configured price.”

## Why hold a database lock during a Stripe call?

“It is a conscious small-demo tradeoff. It gives simple ordering across processes with bounded calls and transactions. It can delay other operations for the same demo user. At scale I would use a more sophisticated synchronization design, but that would be excessive here.”

## Why does the Checkout redirect not activate access?

“Anyone can type a success URL. Only verified Stripe data determines the backend status. The return page asks the backend to reconcile and briefly polls; it never writes active status itself.”

## What happens if Open Food Facts is unavailable?

“The backend times out or returns a safe provider error code. The frontend translates it and lets the user try again. Failed provider searches are not stored as recent searches.”

## What if the database is unavailable?

“If authorization cannot be read, no products or nutrition are returned. If only saving history fails after authorization, I return usable results with a warning and log the failure.”

## What was an important bug found in review?

“A Checkout refusal originally could roll back a newly synchronized subscription status. For example, Stripe might say past due while the database still said active. I changed expected Checkout refusals to commit the reconciliation before throwing the HTTP error, and added a real MySQL regression test.”

## What would you improve for production?

“First, real authentication and per-user isolation. Then monitoring and scheduled Stripe reconciliation so missed webhooks cannot leave stale state indefinitely, coordinated rate limits, a billing portal, deployment configuration, and browser accessibility tests. I would add them based on actual product needs.”

## Practice modifications

- Add another missing-name fixture and explain which fallback wins.
- Change the recent-history limit in `store.ts`, then adjust the integration test.
- Add a new nutrient by changing backend normalization, the frontend contract, dictionaries and tests.
- Make a subscription-status test fail deliberately, then fix the response boundary.
- Explain why merely blurring nutrition text in CSS would not protect the data.

Read each file and practice these changes before submitting. Understanding the implementation is part of the assessment.
