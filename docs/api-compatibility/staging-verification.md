# Stagingverifiering – Gridex Web / Gridex OPS

Den här checklistan ska köras efter `npm run api:sync`, applicerade migrationer och konfigurerade staginghemligheter. Inga personnummer, API-nycklar, fullständiga kundpayloads eller webhookhemligheter får sparas i rapporten.

## Förkrav

```bash
npm ci
npm run api:sync
npm run db:migrations:check
npm run typecheck
npm run lint
npm test
npm run build
```

Verifiera även:

- staging-API-nyckel med avsedda scopes,
- unik stagingtenant,
- `GRIDEX_WEBHOOK_SIGNING_SECRET` minst 32 bytes,
- `WEBHOOK_RETRY_CRON_SECRET` eller `CRON_SECRET`,
- applicerad `20260729131000_ops_webhook_domain_projections.sql`,
- `GRIDEX_DATABASE_MIGRATIONS_READY=true` först efter kontroll i databasen,
- `GRIDEX_WEBHOOK_PROJECTIONS_READY=true` först efter lyckad webhooktest.

## Evidensformat per steg

```text
Steg:
Endpoint:
Request ID:
Kontraktsversion:
Verifierad tenant_reference:
HTTP-status/resultat:
Felkod:
Idempotency key-hash (inte klartext):
Tidpunkt:
Kommentar:
```

## 1. Integration context

- Anropa `GET /api/v1/integration/context`.
- Kontrollera API-nyckel, tenant, contract version och capability/scopes.
- Negativt test: ogiltig nyckel ska ge 401.

## 2. Public contracts

- Hämta privata och företagsavtal.
- Kontrollera att endast website-publicerade, aktiva och datumgiltiga offer visas.
- Kontrollera ETag och 304 utan att blanda tenants.

## 3. Diagnostics

- Anropa diagnostics med avsett scope.
- Verifiera att blockerare och publiceringsrevision hör till rätt tenant.

## 4. Energy-area resolution

- Lös en stagingadress för SE1–SE4.
- Kontrollera canonical `resolution_id`, område och nätägare.
- Negativt test: modifierad/ogiltig request ska stoppas.

## 5. Quote

- Skapa quote från canonical offer och resolution.
- Kontrollera top-level `quote_reference`, `offer_reference`, resolution,
  `customer_type`, `requested_start_mode`, canonicalt `start_date` och
  prisreferenser.
- Verifiera att svar helt utan `valid_until` accepteras.
- Verifiera att ett legacy-`valid_until` i dåtid inte ensamt avvisar quoten.
- Samma `quote_attempt_id` + samma payload ska ge samma idempotenta resultat.
- Samma payload + nytt `quote_attempt_id` ska tillåta ett nytt quote-försök.
- Kontrollera att UI saknar nedräkning, expiry-text och timerbaserad reset.

## 6. Quote validation

- Validera quote precis före ansökan.
- Kontrollera offer-, resolution-, kundtyp-, startdatum-, prisalternativ- och
  områdesprisbindning.
- Publicera en senare prisrevision och verifiera att den äldre immutable quoten
  inte avvisas enbart på grund av revisionens ålder.
- Verifiera canonicala fel för explicit revocation/orderability och konsumtion.
- Samma key + ändrad payload ska ge konflikt.
- Rensa webbens checkout/cachepost och verifiera quoten direkt via OPS-referens.

## 7. Legal bundle

- Hämta bundle för valt offer.
- Spara endast version, hash och opaque dokumentreferens som evidens.
- Verifiera att den immutable quotens dokumentreferenser, versioner och
  SHA-256 bevaras. En uttryckligt återkallad juridikversion ska stoppas av OPS;
  enbart publicering av en senare revision får inte tyst skriva om quoten.

## 8. Kundansökan som gäst

- Skapa ansökan utan auth-ID.
- Kontrollera customer/application/contract references och inga dubbletter vid retry.
- Verifiera att fel tenant/offer/quote/resolution stoppas.
- Verifiera atomiskt att första committed ansökan konsumerar quoten, samma
  application-idempotency returnerar samma ansökan och en ny idempotency-nyckel
  med samma quote ger `quote_already_consumed`.

## 9. Kundansökan som inloggad kund

- Läs Supabase `session.user.id` server-side.
- Skicka samma värde som båda portal-ID-fälten när OPS-kontraktet stödjer det.
- I nuvarande version ska flödet stoppa tydligt som upstream-blockerat, inte tyst efter-synka.

## 10. Atomisk portalidentitet

- Efter OPS-kontraktsfix: verifiera i en transaktion att portal account/identity och ansökan hör ihop.
- Retry får inte skapa annan portalidentity eller dubbel owner-relation.

## 11. Portal bundle

- Anropa server-side med båda authheaders och stabil kundnyckel.
- Kontrollera profil, avtal, sites, fakturor, dokument, juridik, fullmakter, notiser och events.
- Schemafel får inte visas som tomt, komplett eller authoritative resultat.

## 12. Current market price

- Anropa med canonical resolution.
- Kontrollera `current_interval`, samtliga inkluderingsflaggor, request ID och version.
- `is_stale=true`, fallback eller fel resolution ska stoppas.
- Priset får inte visas som komplett kundpris.

## 13. Portfolio history

- Hämta final historik för portfoliooffer.
- Kontrollera `method`, `historical_final_prices` och `locked_settlement_only`.
- Kontrollera att interna ID:n inte exponeras.
- Steget kan inte markeras strikt godkänt före OPS-schemafix.

## 14. Switch status

- Verifiera dokumenterad website route med application number.
- Kontrollera att portalens status kommer från bundle/events och att ingen odokumenterad portalroute anropas.

## 15. Webhook delivery

- Skicka ett officiellt signerat stagingevent.
- Verifiera event ID, event type, delivery ID, timestamp, raw-body HMAC och tenant.
- Fel signatur, gammal timestamp och header/payload-mismatch ska avvisas.

## 16. Webhook projection

- Testa publication changed och minst ett dokumenterat domänevent.
- Kontrollera durable status, cacheinvalidering, notification/projection och audit.
- Dubblett ska inte skapa dubbla rows eller notiser.

## 17. Idempotent retry/dead-letter

- Framkalla ett retrybart projektionfel.
- Kör `/api/internal/webhooks/retry` med cronhemlighet.
- Kontrollera backoff, attempt count, max attempts och `dead_letter_at`.
- Identifierarkonflikt ska vara permanent och aldrig automatiskt återförsöka.

## 18. Tenant isolation

- Kör samma opaque referens/identity mot två stagingtenants.
- Verifiera att API-nyckeln alltid avgör bolag.
- Klientskickad `company_id` eller fritt `customer_id` får inte kunna välja tenant/kund.
- Kontrollera att portaldata, events, invoices och webhooks inte korsar tenantgräns.

## Slutgrind

Markera inte `full_api_compatibility_ready=true` förrän samtliga steg är godkända, live-snapshots är synkroniserade, strict compatibility-kommandot passerar och alla OPS-kontraktsluckor är stängda.
