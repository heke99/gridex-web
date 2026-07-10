# Gridex Web – Customer Portal API hardening

This patch aligns the website with the production Customer Portal API contract published by Gridex OPS and removes the previously identified identity, idempotency, retry, webhook, error handling and stale-data risks.

## Production blockers fixed

- Unauthenticated applications are never attached to an existing Supabase account by e-mail alone; an authenticated user or e-mail plus a matching stable customer identifier is required.
- Portal customer identity is derived only from the authenticated Supabase session and the server-side `customer_profiles` record. Browser POST bodies can no longer override email, customer number or `external_customer_id`.
- New website customers receive a stable `external_customer_id` that is independent of email address changes.
- Every signed website application receives one `submission_attempt_id`, one `Idempotency-Key`, one `external_application_id` and one immutable acceptance timestamp.
- The exact serialized OPS application payload is hashed and locked to the idempotency key in `website_application_submissions` before dispatch.
- Automatic retry with a fresh idempotency key was removed. The same signed application always retries with its original key and payload.
- Grid owner and grid area values are accepted only from the server-side resolver; hidden browser fields are no longer trusted.
- Contract, legal and pricing snapshot mismatches stop submission and require a fresh customer review.
- The displayed pricing quote is HMAC-signed, bound to offer/address/area/kWh, verified on submission and compared with a fresh server-side price calculation.

## Portal bundle and API errors

- `customer_status` and `data_quality` are normalized, returned from local portal routes and shown in Mina sidor/dashboard.
- Live OPS arrays are authoritative when OPS is available; stale local rows are used only for transient OPS/network failures.
- `401`, `403`, `409`, `422` and OPS request IDs/codes/stages are preserved through a shared safe error mapper.
- Customer read routes no longer turn every server or OPS failure into a false `401`.
- Public contracts now forward and cache separately by `customer_type=private|company`.
- Power-of-attorney scopes are represented as an array and displayed to the customer.
- Missing OPS entity IDs use deterministic hashes rather than a new random UUID on every read.

## Writes, outbox and rate limiting

- Every write uses a server-namespaced idempotency key.
- Profile, move-out and customer-sync payloads use strict field allowlists; free `company_id`, `customer_id` and unknown nested fields are dropped.
- Notification-read validates `all=true` versus a non-empty ID list and can no longer mark all notifications read from an empty/invalid body.
- Customer events, notification-read operations and transient profile updates are queued in `customer_portal_write_outbox` on transient OPS failures instead of reporting false success.
- The outbox cron retries with backoff, reclaims stale processing rows and stops retrying permanent 4xx errors.
- Public form rate limiting now uses the atomic Postgres function `consume_distributed_rate_limit`, with process-local fallback only during shared-store outages.

## Webhooks

- Canonical secret: `GRIDEX_WEBHOOK_SIGNING_SECRET`. Conflicting canonical/legacy values fail closed.
- Webhook events have explicit processing state, optimistic claim control, attempt tracking and stale-processing recovery.
- A reused `event_id` with a different payload is rejected.
- `failed` and stale `processing` events can be delivered again; only `processed` events return duplicate success.
- Unlinked notifications stay pending and are retried by reconciliation. Multiple/conflicting profile matches are marked ambiguous rather than linked to an arbitrary customer.
- Public-contract cache invalidation is limited to publication/pricing/campaign events.

## Database migration

Apply:

```text
supabase/migrations/20260710090000_customer_portal_api_hardening.sql
```

It creates:

- `website_application_submissions`
- `customer_portal_write_outbox`
- `distributed_rate_limits`
- `consume_distributed_rate_limit(...)`
- webhook attempt fields
- notification identity reconciliation fields and indexes

## Required production configuration

```text
GRIDEX_OPS_API_URL=https://app.gridex.se
GRIDEX_OPS_ALLOWED_HOSTS=app.gridex.se
GRIDEX_WEBSITE_API_KEY=<full secret token>
GRIDEX_ENABLE_LIVE_SIGNUP=true
GRIDEX_WEBSITE_HASH_PEPPER=<random secret>
GRIDEX_WEBSITE_PRICING_QUOTE_SECRET=<different random secret>
GRIDEX_ENABLE_OPS_WEBHOOKS=true
GRIDEX_WEBHOOK_SIGNING_SECRET=<exact OPS signing secret>
CUSTOMER_PORTAL_OUTBOX_CRON_SECRET=<random secret or use CRON_SECRET>
```

Do not reuse the OPS token as a pricing secret or PII pepper.

## Verification commands

```bash
npm ci
npm run lint
npx tsc --noEmit --pretty false
npm run test:launch
npm run build
```

## Verification result for this archive

The patched source was verified with:

- `npm run lint` — passed with no ESLint errors or warnings.
- `npx tsc --noEmit --pretty false` — passed.
- `npm run test:launch` — all public-contract, launch-readiness, pricing and Customer Portal API hardening checks passed.
- `npm run build` — full Next.js production build passed with production-shaped dummy environment values and live external integrations disabled.

The SQL migration was reviewed statically but was not applied to a live Supabase project from this archive. Production still requires the migration, real OPS credentials/scopes, cron secrets and a live end-to-end smoke test.

`npm audit --omit=dev` reports two moderate advisories through Next.js' nested PostCSS dependency and no high or critical advisories. npm's proposed automatic fix is an unsafe Next.js major downgrade, so it was not applied in this API hardening patch.
