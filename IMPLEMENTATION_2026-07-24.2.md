# Gridex Web – implementationsrapport 2026-07-24.2

## Samlad bedömning

Projektet använde delar av det tidigare kontraktet och byggde kundansökan med fel referensplacering. Den centrala produktionsrisken var att `offer_reference` låg under `contract`, `quote_reference` inte följde hela checkoutkedjan och `site.price_area_code` skickades som klientstyrd canonical uppgift.

Implementationen är nu ombyggd kring en enda tenantbunden kedja där OPS äger tenant, område, marknadsreferens, quote, avgifter, juridik, kundansökan, workflow och portaldata.

## API-nyckel och HTTP-klient

- `GRIDEX_API_KEY` är enda dokumenterade obligatoriska OPS-inställning.
- Deprecated alias läses endast för bakåtkompatibilitet och annonseras inte i `env.example` eller deployinstruktioner.
- API-basen är fast till `https://app.gridex.se/api/v1` i produktion.
- Klienten är server-only och skickar Bearer-auth, JSON-headers, timeout och kontraktsacceptansheader.
- OPS correlation/request ID bevaras i normaliserade fel.
- `ops_contract_version_mismatch` innehåller expected, received, endpoint, correlation ID och retryability.
- Production accepterar inte godtycklig OPS-URL från ENV.

## Integration context och readiness

`GET /api/v1/integration/context` normaliseras till tenant reference, company ID, miljö, kanal, API-version, kontraktsversion, configuration och capabilities.

Readiness blockerar när:

- API-nyckeln saknas eller är ogiltig;
- OPS inte returnerar `2026-07-24.2`;
- API-basen inte är den canonicala `/api/v1`-basen;
- ansökningsreferenser inte annonseras som `top_level`;
- checkout inte är redo;
- något website-scope saknas, inklusive `website_market_prices.read`.

Tenant- eller companyidentitet kopieras inte till ENV.

## Område, marknadspris och quote

- Adressen löses av OPS och ger ett signerbart `resolution_id`.
- `market-price/current` tar endast `resolution_id` från browserflödet.
- OPS-fälten `time_start`, `time_end`, `source_as_of` och `next_update_at` normaliseras utan att priset räknas om.
- Hela `market_reference` bevaras med provider, period, priser, stale/fallback-flaggor, inkluderingar och timestamps.
- Quote skapas med samma `resolution_id`, offer, förbrukning, kundtyp och startdatum.
- Den signerade quote-tokenen låser samma resolution och startdatum.
- Quote validation kontrollerar samma quote/resolution/förbrukning/startdatum innan ansökan.
- Direktdata från Elpriset just nu är avskild till ett informationsadapterlager och får inte påverka checkoutens quote eller avtalsdata.

## Kundansökan

Canonical payload har följande top-level-fält:

```text
external_customer_id
source
offer_reference
quote_reference
resolution_id
annual_consumption_kwh
start_date
customer
site
contract
legal_acceptances
consents
powerOfAttorney
```

Följande skickas inte:

```text
contract.offer_reference
contract.quote_reference
site.price_area_code
```

Ansökan blockeras om offer, quote, resolution, årsförbrukning eller startdatum saknas. Ingen lokal fallbackansökan skapas.

## Idempotens

- Ett stabilt checkoutförsöks-ID och `Idempotency-Key` skapas innan submit.
- Nyckeln återanvänds vid nätverks-/browser-retry.
- Normaliserad OPS-payload SHA-256 låses lokalt före POST.
- Samma nyckel med annan payload blockeras.
- OPS 409 återhämtas endast när svaret innehåller ett stabilt tidigare canonicalt resultat; andra konflikter propagateras.

## Status och workflow

- POST-resultatet mappar application, customer, site, metering point, contract, workflow, continuation job, kommunikation och correlation ID.
- Tack-sidan visar application status som primär status.
- Supplier-switch status visas separat och blandas inte ihop med application status.
- Status-BFF kräver en kortlivad signerad result token och har rate limiting.
- Statussynk sparar endast auditfält lokalt; OPS förblir source of truth.
- Gridex Web startar inte OPS continuation jobs efter accepterad ansökan.

## Databas

Nya migrationer:

```text
supabase/migrations/20260724184500_ops_website_contract_20260724_2.sql
supabase/migrations/20260724190000_ops_website_contract_20260724_2.sql
```

Tillagda auditfält omfattar bland annat:

```text
ops_application_id
ops_application_number
ops_customer_id
ops_customer_number
ops_site_id
ops_metering_point_id
ops_contract_id
ops_workflow_id
ops_continuation_job_id
ops_workflow_state
ops_status
ops_supplier_switch_status
ops_correlation_id
last_status_synced_at
submission_idempotency_key
submission_payload_hash
```

## OpenAPI och CI

- Versionerade snapshots finns under `docs/openapi`.
- Genererade declarationer finns under `lib/ops/generated`.
- `npm run api:generate` regenererar typer från de incheckade specifikationerna.
- `npm run api:drift` hämtar live-specifikationerna, validerar versionen, genererar typer och stoppar CI om typerna avviker.
- OpenAPI hämtas aldrig i runtime.

## Testresultat

Följande kördes och passerade:

```text
npm run api:contract
npm run test:canonical-market-flow
npm run test:customer-application
npm run test:idempotency
npm run test:portal
npm run test:launch
npm test
```

## Kvarvarande verifieringsblockerare

En ren `npm ci` kunde inte slutföras eftersom paketregistret svarade HTTP 503 på `zod-validation-error-4.0.2.tgz`. Den avbrutna installationen lämnades inte i leveransen. Följaktligen kan typecheck och production build inte redovisas som gröna från denna miljö; de måste köras efter en lyckad `npm ci` på användarens dator/CI.

Direkt curl från containern kunde inte lösa `app.gridex.se`. OpenAPI-kontraktet verifierades externt under arbetet och driftkontrollen finns i CI, men exakt live-regenerering ska köras med normal nätåtkomst före merge.

Supabase migration och live staging-E2E kräver användarens Supabase-projekt, CLI-inloggning och en OPS-testnyckel och har därför inte körts i denna miljö.
