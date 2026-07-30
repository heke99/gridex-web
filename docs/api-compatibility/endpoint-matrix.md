# Endpointmatris – Gridex Web mot Gridex OPS

Kontraktsversion: `2026-07-30.1`

## Website Integration

| Endpoint | Web-användning | Status |
|---|---|---|
| `GET /api/v1/integration/context` | tenant, scopes och readiness | kompatibel |
| `GET /api/v1/website/public-contracts` | publicerade avtal och kundval | blockerad av saknad `price_options`-property i OpenAPI |
| `POST /api/v1/website/energy-area/resolve` | verifierat elområde | kompatibel |
| `POST /api/v1/website/quote` | canonical offert inklusive kundval | kompatibel |
| `POST /api/v1/website/quote/validate` | serverbindning före ansökan | kompatibel |
| `GET /api/v1/website/legal-bundle` | dynamiska dokumentkrav | kompatibel |
| `POST /api/v1/website/customer-applications` | atomisk ansökan | kompatibel |
| `GET /api/v1/website/customer-applications/{application_id}` | ansökningsstatus | kompatibel |
| `GET /api/v1/website/switch-status` | leverantörsbytesstatus | kompatibel |

## Customer Portal

Alla operationer använder tenant från API-nyckeln och verifierad authidentitet.
Saknade frivilliga identifierare utelämnas.

| Resurs | Operation | Status |
|---|---|---|
| portal bundle/profile | canonical läsmodell | kompatibel, fail-closed |
| contracts/sites/metering | granulära reads | kompatibel |
| invoices/documents/legal/POA | granulära reads | kompatibel |
| notifications/events | reads och idempotenta writes | kompatibel |
| profile update | idempotent write | kompatibel |
| move-out | toppnivådatum + `data` | kompatibel |
| customer sync | publicerad closed requestmodell | kompatibel |

## Releasekontroller

| Kommando | Kontroll |
|---|---|
| `npm run api:sync` | live-manifest, rå-byte-SHA, atomisk snapshot/type-synk |
| `npm run api:check:local` | lokala specs, typer och manifest |
| `npm run api:check:live` | liveversion, SHA och byteidentitet |
| `npm run api:compatibility` | fail-closed på alla kontrakts- och miljögap |
| `npm run api:compatibility:known-gaps` | rapport utan att dölja gap |
