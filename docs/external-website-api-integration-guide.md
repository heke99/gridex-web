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
```

The client should be created with the complete standard set and reduced only when a capability is intentionally disabled.

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
    "markup": { "amount": 4, "unit": "ore_per_kwh" }
  },
  "legal": {
    "terms_version": "2026-06",
    "privacy_policy_version": "2026-06",
    "withdrawal_version": "2026-06",
    "power_of_attorney_required": true,
    "price_terms_version": "2026-06"
  },
  "valid_from": "2026-06-01T00:00:00Z",
  "valid_to": null
}
```

`offer_reference` is the only contract reference that the website may use for price calculation, selection and application. OPS resolves the current internal contract, price plan and price version from that reference.

## Price preview and quote validation

```http
POST /api/v1/website/pricing/preview
Authorization: Bearer YOUR_GRIDEX_API_TOKEN
Content-Type: application/json
```

Scope: `website_contracts.read`

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

The request must not include `price_plan_id`, `price_plan_version_id`, `contract_id` or a customer-controlled product identifier. OPS calculates the complete price, locks its own price/version snapshot and should return an opaque, short-lived `quote_token` and `quote_expires_at`.

```http
POST /api/v1/website/pricing/quote/validate
Authorization: Bearer YOUR_GRIDEX_API_TOKEN
Content-Type: application/json
```

Validate the opaque quote with the same public fields before an application is submitted. The website currently has a deliberately separate, short-lived HMAC compatibility quote only when OPS has not returned a quote token. It uses `GRIDEX_WEBSITE_PRICING_QUOTE_SECRET`, never the API token or PII hashing secret. Remove this fallback once all OPS tenants return opaque quote tokens.

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
    "offer_reference": "offer_…"
  }
}
```

OPS resolves the internal price plan/version and stores the authoritative contract and legal snapshots. The website sends the displayed contract snapshot and verified price preview only for audit and mismatch detection; they are never the legal source of truth.

## Customer Portal External Auth Linking

Tenant websites use their own Supabase Auth for Mina sidor. Server-side website code sends the website Supabase `session.user.id` to OPS as both `x-gridex-customer-portal-user-id` and `x-gridex-auth-user-id`.

```http
POST /api/v1/customer/portal-bundle
Authorization: Bearer YOUR_GRIDEX_API_TOKEN
Content-Type: application/json
```

Recommended payload:

```json
{
  "email": "kund@example.se",
  "customer_number": "DX-100023",
  "external_customer_id": "GRIDEX-WEB-20260616-…"
}
```

Use `external_customer_id` only for the stable website/customer reference from signup. Do not copy the OPS customer number into `external_customer_id`; send customer numbers in `customer_number`.

The website returns `401` for a missing customer session and `503` when the portal cannot be read. When local fallback data is shown, it must be visibly marked as potentially older than OPS data.

## Customer sync

Signed powers of attorney, legal acceptances, customer documents, facility completions and profile changes are synced to OPS through:

```http
POST /api/v1/customer/sync
Authorization: Bearer YOUR_GRIDEX_API_TOKEN
Idempotency-Key: tenant-sync-…
Content-Type: application/json
```

Payloads must include the same customer identifiers used for Mina sidor linking. OPS stores the records under the tenant resolved from the API key.

## Customer events

Customer portal actions are sent with an allowlisted event type and an `Idempotency-Key`. Support cases are outside the OPS API and must not be sent as website events.

## Webhooks

OPS webhooks are signed with HMAC SHA-256 over:

```text
X-Gridex-Timestamp + "." + rawBody
```

The receiver must reject missing timestamps, stale timestamps and signatures that only match the raw body. The website stores `company_id`, `customer_number`, `external_customer_id`, `customer_email`, payload hash and raw payload for audit/debugging.
