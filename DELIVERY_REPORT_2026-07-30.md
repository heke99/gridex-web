# Leveransrapport 2026-07-30

## Resultat

Gridex Web är uppdaterad mot OPS `2026-07-30.1`. OpenAPI-synken verifierar
manifestets SHA-256 över exakta bytes, portalens affärsdata är OPS-only och
offertvalen bevaras från kalkylator till signerad checkout.

## Viktiga ändringar

- rå-byte-hashning och atomisk OpenAPI-synk,
- regenererade Website- och Customer Portal-kontrakt,
- strikt portalidentitet utan `null`-identifierare,
- ingen lokal portaldatafallback,
- toppnivåbaserad move-out med verklig kalenderdatumkontroll,
- dynamiska juridikkrav utan lokal fallbacklista,
- signerad bindning av prisalternativ, fakturasätt, komponentreferenser och
  `site_count`,
- readiness-gap när `price_options` saknas i public-contract-schemat.

## Lokal verifiering

```text
typecheck                         PASS
lint                              PASS
test:launch                       PASS
api:check:local                   PASS
db:migrations:check               PASS
api:compatibility:known-gaps      PASS med rapporterad blockerare
```

## Extern blockerare

OPS OpenAPI definierar `ContractPriceOption` men publicerar inte
`price_options` på `PublicContract`. Full kompatibilitet är därför `NO-GO`
tills specifikationen har rättats och målmiljön har kört:

```bash
npm run api:sync
npm run api:preflight
```
