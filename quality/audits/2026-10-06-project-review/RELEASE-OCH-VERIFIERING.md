# Gridex – release och kvarvarande skarp verifiering

2026-10-06. Detta är ett körklart releaseunderlag, inte ett intyg om att produktionen redan har rättats. Ändringarna finns i `/workspace/gridex-web`. Resends befintliga webhook är den enda skarpa inställning som ändrats i denna åtgärdsomgång.

## Versionsbindning

`npm run release:audit:manifest` ger baseline-SHA, om arbetskopian är ändrad, hash över aktuellt källunderlag, API-version och hash över migrationsmanifestet. Efter granskning/commit ska Web-SHA låsas, samma commit byggas för preview och produktion och nya bevis knytas till just den revisionen. API-kontraktet är `2026-10-04.1`. Senast observerad skarp Web-SHA var `ff950425b6922df88817f840dc5a395cbceab8eb`; arbetskopians baseline är `188e475d18341a9ec9a531d9705da8988d9e9f6b` med efterföljande ändringar.

Förväntad Web- och Support-Auth-databas är `gridex-prod`, projektref `ayiuxjlfazkjmmtlvhsl`. API-nyckeln måste dessutom bindas till rätt OPS-organisation; rätt Supabase-ref bevisar inte rätt OPS-tenant.

## Migreringar och ordning

Målmanifestet innehåller 45 filer. Sex historiska migreringar var registrerade i produktion vid granskningen, medan många andra objekt redan finns där. Skillnaden är ingen instruktion att köra återstående historiska filer.

De sex nya, ännu inte produktionsapplicerade migreringarna är:

1. `20261006204008_customer_portal_audit_hardening.sql`: återkalla kundrollernas projektion-/identitetsskrivningar inklusive kolumngrants, inför auth.uid()-bundna sessions-RPC:er samt atomisk Auth-profilsynk med claimskydd.
2. `20261006205014_legacy_pricing_atomic_writes.sql`: nödvändiga auditkolumner och atomiska prisversioner/rader/publicering med rollkontroll. Publicerad historik blir inte redigerbar när en version avpubliceras.
3. `20261006205027_public_support_durable_receipts.sql`: serviceägd kvittenskö, atomiskt ärende/meddelande/kvittens och skyddat worker-claim.
4. `20261006205350_audited_web_indexes.sql`: strukturellt verifierade dubblettindex och index för Webs relevanta FK. Constraintindex behålls; ingen CASCADE.
5. `20261006210639_audited_release_preflight.sql`: service-only katalogreadiness som avslöjar saknade objekt och otillåtna kundskrivgrants utan kunddata.
6. `20261006214901_audited_duplicate_policies.sql`: ta bort 54 exakt dubblerade permissiva policyer på 19 tabeller, endast när kommando, roller och båda villkor fortfarande är identiska. Idempotent; katalogdrift och restriktiva policyer lämnas kvar.

Staff-delivery-objekten saknades i gridex-prod. Stäm separat av befintliga `20261005125326_support_staff_invitation_delivery_private.sql` mot målet. Applicera just det saknade kompatibla steget om tabellen och samtliga tre RPC:er saknas; vid delvis befintligt schema krävs en ny framåtriktad korrigeringsmigration. Skriv inte om redan applicerade checksummor.

Ta schema-/grantsunderlag och säkerställ fungerande databasbackup före rollout. Prova de aktuella migreringarna mot en isolerad målklon med samma enums, constraints, triggers, grants och policyer. De nya lokala PostgreSQL-testerna verifierar transaktioner och kundroller men ersätter inte denna målklon.

## Miljö och mejl

`env.example` beskriver nya servervariabler. Hemliga värden får inte hamna i rapport, logg, Git eller någon NEXT_PUBLIC_-variabel.

