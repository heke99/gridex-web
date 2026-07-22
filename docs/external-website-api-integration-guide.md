# External website integration guide

API documentation version: **2026-07-22.1**

## Tenant identity

The full API key is server-only and identifies the API client and tenant. Fetch the verified opaque identity from `GET /api/v1/integration/context` using `integration_context.read`. Do not send `company_id` or any internal tenant ID as a selector.

`GRIDEX_EXPECTED_TENANT_REFERENCE` is optional defense-in-depth pinning. Missing pinning must not block normal operation. A configured mismatch must fail closed.

## Required website capabilities

| Method | Endpoint | Scope |
|---|---|---|
| GET | `/api/v1/integration/context` | `integration_context.read` |
| GET | `/api/v1/website/public-contracts` | `website_contracts.read` |
| GET | `/api/v1/website/public-contracts/diagnostics` | `website_contracts.diagnostics` |
| POST | `/api/v1/website/energy-area/resolve` | `website_energy_area.resolve` |
| POST | `/api/v1/website/quote` | `website_quotes.write` |
| POST | `/api/v1/website/quote/validate` | `website_quotes.validate` |
| GET | `/api/v1/website/legal-bundle` | `website_legal.read` |
| POST | `/api/v1/website/customer-applications` | `website_applications.write` |

Use canonical customer types `private` and `business`. `company` is normalized to `business` only during its documented deprecation period.

## Application rules

- Resolve energy area through OPS.
- Create and validate quotes through OPS.
- Preserve `estimate`, `lines`, `assumptions`, `market_sources`, `source_window`, schema version and validity metadata.
- Put `quote_reference` at application top level, never under `contract`.
- Validate the quote server-side immediately before submit.
- Send a stable `Idempotency-Key` for one logical application attempt.
- Render legal requirements from OPS and serialize consent according to the OpenAPI schema.

## Cache and webhooks

Use tenant/channel-bound ETag and `If-None-Match`; handle `304 Not Modified`. Publication webhooks are HMAC/timestamp verified, event-ID deduplicated, header/body checked and persisted into shared `ops_publication_state`. Process-local invalidation is only an optimization.

## Portal and events

`POST /api/v1/customer/portal-bundle` is primary. Legacy granular fallback is disabled in production. Only documented headers and active events are used; analytics events are best effort and never block portal views.

## Mina sidor identity rules

Use the authenticated Supabase user ID only as the documented portal/auth user identity. Customer number and external customer ID remain separate identifiers. Never substitute `company_id`, tenant ID or an unrelated internal customer UUID.

## Power of attorney

When required by the selected offer, the application may include the documented `powerOfAttorney` object with acceptance timestamp, signer, method, scope and legal text version. Its requirement and version come from OPS legal data.
