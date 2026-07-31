# Gridex OPS – kontraktsstatus

Datum: 2026-07-31
Granskad kontraktsversion: `2026-07-30.3`

## Resultat

Live release-manifest och incheckad OpenAPI är synkroniserade. `PublicContract`
deklarerar canonical `price_options` på toppnivå och varje
`ContractPriceOptionAreaPrice` kräver:

```text
area_price_reference
price_area
energy_price_ore_per_kwh
unit = ore_per_kwh
valid_from
valid_to
```

Det tidigare gapet `public_contract_price_options_not_published` är därför
stängt och får inte längre användas som releaseblockerare.

## Kvarvarande miljögrindar

Följande kan inte bevisas av webb-repot ensamt:

- OPS runtime måste serialisera samma form som live OpenAPI.
- Website-publicerade avtal måste ha canonicala prisalternativ och områdesrader.
- Bakåtfill, publication revision, ETag, outbox och cacheinvalidering måste
  verifieras i OPS-databasen.
- Stagingflödet public contract → resolution → quote → quote validation →
  customer application måste köras med riktig tenantnyckel.

Webben blockerar nu endast den felaktiga avtalsraden och fortsätter använda
övriga giltiga website-avtal. Envelope- eller tenantfel blockerar fortfarande
hela svaret.
