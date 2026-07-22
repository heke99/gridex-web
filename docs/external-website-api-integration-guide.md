# Extern website-tenant – integrationskontrakt

Denna webbplats är en extern API-konsument. OPS äger tenantidentitet, publicering, prisberäkning och den slutliga kundansökan.

## Identitet

`GRIDEX_EXPECTED_TENANT_REFERENCE` ska matcha den opaka `tenant_reference` som returneras av `GET /api/v1/integration/context` eller relevant svar-meta. Mismatch, saknad referens eller okonfigurerad referens stoppar integrationen. Ett internt `company_id` används inte som externt kontrakt.

## Kundtyp

Webbens värden är `private | company`. Vid OPS-gränsen används exakt en normalisering:

```ts
company -> business
private -> private
```

Samma normalisering används för avtalslista, diagnostics, quote och kundansökan.

## Routes och scopes

| Metod | Route | Scope |
|---|---|---|
| GET | `/api/v1/integration/context` | integrationskontext |
| GET | `/api/v1/website/public-contracts` | `website_contracts.read` |
| GET | `/api/v1/website/public-contracts/diagnostics` | `website_contracts.diagnostics` |
| POST | `/api/v1/website/quote` | `website_contracts.quote` |
| POST | `/api/v1/website/customer-applications` | `website_customer_applications.create` |

Diagnostics körs endast server-side. Odokumenterade eller alternativa OPS-routes får inte provas som fallback.

## Quote

Webbplatsen skickar minst:

```json
{
  "offer_reference": "offer_...",
  "customer_type": "business",
  "price_area": "SE3",
  "annual_consumption_kwh": 12000,
  "postal_code": "11122",
  "city": "Stockholm",
  "address": "Exempelgatan 1",
  "grid_area_code": "...",
  "start_date": "2026-09-01"
}
```

OPS-svaret måste innehålla strukturerat:

```text
quote_reference
pricing_interval
estimate_method
source_period
market_data_timestamp
is_binding
assumptions
market_sources
pricing_snapshot_schema_version
valid_until
```

Marknadsbundna erbjudanden får inte beräknas lokalt. En lokal HMAC signerar endast den exakta OPS-quote som visades.

## Kundansökan

Ansökan skickar samma:

```text
offer_reference
quote_reference
annual_consumption_kwh
price_area_code
postal_code
address
site/grid/metering-data
customer_type
requested_start_date
```

Webbplatsen får inte hämta en ny quote och ersätta den visade offerten under inskickningen. OPS validerar referensen och skapar den bindande snapshoten.

## Cache och webhook

Public-contracts använder OPS `ETag`, `If-None-Match`, `304` och `publication_revision`. Tidsbaserad cache ensam är inte tillräcklig.

Webhooktypen `contracts.publication.changed` ska:

1. verifiera HMAC och timestamp;
2. verifiera `tenant_reference`;
3. deduplicera `event_id`;
4. kräva `channel=website` och `publication_revision`;
5. invalidiera avtalscachen;
6. markera eventet behandlat och svara 2xx.

API-nycklar, secrets och hela Authorization-headern får aldrig loggas.

## Mina sidor identity rules

Portalidentiteten kopplas server-side med OPS kund-/portalreferenser. Webbläsaren väljer aldrig tenant eller kund genom internt UUID, och kundidentitet hämtas inte från osignerade klientfält.

## Fullmakt

När avtalet kräver fullmakt skickas den signerade `powerOfAttorney`-strukturen tillsammans med acceptanstid, textversion, omfattning och signerande person i kundansökan.
