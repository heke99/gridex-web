# Gridex Web – canonical tenantintegration mot OPS

Gridex Web behandlas som en vanlig extern tenant och känner inte till OPS interna company-, offer- eller versions-ID:n.

## Obligatorisk miljö

```env
GRIDEX_OPS_API_URL=https://app.gridex.se
GRIDEX_WEBSITE_API_KEY=<full server-side secret>
GRIDEX_EXPECTED_TENANT_REFERENCE=<opak tenant_reference från OPS>
GRIDEX_WEBSITE_API_SCOPES=website_contracts.read,website_contracts.quote,website_contracts.diagnostics,website_customer_applications.create
GRIDEX_WEBSITE_PRICING_QUOTE_SECRET=<separat lokalt signeringshemlighet>
GRIDEX_ENABLE_OPS_WEBHOOKS=true
GRIDEX_WEBHOOK_SIGNING_SECRET=<OPS webhook secret>
```

API-nyckeln och signeringshemligheter får aldrig exponeras med `NEXT_PUBLIC_` eller skrivas i loggar.

## Canonical routes

- `GET /api/v1/integration/context`
- `GET /api/v1/website/public-contracts`
- `GET /api/v1/website/public-contracts/diagnostics`
- `POST /api/v1/website/quote`
- `POST /api/v1/website/customer-applications`

Det finns inga OPS-fallbackkedjor till alternativa energy-resolve-, quote-validation- eller diagnostics-URL:er.

## Prisflöde

1. Webbplatsen hämtar publicerade avtal med stabil `offer_reference`.
2. Kundtypen normaliseras centralt: webbens `company` blir OPS `business`.
3. Alla erbjudandebundna priser beräknas av OPS `/website/quote`.
4. OPS returnerar `quote_reference`, prisperiod, metod, marknadstidpunkt, bindningsstatus, antaganden, källor, snapshot-schema och giltighet.
5. Webbplatsen signerar exakt OPS-svaret för integritet; den beräknar inte om priset.
6. Samma `quote_reference` och `annual_consumption_kwh` skickas i kundansökan.

Elprisetjustnu får endast användas på fristående marknadsinformationssidor och aldrig som erbjudandets prismotor.

## Cache och publicering

- OPS `ETag` lagras per tenant, kanal och kundtyp.
- Nästa hämtning skickar `If-None-Match` och hanterar `304`.
- `publication_revision` skickas vidare till webbläsaren.
- `contracts.publication.changed` verifierar signatur, `tenant_reference`, event-ID, kanal och revision innan avtalscachen invalidieras.

## Go-live-kontroll

API-klienten ska vara aktiv i rätt miljö och ha minst följande scopes:

```text
website_contracts.read
website_contracts.quote
website_contracts.diagnostics
website_customer_applications.create
```

Varje synligt avtal måste ha aktiv website-publicering, aktiv version, komplett publik projection, pris, juridik och fakturaavgift.
