# Gridex website, Mina sidor and webhook integration

This repository treats Gridex OPS as the source of truth for published offers, quotes, legal versions, customer applications and customer-portal data. The website API key is server-side and determines the company. Browser requests must never select an OPS tenant or send internal OPS identifiers as authority.

## Required configuration

```text
GRIDEX_OPS_API_URL=https://app.gridex.se
GRIDEX_WEBSITE_API_KEY=<complete secret API token>
GRIDEX_WEBSITE_API_SCOPES=<comma-separated scopes below>
GRIDEX_EXPECTED_COMPANY_ID=<company UUID represented by the API key>
GRIDEX_ENABLE_LIVE_SIGNUP=true
GRIDEX_ENABLE_LEGACY_PORTAL_BUNDLE_COMPATIBILITY=false
GRIDEX_ENABLE_LEGACY_WEBSITE_CONTRACTS_ROUTE=false
```

Never set or send `X-Gridex-Tenant-Id`. The API key resolves the company. Production startup/readiness must fail visibly when the URL, key, expected company or required scope declaration is missing.

## Scope set

The current integration expects the granular scopes below. Legacy `customer_portal.read` and `customer_portal.write` can be present for compatibility, but they are not a substitute for declaring and testing the endpoint-specific permissions.

```text
website_contracts.read
website_legal.read
website_applications.write
website_events.write
events.read
customer_sync.write
customer_profile.read
customer_contracts.read
customer_sites.read
customer_invoices.read
customer_metering.read
customer_events.read
customer_documents.read
customer_legal.read
customer_power_of_attorney.read
customer_notifications.read
customer_notifications.write
customer_contact.write
customer_facility_data.write
```

The admin integration page runs readiness checks and distinguishes an invalid API key, missing scopes, an invalid base URL/environment and OPS unavailability.

## Official endpoint flow

| Method | OPS path | Primary scope | Website use |
| --- | --- | --- | --- |
| `GET` | `/api/v1/website/public-contracts` | `website_contracts.read` | Published, sellable offers and exact `offer_reference`. |
| `POST` | `/api/v1/website/quote` | `website_contracts.read` | Authoritative quote for selected offer, area and consumption. |
| `GET` | `/api/v1/website/legal-bundle` | `website_legal.read` or compatible contract-read access | Published legal text/version bundle. |
| `POST` | `/api/v1/website/customer-applications` | `website_applications.write` | Strict customer application payload. |
| `POST` | `/api/v1/customer/portal-bundle` | customer read scopes | Preferred Mina sidor bundle and identity linking. |
| `POST` | `/api/v1/customer-portal/sync` | `customer_sync.write` | Link or repair portal identity. |
| `POST` | `/api/v1/customer/sync` | `customer_sync.write` | Sync profile, facility, legal, POA and documents. |
| `POST` | `/api/v1/customer/profile-update` | `customer_contact.write` | Contact/profile update. |
| `POST` | `/api/v1/customer/move-out` | `customer_facility_data.write` | Move-out report. |
| `POST` | `/api/v1/customer/notifications/read` | `customer_notifications.write` | Mark notifications read. |
| `POST` | `/api/v1/website/customer-events` | `website_events.write` | Allowlisted website/customer events. |
| `GET` | `/api/v1/events` | `events.read` | Tenant domain-event read. |

The repository exposes website-local wrapper routes only for browser-safe validation and server-to-server OPS calls. `/api/v1/website/contracts` is a disabled legacy alias and returns `410` unless its explicit compatibility flag is enabled. `gridex.se/api/v1/events does not proxy tenant event reads`; tenant event reads stay on the authenticated OPS API.

## Sell and price flow

The only supported flow is:

```text
GET public-contracts
  -> select exact offer_reference
  -> POST website/quote
  -> show quote and published legal versions
  -> lock local audit snapshot
  -> POST customer-applications with offer_reference
```

`offer_reference` is the only contract reference that the website may use for quote selection and application. An internal `id` must never be substituted when `offer_reference` is missing. Such an offer is integration-invalid and not sellable online.

