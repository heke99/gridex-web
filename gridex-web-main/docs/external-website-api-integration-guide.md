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
    "markup": { "amount": 4, "unit": "ore_per_kwh" }
  },
  "legal": {
    "terms_version": "2026-06",
    "privacy_policy_version": "2026-06",
    "withdrawal_version": "2026-06",
    "power_of_attorney_required": true,
    "power_of_attorney_version": "2026-06-poa",
    "price_terms_version": "2026-06"
  },
  "valid_from": "2026-06-01T00:00:00Z",
  "valid_to": null
}
```

`offer_reference` is the only contract reference that the website may use for price calculation, selection and application. OPS resolves the current internal contract, price plan and price version from that reference.

When `legal.power_of_attorney_required=true`, OPS must also return `legal.power_of_attorney_version` (or the equivalent camelCase/alias field). The website blocks sale instead of sending a signed `powerOfAttorney.textVersionId=null`, because the signed operational fullmakt must be traceable to the published legal text version.

## Official website/customer endpoints

The current website integration uses these official server-to-server endpoints:

| Method | Path | Scope | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/website/public-contracts` | `website_contracts.read` | Published sellable offers. |
| `POST` | `/api/v1/website/pricing/preview` | `website_contracts.read` | Website price preview for a public offer reference. |
| `POST` | `/api/v1/website/pricing/quote/validate` | `website_contracts.read` | Validate an opaque/signed price quote before application submit. |
| `POST` | `/api/v1/website/energy/resolve` | `website_contracts.read` | Resolve address/postal code to price area and, when available, grid area/owner hints. |
| `GET` | `/api/v1/website/legal-texts/current` | `website_contracts.read` | Published legal text versions for website display/audit. |
| `GET` | `/api/v1/website/price-plans` | `website_contracts.read` | Public price-plan/version overview when a tenant admin UI needs it. |
| `POST` | `/api/v1/website/customer-applications` | `website_applications.write` | Submit customer application and legal consent payloads. |
| `POST` | `/api/v1/website/customer-events` | `website_events.write` | Send allowlisted customer actions from website/Mina sidor. |
| `POST` | `/api/v1/events` | `website_events.write` | Alias for website customer events. |
| `POST` | `/api/v1/customer/portal-bundle` | `customer_portal.read` | Preferred Mina sidor bundle. |
| `GET` | `/api/v1/customer/portal-bundle` | `customer_portal.read` | Legacy/header bundle support. |
| `GET` | `/api/v1/customer/me` | `customer_portal.read` | Customer profile fallback. |
| `GET` | `/api/v1/customer/contracts` | `customer_portal.read` | Customer contracts fallback. |
| `GET` | `/api/v1/customer/sites` | `customer_portal.read` | Customer sites/metering points fallback. |
| `GET` | `/api/v1/customer/invoices` | `customer_portal.read` | Customer invoices. |
| `GET` | `/api/v1/customer/invoices/[id]` | `customer_portal.read` | One customer invoice detail. |
| `GET` | `/api/v1/customer/metering-values` | `customer_portal.read` | Customer metering values. |
| `GET` | `/api/v1/customer/events` | `customer_portal.read` | Customer-visible events. |
| `GET` | `/api/v1/customer/documents` | `customer_portal.read` | Customer documents. |
| `GET` | `/api/v1/customer/legal-acceptances` | `customer_portal.read` | Customer legal acceptances. |
| `GET` | `/api/v1/customer/powers-of-attorney` | `customer_portal.read` | Customer powers of attorney. |
| `GET` | `/api/v1/customer/notifications` | `customer_portal.read` | Customer notifications. |
| `POST` | `/api/v1/customer/notifications/read` | `customer_portal.write` | Mark notifications read. |
| `POST` | `/api/v1/customer/sync` | `customer_portal.write` | Sync documents, legal acceptances, POA and facility/profile data. |
| `POST` | `/api/v1/customer/profile-update` | `customer_portal.write` | Submit profile/contact changes. |
| `POST` | `/api/v1/customer/move-out` | `customer_portal.write` | Submit move-out report. |
| `GET` | `/api/v1/customer/switch-status` | `customer_portal.read` | Supplier-switch/facility readiness status. |
| `GET` | `/api/v1/events` | `events.read` | Read tenant domain events. |

Website wrapper routes may proxy or locally validate parts of this contract, but the OPS API key is always server-side and the tenant/company is always resolved from that key.

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
    "textVersionId": "2026-06",
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
    "pricing_preview_snapshot": { "contract": { "offer_reference": "offer_…" } },
    "contract_display_snapshot": { "offer_reference": "offer_…", "legal_versions": {} },
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "sommarkampanj",
    "user_agent": "Mozilla/5.0 …",
    "ip_hash": "sha256-hash"
  }
}
```

`external_application_id` identifies the website application attempt. `external_customer_id` identifies the website customer/account. Do not reuse the OPS customer number as `external_customer_id`; send OPS customer numbers only in `customer_number` after OPS has assigned them.

The application response can include `power_of_attorney_id`, `power_of_attorney`, `nextAction` and `manualInformationRequest`. The website should surface customer-safe `nextAction.message` and the manual request case reference when present, but it must not require these fields to exist.

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

The website returns `401` for a missing customer session. For the current Gridex web implementation, the local `/api/v1/customer/portal-bundle` route returns `200` with `data.opsAvailable=false`, `data.dataFreshness="local_fallback"` and `data.dataFreshnessMessage` when OPS live data cannot be fetched but local Supabase fallback rows exist. UI must visibly mark this as potentially older than OPS data. If no customer session exists, return `401`; if neither OPS nor local fallback can be read, return `503`.

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
customer.opened_contract
customer.downloaded_contract
customer.opened_invoice
customer.downloaded_invoice
customer.opened_document
customer.downloaded_document
customer.updated_contact_details
customer.accepted_power_of_attorney
customer.completed_facility_data
customer.viewed_switch_status
customer.password_reset_completed
```

Payload:

```json
{
  "event_type": "customer.opened_invoice",
  "source": "gridex_website",
  "entity_type": "invoice",
  "entity_id": "invoice-id",
  "idempotency_key": "customer-event-unique-key",
  "metadata": { "page": "/dashboard/invoices" }
}
```

The route adds portal identity headers/body fields server-side from the logged-in user. It rejects unsupported event types before calling OPS.

## Webhooks

OPS webhooks are signed with HMAC SHA-256 over:

```text
X-Gridex-Timestamp + "." + rawBody
```

The receiver must reject missing timestamps, stale timestamps and signatures that only match the raw body. The website stores `company_id`, `customer_number`, `external_customer_id`, `customer_email`, payload hash and raw payload for audit/debugging.


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
GRIDEX_OPS_WEBHOOK_SECRET=<same signing secret configured in OPS webhook settings>
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
customer_power_of_attorney.write
```

The production guard must reject localhost/staging/test OPS URLs unless `GRIDEX_ALLOW_UNSAFE_OPS_URL=true` is explicitly set for a non-production environment. Webhook verification must use `GRIDEX_OPS_WEBHOOK_SECRET` and reject stale timestamps/signatures.
