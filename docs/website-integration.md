# Gridex Web ↔ Gridex OPS

Canonical kontraktsversion: `2026-08-04.2`.

Gridex Web är en extern OPS-klient. `GRIDEX_API_KEY` väljer tenant server-side;
webben skickar inte `company_id` och har ingen parallell lokal affärskälla.

## OpenAPI och releasekedja

Följande filer är maskinella kontraktssnapshots:

```text
docs/openapi/website-integration-v1.json
docs/openapi/customer-portal-v1.json
docs/openapi/manifest.json
docs/openapi/release-manifest.json
docs/openapi/verification-status.json
```

Officiell release och förväntade rå-byte-hashar:

```text
Website SHA-256:       8c1bc549b4b874ce66e8b68793cafb16184d1a70214ea980f2b4bed8b2583ec6
Customer Portal SHA:   b28e73ee068619e2677d966d3bd4be82a95d926c6e347c60e59df080ff94d95d
```

Den distribuerade zippen innehåller de byteidentiska, hashverifierade
releasefilerna för `2026-08-04.2`. `npm run api:sync` hämtar framtida releaser,
regenererar typer och validatorer och uppdaterar hashkonstanterna atomiskt.

`npm run api:sync` hämtar release-manifestet först och verifierar SHA-256 över
specifikationernas exakta råa bytes. Båda specifikationerna måste ha samma
version och matcha manifestets hash innan de ersätter lokala filer atomiskt.
Typer, validatorer, manifest, semantisk diff och lokala kontroller genereras
därefter.

`verification-status.json` dokumenterar vilken release som verifierades och
vilka rå-byte-hashar som låg till grund för genererade typer.

## Checkout och canonical sanningskällor

```text
integration/context
→ public-contracts (inklusive immutable legal snapshot)
→ energy-area/resolve
→ quote
→ quote/validate
→ customer-applications
```

Kunden väljer inte `price_option_reference`, `invoice_delivery_method`,
`selected_component_references` eller `site_count`. Webbservern väljer exakt ett
OPS-publicerat standardprisalternativ, skickar inga kundvalda pristillägg och
låser `site_count=1`. Fakturering styrs av Gridex policy: Kivra prövas först i
downstream billing och nuvarande OPS-API representerar fallbacken som
`invoice_delivery_method=e_invoice`. Alla serverägda värden binds i den
signerade pris-tokenen och återanvänds oförändrade i kundansökan.

Webbens resolver använder `resolution_id`, `price_area`, `grid_area_code` och
`grid_owner_name` från OPS. Resolverkontraktet publicerar inte ett internt
`grid_owner_id`; webben får därför inte skapa eller förvänta sig ett sådant ID.
OPS löser intern nätägare från canonical `grid_area_code` när ansökan behandlas.

`resolution_status` är inte en readiness-regel. Pris och offert får fortsätta
endast när `capabilities.pricing_ready` respektive `capabilities.quote_ready` är
true och `price_area_assurance` är strukturellt konsekvent. En
`postal_suggested`-resolution kan därför vara giltig för SE-prissättning samtidigt
som anläggningsuppslag, leverantörsbyte och EDIFACT fortsatt är blockerade.
`price_area_assurance` binds i den signerade resolution-tokenen och sparas i
webbens revisionsspår; klienten får inte härleda assurance från ett eget
confidence-tröskelvärde.

## Quote-giltighet, startdatum och idempotency

`valid_until` är ett obligatoriskt canonical response-fält i API-version
`2026-08-04.2`. Webben kräver ett giltigt date-time-värde i quote- och
quote-validation-svaret och bevarar det i snapshoten. Kundgränssnittet använder
inte en egen lokal nedräkning som ensam affärsregel; OPS quote-validation,
teckningsbarhet, revocation och konsumtionsstatus är auktoritativa vid submit.

Giltighetskontrollen binder minst:

- `quote_reference`, `offer_reference`, `resolution_id` och `valid_until`,
- echoed quote-input och startdatum,
- `price_option_reference`, `area_price_reference` och vald områdesprisrad,
- fakturametod, valda/obligatoriska/villkorade komponentreferenser och `site_count`,
- `resolver_version`, `geodata_version`, `market_reference` och `energy_direction`,
- OPS-verifierad integritet, teckningsbarhet och uttrycklig revocation.

Kunden väljer `earliest_possible` eller `specific_date` före prisberäkningen.
Ogiltiga eller saknade canonical värden får aldrig normaliseras tyst. Ändrad
kundtyp, resolution, avtal, förbrukning eller startuppgift rensar den aktuella
pris-tokenen och nästa aktiva klick skapar ett nytt `quote_attempt_id`.

Quote-idempotency använder `quote_attempt_id` tillsammans med hash över den
canonicala requesten. Samma tekniska retry återanvänder nyckeln; ett nytt
användarförsök får en ny nyckel. Kundansökan har en separat idempotency-nyckel
bunden till hela den normaliserade ansökningspayloaden.

