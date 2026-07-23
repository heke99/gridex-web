# Gridex Web tenant/API alignment

API documentation version: **2026-07-22.2**

Gridex Web is an external OPS consumer. The API key identifies the tenant and is only used server-side. The opaque tenant identity is verified with `GET /api/v1/integration/context`.

## Required environment

```env
GRIDEX_OPS_API_URL=https://app.gridex.se
GRIDEX_WEBSITE_API_KEY=<full secret>
GRIDEX_WEBSITE_API_SCOPES=integration_context.read,website_contracts.read,website_contracts.diagnostics,website_applications.write,website_legal.read
GRIDEX_WEBSITE_PRICING_QUOTE_SECRET=<at least 32 random bytes>
```

## Canonical flow

1. Fetch OPS integration context and public contracts.
2. Resolve the address locally through `/api/v1/website/energy/resolve`.
3. Calculate the public price locally through `/api/v1/website/pricing/preview`.
4. Sign and verify the local pricing snapshot.
5. Submit the application to OPS using `offer_reference` and the resolved site data.

OPS quote and OPS energy-area endpoints are not part of this flow. Fixed prices are redacted from browser contract DTOs until an address has resolved to an eligible SE area.
