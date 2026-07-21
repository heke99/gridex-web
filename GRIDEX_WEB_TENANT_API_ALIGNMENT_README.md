# Gridex Web – tenant/API-alignment 2026-07-21

## Syfte

Denna patch anpassar Gridex Web till OPS canonical avtalsmodell och gör tenant-bindningen fail-closed när `GRIDEX_EXPECTED_COMPANY_ID` är satt.

## Viktiga driftkrav

Varje tenantwebb måste ha en egen server-side API-nyckel och förväntat bolags-ID:

```env
GRIDEX_OPS_API_URL=https://app.gridex.se
GRIDEX_WEBSITE_API_KEY=<tenantens fullständiga hemliga API-token>
GRIDEX_EXPECTED_COMPANY_ID=<tenantens company UUID i OPS>
GRIDEX_WEBSITE_SOURCE=<tenantens domän, exempelvis gridex.se>
```

API-nyckeln får aldrig exponeras i browsern. Webbklienten skickar inte `company_id`; OPS löser tenant från API-nyckeln.

## Vad patchen rättar

- Stöd för canonical typerna `variable_monthly` och `variable_hourly`.
- `binding_months`, `notice_months` och `automatic_renewal` följer med från OPS till kort, checkout och snapshot.
- Företagsansökan skickar dokumenterad `customer_type=business` och `org_number`.
- Public-contracts hämtas med `diagnostics=1` server-side och verifieras mot `GRIDEX_EXPECTED_COMPANY_ID`.
- Cacheidentitet isoleras med fingerprint av OPS base URL och tenantens API-nyckel.
- Källan för kundansökan konfigureras per tenant genom `GRIDEX_WEBSITE_SOURCE`.

## När syns ett avtal?

OPS returnerar endast avtalet när samtliga krav är uppfyllda:

- canonical avtalsversion är publicerad,
- website/API-kanalen är aktiv,
- tenant assignment är aktiv,
- avtalet är datumgiltigt,
- prisversion och prislista är aktiva,
- fakturaavgift/priskomponenter är canonical och publiceringsklara,
- juridikpaketet är publicerat,
- kunden matchar avtalets kundtyp.

## Livekontroll

Kör server-side med tenantens API-token:

```bash
curl -sS "https://app.gridex.se/api/v1/website/public-contracts?customer_type=private&diagnostics=1" \
  -H "Authorization: Bearer $GRIDEX_WEBSITE_API_KEY" \
  -H "Accept: application/json" | jq
```

Kontrollera:

- `diagnostics.company_id` matchar `GRIDEX_EXPECTED_COMPANY_ID`,
- `diagnostics.result_count` är större än noll,
- önskat avtal finns i `data`,
- blockerade avtal har konkreta orsaker i `diagnostics.publication`.

Kör även med `customer_type=company` för företagsavtal.

## Verifiering

```bash
npm ci
npm run test:launch
npx tsc --noEmit --pretty false
npm run lint
npm run build
```

I patchmiljön passerade launchtesterna, separat TypeScript-kontroll och lint. Next-kompileringen och TypeScript-fasen passerade med webpack, men den isolerade containern fastnade senare i Nexts `Collecting page data`; full build ska därför bekräftas lokalt/CI med riktiga miljövariabler.
