# Gridex Web – API-kompatibilitetsgranskning

Datum: 2026-07-31
Canonical kontraktsversion: `2026-07-30.3`

## Livekontrakt

Release-manifestet publicerar version `2026-07-30.3` med SHA-256:

- Website: `fdabd8196ae94482cd22928bf624b69ffe6a246e47b0781d698ec1701c80d6b2`
- Customer Portal: `93d4cb523515948dae2f168b8cab629e1ef1d8238ddb8322b8ca75aa8a46d1f9`

`PublicContract.price_options` finns på toppnivå. Canonical områdespris använder
`area_price_reference`, `price_area`, `energy_price_ore_per_kwh`,
`unit`, `valid_from` och `valid_to`.

## Webbändringar

- Canonicala områdesprisfält bevaras i den interna DTO:n.
- Legacyalias läses endast efter canonicala fält och endast som avgränsad
  kompatibilitet.
- Referensformat, positiva ändliga priser, enhet, kalenderdatum, dubbletter och
  överlappande giltighetsperioder valideras.
- Prisalternativ och områdespris måste båda vara giltiga för kundens startdatum.
- Checkout binder vald `area_price_reference` och kräver att OPS quote returnerar
  samma rad.
- Website-feed accepterar endast `channel=website`.
- Ett felaktigt avtal isoleras med maskinell kod och JSON-sökväg; övriga avtal
  fortsätter visas.
- Envelope- och tenantfel förblir hårda fel.
- OpenAPI-validering körs per avtalsrad utöver den operationstäckande
  server-side-valideringen.

## Ej verifierbart utan OPS-källkod och miljöåtkomst

Den uppladdade leveransen innehåller endast webbprojektet. OPS-serialisering,
databasvyer, migrationer, bakåtfill, låsta kommersiella versioner,
publication revision, ETag, outbox och faktisk apply kan därför inte ändras eller
redovisas som körda från denna patch.
