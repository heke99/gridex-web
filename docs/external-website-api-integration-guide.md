# Gridex website, Mina sidor and webhook integration

This repository treats Gridex OPS as the source of truth for published offers, fixed and portfolio prices, fees, legal versions, customer applications and customer-portal data. Public monthly, hourly and quarterly spot calculations fetch their market-price basis directly from Elprisetjustnu. The spot portion of a mix product also comes from Elprisetjustnu, while its published portfolio portion and all agreement components come from OPS. Every browser-facing result is calculated server-side and signed for review. The website API key is server-side and determines the company. Browser requests must never select an OPS tenant or send internal OPS identifiers as authority.

## Required configuration

```text
GRIDEX_OPS_API_URL=https://app.gridex.se
GRIDEX_OPS_TIMEOUT_MS=12000
SPOT_PRICE_API_TIMEOUT_MS=8000
GRIDEX_WEBSITE_API_KEY=<complete secret API token>
GRIDEX_WEBSITE_API_SCOPES=<comma-separated scopes below>
GRIDEX_EXPECTED_COMPANY_ID=<company UUID represented by the API key>
GRIDEX_ENABLE_LIVE_SIGNUP=true
GRIDEX_ENABLE_LEGACY_PORTAL_BUNDLE_COMPATIBILITY=false
GRIDEX_ENABLE_LEGACY_WEBSITE_CONTRACTS_ROUTE=false
```

Never set or send `X-Gridex-Tenant-Id`. The API key resolves the company. Production startup/readiness must fail visibly when the URL, key, expected company or required scope declaration is missing.

## Scope set

The integration requires both the documented portal-bundle scopes and the endpoint-specific scopes below. Readiness probes the preferred `POST /api/v1/customer/portal-bundle` route with a non-mutating test identity.

```text
website_contracts.read
website_legal.read
website_applications.write
website_events.write
events.read
customer_portal.read
customer_portal.write
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
customer_power_of_attorney.write
customer_notifications.read
customer_notifications.write
customer_contact.write
customer_facility_data.write
```

The admin integration page performs non-mutating authorization probes against every endpoint group and distinguishes an invalid API key, missing scopes, an invalid base URL/environment and OPS unavailability. `GRIDEX_WEBSITE_API_SCOPES` remains a required configuration inventory, but readiness is never green from the declaration alone.

## Official endpoint flow

| Method | OPS path | Primary scope | Website use |
| --- | --- | --- | --- |
| `GET` | `/api/v1/website/public-contracts` | `website_contracts.read` | Published, sellable offers and exact `offer_reference`. Admin diagnostics use `diagnostics=1` server-side. |
| `POST` | `/api/v1/website/quote` | `website_contracts.read` | Canonical calculation route for fixed and portfolio products. Monthly, hourly and quarterly spot products do not use OPS for their market-price basis. Mix is calculated by Gridex Web from Elprisetjustnu spot data plus the published OPS portfolio portion and fees. |
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
  -> monthly/hourly/quarterly: fetch market basis directly from Elprisetjustnu
  -> mix: combine Elprisetjustnu spot basis with the exact portfolio share, portfolio price and fees published by OPS
  -> fixed/portfolio: use the canonical OPS quote
  -> show price and published legal versions
  -> lock local audit snapshot
  -> POST customer-applications with offer_reference
```

`offer_reference` is the only contract reference that the website may use for quote selection and application. An internal `id` must never be substituted when `offer_reference` is missing. Such an offer is integration-invalid and not sellable online.

The browser-facing pricing route issues a website HMAC token to bind the review page to the exact server-calculated snapshot. The browser never calculates or supplies authoritative prices. `variable_spot`/monthly products use the current calendar month's published prices to date from Elprisetjustnu. Hourly products aggregate today's published source intervals to a 60-minute reporting basis when the API supplies quarter-hour data. Quarterly products use today's published quarter-hour intervals and fail closed if quarter-hour data cannot be verified. Mix products use the current monthly spot basis from Elprisetjustnu together with the exact portfolio share, portfolio price and fees published by OPS. Fixed and portfolio products use the canonical OPS quote. Before submission, the server recalculates through the same shared path and rejects changed or invalid review data.
The integration must never silently convert missing markup, monthly fee, invoice fee, fixed price or portfolio price to zero. Missing mandatory quote values block sale. Browser-supplied `price_plan_id` and `price_plan_version_id` are forbidden; OPS resolves them from `offer_reference`.

The signed website pricing snapshot and displayed contract snapshot are stored in `website_application_submissions` for audit. For fixed and portfolio products, the underlying OPS quote is retained when available. These audit values are deliberately not placed in the strict OPS application payload unless the published OPS schema explicitly allows them.


### Elprisetjustnu market-data policy

The website calls the documented static JSON endpoint server-side:

```text
GET https://www.elprisetjustnu.se/api/v1/prices/{YEAR}/{MONTH}-{DAY}_{AREA}.json
```

Market samples are duration-weighted from `SEK_per_kWh` and `time_start`/`time_end`; zero and negative spot prices remain valid input. `EUR_per_kWh` and `EXR` are retained as source diagnostics but never replace the API's SEK value in the customer calculation. Current-month calculations require every day through the calculation date, so a partial or missing day never silently produces a misleading average. The signed result snapshot records source, price area, period, reporting sample count and interval, original API sample count and interval, EUR average and exchange rate.

### Consumption profile and annual estimate

The public calculator must never invent a default consumption. A private customer either enters annual consumption or approves an estimate based on housing type, floor area, heating type, household size and explicitly selected larger loads. The accepted annual value is converted to monthly kWh and used identically by the calculator, signed quote and final server verification.

### Postal-code persistence

The price-area resolver always checks `website_postal_code_price_areas` first. A successful external resolution is upserted by exact normalized five-digit postal code and then read back from the database before it is returned. Subsequent lookups therefore use the database directly. An expired exact match may be used only as a temporary fallback when the external geodata services are unavailable. Database read/write errors are logged and are no longer silently ignored.

The versioned `consumption_profile` travels with the website checkout context, is validated against `estimated_monthly_kwh`, is included in the immutable local application snapshot and is shown during review. It is not added to the strict OPS application payload until OPS publishes a matching schema field. This avoids divergent price inputs without sending undocumented fields.

## Legal bundle

`GET /api/v1/website/legal-bundle` is available server-side for diagnostics and document views. The selected public contract itself must carry every exact, published legal version and HTTPS URL needed for sale; a temporary bundle failure is therefore not allowed to stop an otherwise complete contract. The contract determines:

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

## OPS response evidence and timeouts

Every OPS call has a bounded timeout controlled by `GRIDEX_OPS_TIMEOUT_MS` (default 12000 ms, allowed 1000–60000 ms). Timeouts are returned as transient `504 ops_request_timeout` errors so the existing retry/outbox policy can handle them.

The complete successful customer-application response is stored as `ops_result_snapshot` together with `contract_status`, `signed_at`, `withdrawal_deadline_at`, `signature_snapshot_sha256`, agreement-confirmation eligibility, switch readiness and the communication snapshot. The public result token exposes only customer-safe status fields.

Public-contract diagnostics are fetched directly from OPS on the authenticated admin integrations page. The browser-facing public-contract routes never forward internal diagnostics to customers.
