# External website API integration guide

This document mirrors the production contract published in Gridex OPS. The website is a presentation and application surface; OPS is the source of truth for publication, pricing, legal versions, contract snapshots and tenant resolution.

## API client and scopes

The server-side API client decides tenant/company. A website must never send a free `company_id`, internal OPS `customer_id`, `price_plan_id` or `price_plan_version_id` from the browser.

A standard website/Mina sidor client needs at least:

```text
website_contracts.read
website_applications.write
customer_portal.read
customer_portal.write
website_events.write
events.read
customer_documents.read
customer_documents.write
customer_notifications.read
customer_notifications.write
customer_contact.write
customer_facility_data.write
customer_power_of_attorney.write
```

The client should be created with the complete standard set and reduced only when a capability is intentionally disabled. Planned granular customer scopes may still be covered by `customer_portal.read` / `customer_portal.write` in OPS, but they should be included in new keys so the integration does not break when enforcement becomes granular.

## Public contracts

```http
GET /api/v1/website/public-contracts
Authorization: Bearer YOUR_GRIDEX_API_TOKEN
```

Scope: `website_contracts.read`

OPS returns only contracts that are published, active, date-valid, have an active price version and have the legal material required for sale. The website must treat the response as a public DTO and must **not** require or persist internal price-plan identifiers or duplicate publication flags.

Stable public fields:

```json
{
  "id": "offer_…",
  "offer_reference": "offer_…",
  "code": "RORLIGT-ELPRIS",
  "name": "Rörligt elpris",
  "type": "variable_spot",
  "customer_type": "both",
  "pricing": {
    "monthly_fee": { "amount": 68, "currency": "SEK", "unit": "month" },
    "markup": { "amount": 4, "unit": "ore_per_kwh" },
    "invoice_fee": { "amount": 0, "currency": "SEK", "unit": "invoice" }
  },
  "legal": {
    "terms_version": "2026-06",
    "terms_version_id": "uuid-from-legal_text_versions",
    "terms_url": "https://app.gridex.se/legal/.../terms/uuid-from-legal_text_versions",
    "privacy_policy_version": "2026-06",
    "privacy_policy_version_id": "uuid-from-legal_text_versions",
    "privacy_policy_url": "https://app.gridex.se/legal/.../privacy/uuid-from-legal_text_versions",
    "withdrawal_version": "2026-06",
    "withdrawal_version_id": "uuid-from-legal_text_versions",
    "withdrawal_url": "https://app.gridex.se/legal/.../withdrawal/uuid-from-legal_text_versions",
    "power_of_attorney_required": true,
    "power_of_attorney_version": "2026-06-poa",
    "power_of_attorney_version_id": "uuid-from-legal_text_versions",
    "power_of_attorney_url": "https://app.gridex.se/legal/.../power-of-attorney/uuid-from-legal_text_versions",
    "price_terms_version": "2026-06",
    "price_terms_version_id": "uuid-from-legal_text_versions",
    "price_terms_url": "https://app.gridex.se/legal/.../price-terms/uuid-from-legal_text_versions"
  },
  "valid_from": "2026-06-01T00:00:00Z",
  "valid_to": null
}
```

`offer_reference` is the only contract reference that the website may use for price calculation, selection and application. OPS resolves the current internal contract, price plan and price version from that reference.

The legal object is the source of truth for both what the customer must accept and where the customer reads the text. The website should link to the OPS `*_url` values when present, keep local legal pages only as fallbacks, and include all `*_version_id` values in the contract snapshot. When `legal.power_of_attorney_required=true`, OPS must return `legal.power_of_attorney_version_id` (or the equivalent camelCase/alias field). `powerOfAttorney.textVersionId` must be that UUID from `legal_text_versions.id`; never send the display/version label such as `2026-06-12-v1`. The website blocks sale instead of sending a signed `powerOfAttorney.textVersionId=null`, because the signed operational fullmakt must be traceable to the published legal text version.

## Official website/customer endpoints

The current website integration uses these official server-to-server endpoints:

