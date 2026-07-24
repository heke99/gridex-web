# Gridex Web – OPS website integration 2026-07-24.2

## Obligatorisk tenantkonfiguration

```env
GRIDEX_API_KEY=gridex_live_xxxxxxxxx
```

Det är den enda obligatoriska OPS-inställningen. Nyckeln används endast server-side och identifierar tenant, bolag, website-kanal och scopes genom `GET /api/v1/integration/context`. Browserkod får aldrig se nyckeln eller välja tenant/company.

Produktionsbasen är fast i kod:

```text
https://app.gridex.se/api/v1
```

Lokala tester, preview och staging kan använda ett process-override. Tenant ska inte konfigurera tenant reference, company ID, kontraktsversion, scope-listor, quote reference mode eller OpenAPI-sökväg.

Deprecated runtime-alias kan läsas under en övergångsperiod men ska inte läggas in i nya miljöer:

```text
GRIDEX_WEBSITE_API_KEY
GRIDEX_OPS_API_KEY
```

## Canonical checkout

```text
GRIDEX_API_KEY
→ integration context
→ publicerade avtal
→ områdesresolution
→ market-price/current
→ OPS quote
→ quote validation
→ kundansökan
→ application status
→ OPS continuation workflow
→ kundnummer/avtal/leverantörsbyte
→ portal bundle
```

Alla OPS-anrop skickar:

```http
Authorization: Bearer <GRIDEX_API_KEY>
Accept: application/json
Content-Type: application/json
X-Gridex-Accept-Contract-Version: 2026-07-24.2
```

OPS-svaret `X-Gridex-Contract-Version` kontrolleras. En annan version ger `ops_contract_version_mismatch` med expected/received, endpoint, correlation ID och retryability i serverloggen.

## Integration context och scopes

Readiness verifierar:

- giltig API-nyckel och tenantbindning;
- `contract_version = 2026-07-24.2`;
- `configuration.required_environment_variables = ["GRIDEX_API_KEY"]`;
- `configuration.api_base_url = https://app.gridex.se/api/v1`;
- `configuration.application_reference_location = top_level`;
- `capabilities.website_checkout_ready = true`;
- tom lista i `capabilities.missing_website_scopes`.

Website-profilen använder bland annat:

```text
integration_context.read
website_contracts.read
website_contracts.diagnostics
website_energy_area.resolve
website_market_prices.read
website_quotes.write
website_quotes.validate
website_applications.write
website_switch_status.read
```

## Kundansökan

Följande är obligatoriska top-level-fält:

```text
offer_reference
quote_reference
resolution_id
annual_consumption_kwh
start_date
```

`contract.offer_reference`, `contract.quote_reference` och `site.price_area_code` skickas inte. Samma signerade `resolution_id` används för marknadspris, quote, quote validation och ansökan. Samma `quote_reference` används i validation och ansökan.

Juridiska val skickas som OPS-fältet `legal_acceptances`. Under kompatibilitetsperioden speglas samma objekt även som `consents`. En strukturerad `powerOfAttorney` skickas endast när den publicerade OPS-juridiken kräver den.

Varje checkoutförsök skapar en stabil `Idempotency-Key`. Den och den normaliserade payload-hashen låses före submit och återanvänds vid retry. Samma nyckel med annan payload blockeras som `idempotency_conflict`/`idempotency_mismatch`.

## Status och workflow

POST-svaret speglas lokalt enbart för audit och tacksidans kortlivade result token: application/customer/site/metering-point/contract/workflow/continuation-job, kommunikationsstatus och initial status. OPS är fortfarande canonical statuskälla.

Tack-sidan läser:

```text
GET /api/v1/website/customer-applications/{application_id}
```

och stöder:

```text
accepted
processing
needs_customer_information
completed
rejected
failed
```

Application status visas primärt. Leverantörsbytets detaljstatus visas separat. Gridex Web startar aldrig continuation jobs själv.

## Aktuellt marknadspris och market reference

`POST /api/v1/website/market-price/current` använder `resolution_id`. Svaret är aktuell grossistmarknadsinformation och inte ett komplett kundpris. Fälten `time_start`, `time_end`, `source_as_of` och `next_update_at` normaliseras till interna adapterfält utan att prisvärdena räknas om.

Hela OPS-proveniensen bevaras när den finns:

```text
provider
price_area
reference_type
reference_period
price_sek_per_kwh
price_ore_per_kwh
requested_days
included_days
period_start
period_end
as_of
source_as_of
generated_at
stale_after
effective_stale_at
unit
includes_vat
includes_supplier_fees
includes_grid_fees
is_indicative
is_stale
fallback_used
fallback_reason
```

UI ska markera indikativt, stale eller fallback-baserat underlag och vad som inte ingår.

## Marknadsinformation kontra quote

OPS quote är alltid source of truth för kundens avtalspris, påslag, avgifter, rabatter och moms. Tenant får inte bygga om OPS quote eller använda marknadspriset som settlement-/faktureringspris.

Generiska SE1–SE4-, dags- och historiksidor använder ett separat informationsadapterlager eftersom OPS-kontraktet inte dokumenterar batch- eller historikendpoint. Dessa sidor märks:

> Ej en personlig offert. Exklusive Gridex avtalsavgifter, moms, skatter och elnätsavgifter. Kan inte användas som avtals- eller faktureringspris.

Informationsdata får aldrig användas i checkout, avtal eller fakturering. Framtida OPS-tillägg kan vara separata endpoints som `market-price/current-batch` och `market-price/history`; Gridex Web anropar inte dessa innan de finns i officiell OpenAPI.

## Mina sidor identity rules

Mina sidor använder server-side portal bundle. Den lokala webbidentiteten länkas endast med de opaka identiteter OPS returnerar efter accepterad ansökan. Gridex Web får inte härleda eller skapa `customer_id`, `customer_number`, `site_id`, `contract_id` eller portalidentitet själv.

Lokala länkar används endast för åtkomstkontroll, audit och onboarding. Om OPS-identiteten saknas eller inte matchar den inloggade användaren blockeras åtkomst fail closed.

## OpenAPI och CI

Versionslåsta filer finns i:

```text
docs/openapi/website-integration-v1.json
docs/openapi/customer-portal-v1.json
```

Typer finns i:

```text
lib/ops/generated/website-api.d.ts
lib/ops/generated/customer-portal-api.d.ts
```

Regenerera och kontrollera drift:

```bash
npm run api:generate
npm run api:contract
npm run api:drift
```

OpenAPI hämtas inte i runtime. CI hämtar live-specifikationerna, kontrollerar versionen, genererar typer och stoppar merge vid avvikelse.

## Lokal verifiering

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:launch
npm run api:contract
npm run test:canonical-market-flow
npm run test:customer-application
npm run test:idempotency
npm run test:portal
# Kräver GRIDEX_API_KEY och GRIDEX_STAGING_E2E_FIXTURE
npm run test:staging:ops
```

## Migration och deploy

```bash
npx supabase db push --include-all
npx vercel --prod
```

Kör staging-E2E med en tenantbunden testnyckel genom hela kedjan: context → contracts → resolution → current price → quote → validation → application → status → portal bundle. Dubbel submit ska returnera samma canonicala resultat.

Staging-fixture: `tests/fixtures/staging-ops-flow.example.json`. Kopiera den till en git-ignorerad fil och använd endast godkända testidentiteter.
