# Gridex Web – OPS website contract 2026-07-24.1

## Genomfört

Integrationen använder nu API-nyckeln som enda tenantkonfiguration och följer ett enda OPS-bundet checkoutflöde:

```text
OPS public-contracts
→ OPS energy-area/resolve
→ signerad resolution_id-token
→ OPS quote
→ signerad och sanerad browser-quote
→ OPS quote/validate
→ dynamiska consents
→ idempotent customer-applications
→ website switch-status
```

Viktigaste ändringarna:

- Kontraktsversionen är `2026-07-24.1`.
- `GRIDEX_WEBSITE_API_KEY` väljer tenant; `tenant_reference` verifieras dynamiskt genom integration context.
- Inga manuella tenant-ID:n, company-ID:n eller scope-listor krävs i miljön.
- OPS `resolution_id` används som enda bindande elområdesreferens.
- Quote-requesten innehåller endast dokumenterade fält: `resolution_id`, `offer_reference`, `annual_consumption_kwh`, `customer_type` och valfritt `start_date`.
- OPS äger energipris, avgifter, moms och indikativ `market_reference`; Gridex Web räknar inte en konkurrerande checkout-quote.
- Kundansökan skickar inte `quote_reference` eller top-level `legal_acceptances`.
- Juridiska godkännanden skickas dynamiskt som `consents`, med valfri dokumenterad `powerOfAttorney`.
- Readiness provar de riktiga endpointsen och härleder behörighet från API-svaren.
- Webhookmottagaren verifierar HMAC, tidsstämpel och deduplicering; tenantreferens verifieras endast när eventet innehåller den.
- Gamla lokala resolver-, marknadspris- och komponentmotorer är borttagna från checkoutflödet.
- Next.js route-konfiguration deklareras lokalt och återexporteras inte.

## Borttagna konfigurationskrav

Följande variabler används inte längre:

```text
GRIDEX_OPS_APPLICATION_QUOTE_REFERENCE_MODE
GRIDEX_EXPECTED_TENANT_REFERENCE
GRIDEX_OPS_APPLICATION_LEGAL_ACCEPTANCES_MODE
GRIDEX_WEBSITE_API_SCOPES
GRIDEX_CUSTOMER_PORTAL_API_SCOPES
GRIDEX_CUSTOMER_PORTAL_REQUIRED_SCOPES
```

Minimal OPS-konfiguration:

```env
GRIDEX_WEBSITE_API_KEY=<fullständig API-nyckel>
```

Valfri URL-override:

```env
GRIDEX_OPS_API_URL=https://app.gridex.se
```

Webhooks kräver separat signing secret endast när mottagning aktiveras:

```env
GRIDEX_ENABLE_OPS_WEBHOOKS=true
GRIDEX_WEBHOOK_SIGNING_SECRET=<hemlighet>
```

## Databas

Ny migration:

```text
supabase/migrations/20260724190000_ops_website_contract_20260724_1.sql
```

Den introducerar canonical `ops_resolution_id`, backfyller den äldre referensen och lägger ett unikt partiellt index för revisionsspåret.

## Verifiering

Kör efter synk:

```bash
npm ci
npm run test:launch
npm run lint
npx tsc --noEmit --pretty false
npm run build
npx supabase db push
```