| Method | Path                                    | Scope                        | Purpose                                                           |
| ------ | --------------------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| `GET`  | `/api/v1/website/public-contracts`      | `website_contracts.read`     | Published sellable offers.                                        |
| `POST` | `/api/v1/website/customer-applications` | `website_applications.write` | Submit customer application and legal consent payloads.           |
| `POST` | `/api/v1/website/customer-events`       | `website_events.write`       | Send allowlisted customer actions from website/Mina sidor.        |
| `POST` | `/api/v1/events`                        | `website_events.write`       | Alias for website customer events.                                |
| `POST` | `/api/v1/customer/portal-bundle`        | `customer_portal.read`       | Preferred Mina sidor bundle.                                      |
| `GET`  | `/api/v1/customer/portal-bundle`        | `customer_portal.read`       | Legacy/header bundle support.                                     |
| `GET`  | `/api/v1/customer/me`                   | `customer_portal.read`       | Customer profile fallback.                                        |
| `GET`  | `/api/v1/customer/contracts`            | `customer_portal.read`       | Customer contracts fallback.                                      |
| `GET`  | `/api/v1/customer/sites`                | `customer_portal.read`       | Customer sites/metering points fallback.                          |
| `GET`  | `/api/v1/customer/invoices`             | `customer_portal.read`       | Customer invoices.                                                |
| `GET`  | `/api/v1/customer/invoices/[id]`        | `customer_portal.read`       | One customer invoice detail.                                      |
| `GET`  | `/api/v1/customer/metering-values`      | `customer_portal.read`       | Customer metering values.                                         |
| `GET`  | `/api/v1/customer/events`               | `customer_portal.read`       | Customer-visible events.                                          |
| `GET`  | `/api/v1/customer/documents`            | `customer_portal.read`       | Customer documents.                                               |
| `GET`  | `/api/v1/customer/legal-acceptances`    | `customer_portal.read`       | Customer legal acceptances.                                       |
| `GET`  | `/api/v1/customer/powers-of-attorney`   | `customer_portal.read`       | Customer powers of attorney.                                      |
| `GET`  | `/api/v1/customer/notifications`        | `customer_portal.read`       | Customer notifications.                                           |
| `POST` | `/api/v1/customer/notifications/read`   | `customer_portal.write`      | Mark notifications read.                                          |
| `POST` | `/api/v1/customer/sync`                 | `customer_portal.write`      | Sync documents, legal acceptances, POA and facility/profile data. |
| `POST` | `/api/v1/customer/profile-update`       | `customer_portal.write`      | Submit profile/contact changes.                                   |
| `POST` | `/api/v1/customer/move-out`             | `customer_portal.write`      | Submit move-out report.                                           |
| `GET`  | `/api/v1/events`                        | `events.read`                | Read tenant domain events.                                        |

Website wrapper routes may proxy or locally validate parts of this contract, but the OPS API key is always server-side and the tenant/company is always resolved from that key. The live OPS developer contract does not expose `POST /api/v1/website/pricing/preview`, `POST /api/v1/website/pricing/quote/validate`, `POST /api/v1/website/energy/resolve`, `GET /api/v1/website/legal-texts/current`, `GET /api/v1/website/price-plans` or `GET /api/v1/customer/switch-status` as official tenant endpoints. When this repository has routes with those paths, they are website-local wrapper routes only. `app.gridex.se/api/v1/events` is the official authenticated tenant-event reader; `gridex.se/api/v1/events` does not proxy tenant event reads and must not expose tenant events from the website server key. In plain terms: gridex.se/api/v1/events does not proxy tenant event reads.

## Website-local price preview and quote validation

The website-local route below is **not** an official OPS endpoint. It exists so the public calculator can produce a customer-friendly preview from the OPS-published `public-contracts.pricing` DTO without ever accepting internal OPS IDs from the browser.

```http
POST /api/v1/website/pricing/preview
Content-Type: application/json
```

Request:

```json
{
  "offer_reference": "offer_…",
  "price_area_code": "SE4",
  "postal_code": "21122",
  "city": "Malmö",
  "address": "Storgatan 1",
  "estimated_monthly_kwh": 2000
}
```

