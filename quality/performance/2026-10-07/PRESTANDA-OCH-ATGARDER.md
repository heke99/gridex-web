# Gridex Web och gridex-prod – prestandagranskning 2026-10-07

Kodbas: `a4d49a8ddbc1fd3fd355a552b94fa2b5739aaf85` på main före denna ändring.
Granskningen använder projektets performance-optimization, Supabase/Postgres- och
Vercel React-skills samt dokumentationen som följer installerad Next 16.3.8.

## Resultat och implementerade ändringar

| Flaskhals | Före | Efter | Verifiering |
|---|---:|---:|---|
| Startsida: RSC-anrop utan användarklick | 19 | 5 | Median av tre browserprov per version |
| Guidesida: RSC-anrop utan användarklick | 28 | 15 | Samma viewport och observationsfönster |
| Startsida: avkodade resursbyte | 959 347 | 698 692 | −27,2 %, inklusive förhandsladdade resurser |
| Guidesida: avkodade resursbyte | 1 018 536 | 828 611 | −18,6 % |
| JavaScript inom observationsfönstret | 578 412 | 539 225 byte | −6,8 %; laddade script, inklusive förhandsladdningar |
| Verifierad Auth-läsning, tre anrop i samma serverrendering | 3 | 1 | Verklig Next RSC, syntetisk Auth-adapter |
| Profilfrågor för kundöversikt och support | 2 | 1 | Runtime-regression med räknade databasläsningar |
| Utgången snapshot, syntetiskt Postgres-prov | 106 377 | 2 byte | Riktig Supabase-query builder och PGlite/Postgres |

1. **Navigationen laddade hela destinationer bara för att menyval syntes.**
   PublicHeader använde explicit `prefetch`; sidfoten laddade också många länkar.
   `IntentLink` använder Next Link och aktiverar normal prefetch först vid hover
   eller tangentbordsfokus. Testet kontrollerar även ny länkadress och navigation.
   Startsidesknappar som bara scrollar inom sidan använder nu vanliga ankarlänkar.

2. **Dashboard, behörighetsläsning och kundöversikt verifierade Auth separat.**
   Supabase-klienten och `getUser()` dedupliceras med request-scoped React.cache.
   Sessioner eller behörigheter lagras inte i en gemensam TTL-cache. Verifieringen
   ligger kvar hos Supabase Auth. Proxy-verifieringen är en separat säkerhetsgräns
   och utförs fortfarande; siffran 3→1 avser serverrenderingen.

3. **Supportgrenen läste kundprofilen igen.**
   Översikten återanvänder den identitet som redan verifierats. OPS bundle och
   support hämtas parallellt; ett supportfel påverkar fortfarande bara supportdelen.

4. **Gamla eller inkompatibla snapshot-rader överfördes innan de avvisades.**
   Frågan filtrerar nu kontraktsversion, parser, schemahash, ålder och vid känd
   identitet organisation direkt i Postgres. Payloadens egna kontroller ligger kvar.
   En saknad/utgången snapshot fortsätter ge cachemiss; databasfel ger fortfarande
   fel. Inga villkor för prisförfrågans giltighet eller prissättning har ändrats.

## Hur mätningen ska tolkas

Node 22, Next produktionsbygge, Chromium, 1365×900, nya browserkontexter, tre prov
per sida och tre sekunder efter DOMContentLoaded. Tredjepartsanrop och writes
blockeras. Bytevärdena avser avkodat innehåll, inte komprimerad nätverkstrafik.
JSON-underlagen ligger bredvid dokumentet, inklusive mellansteget med enbart
navigationsändringen.

Den lokala webbservern saknar riktiga OPS-/Supabase-hemligheter. Startsidan visar
därför feedens felläge i dessa prov. Minskade anrop och byte är reproducerbara,
men proverna bevisar inte responstid för ett riktigt pris eller kundkonto.

LCP, TTFB och långa tasks påverkas av kallstart, cache och samtidig aktivitet i
arbetsmiljön. Ingen förbättring av live LCP/INP eller p95/p99 påstås. CLS var 0 i
proverna. Produktionsbekräftelse kräver samma mätning på driftsatt revision och
fältdata med representativa mobila besökare och interaktioner.

## Databasen: uppmätta förhållanden och prioriteringar

Projekt: **gridex web / gridex-prod**, `ayiuxjlfazkjmmtlvhsl`.
Inspektionen var read-only och exporterade aggregat, fråge-ID:n och resursnamn.

- 15 anslutningar av maximalt 60, en aktiv under provet och inga väntande lås.
- Cacheträffar: tabeller 99,979 %, index 99,924 %.
- Snapshot-tabellen har 25 rader, cirka 1 MB inklusive index. Kundprofilen har fem
  rader. En read-only EXPLAIN för snapshot-läsningen tog 0,156 ms och läste inga
  diskblock. Sekventiell skanning av dessa små tabeller är inte en flaskhals.
- Historiska `pg_stat_statements` sedan 2026-07-10: snapshot-RPC v2 1 479 anrop,
  47,942 ms medel, 185,355 ms max. Profilskrivningar 4 979 anrop, 6,960 ms medel.
  Dessa värden omfattar äldre kod och hela statistikfönstret; de är inte aktuella
  percentiler. Metadatafrågor från dashboard/PostgREST måste skiljas från webbflödet.
- Fem onboardingjobb är pending. Historiken visar tusentals upprepade uppdateringar
  av fem profil-/avtals-/anläggningsrader. Efter samordnad driftsättning bör man mäta
  väntan på kundens mejlbekräftelse och överväga att slippa skriva om oförändrade
  projektioner. Behåll claim-fencing, identitetskontroll och återupptagning vid login.

