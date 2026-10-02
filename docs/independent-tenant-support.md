# Gridex Web som oberoende tenant och supportportal

Web använder OPS versionerade API som källa för kundavtal, anläggningar,
fakturor, mätvärden, juridik, notiser och kundärenden. Webs Supabase-projekt
`gridex-prod` (`ayiuxjlfazkjmmtlvhsl`) hanterar egen inloggning, lokala
projektioner, köer, behörigheter och kontaktformulär. Det behövs ingen direkt
databasanslutning till OPS och inget internt OPS-bolags-ID.

## API och identitet

- Källor: `https://app.gridex.se/developers/customer-portal-api` och den
  verifierade release-manifesten i `docs/openapi/release-manifest.json`.
- Kontraktsversion: `2026-10-02.2`. Båda specifikationerna och genererade
  TypeScript-typer är synkade tillsammans och kontrollerade mot samma release.
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

Båda slutliga migrationerna har körts tillsammans på native PostgreSQL 16
med aktuella produktionsfunktioners exakta definitioner och pristriggers.
Testerna omfattar tenantisolering, nekade och inaktiva rättigheter,
identifierarmanipulation, supportsekretess, rollback vid skriv-/auditfel
och samtidighet. Kontroll av funktionssignaturer i produktion gjordes
read-only och gav noll avvikelser. Inga produktionsändringar har persisterats.

Lokala testkällor finns i `tests/database/independent-web-fixture.sql`,
`independent-web-existing-functions.sql`, `independent-web-security.sql`,
`pricing-fixture.sql`, `atomic-pricing.sql` och `pricing-concurrency.sql`.
Fixturefilerna får endast användas i en separat lokal testdatabas.
Katalogkontroll före tillämpning finns i
`tests/database/independent-web-function-preflight.sql`; efterkontrollerna
finns i `independent-web-production-assertions.sql` och
`pricing-deployment-assertions.sql`.

## Driftsättning och verklig verifiering

1. Förbered den nya Web-kandidaten, kontrollera båda migrationernas lokala
   PostgreSQL-regressioner och kör `npm run db:migrations:check`. Båda
   migrationerna måste samordnas med den nya Web-versionen: de stänger
   browsermutationer som den gamla UI-versionen fortfarande använder.
   **Håll produktionsmigrationerna tills deployment, servermiljö och
   domänåtkomst är bekräftade och kandidaten kan tas i drift samordnat.**
   Före tillämpning körs endast read-only katalogkontroller i produktion.
   Tillämpa sedan först RBAC/supportmigrationen och därefter
   pris-/RLS-migrationen på rätt Web-projekt via `apply_migration` när
   driftsättningen är redo. Använd inte `execute_sql` för produktions-DDL
   eller en DDL-repetition med rollback. Kör båda efterkontrollerna efter
   tillämpning. Ändra inte OPS databas med dessa Web-migrationer.
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