The route must resolve the selected contract from `GET /api/v1/website/public-contracts`, use only the published public `pricing` fields and reject missing mandatory pricing. It must never silently convert missing markup, monthly fee, invoice fee, fixed price or portfolio price to `0`. The website signs the displayed preview with a dedicated HMAC secret in `GRIDEX_WEBSITE_PRICING_QUOTE_SECRET`. That token is a mandatory integrity precondition for submission: it binds the selected `offer_reference`, address fingerprint, price area, estimated consumption and displayed values to the review step. It is not the legal price source and must never reuse the OPS API key or PII hash pepper. If the token expires or no longer matches, the website must refresh the quote and require the customer to review the current price again.

```http
POST /api/v1/website/pricing/quote/validate
Content-Type: application/json
```

The website-local validation route verifies the short-lived HMAC quote against the final address, price area, estimated kWh and selected `offer_reference` before the customer application is submitted. The submission handler then fetches the current public contract again and recalculates the preview server-side. A quote or contract snapshot mismatch blocks the submission and sends the customer back to the review step. OPS remains the authority that resolves the internal contract/price version and stores the authoritative contract price snapshot.

## Customer application

```http
POST /api/v1/website/customer-applications
Authorization: Bearer YOUR_GRIDEX_API_TOKEN
Idempotency-Key: tenant-application-…
Content-Type: application/json
```

Scope: `website_applications.write`

The contract section contains only the selected public offer reference:

```json
{
  "contract": {
    "offer_reference": "offer_…",
    "requested_start_date": "2026-07-01"
  }
}
```

When the selected offer requires a power of attorney, the application must also include a separate `powerOfAttorney` object. `consents.power_of_attorney` records the checkbox consent; `powerOfAttorney` is the signed operational payload that OPS can use for supplier switching and facility-information lookup.

```json
{
  "external_customer_id": "GRIDEX-WEB-20260616-…",
  "external_application_id": "APP-…",
  "source": "gridex_website",
  "customer_portal_user_id": "<website-supabase-user-id>",
  "auth_user_id": "<website-supabase-user-id>",
  "customer": {
    "customer_type": "private",
    "first_name": "Anna",
    "last_name": "Andersson",
    "email": "anna@example.se",
    "phone": "+46701234567",
    "personal_number": "YYYYMMDDXXXX"
  },
  "site": {
    "facility_id": null,
    "metering_point_id": null,
    "street": "Storgatan 1",
    "postal_code": "21122",
    "city": "Malmö",
    "price_area_code": "SE4",
    "grid_area_code": "LKA",
    "grid_owner_id": "uuid-or-actor-id",
    "grid_owner_name": "Landskrona Energi Nät AB",
    "move_in_date": "2026-07-01"
  },
  "contract": {
    "offer_reference": "offer_…",
    "requested_start_date": "2026-07-01"
  },
  "consents": {
    "terms": true,
    "privacy_policy": true,
    "withdrawal": true,
    "power_of_attorney": true,
    "price_terms": true
  },
  "powerOfAttorney": {
    "accepted": true,
    "scope": ["supplier_switch", "facility_information_lookup"],
    "signerName": "Anna Andersson",
    "signerIdentityNumber": "YYYYMMDDXXXX",
    "method": "website_acceptance",
    "acceptedAt": "2026-06-26T09:00:00.000Z",
    "textVersionId": "uuid-from-legal.power_of_attorney_version_id",
    "ipAddress": "203.0.113.10",
    "userAgent": "Mozilla/5.0 …"
  }
}
```

OPS resolves the internal price plan/version and stores the authoritative contract and legal snapshots. The website sends the displayed contract snapshot and verified price preview only for audit and mismatch detection; they are never the legal source of truth.

Accepted application metadata:

```json
{
  "metadata": {
    "requested_start_mode": "specific_date",
    "energy_resolution_status": "resolved",
    "energy_resolution_confidence": 0.98,
    "estimated_monthly_kwh": 2000,
    "pricing_preview_snapshot": {
      "contract": { "offer_reference": "offer_…" }
    },
    "contract_display_snapshot": {
      "offer_reference": "offer_…",
      "legal_versions": {}
    },
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "sommarkampanj",
    "user_agent": "Mozilla/5.0 …",
    "ip_hash": "sha256-hash"
  }
}
```