The browser-facing pricing route may issue a short-lived website HMAC token to bind the review page to the authoritative OPS quote. The token is only an integrity mechanism. Price calculation is never performed from a local independent price engine. Before submission, the server fetches/validates the quote again and rejects changed or expired review data.
The integration must never silently convert missing markup, monthly fee, invoice fee, fixed price or portfolio price to zero. Missing mandatory quote values block sale. Browser-supplied `price_plan_id` and `price_plan_version_id` are forbidden; OPS resolves them from `offer_reference`.

The full OPS quote and the displayed contract snapshot are stored in `website_application_submissions` for audit. They are deliberately not placed in the strict OPS application payload unless the published OPS schema explicitly allows them.

## Legal bundle

`GET /api/v1/website/legal-bundle` is fetched server-side. The selected public contract and legal bundle determine:

- terms version and version ID;
- privacy version and version ID;
- withdrawal version and version ID;
- price-terms version and version ID;
- power-of-attorney requirement and text version ID.

The application must use the exact published versions accepted by the customer. A required power of attorney without a valid published text version blocks sale.

## Strict customer-application payload

Unknown top-level and nested fields can be rejected by OPS. The website therefore sends the documented business payload only. Local analytics, UTM values, quote snapshots, grid-resolution diagnostics and internal application identifiers remain in the website audit record.

Earliest possible start:

```json
{
  "external_customer_id": "GRIDEX-WEB-<stable-id>",
  "source": "gridex_website",
  "customer_portal_user_id": "<authenticated-user-id>",
  "auth_user_id": "<authenticated-user-id>",
  "customer": {
    "customer_type": "private",
    "first_name": "Anna",
    "last_name": "Andersson",
    "personal_number": "YYYYMMDDXXXX",
    "email": "anna@example.se",
    "phone": "+46701234567"
  },
  "site": {
    "facility_id": "735999...",
    "street": "Storgatan 1",
    "postal_code": "21122",
    "city": "Malmö",
    "price_area_code": "SE4",
    "current_supplier_name": "Nuvarande elhandlare",
    "current_supplier_org_number": "5560000000"
  },
  "contract": {
    "offer_reference": "offer_...",
    "requested_start_mode": "earliest_possible",
    "requested_start_date": null
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
    "acceptedAt": "2026-07-13T12:00:00.000Z",
    "textVersionId": "<published-legal-version-uuid>"
  }
}
```

Specific date:

```json
{
  "site": {
    "move_in_date": "2026-08-01"
  },
  "contract": {
    "offer_reference": "offer_...",
    "requested_start_mode": "specific_date",
    "requested_start_date": "2026-08-01"
  }
}
```

Only these start modes are accepted:

```text
earliest_possible
specific_date
```

`specific_date` requires a valid date. `earliest_possible` sends `requested_start_date: null`. The old value `asap` and placement under `metadata` are forbidden.

`external_customer_id` is required by the website type and server validation. It is stable and must not be derived from mutable contact information. Current-supplier fields are optional, but should be collected when known to reduce manual follow-up.

## Idempotency and immutable attempts

Each signed submission receives one durable attempt ID and one idempotency key. The exact normalized OPS payload is hashed and locked before the API call.

```text
same Idempotency-Key = same normalized payload
changed payload = new deliberate operation and new key
```

Never retry a corrected payload with an old key. Completion of an existing application, missing POA repair and administrative replay must use the relevant continuation/replay flow rather than silently mutating a prior request.

## Mina sidor identity rules

`POST /api/v1/customer/portal-bundle` is the primary read/link flow. The website sends a stable portal user ID in the required headers/body plus available customer attributes.

A first automatic relation requires either:

1. an already linked portal identity; or
2. at least two matching customer attributes.

The website resolver follows the same or stricter rule:

- exact portal user ID is accepted;
- exact tenant-scoped external customer ID is accepted;
- otherwise customer number plus e-mail can identify one profile;
- e-mail alone never auto-links a customer.

