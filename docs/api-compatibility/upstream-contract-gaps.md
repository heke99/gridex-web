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

## Quote-regler som måste bevisas i OPS runtime

Webbklienten och den incheckade OpenAPI-snapshoten behandlar nu quotes som
immutable och icke tidsbegränsade. Följande kan inte göras atomiskt eller
juridiskt auktoritativt i webb-repot och måste verifieras i OPS:

- `valid_until`/`expires_at` är nullable legacy-metadata och används inte för
  statusövergång eller avvisning.
- `requested_start_mode` och returnerat `start_date` binds i quote-snapshoten.
- quote-verifiering använder canonicala referenser, integritet,
  teckningsbarhet/revocation och konsumtionsstatus.
- quote-konsumtion och skapande av kundansökan sker i samma databastransaktion;
  misslyckade requests konsumerar inte quoten.
- samma application-idempotency returnerar samma committed ansökan, medan en
  ny ansökan med redan konsumerad quote ger `quote_already_consumed`.
- historiska juridik- och prisreferenser för en immutable quote kan verifieras
  även efter att en senare revision publicerats.

Staging-E2E är den enda godtagbara evidensen för dessa punkter. Webben har ingen
lokal prisfallback, ingen lokal konsumtionsmarkering och ingen expiry-gissning.