`external_application_id` identifies one immutable website application attempt. `external_customer_id` identifies the stable website customer/account and must not be derived from mutable contact data such as e-mail. Do not reuse the OPS customer number as `external_customer_id`; send OPS customer numbers only in `customer_number` after OPS has assigned them.

The implementation creates one UUID `submission_attempt_id` when the customer reaches the final review step. It persists and reuses the following values for every retry of that same signed submission:

```text
Idempotency-Key = website-application:<submission_attempt_id>
external_application_id = <configured prefix>:<submission_attempt_id>
acceptedAt = first persisted acceptance timestamp
request context = first persisted IP hash/user-agent/UTM snapshot
OPS payload hash = hash of the exact serialized request body
```

The same idempotency key may only be sent with the exact same locked OPS payload. The website must never perform an automatic fresh-key retry for a partial `site_create`, missing-POA repair or another failure belonging to the same signed attempt. A new key is only for a deliberately new customer submission.

The application response can include `power_of_attorney_id`, `power_of_attorney`, `nextAction` and `manualInformationRequest`. The website should surface customer-safe `nextAction.message` and the manual request case reference when present, but it must not require these fields to exist.

## Customer Portal External Auth Linking

Tenant websites use their own Supabase Auth for Mina sidor. Server-side website code sends the website Supabase `session.user.id` to OPS as both `x-gridex-customer-portal-user-id` and `x-gridex-auth-user-id`.

```http
POST /api/v1/customer/portal-bundle
Authorization: Bearer YOUR_GRIDEX_API_TOKEN
Content-Type: application/json
```

The website wrapper does not accept customer identity from the browser. It reads `session.user.id` server-side, resolves the linked local profile and sends the verified portal/auth user IDs plus the already stored stable customer identifiers to OPS. A request body containing a different e-mail, customer number or `external_customer_id` must not override that identity. During application onboarding, an unauthenticated submission must never be attached to an existing Supabase account from e-mail alone. Reuse an existing portal profile only for the authenticated session user or when e-mail plus at least one stable customer identifier (`external_customer_id` or customer number) already converge on the same profile.

Use `external_customer_id` only for the stable website/customer reference from signup. Do not copy the OPS customer number into `external_customer_id`; send customer numbers in `customer_number`.

The website returns `401` only when the customer session is missing or invalid. Local Supabase fallback is allowed only for transient OPS/network failures such as timeout, `408`, `425`, `429`, `502`, `503` or `504`, and the UI must visibly mark it as potentially older than OPS data. Authentication, authorization, ambiguous linking and validation failures (`401`, `403`, `409`, `422`) must preserve their status and stable OPS error code instead of being hidden by fallback. When OPS responds successfully, its portal arrays, `customer_status` and `data_quality` are authoritative; stale local contracts/sites/invoices/documents must not be merged back into the live response.

## Customer sync and customer writes

Signed powers of attorney, legal acceptances, customer documents and facility completions are synced to OPS through:

```http
POST /api/v1/customer/sync
Authorization: Bearer YOUR_GRIDEX_API_TOKEN
Idempotency-Key: tenant-sync-…
Content-Type: application/json
```

Payloads must include the same customer identifiers used for Mina sidor linking. OPS stores the records under the tenant resolved from the API key.

Profile changes should use the dedicated endpoint when they are not part of a larger sync payload:

```http
POST /api/v1/customer/profile-update
Authorization: Bearer YOUR_GRIDEX_API_TOKEN
Idempotency-Key: profile-update-…
Content-Type: application/json
```

Move-out reports should use:

```http
POST /api/v1/customer/move-out
Authorization: Bearer YOUR_GRIDEX_API_TOKEN
Idempotency-Key: move-out-…
Content-Type: application/json
```

Both endpoints use the same portal identity headers/payload as `portal-bundle` and must not accept a free `company_id`.

## Customer events

Customer portal actions are sent with an allowlisted event type and an `Idempotency-Key`. Support cases are outside the OPS API and must not be sent as website events.

Allowed inbound website customer event types:

