# Gridex Web som oberoende tenant och supportportal

Web använder OPS versionerade API som källa för kundavtal, anläggningar,
fakturor, mätvärden, juridik, notiser och kundärenden. Webs Supabase-projekt
`gridex-prod` (`ayiuxjlfazkjmmtlvhsl`) hanterar egen inloggning, lokala
projektioner, köer, behörigheter och kontaktformulär. Det behövs ingen direkt
databasanslutning till OPS och inget internt OPS-bolags-ID.

## API och identitet

- Källor: `https://app.gridex.se/developers/customer-portal-api` och den
  verifierade release-manifesten i `docs/openapi/release-manifest.json`.
- Kontraktsversion: `2026-10-02.4`, med minsta tenantversion `2026-10-02.3`.
  Båda specifikationerna och genererade
  TypeScript-typer är synkade tillsammans och kontrollerade mot samma release.
  OPS PR #461 rättar de stängda support- och manifestschemana i en ny,
  bakåtkompatibel release; publicerade `.2`- och `.3`-arkiv behåller sina bytes.
- `GRIDEX_API_KEY` lagras endast på servern och bestämmer OPS-tenant.
  `/api/v1/integration/context` ger en opak `organization_reference`.
- Båda portalidentitetshuvudena kommer från serververifierad Supabase-användare.
  Klienten kan inte välja kund eller vidarebefordra egna identitetshuvuden.
- Kundkoppling måste vara `linked` med `access_granted: true`. Ett väntande
  eller avvisat svar ger ingen kundåtkomst.
- Kundsvar använder `private, no-store`. Cache för autentisering delas bara
  inom en React-serverrendering, aldrig mellan kundernas förfrågningar.
- Kundskrivningar har en stabil idempotensnyckel. Samma nyckel återanvänds
  endast för samma åtgärd. Varje assertion har däremot ett nytt `jti`.

## Support

`/support-center` och `/dashboard/support` använder samma kundfunktioner:
ärendelista med sidindelning, ärendedetalj, skapa ärende, svar och skyddade
bilagor. OPS filtrerar kundsynliga meddelanden; Web väljer dessutom uttryckliga
publika fält. Interna anteckningar och personalidentiteter får inte exponeras.
Uppladdningar begränsas till PDF, PNG och JPEG på högst 4 MiB.

På exakt värdnamnet `support123.gridex.se` skrivs `/` internt om till
`/support-center` och `/staff` till `/support-center/staff`. API-, inloggnings-
och callbackvägar behåller sina adresser. Supportvärden skickar `noindex`.
Inloggning sker på den aktuella värden, med värdbundna sessionscookies.

OPS har ett kund-API för support, men inget externt handläggar-API i denna
release. Handläggarnas kundärenden behandlas därför i OPS befintliga
behörighetsskyddade supportpanel. Webs personalsida länkar dit och hanterar
separat de anonyma förfrågningarna från `/kundservice`. Sådana förfrågningar
skapar inte en andra kopia av en kunds OPS-ärende.

Det anonyma formuläret sparar kontakt och första meddelande i en transaktion.
Den tidigare koden försökte skriva till en obefintlig `system_emails`-tabell.
Ingen automatisk e-postbekräftelse utlovas utan en verifierad e-posttransport.

## RBAC och databas

Tillträde till adminskalet är skilt från behörighet att utföra en åtgärd.
`admin.access` ger inte automatiskt rätt att publicera priser, administrera
användare eller ändra RBAC. Varje serveråtgärd kontrollerar sin uttryckliga
behörighet; personalroll i UI är inte en auktorisationskälla.

Effektiva rättigheter tar hänsyn till aktiva roller, medlemskap, giltighetstid
och nekande undantag. Globala rättigheter och bolagsrättigheter skiljs åt.
`GRIDEX_WEB_COMPANY_ID` är ett valfritt **lokalt** authbolag, inte OPS interna
bolags-ID eller opaka API-referens. Utan det räknas bara globala rättigheter.
Global användar-/rolladministration kräver globala administrationsrättigheter.

