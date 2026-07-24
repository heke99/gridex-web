# Gridex Web – implementation 2026-07-24.1

Gridex Web använder OPS API-nyckeln som enda tenantkonfiguration. Tenantens opaka `tenant_reference` hämtas och verifieras genom `GET /api/v1/integration/context`; inget `company_id`, tenant-ID eller manuellt tenantvärde skickas av webbplatsen.

## Canonical checkout

1. Hämta publicerade avtal från OPS.
2. Lös adressen genom `POST /api/v1/website/energy-area/resolve` och spara `resolution_id` i en kortlivad signerad servertoken.
3. Skapa quote genom `POST /api/v1/website/quote` med endast `resolution_id`, `offer_reference`, årsförbrukning, kundtyp och eventuellt startdatum.
4. Visa OPS-quoten utan lokal omräkning. OPS äger energipris, avgifter, rabatt, moms och `market_reference`.
5. Validera `quote_reference` genom `POST /api/v1/website/quote/validate` före checkout och före ansökan.
6. Skicka kundansökan med det dokumenterade payloadformatet. `quote_reference` skickas inte i ansökan och `legal_acceptances` skickas inte som odokumenterat top-level-fält.

## Konfiguration

Obligatoriskt för OPS-integrationen:

```env
GRIDEX_WEBSITE_API_KEY=<full API key>
```

`GRIDEX_OPS_API_URL` är valfri och har standardvärdet `https://app.gridex.se`. Readiness verifierar de verkliga endpointsen och kräver inga manuella scope-listor. Webhooks kräver endast separat signing secret när webhookmottagning är aktiverad.
