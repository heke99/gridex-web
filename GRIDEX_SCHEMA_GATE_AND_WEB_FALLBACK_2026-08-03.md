# Gridex schema gate och webbfallback – 2026-08-03

## Bekräftad rotorsak

`app.gridex.se` returnerar `503 platform_schema_not_ready` eftersom OPS-koden kör `assertPlatformSchemaReady()` före autentiserade API-anrop. Den anslutna databasen visar:

- `platform_schema_state.is_ready = false`
- `current_version = 20260713150000-api-performance-tenant-hardening`
- blockerare:
  - `CANONICAL_MIGRATION_MANIFEST_EMPTY`
  - `MIGRATION_LEDGER_COUNT_MISMATCH`
  - `MIGRATION_VERIFICATION_STALE`
- canonical manifest: 0 rader
- Supabase migration ledger: 18 rader
- senaste ledger-version: `20260802180000`

Readiness-migrationen `20260802232000_migration_truth_readiness.sql` finns effektmässigt i databasen, trots att ledgern slutar på `20260802180000`. Det visar att senare SQL sannolikt applicerades utanför det normala Supabase-migrationsflödet och därför inte registrerades i ledgern.

Kontraktsdata är inte borta. Den canonicala readiness-vyn visar fortfarande 1 synligt website-avtal av 10 website-rader. API:t stoppas innan endpointen får läsa och returnera detta avtal.

## Gör inte detta

- Sätt inte `platform_schema_state.is_ready = true` manuellt.
- Kör inte `canonical-migration-manifest-after-verification.sql` direkt.
- Kör inte `supabase migration repair` för alla filer utan schemaeffekt- och checksumverifiering.

Repositoryinventeringen innehåller 251 ledger-lämpliga migrationsfiler, men live-ledgern innehåller bara 18 och det finns tre historiska dubblettversioner. En blind “grönmarkering” skulle ge falsk readiness.

## Omedelbar säker återställning

Rulla tillbaka **OPS-projektets Vercel-deployment för `app.gridex.se`** till den senaste kända fungerande deploymenten före schema-readiness-gaten. Databasobjekten kan ligga kvar; den äldre applikationsversionen ignorerar den nya readiness-raden.

Verifiera sedan med server-side API-nyckel:

```bash
curl -i \
  -H "Authorization: Bearer $GRIDEX_API_KEY" \
  https://app.gridex.se/api/v1/integration/context

curl -i \
  -H "Authorization: Bearer $GRIDEX_API_KEY" \
  "https://app.gridex.se/api/v1/website/public-contracts?customer_type=private"
```

Förväntat: HTTP 200 och inte `platform_schema_not_ready`.

## Permanent OPS-reparation

1. Lös dubblettversionerna `20260612193000`, `20260616123000` och `20260727150000` med dokumenterad canonical normalisering.
2. Bygg en disposable ren stagingdatabas från den normaliserade migrationskedjan.
3. Verifiera att alla förväntade schemaeffekter och registrerade SHA-256-checksummor matchar.
4. Jämför stagingens schemafingerprint med live.
5. Kör aktuell `supabase migration repair --help` och reparera endast bevisade live-versioner.
6. Populera `canonical_migration_manifest` med verifierade checksummor, release-ID och schemafingerprint.
7. Kör `gridex_refresh_platform_schema_state_v2(release_identifier, schema_fingerprint)`.
8. Kontrollera:

```sql
select * from public.canonical_migration_readiness_v;
select id, current_version, is_ready, blocking_issues, verified_at
from public.platform_schema_state
where id = true;
```

Readiness ska endast aktiveras när `is_ready=true`, blockerarlistan är tom och manifest/ledger-count matchar.

## Webbpatchen i denna zip

Webben hade ett sekundärt fel: den beständiga last-known-good-snapshoten försökte först verifiera `/integration/context`. När OPS svarade 503 lästes snapshotdatabasen aldrig. Patchen:

- tillåter API-key-bunden snapshotläsning under verifierade 5xx-avbrott,
- accepterar `platform_schema_not_ready` som LKG-fallbackorsak,
- behåller spärrar för 401, 403, tenant mismatch, pausade och stängda tenants,
- verifierar fortfarande kontraktsversion, parser-version och OpenAPI SHA-256,
- skiljer logg för integration-context-fel från verkligt snapshotdatabasfel.

## Testkorrigeringar

- Ett schemaogiltigt quote-validation-svar förväntas nu ge `canonical_response_schema_invalid`.
- Customer Portal POST-regressionen skickar obligatorisk `Idempotency-Key`.
- `package.json` innehåller korrekt mellanslag i `node --experimental-strip-types`.

## Applicera webbpatchen

```bash
rm -rf /tmp/gridex-schema-gate-web-followup
mkdir -p /tmp/gridex-schema-gate-web-followup

unzip -q \
  "/Users/hekmath/Downloads/gridex-schema-gate-web-followup-2026-08-03.zip" \
  -d /tmp/gridex-schema-gate-web-followup

rsync -av \
  /tmp/gridex-schema-gate-web-followup/ \
  "/Users/hekmath/Desktop/Projects/gridex-web/"

cd "/Users/hekmath/Desktop/Projects/gridex-web"
```

Kör:

```bash
npm run typecheck
npm run api:contract
npm run test:launch
npm run build
npm run api:preflight
```

Webbpatchen minskar användarpåverkan under OPS-avbrott, men den gör inte OPS-databasen ready. OPS rollback eller full ledger/manifest-reparation krävs fortfarande.
