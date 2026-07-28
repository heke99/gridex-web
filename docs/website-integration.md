# Gridex Web ↔ OPS

Verifierad maskinläsbar kontraktsversion: `2026-07-28.1`.

## Kontraktsgräns

OpenAPI-snapshots:

```text
docs/openapi/website-integration-v1.json
docs/openapi/customer-portal-v1.json
docs/openapi/manifest.json
```

`GRIDEX_API_CONTRACT_VERSION` i `lib/ops/contract.ts` är enda importerbara
versionskällan. Klienten skickar inte
`X-Gridex-Accept-Contract-Version`. Responseheadern
`X-Gridex-Contract-Version` kontrolleras bara på operationer där OpenAPI
deklarerar den; övriga operationer verifieras med strikt runtimevalidering av
response body.

Transporten blockerar redirects, begränsar retry till säkra eller idempotenta
operationer och skickar aldrig API-nyckeln till en icke allowlistad origin.

## Checkout och juridik

Webb-BFF ligger under `/api/checkout/*`. Canonical OPS-paths används endast
utgående server-side.

Legal bundle hämtas med obligatorisk, opak `offer_reference`. UI byggs från
returnerade `required_types` och dokumentversioner. Servern hämtar bunten på
nytt före submission och blockerar om bundle-versionen ändrats, om ett
obligatoriskt dokument saknas eller om en required typ inte kan uttryckas av
`CustomerApplicationRequest`.

Immutable ansökningsbevis innehåller bundle-version, requirement code,
dokument-ID, dokumentversion, hash och acceptance state. `accepted_at` lagras
på samma rad. Endast de fem fält som nuvarande OpenAPI tillåter serialiseras
till `legal_acceptances`.

Kundansökan skickar de canonicala optionalfälten för fakturering,
`current_supplier_unknown` och full metering-point-modell. Det borttagna
`current_supplier_id` och portalens auth-ID:n skickas inte eftersom de saknas i
OpenAPI. `application_business_conflict` förblir konflikt; endast uttryckligt
`duplicate_application` kan återuppta ett identiskt resultat.

## Kundportal

Granulära webbroutes anropar exakt motsvarande OPS-route:

```text
/api/web/customer/invoices/:id
→ GET /api/v1/customer/invoices/{id}
```

Invoice-ID är opakt. Ingen matchning görs mot fakturanummer, OCR,
betalreferens eller lagringssökväg. Portal-bundle används en gång för en hel
sidvy och får endast falla tillbaka till lokal read model vid transient fel.
Fallback är tekniskt read-only och får inte driva writes.

Alla writes kräver `client_operation_id` som skapas före första browseranropet.
Servern skapar inte ett nytt UUID och returnerar inte lokal outbox-status som
framgång när OPS är otillgängligt.

## Webhook

Canonical endpoint:

```text
POST /webhooks/contracts.publication.changed
```

Följande headers krävs utan aliases:

```text
x-gridex-event-id
x-gridex-delivery-id
x-gridex-timestamp
x-gridex-signature
```

HMAC-SHA256 verifieras constant-time över exakt
`${timestamp}.${rawBody}` före JSON-parse. Därefter valideras OpenAPI-schema,
root/data/integration-tenant, event-ID och revisionsdata.

Databasfunktionen `apply_ops_publication_event` serialiserar per
tenant+kanal, deduplicerar event och delivery, jämför payloadhash, ignorerar
äldre numeriska revisioner och tillämpar `revision_token`. Andra kanaler lagras
och kvitteras med 2xx utan website-cacheinvalidering. Den gamla
`/api/ops/webhooks` svarar `410 Gone`.

## Upstreammotsägelser

### Legal scope

- Guide: `website_legal.read` eller `website_contracts.read`.
- OpenAPI `2026-07-28.1`: endast `website_legal.read`.
- Runtime: följer OpenAPI och readiness kräver `website_legal.read`.
- Föreslagen OPS-ändring: uppdatera guiden, eller versionsbumpa OpenAPI med en
  explicit alternativ scope-regel.

### Dynamisk juridik

- Guide: juridikmoduler kan vara dynamiska.
- OpenAPI: application request har fem fasta booleanfält och
  `additionalProperties: false`.
- Runtime: okända required moduler blockeras fail-closed.
- Föreslagen OPS-ändring: lägg till en versionerad
  `legal_acceptances[]`-modell med requirement code, dokument-ID/version/hash,
  bundle-version och accepted-at, eller begränsa legal-bundle till de fem
  requestfälten.

### Atomisk portalidentitet

- Guide nämner `customer_portal_user_id`/`auth_user_id`.
- OpenAPI saknar båda i `CustomerApplicationRequest`.
- Runtime skickar dem inte och använder idempotent portal-sync som
  reconciliation.
- Föreslagen OPS-ändring: lägg explicit nullable portal identity i request och
  definiera dess atomiska transaktionssemantik.

Webben implementerar inga odokumenterade workaroundfält för dessa tre fall.