Rollskrivningar använder det inspekterade schemats primärnyckel `id` och
avgränsar uttryckligen till globala poster med `company_id IS NULL`.
Produktionsdatabasen saknar `UNIQUE(user_id,role)`; den tidigare upsertnyckeln
gav därför `42P10`. Aktiva, uttrycksbaserade unika index skyddar samma roll
inom samma användar-/bolagsscope. Vid en konkurrerande grant och `23505`
läser servern om en gång. Grant, revoke och återaktivering bevarar andra
bolags rollposter. Ingen ytterligare schemamigration behövs för denna rättning.

`tests/rbac-role-assignment-runtime.test.mjs` kör de verkliga serveråtgärderna
mot en separat fixture av de inspekterade indexreglerna. Den reproducerar
det tidigare felet och verifierar rolltilldelning, återkallning,
återaktivering, användarskapande, bolagsavgränsning och samtidiga grants.
Testet ingår i `npm run test:independent-tenant` och går grönt på Node 22.

Migrationen `20261002173716_independent_web_rbac_and_public_support.sql`
stänger gamla kundskrivningar till lokala supporttabeller, döljer interna
anteckningar i historiska kundläsningar och begränsar personalens lokala
åtkomst till det anonyma kontaktflödet. Godtyckliga användar-ID:n i
behörighets-RPC:er accepteras bara av serverns service-roll, efter att Web
verifierat den inloggade användaren. Historiska ärenden bevaras.

Migrationen `20261002175651_gridex_web_atomic_pricing.sql` stänger
browsermutationer till lokala pris-/produktregister och döljer utkast,
framtida priser och inaktiva produkters priser från offentlig läsning.
Utkast kräver global `pricing.read`; inaktiv produktmetadata tillåter även
global `contracts.read`. Serverns pris-RPC:er sparar, publicerar eller
avpublicerar atomiskt med låsning och audit. Finita signerade prisvärden
behåller sin tidigare betydelse. Lokala pris-/avtalskontroller avser lokal
historik och kontroll; kanonisk publicering sker i OPS.

Migrationen `20261002192814_gridex_web_server_owned_rbac.sql` stänger
alla tabell- och kolumnskrivningar för browserroller på de nio lokala
roll-, rättighets-, bolags- och medlemskapstabellerna. Den bevarar befintliga
SELECT-grants, alla RLS-policyer och service-rollens skrivningar. Bolagsägare
kan därmed inte längre befordra egna medlemsroller eller ge sig rättigheter
via direkt Databas-API. PostgreSQL 17:s MAINTAIN tas också bort.

Migrationen `20261002192011_gridex_web_global_permission_override.sql`
låter endast serverns service-roll sätta en global allow/deny. RPC:n verifierar
aktörens aktuella globala `rbac.write` efter transaktionslåset, använder
rättighetens kanoniska nyckel och bevarar alla bolagsposter. Den ersätter
endast äldre globala direkträttigheter och global overridehistorik; en äldre
global deny kan därför inte vinna över en senare allow. Godtyckliga
användar- eller rättighets-ID:n och ogiltiga effekter avvisas.

