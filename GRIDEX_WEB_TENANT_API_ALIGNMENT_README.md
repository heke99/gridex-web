# Gridex Web tenant/API alignment

API documentation version: **2026-07-22.1**

Gridex Web is an external OPS consumer. The API key identifies the API client and tenant. The website verifies the opaque tenant identity through `GET /api/v1/integration/context`; it never selects a tenant with `company_id`.

## Required environment

```env
GRIDEX_OPS_API_URL=https://app.gridex.se
GRIDEX_WEBSITE_API_KEY=<full secret>
GRIDEX_WEBSITE_API_SCOPES=integration_context.read,website_contracts.read,website_contracts.diagnostics,website_quotes.write,website_quotes.validate,website_energy_area.resolve,website_applications.write,website_legal.read
```

`GRIDEX_EXPECTED_TENANT_REFERENCE` is optional deployment pinning. When absent, the tenant reference is fetched from OPS. When present, a mismatch fails closed.

## Canonical sales flow

1. `GET /api/v1/integration/context`
2. `GET /api/v1/website/public-contracts`
3. `POST /api/v1/website/energy-area/resolve`
4. `POST /api/v1/website/quote`
5. `POST /api/v1/website/quote/validate`
6. `GET /api/v1/website/legal-bundle`
7. `POST /api/v1/website/customer-applications`

`quote_reference` is a top-level application field. OPS quote validation always runs server-side immediately before application submission. Public-contract caching uses OPS ETag/304 and tenant/channel publication state. The legacy `/api/v1/website/contracts` route is disabled unless explicitly enabled and returns deprecation headers during transition.

Scopes are granted in OPS. `GRIDEX_WEBSITE_API_SCOPES` is only an expected-capability/readiness declaration.
