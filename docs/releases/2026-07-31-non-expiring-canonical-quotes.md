# Release: icke tidsbegränsade canonical quotes

Datum: 2026-07-31

## Ändrat

- Tog bort tidsbaserad quote-validering och expiry-UI.
- Gjorde `valid_until`/`expires_at` nullable legacy-metadata.
- Band strikt kundtyp, startläge och canonicalt startdatum i signerad quote.
- Införde `quote_attempt_id` för att skilja teknisk retry från nytt kundförsök.
- Separerade teknisk checkout-TTL från kommersiell quote-giltighet.
- Tog bort lokal invalidation enbart på grund av senare publication/legal
  revision; OPS avgör explicit revocation och orderability.
- Lade till säker migration, auditerad dry-run/backfill och regressionstester.
- Uppdaterade OpenAPI, genererade klienttyper, integrationsguide,
  endpointmatris och stagingchecklista.

## Databas

Applicera `20260731184500_non_expiring_canonical_quotes.sql`. Kör därefter
backfillfilens dry-run, granska räknare och fel, och kör först sedan
`p_dry_run => false` med ett nytt `run_id`.

## Stagingkrav

Staging måste bevisa att OPS accepterar quote utan `valid_until`, ignorerar ett
legacyvärde i dåtid, verifierar quote efter rensad webb-cache och konsumerar
quoten atomiskt med kundansökan.
