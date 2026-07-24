# Website integration 2026-07-23.1

## Canonical dataflöde

```text
Browser
  -> Gridex Web server: address + customer input
  -> OPS integration/context
  -> OPS public-contracts (ETag + publication revision)
  -> OPS energy-area/resolve
  -> signed local area token
  -> external market snapshot when applicable
  -> OPS quote
  -> server-side quote snapshot + signed browser token
  -> OPS quote/validate
  -> dynamic legal acceptances
  -> OPS customer-applications
  -> OPS website/switch-status
  -> customer/portal-bundle
```

## Public contract priority

Canonical fields are read before aliases:

- `contract_type`
- `price_areas`
- `area_pricing`
- `pricing.calculation_components`
- `pricing.display_components`
- `pricing.summary_components`
- `legal.requirements`

For a fixed contract, an exact and unique `area_pricing` row is required. A conflicting uniform price blocks the quote.

## Pricing visibility

- `visible`: may appear on the contract card.
- `summary_only`: may appear only in an allowed full breakdown.
- `hidden`: server calculation only.
- Missing/unknown visibility fails closed.
- `invoice_fee` is additionally denied by component code before any browser DTO or token is produced.

## Component calculation validation

The website validates all `calculation_inclusion=included` components and supports:

- `ore_per_kwh`
- `sek_month`
- `sek_invoice` with `invoices_per_year` or `billing_interval_months`
- `sek_year`
- `percent` with explicit `calculation_base`
- `fixed_amount`

VAT is normalized per component. Unsupported included components block the flow with `unsupported_pricing_component` semantics.

## Legal requirements

Required legal items are rendered from `legal.requirements[]`. Each item is bound to:

- requirement code
- acceptance type
- document ID
- legal bundle document ID
- document version
- document hash
- public URL

The current UI supports `acceptance_type=checkbox`; another required type blocks publication readiness rather than being guessed.

## Application contract guards

`quote_reference` is never sent by assumption. Production requires:

```text
GRIDEX_OPS_APPLICATION_QUOTE_REFERENCE_MODE=top_level
```

or:

```text
GRIDEX_OPS_APPLICATION_QUOTE_REFERENCE_MODE=contract
```

Use only the placement confirmed by OPS OpenAPI/runtime. The default is unset and blocks live submission.

Dynamic consent codes are sent in the documented `consents` object. `legal_acceptances` is omitted unless OPS later documents it and `GRIDEX_OPS_APPLICATION_LEGAL_ACCEPTANCES_MODE=top_level` is explicitly enabled.

## Database audit

Migration `20260724120000_ops_website_contract_20260723_1.sql` adds:

- OPS area resolution reference, status, hash and expiry
- OPS quote reference, expiry, validation status and validation time
- publication revision, ETag and contract payload hash
- market snapshot link
- application number and contract trace
- normalized OPS payload SHA-256
- RLS and service-role-only policies

## Readiness

Checkout readiness and customer portal readiness are independent. The admin integration page shows both. A green checkout does not imply that portal-bundle, documents, invoices, notifications or profile writes have the necessary scopes.

## Mina sidor identity rules

Portal-bundle is the canonical read path. The authenticated Supabase user ID is sent unchanged in both `X-Gridex-Customer-Portal-User-Id` and `X-Gridex-Auth-User-Id`. `external_customer_id`, `customer_number`, `auth_user_id`, `customer_portal_user_id` and billing references are separate identifiers and must never be substituted for one another.

## Power of attorney

When an OPS legal requirement requires a power of attorney, the accepted application carries the structured `powerOfAttorney` object with scope, signer identity, acceptance method, acceptance timestamp, document version ID, IP address and user agent. No local document URL or version is invented; the exact OPS requirement metadata is used.
