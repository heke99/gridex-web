# Canonical quotes utan tidsbegränsning
> **Historisk och ersatt:** Denna design gällde före API-kontrakt `2026-08-02.1`. Aktuell OpenAPI kräver `valid_until`; runtime och nya databasrader följer nu canonical quote-expiry.


Datum: 2026-07-31

## Affärsregel

**Gridex quotes are not time-limited.** En quote är en immutable, reproducerbar,
revisionsbunden och juridiskt spårbar snapshot. `created_at` visar när snapshoten
skapades. `valid_until` och `expires_at` är endast deprecated legacy-metadata och
får inte avgöra kommersiell giltighet.

## Separata begrepp

1. **Quote-giltighet** – canonical referensbindning, signerad integritet,
   orderability/revocation och konsumtion verifierad av OPS.
2. **Teknisk cache** – ETag, Next.js-cache eller checkout-handoff får ha TTL men
   får inte ogiltigförklara en quote.
3. **Publiceringsstatus** – OPS avgör om ett avtal uttryckligen är återkallat
   eller inte längre teckningsbart.
4. **Prisrevision** – en senare revision ändrar aldrig en befintlig snapshot.
5. **Konsumtion** – högst en framgångsrikt committed kundansökan per quote.

## Kartlagt tidigare beteende

Före ändringen fanns aktiv tidslogik i den signerade webbquoten,
checkout-contextens retention och kundgränssnittet. Quote-parsern krävde
utgångstid, verifieringen kunde avvisa gamla timestamps, kalkylatorn kunde
nollställa state via expiry och UI visade giltighetstid. Kundtyp och startläge
hade dessutom tysta defaultvärden.

## Nytt flöde

```text
kundtyp + adress + förbrukning + startläge/datum
→ OPS energy-area resolution
→ nytt quote_attempt_id
→ OPS quote
→ signerad immutable webb-snapshot
→ teknisk checkout-handoff
→ OPS quote/validate
→ atomisk OPS customer application + quote consumption
```

`customer_type` är endast `private | business`. Aliaset `company` accepteras
endast i den centrala compatibility-boundaryn och normaliseras omedelbart till
`business`.

`requested_start_mode` är endast `earliest_possible | specific_date`.
`specific_date` kräver ett verkligt `YYYY-MM-DD`; `earliest_possible` tillåter
inte ett klientdatum. Den canonicala quotens returnerade `start_date` låses och
återanvänds i checkout och kundansökan. Ändring kräver en ny quote.

## Idempotency

Quote-nyckeln består av:

```text
website-quote:<quote_attempt_id>:<canonical request sha256>
```

Samma tekniska retry återanvänder `quote_attempt_id`. Ett nytt aktivt klick
eller ändrad canonical input skapar ett nytt UUID. Kundansökan använder en
separat nyckel bunden till hela den normaliserade ansökningspayloaden.

## Cache och lagring

Webbens checkout-token har 24 timmars teknisk retention. Den tiden är inte
quote-giltighet. Den signerade webbsnapshoten är ett transport- och
manipulationsskydd; OPS quote-reference är den auktoritativa verifieringsvägen.
Webbens cache får rensas utan att den canonicala quoten upphör.

## Databas och backfill

Migration `20260731184500_non_expiring_canonical_quotes.sql`:

- tar bort `NOT NULL` från `website_pricing_snapshots.valid_until`,
- behåller historiska tidsvärden för audit,
- skapar service-role-only auditlogg för backfill,
- tillhandahåller omkörningssäker funktion med dry-run som standard,
- återställer endast `expired`-rader utan ansökan/kontrakt och utan explicit
  invalid/revoked/consumed-status.

Backfill körs först via `supabase/backfills/20260731_non_expiring_canonical_quotes.sql`.

## Canonicala fel

Webben hanterar bland annat `quote_reference_invalid`,
`quote_validation_failed`, `quote_already_consumed`, `quote_revoked`,
`offer_unavailable`, `price_reference_invalid`, `resolution_mismatch`,
`quote_start_date_mismatch`, `quote_customer_type_mismatch` och
`idempotency_conflict`. Ett upstream-`quote_expired` behandlas endast som ett
legacy compatibility-fel och visas inte som att tiden löpt ut.

## OPS-ansvar

Webb-repot kan inte genomföra atomisk quote-konsumtion i OPS-databasen. OPS
måste garantera att konsumtion och kundansökan commit:as i samma transaktion,
att misslyckade försök inte konsumerar quoten och att historiska pris- och
juridikreferenser kan verifieras efter senare publiceringar.
