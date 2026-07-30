# Gridex Web ↔ Gridex OPS

Canonical kontraktsversion: `2026-07-30.1`.

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

`npm run api:sync` hämtar release-manifestet först och verifierar SHA-256 över
specifikationernas exakta råa bytes. Båda specifikationerna måste ha samma
version och matcha manifestets hash innan de ersätter lokala filer atomiskt.
Typer, manifest, semantisk diff och lokala kontroller genereras därefter.

En distribuerad snapshot har avsiktligt `live_sync_verified=false`. Mottagande
miljö måste köra `npm run api:sync` för ett nytt livebevis.

## Checkout

```text
integration/context
→ public-contracts
→ energy-area/resolve
→ quote
→ legal-bundle
→ quote/validate
→ customer-applications
```

Kundens val av `price_option_reference`, `invoice_delivery_method`,
`selected_component_references` och `site_count` verifieras mot det publicerade
avtalet, skickas till OPS och binds i webbens signerade offerttoken. Checkout
återskapar valen från signaturen, inte från ändringsbara formulärfält.

OPS OpenAPI `2026-07-30.1` definierar offertfälten och
`ContractPriceOption`, men publicerar inte `price_options` på
`PublicContract.pricing`. Detta rapporteras som
`public_contract_price_options_not_published` och blockerar full readiness
tills OPS-specifikationen är komplett.

Kundansökan binder även den signerade fullmakten och en full metering-point-modell
när avtalet och anläggningen kräver det.

## Juridik

Legal bundle hämtas dynamiskt för valt `offer_reference` och hämtas på nytt före
submit. Kravkoder, dokument-ID, version, SHA-256, bundle-version och faktisk
acceptanstid bevaras i det immutabla beviset. Webben har ingen lokal fallbacklista
med juridikkoder och skickar endast acceptanser som kunden faktiskt har lämnat.

## Kundportal

Portalidentitet kommer från den verifierade Supabase-sessionen. Tomma
identifierare skickas inte som `null`. Alla affärsdata i portalöversikten kommer
från OPS `portal-bundle`; saknad OPS-profil eller transportfel stänger flödet i
stället för att visa lokal data som om den vore aktuell.

Move-out skickar `requested_move_out_date` på requestens toppnivå och validerar
ett verkligt kalenderdatum. Övrig utflyttningsdata ligger under `data`.
`customer/sync` och övriga writes är idempotenta och följer den publicerade
requestmodellen.

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