Checkout-contextens retention är endast en teknisk handoff-TTL. OPS måste kunna
verifiera en quote via `quote_reference` efter att webbens handoffpost har
rensats.

## Avtal, prisalternativ och juridik

`PublicContract.price_options` är canonical på toppnivå. Varje prisalternativ
måste ha samtliga required-fält och exakt ett alternativ ska ha
`is_default=true`. `default` läses endast som deprecated kompatibilitetsalias och
får inte ersätta ett saknat canonical `is_default`.

Ett fel i en avtalsrad isolerar den raden; envelope-, tenant-, versions- och
publiceringsfel blockerar hela operationen. Nullable juridik-URL eller explicit
`legal_bundle_reference: null` gör inte i sig att ett publicerat avtal försvinner.
Visningsbarhet och online-teckningsbarhet rapporteras separat.

Kundansökan binder en separat signerad fullmakt och en full metering-point-modell när avtalet eller anläggningen kräver det.

Det immutable `PublicContract.legal` som följde med vald publiceringsrevision är
enda juridiska sanningskälla genom hela checkouten. Webben gör ingen separat
`legal-bundle`-hämtning efter avtalsvalet. Kravkoder, dokumentreferenser,
versioner, SHA-256, bundle-version och faktisk acceptanstid bevaras i det
immutabla beviset.

## Publiceringswebhook och cache

`/webhooks/contracts.publication.changed` använder den route-specifika
`PublicationChangedWebhook`-modellen. Obligatoriska headers är:

```text
x-gridex-event-id
x-gridex-delivery-id
x-gridex-timestamp
x-gridex-signature
```

`event_type` läses från body. En frivillig `x-gridex-event-type` får jämföras men
är inte ett routekrav. `revision_token` lagras som `text`, publication revision
appliceras monotont och cache/revalidation sker först efter durable apply.

Persistent avtalscache får endast användas när tenant, kontraktsversion,
parser-version, OpenAPI-checksumma och maximal snapshotålder matchar. Ett
schemafelaktigt, partiellt eller tillfälligt misslyckat svar får aldrig ersätta
last-known-good; ett tidigare verifierat snapshot kan användas som degraderad
läsning. Tenant-/authfel får däremot aldrig döljas med fallback, och ett stale
snapshot får inte svara `304 Not Modified`.

Full avpublicering godtas endast från ett validerat `canonical_empty`-svar med
komplett `empty_feed_authorization`: `authorized=true`, tillåten reason,
revision som exakt matchar `publication_revision`, canonical source
`canonical_public_contract_delivery_readiness_v` samt strängarrayer för berörda
offerter och blockers. Fritext eller enbart tom array räcker aldrig.

## Kundportal och kundansökan

Den slutliga kundansökan får inte skickas anonymt. Kunden måste först ha en
verifierad Supabase Auth-session. Samma verifierade UUID skickas obligatoriskt i
`CustomerApplicationRequest.customer_portal_user_id` och
`CustomerApplicationRequest.auth_user_id`. Webbflödet stoppar därför anonym
submit och återför kunden till den bevarade offerten efter inloggning eller
registrering.

För efterföljande kundportalanrop kommer portalidentiteten från samma verifierade
Supabase-session. UUID:t skickas i både `x-gridex-customer-portal-user-id` och
`x-gridex-auth-user-id`, och i sync-body som `customer_portal_user_id` respektive
`auth_user_id`. `external_customer_id` är en stabil extern identitet och får inte
ersättas med kundnummer; kundnummer skickas separat när det finns.

Portalens canonicala `customer_status.supplier_switch.can_dispatch` styr om
leverantörsbytet kan startas. `can_start_switch` läses endast som deprecated
fallback för äldre svar.

`CustomerSyncRequest` är en stängd toppnivåmodell:

- `facility_data` är en array,
- `power_of_attorney`, `legal_acceptances` och `documents` ligger på toppnivå,
- inget generiskt `data`-objekt skickas.

Move-out skickar både `facility_reference` och `requested_move_out_date` på
requestens toppnivå. Response-envelope mappas från `data`, och `request_id`,
`correlation_id`, `trace_id` samt kontraktsversion bevaras separat för support
och revision.

## Runtime-validering

Okända additiva properties kan rapporteras som kompatibilitetsvarning. Följande
är blockerande:

- saknat required-fält,
- fel typ, enum, format eller const,
- fel eller saknad kontraktsversion,
- tenant-mismatch,
- ogiltigt response-envelope.

Avtalslokala semantiska fel blockerar endast den berörda avtalsraden. Operationens
envelope- och identitetsfel blockerar hela operationen.

## Verifiering

```bash
npm run api:sync
npm run api:check:local
npm run api:check:live
npm run api:contract
npm run api:compatibility
npm run db:migrations:check
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run api:compatibility:known-gaps` rapporterar upstream- och miljögap utan
att maskera dem. `npm run api:compatibility` ska passera före produktion.