A missing or ambiguous relation is an identity state, not an empty portal. Generic 404 responses do not activate legacy reads. Legacy bundle fallback is only allowed behind `GRIDEX_ENABLE_LEGACY_PORTAL_BUNDLE_COMPATIBILITY=true` and only for explicit `endpoint_not_found` or `method_not_supported` compatibility errors.

Portal states must remain distinguishable:

```text
customer_not_linked
customer_not_found
ambiguous_customer_match
identity_information_insufficient
ops_unavailable
scope_missing
```

The dashboard has a dedicated recovery state and calls `POST /api/v1/customer-portal/sync`. A successful authenticated signup also attempts portal sync immediately; transient failures are placed in the durable outbox.

## Stable identifier uniqueness

The website is a single-company deployment. Partial unique indexes enforce uniqueness for non-null:

```text
customer_profiles.external_customer_id
customer_profiles.customer_number
customer_profiles.portal_identity_id
```

The migration aborts with a clear error if duplicate values exist. Resolve duplicates before applying it. In a future shared multi-company database, use `(company_id, identifier)` partial unique indexes instead.

## Customer write outbox

All customer-facing writes use direct OPS calls first and a durable outbox for transient failures:

```text
customer_event
notification_read
profile_update
customer_sync
customer_portal_sync
move_out
facility_data_update
```

Each row stores:

- operation and stable idempotency key;
- normalized identity and payload hash;
- attempt count and maximum attempts;
- next retry time with backoff;
- last HTTP status and API error code;
- dead-letter timestamp.

A duplicate idempotency key is accepted only when operation, identity and payload are identical. Permanent failures or exhausted retries become `dead_letter`. Admins can inspect and replay failed/dead-letter rows from the Integrationer page after fixing the root cause.

## Customer UI coverage

Mina sidor exposes working flows for:

- portal-link refresh/recovery;
- facility and metering-point completion;
- grid/price-area completion;
- move-out report;
- marking notifications read;
- profile/contact updates and existing customer events.

The UI reports whether a transient operation completed immediately or was safely queued.

## Webhooks

Signature verification uses the raw body and the documented `timestamp.rawBody` HMAC input with constant-time comparison. Duplicate deliveries are stored idempotently.

After signature verification:

1. `payload.company_id` must equal `GRIDEX_EXPECTED_COMPANY_ID`;
2. customer resolution must follow the identity rules above;
3. an unknown but correctly signed event is stored as `ignored_unknown_type` and acknowledged with `202`;
4. invalid signatures return `401`;
5. no event is linked by e-mail alone.

Acknowledging unknown signed events prevents retry storms when OPS introduces a new event before the website deployment supports it.

## Success-page privacy

The success URL contains only a random opaque token:

```text
/teckna-avtal/tack?result=<opaque-token>
```

The token is stored as a SHA-256 hash, expires after 24 hours and resolves server-side. Customer number, contract number, application number and case references are never placed directly in the query string, browser history, analytics or referrer headers.

## Deployment order

1. Resolve any duplicate stable customer identifiers.
2. Apply `20260713160000_customer_portal_api_contract_alignment.sql`.
3. Configure the complete OPS URL, API key, scope declaration and expected company ID.
4. Keep both legacy compatibility flags disabled.
5. Run `npm run test:launch`, `npm run lint`, `npx tsc --noEmit` and `npm run build`.
6. Open Admin → Integrationer and verify every required scope and OPS probe.
7. Test all four application price types and both start modes.
8. Test portal linking with an already linked user, a valid two-attribute first link, missing identity and ambiguous identity.
9. Test transient write queue, dead-letter and administrative replay.
10. Test valid, duplicate, unknown-type, wrong-company and invalid-signature webhooks.

## Non-negotiable rules

- OPS is the price and legal source of truth.
- Never expose the API key to the browser.
- Never send a tenant/company override header.
- Never substitute internal `id` for `offer_reference`.
- Never present identity/link errors as a successful empty portal.
- Never auto-link a customer by e-mail alone.
- Never reuse an idempotency key with a changed normalized payload.
- Never place customer/application identifiers in a success URL.
