# Kundsynlig prisinformation – korrigering

## Mål

Denna ändring låser tre regler i hela det publika flödet:

1. Intern systemterminologi visas inte för kunder.
2. Dold fakturaavgift räknas med men exponeras inte i kalkyl, browser-DTO eller signerat browser-token.
3. Fastpris lämnar inte servergränsen innan kundens SE-område har verifierats.

## Implementerat

- Kundnotisen är nu: `Elnätsavgifter och nätägarens avgifter ingår inte.`
- Rubriken `OPS-offert` har ersatts med `Prisunderlag`.
- Alla publika tecknings-, FAQ- och kvittotexter har sanerats från intern OPS-terminologi.
- Fakturaavgiften ligger kvar i serverns fullständiga kalkyl och totalsumma.
- Den fullständiga kalkylen sparas i `website_pricing_snapshots`.
- Fakturaavgiften tas bort från React-props, public-contracts browser-DTO, synliga kalkylrader och det signerade browser-tokeninnehållet.
- Fastpris och fasta energipriskomponenter filtreras före SE-områdesresolution i avtalskort, API-DTO och signup-data.
- Fastprisavtal visar i stället: `Ange adress för att se priset i ditt elområde`.

## Databas

Ingen ny migration tillkommer. Tabellen används från den redan befintliga migrationen:

`supabase/migrations/20260723113000_website_pricing_audit.sql`

Migrationen måste vara applicerad före deployment.

## Verifiering

`npm run test:launch` innehåller ett nytt regressionstest:

`tests/customer-facing-pricing-visibility.test.mjs`

Testet verifierar bland annat att:

- fastpris inte renderas före områdesresolution;
- dold fakturaavgift ingår i serverns totalsumma;
- avgiften inte finns i browser-token eller browser-DTO;
- publika kundtexter inte innehåller `OPS`;
- den neutrala nätavgiftstexten används.
