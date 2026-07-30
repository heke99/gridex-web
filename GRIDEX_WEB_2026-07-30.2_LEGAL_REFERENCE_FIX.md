# Gridex Web – 2026-07-30.2 legal reference fix

## Grundorsak

OpenAPI-release `2026-07-30.2` bytte den dokumentbundna juridikreferensen från
`document_id` till `document_reference` i både `WebsiteLegalRequirement` och
`LegalAcceptance`. Teckna-flödet och den interna OPS-klienten använde fortfarande
`document_id`, vilket stoppade Next.js typecheck/build.

## Utförd reparation

- juridikpaket normaliseras till `document_reference`
- kundansökan skickar `document_reference`
- browser-safe juridik-DTO exponerar inte interna dokument-ID-fält
- checkout-formuläret kräver en canonical dokumentreferens
- fullmaktens `textVersionId` hämtas från den publicerade legal-bundle-modulens
  UUID, inte från `document_reference`
- API-kontraktstestet läser versionsnumret från release-manifestet i stället för
  att hårdkoda en äldre release
- regressionskontroller har lagts till

## Miljövariabler

`GRIDEX_WEBSITE_STATE_SIGNING_SECRET` är en hemlig slumpmässig HMAC-nyckel med
minst 32 byte. Exempel:

```bash
openssl rand -base64 48
```

`GRIDEX_WEBSITE_STATE_SIGNING_KID` är inte hemlig och ska vara en stabil etikett
för aktiv nyckel, exempelvis:

```text
state-2026-07-30-v1
```

`GRIDEX_BUILD_TIMESTAMP` är inte hemlig och inte slumpmässig. Den är valfri och
ska, när den används, vara byggtid i UTC:

```bash
date -u +%Y-%m-%dT%H:%M:%SZ
```

## Kvarvarande OPS-blockerare

`ContractPriceOption` finns i Website OpenAPI och quote accepterar
`price_option_reference`, men `PublicContract` publicerar ännu inget
`price_options`-fält. OPS måste därför:

1. skapa/stabilisera externa `price_option_reference` per canonical prisalternativ
2. bygga prisalternativen från tenantens aktiva offer-, produkt-, prisplans- och
   prisversionsgraf
3. returnera `price_options` i `/api/v1/website/public-contracts`
4. returnera samma data i diagnostics för synliga erbjudanden
5. lägga till `price_options` i `PublicContract`-schemat, som array av
   `ContractPriceOption`
6. säkerställa att `area_prices` innehåller korrekta SE1–SE4-priser
7. validera samma `price_option_reference` i quote, quote validate och customer
   application
8. inkludera prisalternativet i quote/pricing snapshot, idempotency och hash
9. publicera en ny sammanhållen release där runtime-header, release-manifest,
   OpenAPI och guide har samma version

Webbens `api:compatibility` ska fortsätta blockera tills den nya OPS-releasen är
publicerad och `api:sync` har körts.
