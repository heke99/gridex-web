# Gridex Web – API-kompatibilitetsgranskning

Datum: 2026-07-30  
Canonical kontraktsversion: `2026-07-30.3`

## Genomfört

- Release-manifest och OpenAPI-snapshots synkas atomiskt med SHA-256 över råa
  bytes.
- Website- och Customer Portal-typer är regenererade från livekontrakten.
- Portalidentitet utelämnar saknade fält i stället för att skicka `null`.
- Portalöversikten är OPS-only och har ingen lokal affärsdatafallback.
- Move-out använder toppnivåfältet `requested_move_out_date` och strikt
  kalenderkontroll.
- Juridikkrav renderas från legal bundle utan lokal kodlista.
- Offertens prisalternativ, fakturasätt, komponentval och antal anläggningar
  verifieras och låses i den signerade snapshotsignaturen.

## Verifierat

- `npm run typecheck`
- `npm run lint`
- `npm run test:launch`
- `npm run api:check:local`
- `npm run db:migrations:check`
- `npm run api:compatibility:known-gaps`

Live-manifestet publicerar version `2026-07-30.3` med SHA-256:

- Website: `9ad3fc518d9aadb687141af2df7d3068df8f7daca530cc01b525d4b94c816b7b`
- Customer Portal: `a3e3f475f3822f30efab4e9a792d714585bacc98773d52790adf12072ed3251e`

## Kvarvarande blockerare

OpenAPI innehåller `ContractPriceOption` och offertfältet
`price_option_reference`, men `PublicContract` saknar en deklarerad
`price_options`-egenskap. Klienten stödjer livefältet när det levereras, men
maskinkontraktet är inte komplett. Gapkod:
`public_contract_price_options_not_published`.

Den distribuerade `verification-status.json` lämnas dessutom med
`live_sync_verified=false`, eftersom målmiljön måste skapa sitt eget livebevis.

## Releasebeslut

`NO-GO` för full API-kompatibilitet tills OPS publicerar `price_options` på
`PublicContract` och `npm run api:sync && npm run api:preflight` passerar i
målmiljön. Denna status är en extern kontraktsblockerare, inte en lokal fallback.
