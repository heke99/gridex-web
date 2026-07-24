# Website integration 2026-07-24.1

## Tenant identity

The full server-side `GRIDEX_WEBSITE_API_KEY` selects the tenant. The backend verifies the opaque `tenant_reference` through `GET /api/v1/integration/context`. Browser code never receives the key and no client request may select a tenant through `company_id`.

## Canonical pricing flow

```text
address → OPS energy-area resolve → resolution_id → OPS quote → signed browser token
→ OPS quote validate → customer application
```

The quote request contains only the documented fields: `resolution_id`, `offer_reference`, `annual_consumption_kwh`, `customer_type` and optional `start_date`. OPS owns all pricing, VAT and the additive indicative `market_reference`. Gridex Web stores and displays the returned quote but does not calculate an alternative price.

The application payload contains `external_customer_id`, `source`, `customer`, `site`, `contract`, dynamic `consents`, optional portal user identifiers and optional `powerOfAttorney`. It does not include `quote_reference` or a top-level `legal_acceptances` field.

## Mina sidor identity rules

The backend sends the same Supabase `session.user.id` as both `x-gridex-customer-portal-user-id` and `x-gridex-auth-user-id`. It sends a genuine stable `external_customer_id`, or the OPS `customer_number` in its dedicated field. It never sends `company_id`, a browser-supplied `customer_id`, or an OPS customer number as `external_customer_id`.

## Webhooks

The receiver verifies the HMAC over timestamp and raw request body, rejects stale timestamps and deduplicates event/delivery IDs. A `tenant_reference` is verified against integration context when the event type supplies it; general signed customer events are not rejected solely because the optional field is absent.

## Required environment

```env
GRIDEX_WEBSITE_API_KEY=
```

Optional URL override:

```env
GRIDEX_OPS_API_URL=https://app.gridex.se
```

When webhooks are enabled:

```env
GRIDEX_ENABLE_OPS_WEBHOOKS=true
GRIDEX_WEBHOOK_SIGNING_SECRET=
```
