# Verifieringslogg – Gridex Web API compatibility

Datum: 2026-07-29  
Canonical kontraktsversion: `2026-07-28.2`

## Genomförda kontroller

| Kontroll | Resultat | Bevis |
|---|---|---|
| `npm run verify:delivery` | GODKÄND | Lokal OpenAPI/types-konsistens, 22 migrationschecksummor, kända upstream gaps och hardeningtest passerade. |
| `npm run api:check:local` | GODKÄND | Båda lokala OpenAPI-snapshots och genererade typer är internt konsistenta på `.2`. |
| `npm run db:migrations:check` | GODKÄND | 22 SQL-filer, unika versioner och matchande SHA-256-manifest. |
| `npm run api:compatibility:known-gaps` | GODKÄND MED REDOVISADE BLOCKERARE | Tio OPS-kontraktsluckor och `live_openapi_sync_not_verified` redovisas maskinellt. |
| `node tests/api-compatibility-hardening.test.mjs` | GODKÄND | Canonical transport, market/portfolio, portal-ID, no-store, readiness och webhooks verifierades statiskt. |
| Tidiga `npm run test:launch`-steg | DELVIS GODKÄND | Pricing visibility, Customer Portal hardening, elprisetjustnu, launch readiness, public DTO och signup quote binding passerade. |
| TypeScript parser över repo | GODKÄND | 318 TS/TSX/JS-moduler, noll syntaxfel. |
| `npm run api:compatibility` | FÖRVÄNTAT BLOCKERAD | Stoppar på tio OPS-schemafel och ej verifierad live-synk. |
| `npm ci` / riktiga dependencies | BLOCKERAD AV MILJÖ | Den interna npm-proxyn returnerade 404 för låsta paket, bland annat `@supabase/ssr` och tidigare `zod-validation-error`. |
| `npm run typecheck` | BLOCKERAD AV MILJÖ | Paket och typdefinitioner saknas efter misslyckad installation; resultaten består huvudsakligen av `module not found`/saknade Node/React-typer och kaskadfel. |
| `npm run lint` | BLOCKERAD AV MILJÖ | `eslint` är inte installerat. |
| `npm run build` | BLOCKERAD AV MILJÖ | `next` är inte installerat. |
| Live OpenAPI-sync | BLOCKERAD AV MILJÖ | Sandlådan kunde inte hämta de kompletta officiella JSON-filerna. `live_sync_verified` lämnas därför avsiktligt `false`. |
| Staging smoke test | BLOCKERAD AV MILJÖ | Staging-API-nyckel, Supabase-projekt och webhookhemligheter saknades. |

## Maskinellt redovisade OPS-blockerare

```text
customer_application_portal_identity_missing
legal_acceptances_not_dynamic
portfolio_response_schema_not_strict
website_quote_validation_response_not_strict
website_customer_events_schema_not_strict
customer_portal_sync_request_not_strict
customer_portal_sync_response_is_invoice_list
customer_portal_identity_headers_missing
customer_portal_resource_schemas_not_strict
ops_domain_webhook_schema_not_published
```

## Kontroll efter lokal synk

Kör i projektet med fungerande npm- och nätverksåtkomst:

```bash
npm ci
npm run api:sync
npm run db:migrations:check
npm run api:check
npm run api:contract
npm run typecheck
npm run lint
npm test
npm run build
npm run api:compatibility
```

Det sista kommandot ska fortsätta vara rött tills OPS har publicerat korrigerade maskinscheman och live-synken är verifierad.
