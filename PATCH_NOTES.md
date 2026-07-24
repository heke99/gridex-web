# Gridex Web – OPS website contract 2026-07-24.2

## Canonical målbild

Gridex Web använder nu ett tenantbundet OPS-flöde där API-nyckeln är den enda obligatoriska OPS-konfigurationen:

```text
GRIDEX_API_KEY
→ integration context
→ publicerade avtal
→ OPS energy-area resolution
→ OPS market-price/current
→ canonical OPS quote
→ quote validation
→ idempotent customer application
→ application status
→ OPS continuation workflow
→ customer portal bundle
```

## Viktigaste rättningarna

- Kontraktsversionen är `2026-07-24.2` i runtime, request-header, svarskontroll, tester och dokumentation.
- Klienten skickar `X-Gridex-Accept-Contract-Version: 2026-07-24.2` och validerar OPS-svaret `X-Gridex-Contract-Version`.
- `GRIDEX_API_KEY` har högst prioritet och är den enda dokumenterade tenantinställningen. `GRIDEX_WEBSITE_API_KEY` och `GRIDEX_OPS_API_KEY` accepteras endast som deprecated runtime-alias.
- Produktionsbasen är fast till `https://app.gridex.se/api/v1`. Override används endast lokalt, i preview eller staging.
- Integration context verifierar API-nyckelns tenantbindning, kontraktsversion, API-bas, `top_level`-placering och saknade website-scopes.
- `website_market_prices.read` ingår i website-readiness.
- Kundansökan skickar `offer_reference`, `quote_reference`, `resolution_id`, `annual_consumption_kwh` och `start_date` top-level.
- `contract.offer_reference`, `contract.quote_reference` och `site.price_area_code` skickas inte.
- Den signerade browser-quoten låser `resolution_id`, `quote_reference`, årsförbrukning och startdatum. Validation och application måste använda exakt samma värden.
- Varje checkoutförsök får en stabil `Idempotency-Key`. Exakt OPS-payload hash-låses före submit och nyckeln återanvänds vid retry.
- `POST /api/v1/website/market-price/current` har en server-only OPS-klient och en rate-limitad BFF-route.
- Generiska SE1–SE4-/historiksidor är separerad marknadsinformation och får inte användas som quote, avtal eller faktureringsunderlag.
- `GET /api/v1/website/customer-applications/{application_id}` har en skyddad BFF-route och används som primär status på tack-sidan.
- Application status och supplier-switch status är separata modeller.
- OPS workflow-, kund-, site-, mätpunkt-, avtals-, status-, correlation- och idempotensfält sparas lokalt enbart för audit och återupptagning. OPS förblir canonical.
- Officiella `legal_acceptances` skickas. `consents` speglas samtidigt som ett kompatibilitetsalias under övergången.
- OpenAPI-snapshots, genererade deklarationer och CI-kontroll mot live-specifikationerna har lagts till.

## Databasmigrationer

```text
supabase/migrations/20260724184500_ops_website_contract_20260724_2.sql
supabase/migrations/20260724190000_ops_website_contract_20260724_2.sql
```

Den första migrationen lägger additivt till workflow-, status-, correlation-, idempotency- och payload-hashfält samt index och unik koppling för `ops_application_id`.

Den andra ersätter den tidigare `20260724190000_ops_website_contract_20260724_1.sql` och canonicaliserar `ops_resolution_id` för lokal revisionsspårning.

## Verifiering i leveransmiljön

Grönt:

```text
npm run api:contract
npm run test:canonical-market-flow
npm run test:customer-application
npm run test:idempotency
npm run test:portal
npm run test:launch
npm test
```

Inte slutfört i leveransmiljön:

- `npm ci` stoppades av HTTP 503 från det tillgängliga npm-registret.
- Därför saknades Next.js/React/Supabase-paketen för en tillförlitlig `npm run typecheck` och `npm run build`.
- Supabase CLI, staging-nyckel och stagingdatabas var inte tillgängliga, så migration och live E2E kördes inte här.

Se `VERIFICATION_2026-07-24.2.md` och `VERIFICATION_2026-07-24.2.log`.
