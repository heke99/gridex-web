# Gridex Web tenantfix – genomförd ändringsrapport

## Korrigerat

1. Intern company-UUID har ersatts av fail-closed `tenant_reference` via integration context/meta.
2. Kundtypen normaliseras centralt från `company` till `business` vid OPS-gränsen.
3. Erbjudandebunden lokal Elprisetjustnu-prissättning har kopplats bort från produktionsflödet.
4. Alla prismodeller använder canonical `POST /api/v1/website/quote`.
5. Quote-metadata är explicit typad, signerad och visas i UI.
6. Kundansökan binds till exakt `quote_reference` och samma års-/månadsförbrukning.
7. Site- och griddata förs konsekvent vidare; ett separat mätpunkts-ID skickas endast när det faktiskt finns och blandas inte ihop med anläggnings-ID.
8. Public-contracts använder OPS ETag, `If-None-Match`, `304` och `publication_revision`.
9. `contracts.publication.changed` invalidierar cache efter signatur-, tenant-, kanal- och revisionskontroll.
10. Diagnostics använder `/api/v1/website/public-contracts/diagnostics` och nytt scope.
11. OPS-klienten använder inte fallbackkedjor till påhittade energy/quote-routes.
12. Readiness och `env.example` kräver canonical scopes och tenantreferens.

## OPS-beroenden

Gridex Web kan inte bli live enbart genom kodändringen. OPS måste erbjuda integration context, komplett quote metadata, ETag/revision, publication-webhook samt ge API-klienten rätt scopes. Avtal som saknar aktiv website-publicering eller komplett projection kommer korrekt att döljas/blockeras.

## Verifiering

- `npm run test:launch`: godkänd.
- Samtliga nya tenantarkitekturtester är godkända.
- TypeScript-parserkontroll: inga syntaxfel.
- Full `next build` kunde inte köras i granskningsmiljön eftersom `node_modules` saknades och beroendeinstallationen inte kunde startas.
