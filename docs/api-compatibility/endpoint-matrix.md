# Endpointmatris – Gridex Web mot Gridex OPS

Kontraktsversion: `2026-08-02.1`

## Website Integration

| Endpoint | Web-användning | Status |
|---|---|---|
| `GET /api/v1/integration/context` | tenant, scopes, readiness och exakt kontraktsversion | kompatibel, fail-closed |
| `GET /api/v1/website/public-contracts` | publicerade avtal, prisalternativ och immutable legal snapshot | kompatibel, avtalsrad isoleras |
| `POST /api/v1/website/energy-area/resolve` | verifierat elområde; `grid_area_code` är canonical, inget internt grid-owner-ID förväntas | kompatibel |
| `POST /api/v1/website/quote` | canonical quote med required `valid_until`, echoed input och kundval | kompatibel lokalt; runtime ska stagingverifieras |
| `POST /api/v1/website/quote/validate` | full referens-, version-, komponent-, marknads- och områdespriskontroll | kompatibel lokalt; runtime ska stagingverifieras |
| `GET /api/v1/website/legal-bundle` | fristående API-yta; används inte som andra juridisk sanningskälla efter avtalsval | inte del av canonical checkout |
| `POST /api/v1/website/customer-applications` | atomisk ansökan med canonical referenser och immutable juridik | kompatibel |
| `GET /api/v1/website/customer-applications/{application_id}` | ansökningsstatus | kompatibel |
| `GET /api/v1/website/switch-status` | leverantörsbytesstatus | kompatibel |
| `POST /webhooks/contracts.publication.changed` | durable publication state, cacheinvalidering och revalidation | kompatibel med route-OpenAPI |

## Customer Portal

Alla operationer använder tenant från API-nyckeln och verifierad authidentitet.
Saknade frivilliga identifierare utelämnas.

| Resurs | Operation | Status |
|---|---|---|
| portal bundle/profile | canonical läsmodell | kompatibel, fail-closed |
| contracts/sites/metering | granulära reads | kompatibel |
| invoices/documents/legal/POA | granulära reads | kompatibel |
| notifications/events | reads och idempotenta writes med validerat response-envelope | kompatibel |
| profile update | idempotent write | kompatibel |
| move-out | `facility_reference` + datum på toppnivå | kompatibel |
| customer sync | stängd toppnivåmodell; array för `facility_data`; auth user reference stöds | kompatibel |

## Releasekontroller

| Kommando | Kontroll |
|---|---|
| `npm run api:sync` | live-manifest, rå-byte-SHA, atomisk snapshot/type-synk |
| `npm run api:check:local` | lokala specs, typer och manifest |
| `npm run api:check:live` | liveversion, SHA och byteidentitet |
| `npm run api:compatibility` | fail-closed på kontrakts- och miljögap |
| `npm run db:migrations:check` | migrationernas manifest och checksummor |
| `npm run test:launch` | runtime-/regressionssvit för release |