```text
customer.opened_document
customer.downloaded_document
```

Keep extra customer action events disabled in the website until they are listed as active/built in OPS and the production developer contract. Otherwise the website may accept events that OPS rejects.

Payload:

```json
{
  "event_type": "customer.opened_document",
  "source": "gridex_website",
  "entity_type": "document",
  "entity_id": "document-id",
  "idempotency_key": "customer-event-unique-key",
  "metadata": { "page": "/dashboard/documents" }
}
```

The route adds portal identity headers/body fields server-side from the logged-in user. It rejects unsupported event types before calling OPS.

## Durable website writes and recovery

Customer events, notification-read changes and profile updates use server-generated, user-namespaced idempotency keys. If OPS is temporarily unavailable, the website stores the exact operation in `customer_portal_write_outbox` and returns a queued status instead of claiming that a lost event succeeded. The Vercel cron route `/api/internal/customer-portal/outbox/process` retries pending operations with the same key and payload, applies exponential backoff and does not retry permanent `4xx` validation/authorization failures.

Notification-read requests must contain exactly one of a non-empty `notification_ids` array or explicit `all=true`. Empty/invalid payloads must never be interpreted as “mark everything read”.

## Webhooks

OPS webhooks are signed with HMAC SHA-256 over:

```text
X-Gridex-Timestamp + "." + rawBody
```

The receiver must reject missing timestamps, stale timestamps and signatures that only match the raw body. `GRIDEX_WEBHOOK_SIGNING_SECRET` is the canonical variable; if the deprecated alias is also set to a different value, verification fails closed. The website stores `company_id`, `customer_number`, `external_customer_id`, `customer_email`, payload hash and raw payload for audit/debugging.

A duplicate with status `processed` is acknowledged without running business logic twice. A previously `failed`, `received` or stale `processing` event is claimable and may be processed again with attempt tracking and optimistic concurrency. The same `event_id` with a different payload hash is a conflict, not a harmless duplicate. Notifications that arrive before a portal user can be resolved remain `pending`; `/api/internal/customer-portal/notifications/reconcile` retries resolution using converging stable identifiers and never links an ambiguous customer.

## Production readiness checklist

Before calling a tenant website production-ready, verify:

```text
GRIDEX_OPS_API_URL=https://app.gridex.se
GRIDEX_WEBSITE_API_KEY=<full API token, not the gdxp_ prefix only>
GRIDEX_ENABLE_LIVE_SIGNUP=true
GRIDEX_ENABLE_PORTAL_ONBOARDING=true
GRIDEX_WEBSITE_HASH_PEPPER=<stable secret>
GRIDEX_WEBSITE_PRICING_QUOTE_SECRET=<stable signing secret>
GRIDEX_ENABLE_OPS_WEBHOOKS=true
GRIDEX_WEBHOOK_SIGNING_SECRET=<same signing secret configured in OPS webhook settings>
CUSTOMER_PORTAL_OUTBOX_CRON_SECRET=<cron secret, or rely on CRON_SECRET>
GRIDEX_OPS_ALLOWED_HOSTS=app.gridex.se
```

The OPS API key should include:

```text
website_contracts.read
website_applications.write
customer_portal.read
customer_portal.write
website_events.write
events.read
customer_documents.read
customer_documents.write
customer_notifications.read
customer_notifications.write
customer_contact.write
customer_facility_data.write
customer_power_of_attorney.write
```

Before deployment, apply `supabase/migrations/20260710090000_customer_portal_api_hardening.sql`. It creates immutable application-attempt storage, the durable write outbox, retry metadata for webhook/notification reconciliation and the shared database-backed rate limiter. Configure both Vercel cron routes and verify they receive the expected authorization header.

The production guard requires HTTPS and a hostname in `GRIDEX_OPS_ALLOWED_HOSTS` (normally only `app.gridex.se`). Unsafe URL overrides are for explicit non-production diagnostics only. Webhook verification must use `GRIDEX_WEBHOOK_SIGNING_SECRET` and reject stale timestamps/signatures. Public rate limits use the shared Supabase RPC; the process-local limiter is only a fail-safe when the shared store is temporarily unavailable.