| Prioritet | Nästa åtgärd | Tillstånd |
|---|---|---|
| Hög | Samordna driftsättning av redan mergad auditkod och schemaändringar | Tidigare produktionsarbete kvarstår |
| Hög | Lös Vercels cron-begränsning inför driftsättning | PR-förhandsvisning nekas på Hobby; Pro eller extern schemaläggare krävs för befintlig frekvens |
| Hög | Mät verklig checkout/portal och OPS-tid separat från lokal frontend | Kräver driftsatt revision och testkonto |
| Medel | Aktivera förberedd städning av verifierade dubbla index | Redan i `20261006205350_audited_web_indexes.sql`; inte applicerad |
| Medel | Aktivera förberedd policy-deduplicering | Redan i `20261006214901_audited_duplicate_policies.sql`; inte applicerad |
| Medel | Minska oförändrade onboarding-skrivningar efter säker claim | Utredning mot nya produktionskoden återstår |
| Medel | Mät snapshot-lagring med representativ write-last lokalt | Historiskt dyraste applikationsfrågan; ingen live-write-benchmark gjord |
| Låg | Triagera ytterligare FK-index efter verkliga frågor och tabelltillväxt | Ingen evidens för massindexering nu |

Supabase advisors: 61 saknade FK-index, 194 oanvända index, 537 förekomster av
överlappande permissiva policies och sex grupper dubbla index. Grupperna och många
varningar omfattar delade/legacy-tabeller. Oanvända index får inte tas bort enbart
på grund av `idx_scan=0`: de kan skydda constraints eller användas sällan.

Remedieringsreferenser:

- [Foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [Unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- [Multiple permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)
- [Duplicate indexes](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index)

Inga nya index, RLS-ändringar, compute-uppgraderingar eller globala cacheinställningar
behövs för denna kodleverans. Sex nya auditmigreringar från föregående leverans
väntar fortfarande på samordnad produktionsaktivering. Automatisk main-deploy är
fortfarande avstängd.

## Skill och fortsatt arbetssätt

Den installerade prestandaskillen hänvisade till en saknad
`references/performance-checklist.md`. Referensen finns nu, med Gridex-kommandon,
mätdisciplin, rätt Supabase-projekt, sekretess, RLS/claim-krav och tydliga gränser
mellan lokala mätningar och produktion. Skillen länkar till tillägget och dess
lokala checksummor/proveniens är uppdaterade. Upstreams låsta källa behålls.

Kör:

```sh
npm run build
npm start -- --hostname 127.0.0.1 --port 3100
# I annan terminal, efter serverstart:
GRIDEX_PERF_OUTPUT=/tmp/gridex-perf.json npm run perf:web
npm run test:performance
npm run test:performance:browser
```

CI kör nu SQL-filtertesten och Next/Chromium-testet för Auth-isolering och
navigation. Begärantal övervakas av jämförelseverktyget; ingen hårdkodad
Lighthouse-poäng införs utan en representativ miljö.

## Verifiering för denna kodleverans

Godkänt lokalt: full `npm test`, `test:support`, `test:performance`,
`test:performance:browser`, `test:audit:browser`, lint utan varningar, typecheck,
produktionsbygge, filstorlekskontroll, OpenAPI local drift och migrationsmanifest
(45 oförändrade SQL-filer). Den kompletterande varma browseromgången bekräftar
oförändrade begärantal och payloadminskningar. Detaljer finns i
`verification-results.json` och de sanerade testloggarna.

En supporttest-loader behövde uppdateras för den nya Auth-helper-exporten. Därefter
passerade hela supportsuiten. Ingen assertionskontroll togs bort.

Leveransen ändrar webbkod och lokal skill. Ingen produktionsdriftsättning eller
databasmigration har utförts i denna prestandaomgång. Live prestanda är därför
fortfarande ej verifierad för den nya revisionen.

### PR och hosting

[PR #50](https://github.com/heke99/gridex-web/pull/50) innehåller ändringarna och
är öppen. GitHub Actions-kontrollerna ligger i kö vid leveransen.

Vercels förhandsvisning nekades med meddelandet: "Hobby accounts are limited to
daily cron jobs. This cron expression (5 * * * *) would run more than once per
day." Befintlig `vercel.json` har även ett kvittensjobb var tionde minut. Projektet
behöver en plan som stödjer dessa intervall eller en extern schemaläggare som
anropar de skyddade interna endpoints med korrekt autentisering. Frekvenserna har
behållits i denna PR. Att ändra dem till dagligen skulle påverka återförsök och
kundernas mejl-/kontoflöden och behöver bedömas som en produktionsändring.

Förhandsvisningsfelet kommer från Vercels validering av hostingplan och cron, före
ett tillgängligt preview-bygge. Lokalt produktionsbygge och browserproven är
godkända. Ingen kostnadsändring eller ny schemaläggare har aktiverats.

## Försökslogg

| Försök | Utfall | Beslut |
|---|---|---|
| Meny-/sidfotsförhandsladdning vid intent | Startsida 19→6 anrop, guidesida 28→15 | Behåll |
| Ankarlänkar för scroll på startsidan | Ytterligare 6→5 anrop; mindre payload | Behåll |
| Auth deduplicering i samma RSC | 3→1, kundisolering och Auth-fel bevarade | Behåll |
| Återanvänd kundöversiktens supportidentitet | 2→1 profilfrågor, supportfel isolerat | Behåll |
| Snapshot-filter innan JSON-transfer | 106 377→2 byte för utgången fixture | Behåll |
| Fler index på små tabeller | SELECT redan 0,156 ms, cacheträffar över 99,9 % | Ingen ändring |
| Generell TTL-cache för kunder/prisförfrågningar | Saknar mätbehov och bryter färskhet/isolering | Ingen ändring |
