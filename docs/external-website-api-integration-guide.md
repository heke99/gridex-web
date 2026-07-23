# Gridex Web integration – API 2026-07-22.2

Gridex Web is an external tenant. OPS is the source of truth for public contracts, `offer_reference`, legal requirements, fees, VAT, fixed prices and accepted customer applications. Gridex Web resolves price area and calculates the public indicative price in its own server backend.

## Active OPS calls

- `GET /api/v1/integration/context`
- `GET /api/v1/website/public-contracts`
- `GET /api/v1/website/public-contracts/diagnostics`
- `POST /api/v1/website/customer-applications`

The API key is server-only. `offer_reference` is the only contract selector. New applications do not send a quote reference.

## Local Gridex Web BFF

- `POST /api/v1/website/energy/resolve`
- `POST /api/v1/website/pricing/preview`
- `POST /api/v1/website/pricing/verify`
- `POST /api/v1/website/customer-applications`

The local pricing preview resolves the address again server-side, obtains Elprisetjustnu data for market-linked contracts, combines all OPS calculation components and signs the resulting pricing snapshot.

## Fixed price

A fixed price is never included in the browser DTO before the address has been resolved to a supported SE area. After resolution, the backend selects the OPS-published fixed price for that area and returns the signed preview.

## Removed OPS routes

The former OPS energy-area and quote routes are not used. Legacy local compatibility routes return `410 Gone` and point to the local replacement.