Det ursprungliga fyrmigrationspaketet kördes tillsammans på native PostgreSQL 16
med aktuella produktionsfunktioners exakta definitioner och pristriggers.
Testerna omfattar tenantisolering, nekade och inaktiva rättigheter,
identifierarmanipulation, supportsekretess, rollback vid skriv-/auditfel
och samtidighet. Nya ACL-tester bevarar exakta läsgrants och 27 policyer,
nekar 108 browsermutationer och tillåter 27 serveroperationer. Tolv samtidiga
globala beslut ger en aktiv post med bevarad historik; en aktör som tappar
rättigheten under låsväntan nekas. Kontroll av funktionssignaturer i produktion gjordes
read-only och gav noll avvikelser. Den separata ACL-spärren tillämpades i
`gridex-prod` 2026-10-02 via `apply_migration`, historikversion
`20261002192814`, namn `gridex_web_server_owned_rbac`. Efterkontrollerna
passerar; SELECT/RLS för nio tabeller, alla 27 policydefinitioner och
service-rollens INSERT/UPDATE/DELETE är oförändrade. Inga produktionsrader
eller testfixturer skrevs. De ursprungliga två migrationerna och den globala
setter-RPC:n väntar fortfarande på samordnad Web-driftsättning.

Lokala testkällor finns i `tests/database/independent-web-fixture.sql`,
`independent-web-existing-functions.sql`, `independent-web-security.sql`,
`pricing-fixture.sql`, `atomic-pricing.sql`, `pricing-concurrency.sql` och
`server-owned-rbac*.sql` samt `server-owned-rbac-concurrency.py`.
Fixturefilerna får endast användas i en separat lokal testdatabas.
Katalogkontroll före tillämpning finns i
`tests/database/independent-web-function-preflight.sql`; efterkontrollerna
finns i `independent-web-production-assertions.sql` och
`pricing-deployment-assertions.sql`, `server-owned-rbac-deployment-assertions.sql`
och `server-owned-rbac-overrides-deployment-assertions.sql`.
Den separata ACL-katalogkontrollen före tillämpning finns i
`server-owned-rbac-preflight.sql`.

Slutgranskningen utökar paketet med fyra framåtriktade migrationer:

| Migration | Ändring |
| --- | --- |
| `20261002200715_gridex_web_server_owned_postal_mapping.sql` | Stänger direkta browsermutationer till postnummermappningen; serveråtgärder kräver global `pricing.write`. |
| `20261002201624_gridex_web_atomic_monthly_spot.sql` | Sparar, publicerar och återställer månadsspot atomiskt med verifierad aktör och global rättighet efter låsväntan. |
| `20261002202211_gridex_web_atomic_agreement_pdf.sql` | Sparar PDF-referens och operatörsaudit atomiskt, bevarar livscykel/mailstatus och skyddar avtalsläsning med aktivt ägarskap eller global rättighet. |
| `20261002202617_gridex_web_agreement_projection_trigger.sql` | Rättar den befintliga lokala projektionstriggerns verkliga schemafel och lämnar PDF-ändringar och kanoniska OPS-identiteter utanför projektionen. |

Delade kund-, avtals-, export- och PDF-vyer kräver globala rättigheter.
Kundkort filtrerar och sidindelar relaterade poster i databasen. Äldre lokala
e-postsigneringslänkar är läsande och visar endast faktisk, tidigare sparad
signatur; osignerade länkar hänvisar till den aktuella portalen. En PDF-åtgärd
genererar dokumentet och innebär ingen aktivering eller skickad e-post.

De ännu inte tillämpade behörighetsfunktionerna använder väggklockan när en
tidsbegränsad override kontrolleras. En transaktions starttid får inte hålla
en utgången rättighet giltig efter låsväntan. Native CI kör paketet på både
PostgreSQL 16.15 och 17.6 med isolerade fixturedata, rollbackprov och riktiga
fleranslutningsprov. Det kör inga fixtures mot produktionsdatabasen.

## Driftsättning och verklig verifiering