| Funktion | Måste verifieras/konfigureras |
|---|---|
| Kundassertion | OPS policy report/required, accepterad publik nyckel/kid, exakt issuer/audience och kopplat Auth-subject. Web använder RS256 med 60 s giltighet och nytt jti. Testa fel tenant/signatur/subject, utgång och replay mot OPS. |
| Auth | Email-confirmation, gemensam lösenordspolicy och läckta lösenord där planen stöder det. Site URL/redirect-allowlist och SMTP måste passa miljön. |
| Auth-mallar | Verifiering och recovery ska gå via stödd callback med token-hash/korrekt typ. Kontrollera även email-change/invite och att en mejllänk inte bygger på gamla signeringsvägen. |
| Publik supportkvittens | `GRIDEX_SUPPORT_RECEIPT_RESEND_KEY`, `GRIDEX_SUPPORT_RECEIPT_FROM`, verifierad domän och `CRON_SECRET`. Ny cron går var tionde minut. Workerstatus sent betyder accepterad av providern; faktisk delivered kräver providerbevis. |
| Avtalsbekräftelse | OPS äger avtalsmejl och aktuell `checkout.confirmation_email`. Web skiljer köad/skickad/levererad/misslyckad status. |
| Resend-händelser | Aktiv webhook verifierad med bounced, delivered, failed, suppressed, complained, delivery_delayed. OPS har hanterare för de två tillagda händelserna. |
| Support | Verifiera `GRIDEX_SUPPORT_SUPABASE_URL`/publik anon-nyckel för gridex-prod samt support.read/write mot rätt OPS-tenant. Behörighetsprober använder avsiktligt ogiltig identitet/payload och skapar inga giltiga kundoperationer. |

De anslutna verktygen exponerar ingen hantering av Supabases Auth/SMTP-inställningar. Den delen behöver kontrolleras i projektets Auth-konfiguration före release.

Ingen testinkorg har ännu godkänts. Skicka inga verifierings-/recovery-/supporttestmejl till befintliga kunder. Testadress och tillstånd för utskick inväntas.

## Releasekontroll och bevis

Framework och eslint-config-next är låsta till 16.3.8; lintens React Hooks-plugin behåller den verifierade versionen 7.0.1. Det riktade tinyglobby-overridet eliminerar även utvecklingskedjans sårbarhet; full npm audit visar noll. Kör med Node 22 och projektets låsta paket:

```sh
npm ci
npm test
npm run test:support
npm run test:audit:browser
npm run typecheck
npm run typecheck:support
npm run lint
npm run build
npm run build:support
npm run api:check:live
npm run api:compatibility
npm run db:migrations:check
npm audit
npm run release:audit:manifest
npm run release:audit:check
```

Chromium måste vara installerat för webbläsartesterna; de startar ett isolerat localhost-projekt och stubbar externa tjänster. De kan inte skapa ett skarpt avtal eller mejl. Koden tar inte bort eller inför någon tidsgräns för kundofferten. Cache-TTL och tekniska API-deadlines gäller beräkningar/anrop, inte kundens rätt att fortsätta med sin verifierade offert.

`release:audit:check` kräver en committad revision, matchande `GRIDEX_RELEASE_WEB_SHA`, rätt DB-ref, nödvändig serverkonfiguration, godkänt svar från `gridex_web_audit_readiness_v1()` samt `GRIDEX_RELEASE_E2E_EVIDENCE` som pekar på en bevisfil från målmiljön. Filen ska innehålla dessa fält:

```json
{
  "web_sha": "exact-release-commit",
  "api_version": "2026-10-04.1",
  "database_project": "ayiuxjlfazkjmmtlvhsl",
  "migrations_sha256": "hash-from-release-manifest",
  "checks": {
    "customer_isolation": false,
    "canonical_checkout": false,
    "portal_support": false,
    "assertion_policy": false,
    "auth_smtp": false,
    "verification_email_delivered": false,
    "reset_email_delivered": false,
    "leaked_password_policy": false,
    "support_receipt_delivered": false
  }
}
```

Mallen är avsiktligt **inte** godkänd. Sätt true först efter genomförda kontroller och behåll redigerade spårbara provider-/API-/DB-bevis utan kunddata. Scriptet kan kontrollera bevisens revision och obligatoriska resultat, men kan inte själv intyga att en människa mottagit ett mejl eller att en extern dashboardinställning är rätt.

## Skarpa scenarier före släpp

