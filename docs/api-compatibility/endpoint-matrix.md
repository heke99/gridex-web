# Endpointmatris – Gridex Web mot Gridex OPS

Kontraktsversion: `2026-07-30.1`

## Website Integration

| Endpoint | Scope | Kontrakt | Web-användning | Lokal status |
|---|---|---|---|---|
| `GET /api/v1/integration/context` | `integration_context.read` | Tenant, scopes, capability och version | auth/readiness | kompatibel |
| `GET /api/v1/website/public-contracts` | `website_contracts.read` | canonical public offer | checkout/cache | kompatibel |
| `GET /api/v1/website/public-contracts/diagnostics` | `website_contracts.diagnostics` | publiceringsgraf | readiness | kompatibel |
| `POST /api/v1/website/energy-area/resolve` | `website_energy_area.resolve` | strict resolution | checkout | kompatibel |
| `POST /api/v1/website/quote` | `website_quotes.write` | canonical quote | checkout | kompatibel |
| `POST /api/v1/website/quote/validate` | `website_quotes.validate` | strict binding response | checkout | kompatibel |
| `GET /api/v1/website/legal-bundle` | `website_legal.read` | dynamiska dokumentkrav | checkout | kompatibel |
| `POST /api/v1/website/customer-applications` | `website_applications.write` | atomisk auth/legal/quote-bindning | checkout | kompatibel |
| `GET /api/v1/website/customer-applications/{application_id}` | `website_switch_status.read` | canonical status | status | kompatibel |
| `GET /api/v1/website/switch-status` | `website_switch_status.read` | canonical bytesstatus | status/readiness | kompatibel |
| `POST /api/v1/website/market-price/current` | `website_market_prices.read` | current interval | pris-BFF | kompatibel |
| `GET /api/v1/website/portfolio-prices` | `website_contracts.read` | låst historik | portfolio-BFF | kompatibel |
| `POST /api/v1/website/customer-events` | `website_events.write` | canonical event + idempotens | portal/outbox | kompatibel |

## Customer Portal

Alla portaloperationer använder:

- tenant från API-nyckeln,
- `x-gridex-customer-portal-user-id`,
- `x-gridex-auth-user-id`,
- identiska serververifierade UUID:n,
- opaka kundreferenser,
- slutna request/response-envelopes.

| Resurs | Operationer | Lokal status |
|---|---|---|
| portal identity | `POST /api/v1/customer-portal/sync` | kompatibel, endast recovery |
| portal bundle/profile | bundle + `customer/me` | kompatibel |
| contracts/sites/metering | granular reads | kompatibel |
| invoices/documents/legal/POA | granular reads | kompatibel |
| notifications/events | reads och dokumenterade writes | kompatibel |
| profile/move/sync | idempotenta writes | kompatibel |

## OpenAPI-release

| Endpoint/kommando | Kontroll |
|---|---|
| `GET /api/v1/openapi/release-manifest.json` | gemensam version, URL och SHA-256 |
| `npm run api:sync` | manifest först, därefter atomisk snapshot/type-synk |
| `npm run api:check:local` | lokala specs, typer och manifest |
| `npm run api:check:live` | live manifest, SHA och semantisk drift |

Lokal kompatibilitet ersätter inte stagingbevis. Live sync, migrationer,
två-tenant-isolering och webhooks måste passera innan produktion.