1. Förbered Web-kandidaten, verifiera alla åtta migrationers lokala
   PostgreSQL-regressioner på båda versionerna och kör
   `npm run db:migrations:check` (46 filer).
   Den rena ACL-migrationen är redan tillämpad separat i Gridex Prod: basens Web
   (`9ae3736`) saknar browserfunktioner för bolag/medlemskap/overrides;
   övriga berörda sessionsskrivningar var redan blockerade av RLS/helpergrants.
   Fungerande serveroperationer behåller service-rollens rättigheter.
   Kontrollerna `server-owned-rbac-preflight.sql` före/efter och den rena
   ACL-efterkontrollen passerade med oförändrad läsåtkomst och policyer.
   Faktisk historikversion är `20261002192814` från 2026-10-02.
   Produktions-DDL går enbart via `apply_migration`.
   **Håll samtliga sju återstående migrationer tills deployment, servermiljö
   och domänåtkomst är bekräftade och kandidaten kan tas i drift samordnat.**
   Basens fungerande postnummer- och avtalsoperationer använder fortfarande
   sessionsklienten; nya ACL-spärrar måste därför införas tillsammans med
   den nya serverkoden.
   Pausa berörda administrativa skrivningar under databas-/Web-bytet.
   Vid Web-driftsättning tillämpas eventuella återstående migrationer i
   beroendeordning: RBAC/support, pris/RLS, global setter, postnummer,
   månadsspot, avtals-PDF och projektionstrigger. RBAC-ACL-spärren är redan
   tillämpad och ska inte tillämpas på nytt. Kör paketets nio katalog- och
   efterkontrollfiler, inklusive kontrollen av RPC-signaturer.
   Ta därefter den testade Web-revisionen i drift, kontrollera sidor och
   skrivflöden och återöppna de administrativa operationerna.
   Använd inte `execute_sql` för produktions-DDL eller en DDL-repetition med
   rollback. Ändra inte OPS databas med dessa Web-migrationer.
2. Konfigurera serverns `GRIDEX_API_KEY` för avsedd OPS-tenant. Nyckeln behöver
   befintliga hemside-/portal-scopes och uttryckligen `customer_support.read`
   samt `customer_support.write`; vanliga portal-scopes räcker inte.
3. Behåll `GRIDEX_OPS_API_URL=https://app.gridex.se/api/v1`, Webs egna
   `NEXT_PUBLIC_SUPABASE_URL`, publika Supabase-nyckel och serverns hemliga
   Supabase-nyckel. `GRIDEX_WEBSITE_STATE_SIGNING_SECRET` ska vara minst 32 byte.
4. Om OPS-tenanten kräver signerad kundassertion, registrera Webs publika nyckel
   i OPS och konfigurera följande **servervariabler**:
   `GRIDEX_CUSTOMER_ASSERTION_REQUIRED=true`,
   `GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY`, `GRIDEX_CUSTOMER_ASSERTION_ISSUER`,
   `GRIDEX_CUSTOMER_ASSERTION_AUDIENCE`, `GRIDEX_CUSTOMER_ASSERTION_KID` och vid
   behov `GRIDEX_CUSTOMER_ASSERTION_ALGORITHM` (`RS256`, `PS256` eller `ES256`).
   Behåll privata nycklar utanför git och klientens `NEXT_PUBLIC_`-variabler.
5. Lägg till `support123.gridex.se` i samma Vercel-projekt som `gridex.se`
   (`prj_M9CISqPbBmmX7L83lvqiAJDJfhGS`) och följ Vercels visade DNS-krav.
   Använd inte en gissad CNAME. Kontrollera domänverifiering och TLS.
6. Kontrollera att Supabase Auths tillåtna redirectadresser inkluderar
   `https://support123.gridex.se/auth/confirm` och det återställningsflöde som
   faktiskt används. Behåll även befintliga huvuddomänadresser.
7. Verifiera på den publicerade kandidaten med två riktiga testkunder från
   olika tenants och separat supportpersonal: kundkoppling, läsningar,
   skriva/svara, filuppladdning/nedladdning, stängda ärenden, återförsök,
   förbjuden åtkomst, avaktiverade roller och prispublicering.

Kodtester eller en fungerande inloggningssida ersätter inte detta sista
liveprov med verklig API-nyckel, tenantscopes, sessionsidentitet och domän.