- Två isolerade testkunder: profil/avtal/anläggning/faktura/dokument får aldrig korsa identiteter. Testa direkta REST-skrivförsök som anon/authenticated samt kund- och admininloggning.
- Quote/application: de avtalstyper och energiriktningar som verkligen är publicerade; avgifter/moms/belopp mot den returnerade OPS-offerten. Bevara samma idempotensnyckel efter osäkert svar; pending/action-required får inte skapa en ny ansökan eller visas signerad. Koppla receipt, aktuell checkout, juridiska bevis och supplier-switch.
- Ingen femminuterstimer, tyst omprisning eller avvisning enbart på tid. Testa även oförändrad adress efter nyckelrotation och ändrad adress medan prisförfrågan pågår.
- Portal: notisläsning, anläggningsuppgifter, flytt, supportfall/meddelanden samt avtal/fakturor när supportdelen ger 403/timeout/503.
- Auth/email: signup → verifieringsmejl → callback → inloggning → rätt kundprofil. Recovery → mejl → nytt lösenord, återbrukad/ogiltig token, email-change och avbrott i profilsynk. Bekräfta faktisk providerleverans och mottagning i den godkända inkorgen.
- Supportkvittens: stabilt operation-ID, inga dubbla tickets/kvittenser efter retry, provider timeout/429/5xx/permanent fel och cron-autentisering. Följ upp manual_review och delivered separat från sent.

## Kvarvarande utvecklingsberoende

Full `npm audit` rapporterar fortfarande fem high-poster i utvecklingskedjan `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. Detta är en och samma kvarvarande bakomliggande advisory med propagerade beroendeposter. `braces` senaste publicerade version är fortfarande 3.0.3 och saknar rättning för rekursions-/stackfelet. Paketen används av lintverktygen och ligger inte i Webs produktionsberoenden; `npm audit` rapporterar 0. Lintkonfigurationens mönster ska hållas betrodda och upstream-patch följas upp. `npm audit fix --force` föreslår ett brytande Next/ESLint-byte och ska inte användas som blind rättning. Kompatibla rättningar för humanfs, brace-expansion, browserslist och js-yaml har applicerats och låsfilen verifieras på nytt.

## Rollout och återställning

Håll automatisk main-publicering spärrad tills måltesterna är klara. Förbered ett godkänt artefaktbygge och en kontrollerad underhållsperiod för kundskrivningar. Den första migrationens grants får inte ändras ensam medan äldre Web fortfarande förväntas kunna skriva direkt som kund. Under fönstret: applicera avstämda steg, aktivera det matchande Web-bygget, kör katalog-/API-/kundkontroller och återöppna skrivningar först när utfallet är godkänt.

Vid fel: pausa teckning/berörda skrivflöden, bevara durable jobs/idempotensnycklar och felsökningsreferenser, och gör en framåtriktad korrigering. En äldre Web-binary är inte automatiskt kompatibel med de nya behörigheterna. Återöppna aldrig de osäkra identitetsskrivningarna eller valfri-UID-RPC:erna för att få ett gammalt bygge att fungera. Återskapa borttagna dubblettindex vid behov från det sparade katalogunderlaget; radera inte ansökningar, juridiska bevis eller köposter.

F15 återstår delvis: granska delade OPS-policyer och övriga FK/index mot explicit rollmatris och representativ EXPLAIN i staging. Oanvänd statistik är inte ensam grund för att radera ett index. Ingen full belastnings-/penetrations-/OPS-avräkningsrevision har genomförts.

## Verifieringsbegränsningar efter fortsättningen

Supabase security advisor bekräftar fortfarande avstängt skydd mot läckta lösenord. Den installerade anslutningen exponerar databas-/migreringsverktyg men ingen Auth-/SMTP-hantering. Vercels befintliga hemligheter är av typen sensitive och returneras inte dekrypterade. Därför går det inte att bevisa rätt OPS-tenant eller genomföra autentiserade skarpa E2E-anrop med dessa verktyg. Inga hemligheter har skrivits ut eller nya värden gissats. Ingen testinkorg har godkänts. Main-merge och produktionsaktivering ska dokumenteras var för sig; main-deploy är fortsatt avstängd tills samordnad DB-/Auth-/OPS-release är verifierad.
