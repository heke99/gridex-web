# Gridex Web – leveransrapport 2026-07-29

## Mål

Göra Gridex Web canonicalt, fail-closed och produktionsmässigt synkroniserat mot aktuell Gridex OPS Customer Portal / Website API, utan tysta fallbackvärden eller falsk readiness.

Canonical kontraktsversion i leveransen: `2026-07-28.2`.

## Sammanfattning

Webbsidans lösbara kodfel är korrigerade: versionen är centraliserad, all OPS-trafik går genom en transport, OpenAPI-operationer valideras, market price och portfolio parsas korrekt, inloggad portalidentitet är förberedd atomiskt, separat portal-sync är borttagen från nyteckning, kunddata är `private, no-store`, readiness är granular och webhooks har durable retry/dead-letter.

Full API-kompatibilitet kan ändå inte deklareras. OPS OpenAPI motsäger guiden eller saknar slutna schemas på tio punkter. Dessutom kunde varken live-OpenAPI-sync, riktig dependency-installation, Next build eller staging verifieras i leveransmiljön. Systemet visar därför korrekt **NO-GO** i stället för falskt grönt.

## Kravstatus

| Krav | Status | Kodbevis | Verifieringsbevis | Kvarvarande risk |
|---|---|---|---|---|
| Canonical API-version `.2` | KLAR | `lib/ops/contract.ts`, manifest, snapshots och genererade typer | `api:check:local` passerar | Live-snapshot måste hämtas med `api:sync`. |
| Säker gemensam transport | KLAR | `lib/ops/transport.ts`, tunn wrapper i `lib/ops/client.ts` | Hardeningtest passerar | Live timeout/retry kräver staging. |
| Request/query/path/header/response-validering | KLAR | `lib/ops/validators/openapi.ts` | Hardeningtest + parserkontroll | Öppna OPS-schemas kan inte ge strict proof. |
| Current market price | KLAR | Helt envelope, inga semantiska fallbackvärden, stale fail-closed | Hardeningtest passerar | Live prisfeed kräver staging. |
| Portfolio parser/BFF | KLAR | `data.historical_final_prices`, locked settlement, metadata bevarad | Hardeningtest passerar | BLOCKERAD AV OPS för strikt OpenAPI-schema. |
| Atomisk portalidentitet i kundansökan | BLOCKERAD AV OPS | Webben skickar båda serververifierade ID:n när schema stöder dem och stoppar annars specifikt | Hardeningtest passerar | OPS requestschema saknar fälten. |
| Separat portal-sync bort från nyteckning | KLAR | Signup gör endast canonical customer application | Hardeningtest passerar | Sync finns kvar endast för explicit repair/legacy. |
| Dynamisk juridik och immutable evidence | BLOCKERAD AV OPS | UI/evidence är datadrivet och okända krav ignoreras inte | Launch/hardeningkontroller passerar | OPS accepterar fortfarande fem fasta booleanfält. |
| Customer Portal requests/responses | BLOCKERAD AV OPS | Endpointsspecifik validation, serveridentitet och fail-closed fallback | Portal hardening passerar | Sync och resursmodeller är öppna/felaktiga i OPS OpenAPI. |
| Kunddata-cache | KLAR | `privateJsonResponse`, `private, no-store` på portaldata och fel | Hardeningtest passerar | CDN/proxyheaders bör bekräftas i staging. |
| Granular readiness | KLAR | Separata contract/runtime/market/portal/webhook/migration/full checks | Hardeningtest passerar | Live/staging-bevisflaggor måste sättas efter verklig verifiering. |
| Webhooktransport | KLAR | HMAC raw body, timestamp, event/type/delivery ID, tenant och dedupe | Hardeningtest passerar | Officiella domänwebhookschemas saknas. |
| Webhookprojektion/retry/dead-letter | KLAR | SQL-RPC, cron-route, attempt budget och permanent failure | Migration/hardeningkontroller passerar | Migration och cron måste appliceras/verifieras i staging. |
| Idempotens/concurrency | KLAR | Canonical JSON-hash, stabila operation keys, SQL advisory lock/dedupe | Hardening + migrationskontroll | Live parallelltest krävs. |
| Tenant isolation | KLAR | API-nyckel/context, tenantverifiering, inga klientstyrda tenantfallbacks | Statiska kontroller | Två-tenant stagingtest återstår. |
| Migrationskedja/checksummor | KLAR | 22 filer, unik version, SHA-manifest | `db:migrations:check` passerar | Remote history måste jämföras före push p.g.a. tidigare `20260602`-kollision. |
| Full dependency-installation | BLOCKERAD AV MILJÖ | `package.json`/lockfil lämnas canonical | Registry returnerade 404 | Kör `npm ci` i normal miljö. |
| Typecheck/lint/build | BLOCKERAD AV MILJÖ | 318 moduler parseade utan syntaxfel | `tsc`/eslint/Next saknade dependencies | Måste passera lokalt/CI efter `npm ci`. |
| Live OpenAPI-sync | BLOCKERAD AV MILJÖ | `verification-status.json=false`; syncscript är transaktionellt | Lokal driftkontroll passerar | Kör `npm run api:sync` med nätverk. |
| Staging E2E | BLOCKERAD AV MILJÖ | 18-stegs checklista finns | Ej körd utan credentials | Krävs före produktion. |
| Full API-kompatibilitet | BLOCKERAD AV OPS | Strict readiness och `api:compatibility` stoppar korrekt | Kommandot misslyckas på redovisade gaps | OPS måste publicera nästa korrigerade kontraktsversion. |

## Viktig migrationsanmärkning

Den tidigare filen:

```text
supabase/migrations/20260602_market_price_and_invoice_integrations.sql
```

har ersatts med den unika versionen:

```text
supabase/migrations/20260602010000_market_price_and_invoice_integrations.sql
```

Kör därför alltid `supabase migration list` och `supabase db push --dry-run` innan faktisk push. Om en fjärrmiljö redan registrerat den gamla kolliderande versionen ska historiken reconcileras uttryckligen; kör inte en blind push.

## Säker synk – patchleverans

```bash
rm -rf /tmp/gridex-web-api-compatibility-patch-2026-07-29
mkdir -p /tmp/gridex-web-api-compatibility-patch-2026-07-29
unzip -q "$HOME/Downloads/gridex-web-api-compatibility-patch-2026-07-29.zip" \
  -d /tmp/gridex-web-api-compatibility-patch-2026-07-29

rm -f "/Users/hekmath/Desktop/Projects/gridex-web/DELIVERY_REPORT_2026-07-28.1.md"
rm -f "/Users/hekmath/Desktop/Projects/gridex-web/supabase/migrations/20260602_market_price_and_invoice_integrations.sql"

rsync -av \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  "/tmp/gridex-web-api-compatibility-patch-2026-07-29/gridex-web/" \
  "/Users/hekmath/Desktop/Projects/gridex-web/"
```

## Kontroll efter synk

```bash
cd "/Users/hekmath/Desktop/Projects/gridex-web"

npm ci
npm run api:sync
npm run db:migrations:check
npm run api:check
npm run api:contract
npm run typecheck
npm run lint
npm test
npm run build
npm run api:compatibility:known-gaps
npm run api:compatibility

supabase migration list
supabase db push --dry-run
```

Applicera inte migrationer eller deploya produktion om `api:sync`, build, strict compatibility eller stagingchecklistan är röda.

## Releasebeslut

**NO-GO**
