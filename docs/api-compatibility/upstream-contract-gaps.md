# Gridex OPS – kvarvarande runtime- och miljögrindar

Datum: 2026-08-01
Granskad kontraktsversion: `2026-08-01.1`

## Stängda webbgap

Webbklienten följer nu de lokalt incheckade Website- och Customer Portal-
specifikationerna för publication webhook, public contracts, quote,
quote-validation, customer sync och move-out. Stale cache får inte maskera
kontraktsfel och immutable avtalsjuridik används genom hela checkouten.

## Måste verifieras i OPS/staging

Följande kan inte bevisas av webb-repot ensamt:

- OPS runtime serialiserar samma required canonical fält som publicerad OpenAPI.
- Website-publicerade avtal har exakt ett canonical `is_default`, fullständiga
  price-option-fält och konsekventa immutable legal snapshots.
- Publication outbox skickar route-specifik body, monotona revisioner och
  godtyckliga textbaserade revision tokens.
- Full avpublicering ger en ny auktoritativ publication revision och tom feed.
- Quote och quote-validation returnerar required `valid_until`, echoed input,
  samtliga komponentreferenser, resolver-/geodataversion, market reference,
  energy direction och selected area price.
- Kundansökan och quote-konsumtion är atomiska och idempotenta.
- Customer Portal-mutationerna returnerar canonical envelope med separat
  request/correlation/trace-spårbarhet där fälten finns.
- Bakåtfill och de nya Supabase-migrationerna är applicerade i varje miljö.

## Godtagbar evidens

```text
live OpenAPI checksum + runtime contract tests
publication webhook integration test
public contract → resolution → quote → validation → application staging-E2E
customer sync + move-out staging-E2E
Supabase migration history + post-migration SQL checks
```
