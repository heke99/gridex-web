# Gridex – samlad granskning och åtgärdsstatus

Sammanställd 2026-10-06. Alla 42 ursprungliga fynd samt två ytterligare fel finns här med underlag och åtgärdsstatus. Implementeringsstatus uppdateras under rättningen. Granskningsresultat är historiska observationer; rättning i koden innebär inte automatiskt verifierad produktion.

Krav: offerter ska inte löpa ut enbart för att tiden går, ingen femminuterstimer och ingen tyst omprisning.

## Åtgärdsstatus efter implementation

**Rättat lokalt** betyder implementerat och lokalt verifierat, inte driftsatt på gridex.se. **Migration klar** betyder provad i isolerad PostgreSQL-motor, inte applicerad i gridex-prod. Tabellen lämnar produktionsberoenden öppna där de fortfarande saknar bevis.

| Fynd | Status | Rättning och verifiering |
|---|---|---|
| F01 | Migration klar lokalt | Klientens skrivgrants återkallas inklusive kolumngrants. Två kundidentiteter/roller och förbjudna identitetsändringar testade i PostgreSQL. |
| F02 | Rättat lokalt + migration | Alla sessionanrop använder auth.uid()-bundna RPC:er. Ingen återöppning av RPC med valfri användaridentitet. |
| F03 | Releaseblockerare kvar | Versions-/källmanifest och releasekontroll byggda. Skarpa Web ligger fortfarande på annan SHA; gemensam release/E2E återstår. |
| F04 | Rättat lokalt | Obligatorisk checkout valideras och styr om ansökan är mottagen, behandlas eller är färdig. Processing godtas aldrig som signerad framgång. |
| F05 | Rättat lokalt | Kvittens och aktuell uppföljning skiljer queued/sent/delivered/failed och visar aktuellt behov av komplettering. |
| F06 | Kod klar; OPS-konfiguration kvar | Server signer RS256, 60 sekunder, verifierad UID, färskt jti per försök. Issuer/audience/nyckel och OPS report/required/replayprov behöver verifieras. |
| F07 | Rättat lokalt | Core-översikt fungerar vid supportfel. Separata read/write-supportprober och tydlig supportdiagnostik. |
| F08 | Rättat lokalt | Gemensam deadline omfattar headers, body och retries. Långsam body och klientabort regressionstestade. |
| F09 | Rättat lokalt | Explicit retryable=false stoppar transport och outbox. Backoff avbryts när deadline/klient avbryter. |
| F10 | Rättat lokalt | CAS-claim och completion/failure matchar försöksnummer och claimtid. Gammal worker kan inte avsluta det nya försöket. |
| F11 | Migrationsunderlag klart; målrelease kvar | 45 filers manifest verifierat, sex nya migreringar, katalogreadiness med rätt projekt. Befintlig saknad staff-delivery-migration måste avstämmas och appliceras separat; ingen blind historisk replay. |
| F12 | UI rättat; Auth-inställningar kvar | Profilbyte använder gemensam lösenordspolicy. Supabases styrka och kontroll av läckta lösenord behöver ställas in/verifieras i Auth. |
| F13 | Rättat lokalt | 60 s adaptiv pollning, dold/offline-paus, deadline och terminalstopp. Verifierad ansökan får egen kvot; delad IP har separat högre missbrukskvot. |
| F14 | Rättat lokalt | Distribuerad begränsning avvisar vid infrastrukturfel i produktion. Bunden reservcache i utveckling och Vercels ingress-IP-header. |
| F15 | Dubbletter och Web-index rättade; belastningsmätning kvar | Strukturell indexkontroll samt 54 exakt dubblerade policyer på 19 tabeller. Migreringen bevarar roller/villkor och hoppar över avvikande kataloger. 665 syntetiska behörighetsutfall bevaras. Övriga rådgivarvarningar kräver verkliga frågeplaner; de är inte bevisade fel. |
| F16 | Rättat i hela beroendekedjan | Full npm audit visar 0 sårbarheter. Next/eslint-config-next 16.3.8. Endast Next-lintens fast-glob byts till låst tinyglobby 0.2.17; faktiska Next-regler och katalog-/monorepomönster testade. Supabase-paket låsta. |
| F17 | Rättat lokalt | Synliga kanoniska prisrader, enheter, momsbelopp och årsbelopp bevaras/visas. Dolda rader exponeras inte. OPS totalsummor används. |
| F18 | Rättat lokalt | Momsmetadata följer publika komponenter till presentation. Okänd moms anges som okänd; inga antagna konverteringar. |
| F19 | Rättat lokalt | Produktion visas som ersättning och årsproduktion. Energiriktning följer med även startsidans kalkylatoralternativ. |
| F20 | Rättat lokalt | Adressfingerprint valideras med offertens kid. Offert överlever nyckelrotation och tidsförlopp. |
| F21 | Rättat lokalt | Svenskt kalenderdygn används direkt i pris-URL, strikta datum avvisar ogiltiga datum. |
| F22 | Rättat lokalt | Aktuellt pris kräver intervall som täcker nu. Historiskt/framtida intervall blir aldrig aktuellt pris. |
| F23 | Rättat lokalt | Null/ogiltigt är inte noll; hela dygn krävs i beräkningsunderlag. 23/25-timmars sommartidsdygn och negativa/nollpriser testade. |
| F24 | Rättat lokalt | Saknat fakturabelopp bevaras som null och visas Inväntas. Verkligt nollbelopp bevaras som 0. |
| F25 | Rättat lokalt | Avtalets avgifter, energiriktning, bindning/uppsägning och förlängning bevaras. Okänt skapandedatum uppfinns inte. |
| F26 | Rättat lokalt | Förfrågningsgeneration skyddar hela adress-/offert-/checkoutkedjan från sena svar. Verklig komponent testad i Chromium. |
| F27 | Legacy rättat; OPS-prisägande tydliggjort | Skapa/klona/spara/publicera/avpublicera sker atomiskt med DB-behörighetskontroll. Tidigare publicerad version förblir skyddad. Legacyadmin märks intern; publicerade kundpriser ändras i OPS. |
| F28 | Rättat lokalt | Publik offertvalidering begränsas och kontrollerar token före uppströmsanrop. Juridiskt paket har kvot och referensgräns. Ingen offerttimer. |
| F29 | Rättat lokalt | Fyra parallella marknadsanrop, delad pågående månadsberäkning och begränsad kort cache. 128 samtidiga förfrågningar gav 30 anrop, max 4 parallella. |
| F30 | Kod + migration klara; mejldrift kvar | Ticket, meddelande och kvittenskö skapas atomiskt/idempotent. Worker har stabil provider-nyckel, claimskydd och manuell hantering efter idempotensfönstret. Sender/cron och riktig leverans återstår. |
| F31 | Rättat lokalt | Äldre GET-signering utför inga skrivningar. Gamla resultatsidor gör inga framgångspåståenden; gamla avtalsskaparen är avvecklad. Äldre legal-accept returnerar 410. Falsk welcome_email_sent-finalisering borttagen; kanonisk OPS-checkout används. |
| F32 | Rättat lokalt | notification_references skickas enligt API-kontraktet. Lokal projektionsskrivning är serverägd. |
| F33 | Rättat lokalt | facility_reference och kapslad adress mappas enligt aktuellt DTO. |
| F34 | Rättat lokalt | secure_url blir säker HTTPS-dokumentlänk och versionen bevaras. |
| F35 | Rättat lokalt | Nät-/elområde visas som fastställda uppgifter. Formuläret samlar bara in fält som API:t accepterar. |
| F36 | Rättat lokalt | document_version/-reference/-hash samt fullmaktens valid_to bevaras. Okänd fullmaktsstatus anges inte aktiv. |
| F37 | Rättat lokalt | Pending review/access_granted=false visas väntande. Obehandlad anläggnings-/profiländring markeras inte genomförd. |
| F38 | Rättat lokalt | Oförändrat omförsök behåller operation-ID, även i användarbunden sessionStorage efter sidomladdning. |
| F39 | Rättat lokalt | Profilsynkens återställning ligger inom felgränsen. Lyckad OTP ger fortsatt återkomst med pending-status vid DB-avbrott. |
| F40 | Rättat lokalt + migration | Verifierad aktuell Auth-email används vid atomisk profilcommit. Ny bekräftad email tappas inte bakom äldre pågående jobb; claim skyddar avslut. |
| F41 | Rättat lokalt | 429 och email-rate-limit ger instruktion att vänta. Felaktig adress och nätverksfel har egna besked. |
| F42 | Rättat i Resend | Aktiv webhook inkluderar email.complained och email.delivery_delayed. Läsning efter ändringen verifierar samtliga sex händelser. |
| F43 | Rättat lokalt | Osignerad processing-kvittens använde null som datum och blev direkt utgången. Den använder nu försökets oföränderliga mottagningstid, utan att hitta på ett signeringsdatum. Upprepade försök ger samma giltiga token; lagringsfel avgränsas efter mottagen ansökan. |
| F44 | Rättat lokalt | Kvittenskörningen begränsas till fyra 12-sekunders provideranrop och har 60 sekunders funktionsbudget. Övriga kvittenser ligger kvar i kön. |

## Levererat byggunderlag och testbevis

Rättningarna finns i arbetskopian. Befintliga tester och nya regressioner är körda utan att skapa kundansökningar, konton eller testmejl i produktion. Den aktiva Resend-webhookens prenumeration har uppdaterats; övriga skarpa releasesteg är inte genomförda.

- Full Web-testsvit inklusive nya API-/SQL-/köregressioner: `npm test`.
- Supportens testsvit: `npm run test:support`.
- Isolerade Chromium-tester med syntetiska svar: `npm run test:audit:browser`.
- Web- och supportbyggen, TypeScript och ESLint: godkända, lint utan fel/varningar.
- Levande OpenAPI speglar exakt kontrakt `2026-10-04.1`; migrationsmanifestets 45 filer saknar tidskollisioner.
- Ny regressionssvit provar bland annat kundisolering, nekade skrivgrants, aktuellt verifierat Auth-email, transaktionsrollback, köägarskap, provider-idempotens, moms/avgiftsrader, DST och nyckelrotation.

Nya testbevis och kommandoresultat sparas under [åtgärdsbevis](atgardsbevis/verification-results.json). Ursprungliga `CONFIRMED`-loggar nedan dokumenterar felen **före** implementationen och ska inte tolkas som den rättade kodens testresultat.

## Beroendesäkerhet efter sista rättningen

Full `npm audit` visar nu **0 sårbarheter**, även för utvecklingsverktygen. Den opatchade braces-kedjan har tagits bort genom ett riktat npm-override för Next-lintens enda användning av fast-glob. tinyglobby 0.2.17 har samma nödvändiga globSync-anrop och katalogfiltrering. Ett test anropar Nexts verkliga root-dir-resolver med standardrot, explicita kataloger, arrays, brace-mönster och monorepomönster; hela linten passerar utan att regler stängs av. Versionslåset och npm-ci kontrolleras. Ursprungliga granskningsrapporter nedan beskriver fortfarande den tidigare sårbarheten som historiskt underlag.

## Kvarvarande produktionssteg

Produktionssläppet är ännu inte klart. [Release- och återställningsplanen](RELEASE-OCH-VERIFIERING.md) anger ordning, databasschema, miljövariabler och tester som återstår. `npm run release:audit:check` avvisar saknad konfiguration, fel projekt/revision, saknade DB-prerequisiter och saknade skarpa testbevis.

1. Förbered och verifiera rätt Web-revision tillsammans med de sex nya migreringarna och separat avstämd staff-delivery-prerequisite. Kör inte hela gamla migrationshistoriken mot prod. Staff-prerequisiten består av privat tabell och tre RPC:er; samtliga saknas fortfarande i målprojektet.
2. Verifiera OPS assertionpolicy och nycklar samt supportens mål, behörigheter och integration.
3. Verifiera Supabase Auth/SMTP/mallar/redirects och skydd mot läckta lösenord. Konfigurera supportkvittensens avsändare och cron.
4. Genomför verklig kontobekräftelse, återställning och mottagning i en godkänd testinkorg. Testadress och explicit tillstånd för dessa utskick inväntas.
5. Slutför [F15-triagen per tabell](F15-DATABASTRIAGE.md) med representativa frågeplaner och rollmatris för den delade OPS-databasen.

## Ursprungligt granskningsunderlag

Följande avsnitt återger observationerna från granskningen före rättningen. Historiska formuleringar om att inget ändrats gäller den fasen. Aktuell status finns i tabellen ovan.

## Grundgranskning F01–F16

Granskad 2026-10-06. **Projektet kan inte bedömas som korrekt genom hela kundflödet ännu.** Det finns verifierade brister i identitetsskydd, behörigheter och tolkning av ansökans resultat. Befintliga tester och byggsteg passerar, men täcker inte dessa fel eller verklig mejlleverans.

Rapporten omfattar Web-kod, ansökan, kvittens, autentisering, onboarding, kundportal, supportintegration, API-transport, bakgrundsjobb, Supabase-behörigheter, migrationsläge, beroenden och prestanda. OPS används som dokumenterad affärs-API-gräns; detta är ingen fullständig intern revision av OPS-systemet.

**Fortsatt granskning:** [priser, beräkningar och återstående flöden](PRISER-OCH-RESTERANDE.md) dokumenterar ytterligare 15 punkter F17–F31, bland annat fel marknadsdygn i produktion, förlorade prisrader/momsmetadata, portalvisning, kalkylatorns asynkrona svar och äldre admin-/signeringsvägar. Den verifierar också användarens krav: kundofferten ska inte ha en femminuterstimer eller löpa ut enbart för att tiden passerar. Totalt finns 31 prioriterade granskningspunkter; villkorliga risker är markerade separat från observerade fel.

**Mina sidor och mejl:** [kundportal, kontoverifiering och leverans](MINA-SIDOR-OCH-MEJL.md) tillför F32–F42. Underlaget omfattar tio nya reproducerade kod-/kundflödesfel samt saknade händelser i aktiv leveranswebhook. Totalt finns nu 42 prioriterade punkter. Domänen är verifierad hos mejlprovidern, men Supabases skarpa SMTP/mallar och verklig end-to-end-mottagning är fortfarande inte verifierade.

## Underlag och bevisnivå

- Lokal Web-revision: `188e475d18341a9ec9a531d9705da8988d9e9f6b`.
- Aktiv Vercel-produktion för `gridex.se`: `ff950425b6922df88817f840dc5a395cbceab8eb`, deployment `dpl_AzzAxuYSZpjRdbNWbC5w7KLyQCfb`, READY.
- Supabase-anslutning **gridex web**, projekt **gridex-prod**, ref `ayiuxjlfazkjmmtlvhsl`, PostgreSQL 17.6.1.063, eu-north-1.
- [Levande API-dokumentation](https://app.gridex.se/developers/customer-portal-api), version `2026-10-04.1`. Hämtade Website- och Customer Portal-OpenAPI-filer matchar Webs lokala specifikationer byte för byte.
- Website SHA-256: `311c1fd85a82aec158bc5e391bcd380a8a944d7762a7fdeebb24cc0ae7da6a47`.
- Customer Portal SHA-256: `2ada64c650234d8cf8e5191c68d6b6ab8b47586c5fef13feeb611a9bddb79294`.

**Verifierat** betyder kodfel reproducerat med syntetiska API-svar eller konstaterat i produktionsdatabasens kataloger. **Villkorligt** betyder att felet beror på en produktionsinställning som inte kunnat kontrolleras. **Återstår** betyder att skarp funktion inte har bevisats. Kataloggranskning är inte samma sak som ett exploitförsök mot verkliga kunder.

Ingen produktionskod, databas, konfiguration eller kunddata har ändrats. Inga ansökningar, utskick eller inloggningsförsök med riktiga kunder har skapats. Underlaget består av läsningar, offentliga GET-anrop och lokala testkörningar. Rapportfilerna innehåller katalogmetadata och aggregerade värden, inte kundregister.

## Prioriterad fellista

P1 ska lösas före nästa breda kundrelease. P2 ska lösas i samma stabiliseringsarbete och verifieras före godkännande av respektive funktion. Ingen verifierad P0-incident eller bevisad åtkomst till annan kund har konstaterats.

| ID | Prioritet | Problem | Bevis |
|---|---|---|---|
| F01 | P1 | Kunden kan ändra serverägda identiteter och skriva affärsprojektioner | Produktionskatalog + kod |
| F02 | P1 | Web anropar RBAC- och login-RPC:er som sessionrollen saknar rätt att köra | Produktionskatalog + kod |
| F03 | P1 | Produktion, aktuell kod och OPS-kontrakt är olika revisioner | Vercel + publikt API |
| F04 | P1 | Ansökans obligatoriska `checkout` styr inte resultatet | Reproducerat mot giltiga OpenAPI-svar |
| F05 | P2 | Bekräftelse och nästa steg visas från frysta resultatfält | Kod |
| F06 | P1 om assertion krävs | Kundassertion saknas i API-klienten | Kod; OPS-kravets aktivering återstår |
| F07 | P2 | Supportfel kan slå ut hela kundöversikten; readiness missar beroendet | Kod |
| F08 | P2 | Timeout gäller inte under läsning av svarskroppen | Reproducerat |
| F09 | P2 | Återförsök ignorerar explicit `retryable=false` | Reproducerat + kod |
| F10 | P2 | Gammal outbox-worker kan avsluta en ny workers försök | Reproducerat med modellerad DB-gräns |
| F11 | P2 / releasekrav | Migreringar och supportprerequisiter är inte avstämda mot prod | Produktionskatalog + migrationsfiler |
| F12 | P2 | Olika lösenordsregler; läckta lösenord kontrolleras inte | Reproducerat + Auth-advisor |
| F13 | P2 | Statuspollning är ineffektiv och kvittensen uppdateras otillräckligt | Kod |
| F14 | P2 | Rate limiting tappar distribuerat skydd vid DB-fel | Kod |
| F15 | P2 | Överlappande RLS och index med onödig kostnad | Produktionsadvisors |
| F16 | P1 för triage | Kända sårbarheter i installerade produktionsberoenden | npm audit; exploaterbarhet varierar |

### F01 – Skydda kundidentitet och affärsdata från direkta klientskrivningar

**Fel:** `authenticated` har INSERT/UPDATE på hela `customer_profiles`. Ägarpolicyerna kontrollerar endast `auth.uid() = user_id`. Kunden kan därmed ändra exempelvis `customer_number`, `external_customer_id`, `portal_identity_id`, `contract_customer_ref`, `canonical_ops_id`, `tenant_reference`, `upstream_revision` och `email_verified_at` på sin egen rad. Den enda relevanta profiltriggern uppdaterar tidsstämpeln; den låser inte identitetsfält.

`lib/customerPortal/service.ts:632` bygger OPS-identitet från just profilens kundnummer och externa ID. Teckningsflödet återanvänder också profilens externa ID. RLS skyddar vem som äger raden men inte vem som bestämmer dess identitet.

Dessutom tillåter ägarpolicyerna ALL på `customer_delivery_points` och `customer_notifications`, inklusive klientskrivningar. `customer_contracts_owner_insert` tillåter en användare att infoga en avtalsrad med eget `user_id`, utan att den policyn kräver företagets skrivbehörighet. De parallella företagsvillkoren är permissiva: de kombineras med OR, så de skärper inte ägarpolicyn. Tabellens affärsfält saknar CHECK- och skyddstriggers som skulle ersätta detta behörighetskrav.

**Konsekvens:** lokal identitet och affärsprojektion kan förfalskas. OPS kan fortfarande stoppa felaktig kundbindning; åtkomst till annan kund är inte bevisad. Även utan sådan åtkomst kan förfalskade lokala data störa onboarding och framtida funktioner som litar på projektionen.

**Bygg korrekt:** separera kundredigerbara kontaktuppgifter från en serverägd, tenantbunden identitetsmappning. Återkalla tabellövergripande klientskrivrättigheter; smala kolumngrants hjälper först när breda grants är borta. Låt verifierad BFF/RPC ändra kontaktuppgifter och låt backend ensam skriva identitet, avtal och projektion. Anpassa profilactionen som nu också skriver synkmetadata. Behåll läs-RLS per ägare/tenant. Testa verkliga PostgreSQL-roller i staging med två syntetiska kunder: ingen ska kunna ändra identitet, signeringsstatus, tenant eller andra kunders data.

**Underlag:** [identitets- och policykatalog](identity-policy-evidence.json), [övrig databaskatalog](database-evidence.json).

### F02 – Anpassa Webs RBAC-anrop till produktionsbehörigheterna

**Fel:** `authenticated` saknar EXECUTE på `gridex_get_user_permissions`, `gridex_has_permission`, `gridex_can` och `gridex_log_customer_login`. Web använder fortfarande sessionklienten för dessa funktioner i `lib/auth/permissions.ts:12`, `lib/admin/getAdminContext.ts:45`, `proxy.ts:96` och `app/login/actions.ts:60`.

Login till `/admin` loggar ut användaren vid RPC-fel innan eventuell rollfallback kan användas. Admin-context kastar fel och behörighetsläsning kan bli en tom lista. Loginloggningen vid `app/login/actions.ts:99` kontrollerar inte Supabases returnerade `{error}`; try/catch upptäcker därför inte vanliga RPC-fel.

**Bygg korrekt:** verifiera användaren med Auth först. Hämta därefter behörigheter via en serverägd funktion med UID hämtat från verifierad session, eller skapa snäva klientfunktioner utan godtyckligt `p_user_id`, bundna till `auth.uid()`. Hantera både returnerade fel och kastade fel. Återöppna inte generella SECURITY DEFINER-funktioner för valfria användar-ID:n. Kontrollera kundlogin, adminlogin, avstängd roll och behörighetsbyte i den databas som releasen faktiskt ska använda.

### F03 – Granskad kod är inte samma kod som ligger på gridex.se

**Fel/risk:** aktiv produktion kör commit `ff950425…`, medan granskad main är `188e475…`. Publika kontraktsflödet rapporterar API-version `2026-10-02.4`; aktuell OPS-dokumentation och lokala specifikationer är `2026-10-04.1`. Det visar versionsskillnaden, men bevisar inte att varje äldre endpoint redan är inkompatibel.

`vercel.json` har deployment från main avstängd. Projektets releaseanteckningar beskriver en avsiktlig paus inför support-/assertion-/readiness-verifiering. **Pausen är inte i sig ett fel och ska inte tas bort för att forcera en release.**

**Bygg korrekt:** skapa en release med fast Web-SHA, OPS-kontraktsversion och DB-migrationsmanifest. Kör samma kundscenarier i preview/staging mot rätt tenant och målprojekt. Stäm av F01–F06 och supportprerequisiter innan releasen får gå till prod. Spara verifierad driftskonfiguration utan hemliga värden och en rollbackplan.

**Underlag:** [release](release-evidence.json), [publik feed](public-feed-metadata.json).

### F04 – Ansökans resultat måste styras av `data.checkout`

**Fel:** dokumentationen kräver att `checkout.page_state` och `checkout.thank_you_ready` styr resultatvyn. `mapOpsCustomerApplicationResult` i `lib/ops/client/application.ts:612` bevarar råsvaret men exponerar inte detta objekt i den typade resultatkedjan. `assertAcceptedApplication` vid rad 711 kräver i stället `status=accepted`, signerat avtal och `workflow_state=canonical_data_committed`. Resultatlagring och tackvy bygger vidare på dessa äldre fält.

Två syntetiska svar validerade mot verklig OpenAPI reproducerar felet: ett svar med `page_state=action_required` och `thank_you_ready=false` passerar accepted-kontrollen om äldre fält säger accepted/signed; ett kontraktsgiltigt processing-svar avvisas som `ops_application_not_accepted`/502. Frontend kan då visa fel efter att OPS redan har tagit emot affärsoperationen.

**Bygg korrekt:** mappa och validera checkout genom hela klient → submission → kvittens → UI. Använd en explicit resultattype för `success`, `success_action_required`, `action_required` och `processing`. Visa lyckad avslutning endast när API:ts flagga medger det. Håll affärsmottagning, signering, portal och mejlleverans som separata tillstånd. Ett timeout-/processingresultat ska återställas via samma ansökan och idempotensnyckel; det får inte orsaka en ny oavsiktlig ansökan.

**Underlag:** [reproduktion](reproduction-results.txt), [testkod](reproduce.mjs).

### F05 – Kvittensen måste skilja mottagen ansökan från skickat och levererat mejl

**Fel:** `lib/website/applicationResultStore.ts` och `app/(public)/teckna-avtal/tack/SignupThanksPage.tsx:85` använder frysta `communicationQueued/Sent/Failed`. Application-statusmappningen i `lib/ops/client/website.ts` tar inte med checkout/aktuell kommunikation till denna vy. En senare leverans, leveransförlust eller ändrad nästa åtgärd uppdaterar inte den gamla kvittensen. Portalinbjudan och avtalsbekräftelsen har dessutom separata livscykler; deras tidsordning är inte garanterad av nuvarande kod.

**Bygg korrekt:** behåll ett oföränderligt kvitto på inskickat material och en separat aktuell statusmodell. Mappa `checkout.confirmation_email` och dokumenterade leveranstillstånd. Visa mottagen, köad, skickad, levererad och misslyckad med korrekt betydelse; en köpost är inte bevis för leverans. OPS ansvarar för affärsbekräftelsen och signeringsdokumenten, Supabase Auth för kontobekräftelse/inbjudan. Web får inte kompensera osäker status genom att skicka ett extra affärsmejl.

Verifiera e-postadress, PDF/version/hash, ångerinformation, suppression/bounce, återförsök och dubbelinsändning med testmottagare. Faktisk leverans är **inte verifierad** i denna granskning.

### F06 – Implementera kundassertion innan OPS kräver den

**Villkorlig lucka:** dokumentationen beskriver `x-gridex-customer-assertion`, med validerat JWS och möjlighet till report/required-läge per organisation. Genererade typer känner till headern, men kundklienten signerar och skickar ingen sådan assertion. Personalassertion i `lib/staff-api` är ett separat protokoll och ersätter inte kundassertionen. OPS-organisationens aktiva läge har inte kunnat kontrolleras.

**Bygg korrekt:** använd serverlagrad nyckel och dokumenterad RS256/PS256/ES256, rätt `iss`, `aud`, verifierat och kopplat `sub`, `iat`, högst 15 minuters giltighet och unikt `jti`. Ta identiteten från session och serverägd mappning enligt F01. Verifiera först report-läge, sedan required-läge, inklusive fel tenant, utgången token, fel signatur och återspelning enligt OPS kontrakt. Säkerställ rotationsrutiner och att aldrig exponera signeringsnyckeln för klienten.

### F07 – Support ska ha en egen förmåga och felgräns

**Fel:** `getCustomerPortalOverview` i `lib/customerPortal/service.ts:734` kör supportärenden och core portal-bundle i samma `Promise.all`. Saknad `customer_support.read`, en 403 eller supportavbrott avbryter hela kundöversikten trots att avtal och fakturor kan vara tillgängliga. `lib/ops/portalReadiness.ts` verifierar core-förmågor men har inga egna supportprober/scopes.

**Bygg korrekt:** verifiera support separat när funktionen är aktiverad. Rendera core-data när core-läsningen fungerar och visa ett tydligt tillfälligt fel i supportdelen. Håll allvarliga core-identitets-/auktorisationsfel blockerande. Prova core fungerande + support 403/timeout/503 och säkerställ att avtal/fakturor fortfarande kan visas. Prova supportskrivning med exakt `customer_support.write` och återspelad idempotensnyckel.

### F08 – API-timeout måste omfatta hela svaret

**Fel:** `lib/ops/transport.ts:269` rensar timeouten när fetch har fått headers, innan JSON-kroppen lästs. En uppströmsserver som skickar headers men sedan stannar kan hålla anropet öppet längre än konfigureringen avser. Reproduktion visar väntande body efter 1 200 ms trots 1 000 ms timeout och ingen abort.

**Bygg korrekt:** behåll deadline genom bodyläsning och validering, rensa i slutlig `finally`. Dela en övergripande deadline mellan försöken och avbryt eller dränera kroppen före återförsök. Testa sena headers, långsam body, avbruten klient och icke-JSON-svar.

### F09 – Respektera API:ts beslut om återförsök

**Fel:** transporten återförsöker GET/HEAD för 429/502/503/504 innan felobjektet tolkats. Ett 503-svar med `retryable=false` anropas tre gånger i reproduktionen. Outboxens klassning i `lib/customerPortal/outbox.ts:280` bygger på HTTP-status och bortser också från explicit permanent fel på 5xx.

**Bygg korrekt:** låt ett giltigt `retryable=false` stoppa automatiska försök. Respektera Retry-After enligt kontraktet, använd backoff med jitter och gemensam deadline. Behåll exakta payloadbytes och nyckel vid tillåtna idempotenta skrivförsök. Permanent fel ska direkt till tydlig avvikelse/dead-letter med operatörsåtgärd. Nuvarande transport gör endast ett försök för POST; den delen ska inte ersättas med blinda POST-retries.

### F10 – Outbox behöver ett låst claim med ägarskap för varje försök

**Fel:** worker återtar processing-jobb efter 15 minuter. Completion och failure matchar bara rad-ID och `status=processing` (`lib/customerPortal/outbox.ts:262–301`). Om worker A lever vidare efter återtag och worker B hunnit claima jobbet kan A avsluta B:s försök. En testharness med verklig worker och modellerad Supabase-gräns reproducerar detta. Det är inte ett genomfört race i produktionsdatabasen; outboxen var tom vid granskningen.

**Bygg korrekt:** claima atomärt i PostgreSQL, exempelvis med `FOR UPDATE SKIP LOCKED`, och tilldela ett unikt `claim_token` per försök. Completion/failure måste jämföra samma token. Skydda även lokala projiceringsskrivningar från äldre försök. Gör flertabellsfinalisering i en DB-transaktion och använd idempotent saga för externa OPS-operationer. Ha larm och kontrollerad återspelning för dead-letter. Testa med två riktiga DB-workers samt avbrott före och efter externa anrop.

**Underlag:** [race-resultat](outbox-results.txt), [harness](outbox-reproduce.mjs), [loader](outbox-loader.mjs).

### F11 – Avstäm migrationshistorik och rätt supportdatabas före release

**Verifierat:** repo har 39 kontrollerade migrationsfiler. Prod registrerar sex migreringar, bland annat `20261002192814_gridex_web_server_owned_rbac`, som saknar motsvarande filnamn i repo. Många övriga objekt finns redan i databasen; detta bevisar **inte** att 33 migreringar saknas.

`support_private.staff_invitation_deliveries` och `public.gridex_support_claim_staff_delivery_v1(jsonb)` saknas i gridex-prod. De finns i den lokala migrationen `20261005125326_support_staff_invitation_delivery_private.sql`. Support kan använda separat mål via `GRIDEX_SUPPORT_SUPABASE_URL`; dess skarpa bindning är inte verifierad. Saknade objekt blockerar därför denna funktion **om** gridex-prod är målet, men är inte bevis för att aktiv supportproduktion just nu är trasig.

**Bygg korrekt:** jämför faktisk schemafunktion, grants, triggers, index och funktioner med målmanifestet. Återskapa produktionshärdningen som spårbar migration och ändra samtidigt anrop enligt F02. Applicera endast saknade kompatibla steg i staging, därefter kontrollerat i rätt prodprojekt. Kör inte samtliga historiska filer blint och skriv inte om redan applicerade checksummor. Readiness måste verifiera rätt projektref samt nödvändiga supporttabeller/RPC:er, inte bara lokal filintegritet.

### F12 – En gemensam lösenordspolicy i UI och Auth

**Fel:** register/reset använder `lib/auth/passwordPolicy.ts` med minst åtta tecken, versal, siffra och specialtecken. Profilens `app/dashboard/profile/actions.ts:18` kontrollerar enbart längden. Reproduktion visar ett lösenord som profilvalideringen accepterar men gemensamma policyn avvisar. Om Supabase accepterar lösenordet beror på dess skarpa Auth-konfiguration, som inte verifierats fullt ut. Auth-advisor visar att skydd mot läckta lösenord är avstängt.

**Bygg korrekt:** en delad validerare för alla ingångar och motsvarande serverpolicy i Auth. Aktivera Supabases kontroll av läckta lösenord där projektplanen stöder den. Testa registrering, inbjudan, reset, byte och felmeddelanden konsekvent; befintliga sessioners hantering vid lösenordsbyte ska vara avsiktlig.

Se [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

### F13 – Begränsa statuspollning och uppdatera rätt tillstånd

**Fel:** `components/signup/SwitchStatusCard.tsx` gör ett omedelbart GET och därefter ett anrop var 30:e sekund. Den stannar på ett terminalt lyckat svar, men fortsätter vid permanent fel/utgången token och i dolda flikar. Det separata application-kortet hämtar en gång och följer inte senare kvittensförändringar. Switch-endpointens 30 anrop/10 minuter per IP kan överskridas av två flikar som tillsammans gör cirka 40 anrop.

**Bygg korrekt:** starta från det bekräftade POST-resultatet. Använd webhookdriven statuslagring och klientuppdatering när tillgängligt, med adaptiv pollning som fallback. Pausa dolt/offline, använd backoff, stoppa utgångna token/permanenta fel och terminala tillstånd, och samordna flikar eller samma ansökan. Rate limiting ska skydda missbruk utan att normal statusvisning bakom delad IP själv orsakar 429-loopar.

### F14 – Rate limiting ska vara effektiv även vid infrastrukturfel

**Fel:** `lib/security/rateLimit.ts` faller tillbaka till en processlokal Map när den delade DB-funktionen misslyckas. Flera serverless-instansers kvoter samordnas då inte. Map saknar dessutom städning av gamla distinkta nycklar. Detta är en konstaterad försämring vid fel, inte bevis för pågående missbruk.

**Bygg korrekt:** bestäm degraderingspolicy per endpoint. Känsliga skriv-/authflöden behöver ett fortsatt delat skydd eller kontrollerad avvisning; publika läsflöden kan ha annan tolerans. Begränsa och städa reservcachen, larma på fallback och verifiera vilka IP-headers plattformen garanterar. Kombinera identitet/ansökan och betrodd klient-IP där det passar. Återanvänd serverklient när möjligt och mät rate-limit-anropens kostnad.

### F15 – Databasen har överlappande index och policyer

Advisors rapporterar sex grupper med duplicerade index, 60 oindexerade FK, 194 oanvända index och 537 varningsinstanser för flera permissiva policyer. Den sista siffran är kombinationer av tabell/roll/operation, **inte 537 tabeller**.

Duplicerade grupper finns på `company_memberships`, `contract_area_pricing`, `contract_pricing_versions`, `customer_sites`, `gridex_monthly_spot_prices` och `gridex_spot_basis_publish_log`. Extra index kostar skrivtid och lagring. F01 visar också varför överlappande permissiva policyer behöver granskas som behörigheter, inte enbart prestanda.

**Bygg korrekt:** förena policyer efter en explicit behörighetsmatris; OR får aldrig råka ge mer rätt än avsett. Bevara unikhets-/FK-skydd när överflödiga index tas bort. Indexera bara FK och sort/filterkombinationer som relevanta läs-/skrivplaner behöver. Bekräfta med representativa data och `EXPLAIN (ANALYZE, BUFFERS)` i staging. Ta inte bort index bara för att användningsstatistiken för aktuell mätperiod är noll.

Datamängderna i Web-tabellerna är små: fem profiler, 18 submissions och fem onboardingjobb vid mättillfället; inga deadlocks noterades. Det går därför inte att dra slutsatser om produktionskapacitet från dessa tabeller. RLS är påslaget på publika tabeller och granskade vyer har `security_invoker=true`. RLS utan klientpolicy på backendtabeller är ofta avsiktlig avskärmning, inte automatiskt en sårbarhet.

Se [duplicerade index](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index), [FK-index](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [permissiva policyer](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) och [oanvända index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). Full objektlista: [advisors.json](advisors.json).

### F16 – Uppdatera sårbara beroenden efter faktisk exponering

**Verifierat:** `npm audit --omit=dev` rapporterar åtta beroenden: en critical, sex high och en moderate i den låsta installationen. Next är 16.3.0; advisories omfattar bland annat versioner före 16.3.3/16.3.6 samt transienta beroenden såsom sharp, fast-uri och source-map-js. Detta visar versionsmatchning, inte genomförd exploatering.

En Next-advisory avser Windows/image-AVIF; Vercel kör Linux och granskad direkt Next/Image-användning är SVG-logotyp. En annan avser next/og, som inte hittats som direkt användning i Web. Den faktiska exponeringen behöver därför bedömas per advisory. Risk för en använd bild-/parserkedja kan inte avfärdas enbart med en totalsiffra.

**Bygg korrekt:** kontrollera advisories i [dependency-audit.json](dependency-audit.json), välj publicerad korrigerad kompatibel Next 16-version, kontrollera särskilt minst de noterade fixgränserna och uppdatera berörda transitiva paket. Granska ny lockfil, kör Node 22-build och relevanta regressioner och därefter ny audit. Undvik automatisk `audit fix --force` som kan ändra huvudversioner utan funktionsverifiering.

## Så bör flödet byggas

| Del | Källa/ägare | Webs ansvar |
|---|---|---|
| Utbud, offert och villkor | OPS Website API | Visa rätt publicerad version, bind offert och juridiskt underlag till ansökan |
| Kundansökan/signering | OPS | Validera indata, skicka exakt idempotent operation, tolka hela checkout |
| Avtal, PDF, affärsbekräftelse | OPS | Visa aktuell status och länka behörigt till dokument |
| Auth och session | Supabase Auth | Verifierad server-session, säkra callbacks, konsekventa lösenordsregler |
| Auth UID ↔ OPS-identitet | Serverägd tenantbunden mappning | Ingen klientstyrd koppling; verifiera bindningen innan kundanrop |
| Mina sidor | OPS Customer Portal API | Server-BFF med rätt scopes/assertion, isolera supportfel |
| Lokala projektioner | Backend via verifierade händelser | Transaktioner, revisionsordning, idempotens och återställning |
| Bakgrundsjobb | DB-kö + backendworker | Atomiskt claim, fenced completion, dead-letter och larm |

Rekommenderat sekvensflöde:

1. Ladda publicerat utbud med ETag och rätt tenant. Cachelagra bara enligt API:ts giltighet och skilj färskkälla från cachemetadata.
2. Lös anläggning/energiriktning och skapa giltig offert. Bind exakt erbjudande, pris, giltighet och juridiska referenser/hashar till användarens samtycke.
3. Skicka ansökan med stabil idempotensnyckel och samma payload vid återspelning. Spara ansökans identitet och ursprungligt kvitto serverseit.
4. Tolka checkout utan att blanda mottagen ansökan med slutförd signering eller mejlleverans. Processing/åtgärdskrav är explicita vyer som kan återupptas.
5. Koppla befintlig verifierad användare eller skapa Auth-onboarding enligt dokumenterad policy. En e-postadress ensam får inte ge rätt till en annan kunds avtal. Lokal identitet skrivs enbart av backend.
6. OPS skickar affärsmejlet; Auth skickar konto-/verifieringsmejlet. UI visar varje livscykel från dess källa och lovar ingen obekräftad leveransordning.
7. Ta emot webhook på rå body med signatur, tidsfönster, tenantkontroll och dedupe. Uppdatera projektion transaktionellt och avvisa äldre revisioner.
8. Verifiera session på servern vid login/återkomst, slutför tillåten onboarding idempotent och läs portaldata med verifierad identitet, scopes och eventuell assertion.

### Det som redan har bra grund

Lokala OpenAPI-filer är aktuella och matchar live. Web har serverbaserad OPS-klient, offert-/juridiska bindningar, stabila idempotensmönster, Supabase SSR och safe redirect. Webhookhanteringen använder rå body, signatur/tidskontroll, dedupe och organisationskontroll. Det finns unika projekteringsnycklar och ett stort regressionstestpaket. De här skydden ska bevaras vid rättningarna.

Web använder juridiskt underlag från det kanoniska publicerade kontraktsflödet med referens-/hashkontroller. Dokumentationen beskriver också legal-bundle-läsning. Detta är inte klassat som ett bevisat avtalsfel enbart på grund av endpointvalet; verifiera att inbäddat underlag alltid motsvarar exakt legal-bundle/version och att utgången/ändrad offert kräver nytt samtycke.

Fem väntande onboardingjobb var bundna till ej bekräftad Auth och inga var förfallna för bearbetning. Deras ålder är inte ensam bevis för en trasig worker. Avstängda legacy-/BankID-endpoints ska inte räknas som fel om funktionen avsiktligt är inaktiverad och UI är tydligt med det.

## Verifiering som utförts

Körningarna gjordes mot en isolerad kopia med låsta beroenden och Node 22.23.3. Produktionshemligheter behövdes inte för dessa körningar.

| Kontroll | Resultat | Begränsning |
|---|---|---|
| `npm test` | PASS | Befintlig testsvit, syntetiska beroenden |
| TypeScript | PASS | Bevisar inte API-semantik |
| ESLint | 0 fel, 2 varningar | Oanvända `now`/`options` i pricingQuote |
| Produktionsbuild | PASS, 151 sidor | Utan skarpa runtimecredentials |
| `test:support` | PASS | Inkluderar lokala SQL/regressioner; inte skarpa providers |
| Delivery-/migrationsverifiering | PASS, 39 lokala migreringar | Lokal verifiering är inte prod-readiness |
| `api:preflight` | PASS | Färska specifikationer; Node behövde miljöns proxykonfiguration |
| Sex nya reproduktioner | Bekräftar F04, F08, F09, F10, F12 | Simulerade upstream-/DB-gränser |
| HTTP mot publik produktion | 200 på granskade sidor/API | GET, ingen kundoperation |
| npm audit | 8 rapporterade beroenden | Behöver exponeringstriage, F16 |

Enstaka externa HTTP-mätningar gav cirka 1,93 s för startsidan, 1,31 s för teckningssidan, 1,49 s för login, 1,30 s för kontrakts-API och 0,24 s för public-session. Detta är total tid från denna granskningsmiljö inklusive nätväg, **inte** Core Web Vitals eller p95 och räcker inte för att förklara en flaskhals.

Publika kontrakts-API:t visade två synliga avtal, inga blockerade eller varningar. `fetched_at` låg kvar på 2026-10-04 trots `source=live`/`stale=false`. Versions-/cachemetadata behöver följas upp; oförändrad tidsstämpel är inte ensam bevis för gammalt innehåll, eftersom ETag/304 kan återanvända ett giltigt snapshot.

Webbläsarförsök mot produktion stoppades av proxycertifikat (`ERR_CERT_AUTHORITY_INVALID`). TLS-kontrollen kringgicks inte. Därför är fullständig klickgenomgång, mobil layout, tillgänglighet och CWV **inte verifierade**. Lokal kodgranskning följde projektets web design-/React-riktlinjer, men ersätter inte dessa browserkontroller.

## Konkret byggplan i ordning

| Leverans | Innehåll | Godkännandekrav |
|---|---|---|
| 1. Identitet och behörigheter | F01, F02; spårbar säkerhetsmigration | Två kunder och admin testade med riktiga DB-roller; klient kan inte ändra identitet/avtal; loginloggar fungerar |
| 2. Ansökan och kvittens | F04, F05 | Alla checkout-tillstånd + osäker nätverksutgång; samma inskick ger ett avtal; sanningsenlig mejlstatus |
| 3. API-robusthet och kö | F08–F10, F13–F14 | Body-timeout, permanent/transient fel, 429, två workers, dold flik och flera instanser |
| 4. Portal och support | F06, F07, F11, F12 | Rätt scopes/tenant/assertion, komplett supportprerequisite, core fungerar vid isolerat supportfel |
| 5. Prestanda och beroenden | F15–F16 | Mätta SQL-/API-planer, kompatibla patched paket, inga nya regressioner |
| 6. Gemensam release | F03 + nedanstående E2E | Fast versionsmanifest, stagingbevis och rollback före produktionssläpp |

### Scenarier som måste köras före slutligt klartecken

Använd dedikerad testtenant och testmottagare, inte riktiga kunders avtal.

- Ny kund: offert → villkor → ansökan → affärsbekräftelse med korrekt PDF → Auth-bekräftelse/lösenord → Mina sidor.
- Befintlig bekräftad kund: ny anläggning/nytt avtal binds till rätt kund utan extra konto eller oavsiktlig dubblett.
- Befintlig obekräftad e-post: säkert återupptagande och nytt tillåtet verifieringsutskick, utan att e-postinnehav antas från formuläret.
- Dubbelklick, refresh och förlorat HTTP-svar: samma idempotensnyckel ger samma operation; modifierad payload behandlas enligt kontraktet.
- `processing`, `action_required`, `success_action_required` och `thank_you_ready=false`: rätt vy och återupptagande, ingen falsk success/failure.
- Mejlet köat/skickat/levererat/bounced/failed och flera webhookleveranser: korrekt aktuell status, inga dubbla affärsutskick.
- Två kunder/tenants: försök med annat kundnummer, externt ID, dokument-/fakturareferens och fel assertion ska stoppas i både Web och OPS.
- Utgången/återspelad authcallback, resetlänk och resulttoken: tydliga säkra fel och stoppad meningslös pollning.
- Saknad scope, 403, 429, 503 och långsam svarskropp: rätt degradering och begränsad belastning.
- Två workers samt krasch efter OPS-write före lokal commit: exakt affärsoperation, återställbar projektion och endast aktuell worker får finalisera.
- Mobil/desktop, tangentbord/fokus, formulärfel och live-regioner; mät LCP, INP, CLS samt p50/p95 för offert, ansökan, bundle och databas under representativ last.

Skarpa OPS-nycklars scopes/organisationsinställningar, kundassertionens läge, Vercel-miljöns fullständiga projektbindning, Auths SMTP/redirect/rate-limit-konfiguration och verklig leverans från providers har inte kunnat verifieras. Underlaget ska därför användas som **fel- och åtgärdsrapport**, inte som ett slutligt godkännande av produktionen.

## Övrig kodstädning och dokumentation

`lib/admin/rbacClaims.ts` har ett äldre helpermönster som använder rollnamn mot ett `role_id` som i prod är UUID. Inga aktiva anrop till kedjan hittades, så det är kodskuld snarare än en bevisad aktiv driftstörning. Ta bort eller bygg om det innan återanvändning. Åtgärda också ESLints två oanvända parametrar när offertmodulen ändå ändras. Ingen av dessa punkter motiverar en egen produktionsrelease.

Supabase Security Definer-advisory rapporterar sex klientkörbara helpers. De är inte samma funktioner som de återkallade RPC:erna i F02 och ska inte automatiskt beskrivas som ett exploit. Granska explicit caller/tenant-kontroll och minimala grants vid säkerhetsmigreringen. Känd-prefix-sökning hittade en uttryckligt syntetisk testnyckel, inte en konstaterad produktionshemlighet; kontrollen omfattade inte hela Git-historiken.

Använda vägledningar: Supabase-skill, Supabase Postgres best practices, hanterad molnmiljös runtime-/nätverksinstruktioner samt repots web design guidelines och React best practices. Relevant [Supabase changelog](https://supabase.com/changelog) och aktuella Auth/RLS-dokument lästes. Ingen skill krävde att ändra eller publicera produktion som del av denna granskning.

## Evidensfiler

[Databas](database-evidence.json), [identitet/policyer](identity-policy-evidence.json), [advisors](advisors.json), [release](release-evidence.json), [HTTP](http-evidence.json), [publik feed](public-feed-metadata.json), [beroenden](dependency-audit.json), [reproducerade fel](reproduction-results.txt), [outbox-race](outbox-results.txt). Loggarna för build, tester, support, typer, lint, preflight och delivery finns i samma katalog.

Reproduktionsscript körs från repots rot med installerade låsta beroenden:

```sh
node --experimental-loader ./tests/typescript-alias-loader.mjs quality/audits/2026-10-06-project-review/reproduce.mjs
node --experimental-loader ./quality/audits/2026-10-06-project-review/outbox-loader.mjs quality/audits/2026-10-06-project-review/outbox-reproduce.mjs
```

Script använder syntetiska data och stubbar, inte produktionsnycklar. För outbox krävs efter rättning dessutom det riktiga samtidighetstestet mot PostgreSQL som anges under F10.


## Priser och återstående flöden F17–F31

Granskad 2026-10-06, samma lokala revision och produktionsprojekt som i [huvudrapporten](RAPPORT.md). **Ytterligare 15 granskningspunkter, F17–F31, har identifierats.** Fynden omfattar verifierade kodfel, ett fel direkt observerat i publikt produktions-API och villkorliga risker i äldre flöden. Dokumentationen har dessutom en motsägelse om offertens giltighet som beskrivs nedan.

Ingen produktionskod, databas eller konfiguration har ändrats. Inga riktiga ansökningar, signeringar, fakturor eller mejl har skapats. Testerna använder verkliga Web-funktioner och komponenter med syntetiska svar vid externa gränser. Produktionsläsningar omfattar offentlig prisinformation, katalogmetadata och aggregerade värden.

## Priset ska inte ha en timer

**Krav från användaren:** en prisförfrågan ska inte löpa ut efter exempelvis fem minuter och tvinga kunden att söka igen.

**Aktuell kod uppfyller grundkravet:** `lib/website/pricingQuote.ts` kontrollerar signatur och innehåll utan att jämföra offertens `valid_until` med dagens tid. `lib/website/canonicalQuoteValidation.ts:168` behåller exakt accepterad offert när tiden passerar, kalenderdatumet ändras eller en ny katalogversion finns. Ett utgånget tekniskt adressunderlag förnyas automatiskt, medan ansökan behåller den resolution som bundits till offerten. Ingen kundnedräkning eller femminutersgräns för offert har hittats i den granskade koden.

- `5 * 60_000` i quote- och adress-endpointen är ett fönster för begränsning av antal anrop, inte offertens livslängd.
- Adresstoken har högst 30 minuters teknisk livslängd. Förnyelse i valideringen ska ske utan omprisning eller krav på att kunden söker igen.
- `valid_until` finns kvar i API-format och revisionsspår. Den levande OPS-dokumentationen `2026-10-04.1` säger uttryckligen att tiden inte gör kundpriset ogiltigt.
- Uttrycklig återkallelse eller ändrade kundval kan kräva en ny offert. Ny offert får inte skapas tyst enbart för att tiden gått.

De riktade befintliga testerna för offerter utan tidsutgång passerar, även med `valid_until` i dåtid och verifiering flera år senare. Se [testresultat](no-expiry-results.txt). Det verifierar lokal implementation, inte ett fullständigt autentiserat flöde mot aktiv produktionsversion, som är äldre än granskad main.

**Dokumentationsfel:** `docs/api-compatibility/staging-verification.md:72` säger fortfarande att ett passerat `valid_until` ska tvinga fram ny quote. `docs/api-compatibility/gridex-api-audit.md:32` och historikmarkeringarna i `docs/architecture/non-expiring-canonical-quotes.md` och `docs/releases/2026-07-31-non-expiring-canonical-quotes.md` beskriver också tidsbaserad utgång. Uppdatera dessa till aktuell API-regel och användarens krav, så att framtida implementation inte återinför en timer. Bevara tidsgränser för sessioner, säkerhetsbevis och tekniska överlämningar där de behövs; de ska inte bli en offertnedräkning.

## Vad som fungerar och vad som inte är bevisat fel

Kundkalkylatorn hämtar det kommersiella priset från OPS. I den reproducerade giltiga offerten behålls månadstotalen **149 kr exklusive moms / 186,25 kr inklusive moms**. Felet är att specifikationen och årsbeloppet tappas vid mappning, inte att just denna total räknas om fel i Web.

I gridex-prod finns 42 lokala pris-snapshots. Den aggregerade kontrollen hittade inga saknade månadstotaler och inga avvikelser över 0,01 kr mellan lagrad total exklusive moms + lagrad moms och total inklusive moms. Detta bevisar intern summeringskonsistens; det bevisar inte rätt affärspris, alla momsregler eller överensstämmelse med fakturering. Inga lokala kundfakturor eller äldre `contract_agreements` finns i det granskade projektet. Det säger inget om antal avtal eller fakturor i OPS.

Marknadspris för en publik informationssida kan komma från en extern marknadskälla. Kommersiell offert och slutavräkning ska däremot följa OPS. Rörligt månadspris, timpris, kvartspris och portföljpris är prognoser/prismodeller vid teckning enligt respektive settlement-fält; framtida faktisk energikostnad får inte framställas som låst enbart för att offerten har en signatur.

## Prioritering

P1 åtgärdas före bred release eller innan berörd funktion aktiveras. P2 åtgärdas och verifieras före godkännande av respektive flöde. Ett vilande äldre flöde är inte bevis för att nya OPS-flödet har samma fel.

| ID | Prioritet | Fel eller risk | Bevis |
|---|---|---|---|
| F17 | P2 | OPS-offertens synliga avgifter och årsbelopp tappas | Giltigt OpenAPI-svar → verklig mapper och rendering |
| F18 | P2 | Priskort tappar om komponentbelopp inkluderar moms | Verklig mapper + publik rendering |
| F19 | P2 före produktionsavtal | Produktionsersättning visas som förbrukningskostnad | Giltigt produktionssvar → verklig rendering |
| F20 | P2 | Nyckelrotation avvisar oförändrad adress trots giltig offertsignatur | Verklig tokenutgivning och verifiering |
| F21 | P1 | Pris-API hämtar fel kalenderdygn | Lokalt reproducerat och observerat i produktion |
| F22 | P1 | Utgånget eller framtida prisintervall kan visas som aktuellt | Lokalt reproducerat och observerat i produktion |
| F23 | P2 | Saknade priser blir noll; ofullständigt normalt dygn godtas | Verkliga marknadsdataparser |
| F24 | P2 | Okänt fakturabelopp blir 0 kr | Giltigt portalsvar → verklig mapper |
| F25 | P2 | Kundens avtalspris och villkor tappas; okänt datum uppfinns | Verklig portalmapper + UI |
| F26 | P2 | Försenat svar visar gammalt pris efter adressändring | Verklig kalkylator i lokal webbläsare |
| F27 | P1 för adminprisändringar | Prisadministration saknar atomisk sparning och verifierad OPS-koppling | Verklig action med modellerat DB-fel + kod |
| F28 | P2 | Publika valideringar gör obegränsade uppströmsanrop | Kod; ingen belastningsattack utförd |
| F29 | P2 | Marknadsprisvisning startar många parallella anrop vid tom cache | Verklig månadsfunktion med räknad fetch-stub |
| F30 | P2 | Supportbekräftelse kan tappas trots lyckat svar | Kod + saknad mejltabell i gridex-prod; runtimebindning återstår |
| F31 | P1 om äldre signering behålls | Äldre signeringsvägar ger falsk framgång och felaktiga bevis | Verklig rendering + produktionskatalog + kod |

### F17 – Bevara OPS-offertens prisrader och årsbelopp

**Fel:** `lib/ops/client/core.ts:873` bygger specifikationen via generisk komponenttolkning. Kanoniska `lines` använder bland annat `unit_price_ex_vat`, `amount_ex_vat`, `vat_amount` och `amount_inc_vat`. `pickComponentNumber` på rad 339 läser inte dessa. `resolved_price_components` utnyttjas inte heller som motsvarande komponentunderlag. Årsbeloppet läses från alternativa namn, medan OPS skickar `estimate.annual_inc_vat`.

Ett schema-validerat exempel med månadsavgift 49 kr exklusive moms och årsbelopp 2 235 kr inklusive moms gav korrekt månadstotal 186,25 kr men ingen månadsavgiftsrad och inget årsbelopp i Web. Den verkliga `PriceResultCard` utelämnade avgiften. Referensprojektionen i OPS använder dessa kanoniska radfält; testet bygger inte enbart på en hypotetisk gammal payload.

**Bygg korrekt:** mappa `estimate` och `lines` uttryckligt efter API-formatet. Bevara komponentreferens, belopp, enhet, kvantitet, momssats och visningsregel. Koppla komponentmetadata för rätt namn och synlighet. Använd OPS-totalerna och tydliga separata årsbelopp exklusive/inklusive moms. Härled aldrig öre/kWh från en hel månadsavgift eller summerad energirad. Kontrollera att synliga rader förklarar totalsumman utan att inkludera interna eller uttryckligen dolda komponenter.

### F18 – Bevara momsbetydelsen i publika priser

**Fel:** `lib/website/publicContractDisplay.ts:116` och `:171` omvandlar komponenter till formaterade rader utan att bevara `vat_included` och `vat_rate`. Ett syntetiskt giltigt komponentbelopp 49 kr/mån med `vat_included=false` visas som enbart ”49 kr/mån”. Med verifierad momssats 25 % motsvarar det 61,25 kr inklusive moms. Avtalssidan visar formaterade rader utan att klargöra moms per beloppsgrund.

Publik produktion visar också exempelvis ”49 kr/mån”. Produktionsfeedens momsmetadata för dessa rader saknar dock tillräcklig uppgift för att fastställa om just 49 kr är netto eller brutto. **Det är inte bevisat att det skarpa beloppet ska höjas till 61,25 kr.**

**Bygg korrekt:** håll beloppets momsgrund genom hela modellen. Visa konsumentpriser inklusive tillämplig moms och företagets beloppsgrund uttryckligt. Använd kanoniskt bruttobelopp eller verifierad momssats, aldrig en generell automatisk multiplikation för alla produkter. Om momsunderlag saknas, komplettera API-metadata och tydliggör priset innan publicering.

### F19 – Skilj produktionsersättning från förbrukningskostnad

**Fel:** `components/PriceResultCard.tsx:73` visar alltid ”Beräknad månadskostnad inkl. moms”. Ett giltigt svar med `energy_direction=production`, fast ersättning och nollmoms får samma rubrik och förbrukningens teckningsspråk. Kalkylatorn modellerar inte produktionsinmatning separat och läser inte produktionsriktningen för hushållets förbrukningsuppskattning.

Det publika granskade utbudet innehåller förbrukningsavtal; detta är ett verifierat stödproblem inför aktivering av produktionsavtal, inte bevis för att en nuvarande produktionskund fått fel faktura.

**Bygg korrekt:** låt ekonomisk riktning styra input, rubrik och resultat. För produktion ska kunden ange förväntad exporterad årsproduktion, få beräknad ersättning samt rätt avdrag, premie, avräkningsmodell och momsbehandling från `production_pricing`. Behåll produktion och förbrukning som separata ekonomiska flöden. Nettning och lokal beräkning får inte införas utan stöd i OPS-kontraktet.

### F20 – Använd offertens signerande nyckel även för adresskontrollen

**Fel:** `lib/website/pricingQuote.ts:104` beräknar adressens fingerprint med aktiv nyckel. Verifieringen accepterar däremot tidigare nyckel utifrån tokenens `kid`. Efter korrekt nyckelrotation verifierades den gamla signaturen, men samma oförändrade adress avvisades som `location_changed` på rad 356.

**Bygg korrekt:** verifiera och beräkna fingerprint med samma verifieringsnyckel som tokenens `kid`. `energyAreaToken.ts` har redan motsvarande mönster. Definiera hur äldre accepterade offerter kan verifieras vid rotation, utan tidsbaserad omprisning. Ett explicit komprometterat nyckelmaterial kräver en separat återkallelsepolicy, inte att alla gamla offerter råkar bli ”ändrad adress”.

### F21 – Hämta rätt svenskt kalenderdygn

**Fel:** `lib/gridex/livePrices.ts:50` tolkar en datumsträng som midnatt med fast `+01:00`. `marketUrl` och `toIsoDate` använder sedan serverns lokala datumdelar. I UTC blir det föregående dag. Sammanfattningsfunktionen tolkar datumet ytterligare en gång och kan hämta två dagar bakåt. Fast offset hanterar dessutom inte svensk sommartid.

**Observerat i produktion:** GET [pris-API för 2026-10-06, SE3](https://gridex.se/api/elpris/live?area=SE3&date=2026-10-06) svarade 200 med `date=2026-10-05`, men de 96 intervallen avsåg **2026-10-04**. Detta är ett faktiskt externt observerat prisvisningsfel. Se [sparat HTTP-underlag](pricing-public-http-evidence.json).

**Bygg korrekt:** behandla begärd `YYYY-MM-DD` som kalenderdatum utan att förvandla det till fel serverlokal instant. Använd `Europe/Stockholm` för dagens svenska datum och dygnsgränser; befintlig `stockholmCalendarDate` kan återanvändas. Validera verkligt datum, inte enbart format. Kontrollera att returnerade intervall hör till begärd dag. Testa UTC-drift, svensk midnatt, månadsskifte och sommartidsbyten.

### F22 – Visa bara ett täckande intervall som aktuellt

**Fel:** `lib/gridex/livePrices.ts:100` väljer först ett intervall som täcker tiden, men faller sedan tillbaka till senaste start före nu och till sist första raden. Därmed kan gårdagens eller morgondagens pris visas som aktuellt.

I ovanstående produktionssvar var `current.timeEnd=2026-10-05T00:00:00+02:00`, trots anrop den 6 oktober. Det negativa prisvärdet i intervallet är i sig tillåtet; aktualitetsmärkningen är felet.

**Bygg korrekt:** `current` kräver strikt `start <= now < end`. Returnera annars null och ett tydligt tillstånd för saknat/föråldrat underlag. En historisk dagsvisning ska märkas historisk. Uppdatera öppna vyer vid prisintervallets gräns utan att koppla denna informationsuppdatering till offertens giltighet. Visa datakällans och observationens tid.

### F23 – Skilj bortfall från noll och kontrollera hela marknadsdygnet

**Fel:** live-parsern gör `Number(null)` till 0. Ett saknat pris blir därmed ett verkligt nollpris. Månadsparsern kontrollerar överlapp och interna luckor samt total längd 23–25 timmar, men inte att början och slut exakt täcker begärd svensk dag. Ett 23 timmar långt, avkortat normalt 24-timmarsdygn den 6 oktober accepterades och bidrog till medelvärdet.

**Bygg korrekt:** avvisa saknat/null eller ogiltigt pris utan att förbjuda riktiga noll- och negativa priser. Validera tidsstämplar, ordning, överlapp, luckor och exakt begärd dags början/slut i `Europe/Stockholm`. Endast verkliga sommartidsdygn ska ha 23 eller 25 timmar. Dela valideringslogik mellan live- och månadsunderlag. Månadsparserns tidsviktade medelvärde är redan en bra grund; live-statistik behöver motsvarande viktning om intervallängder kan variera. Visa partiellt underlag uttryckligt där API-policyn tillåter det.

### F24 – Visa inte ett okänt fakturabelopp som 0 kr

**Fel:** portalformatet tillåter att `amount_inc_vat` och `vat_amount` saknas eller är null. `lib/customerPortal/service.ts:305` ersätter dem med 0. UI får ett känt nollbelopp även för en faktura vars belopp inte är färdigt.

**Bygg korrekt:** bevara null i portaltyper och visa ”Belopp inväntas” eller motsvarande beroende på status. Visa 0 kr endast när API uttryckligen anger ett riktigt nollbelopp. Bevara även tillgängligt nettobelopp och förbrukningsunderlag med korrekt enhet. Hitta inte på betalningsinformation som API inte levererar. Ingen skarp kundfaktura har använts i testet.

### F25 – Visa kundens faktiska avtalsvillkor

**Fel:** `lib/customerPortal/service.ts:255` kastar bort tillgängliga kanoniska fält för bland annat månadsavgift, fakturaavgift, fastpris/påslag, bindningstid, uppsägningstid, automatisk förlängning, energiriktning och signeringsbevis. `pricing_snapshot` blir ett tomt objekt. När `created_at` saknas uppfinns aktuell tid, vilket kan ändras mellan läsningar. Avtalsvyn visar främst referens och datum.

**Bygg korrekt:** mappa tillgängliga avtalsfält uttryckligt och bevara okända värden. Visa kundens accepterade prisvillkor, bindningstid och förlängningsregler från kundavtalet, inte dagens publika katalog eller marknadspris. Visa begärt och faktiskt bekräftat startdatum som skilda uppgifter när API ger dem. Bevara signeringshash och ångerfrist i revisionsunderlaget. Om avtalet behöver ytterligare pris- eller momsmetadata, begär den från kanonisk avtalsresurs.

### F26 – Förhindra att gamla prisförfrågningar återställer resultatet

**Fel:** medan kalkylatorns fetch pågår kan kunden ändra adress. Ändringen nollställer resultatet, men det gamla asynkrona svaret kan ändå köra `setResult` på `components/ElectricityCalculator.tsx:641` och visa tidigare adressens offert. Bara beräkningsknappen spärras vid laddning, inte alla indata.

**Webbläsarreproduktion:** starta förfrågan för ”Gammal gata 1”, ändra till ”Ny gata 2”, släpp sedan det gamla svaret. Den riktiga komponenten visade åter priset 186,25 kr för den gamla adressen. Serverns tuple-kontroll finns kvar; felaktigt tecknat avtal har inte bevisats.

**Bygg korrekt:** avbryt gamla förfrågningar och använd ett förfrågnings-ID/generation som ogiltigförklaras vid varje prisstyrande ändring. Kontrollera ID och input innan resolution, resultat och checkout-context sparas. Resultat och adress måste alltid avse samma underlag. Att ogiltigförklara svar efter kundens ändring är ingen offerttimer.

### F27 – Gör prisadministration atomisk och knuten till kanoniskt pris

**Fel 1:** `app/admin/pricing/[slug]/actions.ts:246` tar först bort alla områdesprisrader och gör därefter ett separat INSERT. Ett insertfel lämnar raderna borttagna. Den verkliga actionen reproducerades med ett modellerat fel vid DB-gränsen och förlorade de tidigare fyra raderna. Publiceringsactions gör också flera separata mutationer. Produktionsdatabasen har triggers för fullständiga områden och publicerad version, men de kan inte rulla tillbaka ett redan genomfört tidigare HTTP-anrop.

**Fel 2:** adminpreview säger ”Validera exakt kundspec” men använder den äldre lokala `lib/gridex/pricing/engine.ts`, andra tabeller och en annan beräkningsmodell än OPS-offerten. Saknat underlag kan få nollvärden och subtotal avrundas till hela kronor före moms. Lokala adminactions saknar ett verifierat kanoniskt OPS-publiceringsflöde. Därför kan denna preview inte godkänna kundens riktiga OPS-pris.

**Bygg korrekt:** låt OPS äga kommersiell prisdefinition och publicering. Admin ska antingen använda kanonisk OPS-preview/publicering eller tydligt begränsas till ett dokumenterat internt verktyg. Lokala skrivningar som behövs ska ske i en databastransaktion med behörighetskontroll, lås, versionskontroll och audit. Publicerade versioner ska vara oföränderliga. Sparfel ska behålla hela tidigare versionen. Ogiltigt/saknat prisunderlag får inte bli ett giltigt nollpris. Ange en decimal- och avrundningspolicy som följer OPS.

### F28 – Begränsa onödiga uppströmsanrop utan offerttimer

**Fel/risk:** `/api/checkout/quote/validate` saknar egen rate limiting och hämtar färska publika avtal innan signerade offert- och adresstoken verifieras. `/api/checkout/legal-bundle` saknar också anropsbegränsning och övre längd på `offer_reference`. Därmed kan obehöriga eller felaktiga förfrågningar ändå orsaka autentiserade anrop till OPS. Ingen skarp belastning eller tjänstestörning har framkallats.

**Bygg korrekt:** gör billiga lokala format-, längd- och signaturkontroller före fjärranrop. Använd distribuerad anropsbegränsning, deduplicering av samtidiga likadana läsningar och timeout även under svarsläsning. Behåll OPS kontroll av offertens verkliga teckningsbarhet vid submit. Rate limiting och läscache ska inte påverka giltigheten hos en redan utfärdad kundoffert.

### F29 – Beräkna och cacha månadsunderlag effektivt

**Fel/risk:** `lib/gridex/pricing/elprisetjustnu.ts:306` kör ett fetch per dag samtidigt. En 30-dagarsmånad ger 30 anrop för ett område. Informationssidan för fyra områden schemalägger 120 månadsanrop plus fyra live-anrop innan cacheeffekter; en 31-dagarsmånad ger 128 totalt. Funktionen har ingen egen begränsning av parallellism eller beständig månadsaggregatcache. Nexts befintliga fetch-cache reducerar varma anrop; detta är ingen uppmätt produktionstrafik eller latenssiffra.

`/api/elpris/monthly` ersätter dessutom ogiltigt angivet område med SE3 och ogiltig månad/år med föregående period. Kunden kan då få ett annat områdes eller en annan periods pris utan valideringsfel.

**Bygg korrekt:** importera/beräkna marknadsunderlag i bakgrund, eller dela färdiga verifierade månadsaggregat med lång cache för avslutade månader. Begränsa parallellism och dela pågående identiska hämtningar. Separera aktuell dag med kortare cache. Om källa korrigerar historik ska revision/invalidering kunna ske. Avvisa uttryckligen ogiltiga parametrar; använd defaults endast när de utelämnas. Mät kalla/varma p95-svarstider, antalet fjärranrop och fel utan att generera en skarp belastningstestburst.

### F30 – Säkra bekräftelse och idempotens i det publika supportformuläret

**Fel:** `app/api/support/public/route.ts:118` försöker infoga ett bekräftelsemejl i `system_emails` men kontrollerar inte Supabases returnerade fel. Tabellen finns inte i gridex-prod. Om endpointen kör mot det granskade projektet kan ett lyckat ärendesvar därför sakna köad mejlbekräftelse. Runtimebindningen och verklig mejlleverans återstår att verifiera; inga mejl skickades.

Ärende och första meddelande skrivs dessutom i separata anrop. Om meddelandet misslyckas kan det skapade ärendet bli kvar. `Date.now()` i request-ID gör en kundretry till ett nytt ID och kan skapa en dubblett.

**Bygg korrekt:** skriv ärende, första meddelande och en beständig mejl-outbox atomiskt med ett stabilt operation-ID. Kontrollera alla returnerade fel. Använd faktisk befintlig kö och leveransworker, med återförsök och observerbar leveransstatus. Visa ärendets mottagande separat från mejlets leverans. Det anonyma intake-flödet har en avsedd egen gräns och behöver inte felaktigt använda den inloggade kundens support-API.

### F31 – Avveckla eller rätta den äldre signeringen

**Fel:** `app/sign/email/[token]/page.tsx:13` skriver signeringsstatus i en GET-läsning. En länkförhandsvisning eller mejlskanner kan då utföra åtgärden. Sidan visar alltid ”Avtalet är signerat”, även när token inte matchar något avtal. Detta falska lyckade resultat reproducerades med den riktiga sidkomponenten och ett tomt DB-svar.

`/api/legal/accept` läser `email_token`, som saknas i produktionsschemat för `contract_agreements`; databasuppslaget kan därför ge fel. Den äldre endpointen accepterar samtidigt kundskickat dokumentinnehåll och version utan bindning till ett kanoniskt dokument. `lib/contracts/finalizeAgreement.ts` sätter `welcome_email_sent_at` utan att skicka något välkomstmejl och ignorerar returnerade skrivfel.

Det nya teckningsflödet använder OPS och ingen aktiv anropskedja från det till denna äldre avtalsskapare hittades. gridex-prod har noll äldre avtalsrader. **Fyndet gäller kvarvarande exponerad legacy-kod, inte bevis för fel i OPS egen signering eller utskick.**

**Bygg korrekt:** avveckla oanvända endpoints med tydlig 410 och ta bort missvisande framgångssidor. Om verkliga äldre avtal kräver stöd ska de få en avgränsad migreringsväg: GET läser endast, POST registrerar uttrycklig accept, token binds till avtal/dokument och tillåtet tillstånd, dokumenthash kommer från serverns signerade snapshot. Ogiltig token ger ett ärligt fel och upprepad signering visar verifierat befintligt resultat. Registrera mejl som skickat först efter faktisk leveranshändelse. Behåll OPS som ägare för nya ansökningar, legal evidence och kommunikation.

## Rekommenderad byggordning och godkännandekriterier

1. Åtgärda identitet/behörigheter och checkout-resultat från huvudrapporten, samt F21–F22 för offentligt pris-API. Behåll releasepausen tills riktiga runtimeberoenden är verifierade.
2. Bygg en explicit kanonisk prismodell i Web för offerter, komponenter, moms, enheter, energiriktning och settlement. Rätta F17–F19, F24–F25 och F26. OPS äger totalsummor och accepterade affärsvillkor; Web ansvarar för korrekt presentation.
3. Rätta nyckelrotation, atomiska adminåtgärder och oanvända signeringsvägar. Uppdatera dokumentationens giltighetsregel. Ingen offerttimer och ingen tyst omprisning.
4. Begränsa och deduplicera läsanrop, bygg verifierat marknadsunderlag och en fungerande mejl-outbox. Slutför driftmätning och leveransverifiering i rätt staging/projekt.
5. Kör syntetiska end-to-end-scenarier för privat/företag, SE1–SE4, samtliga aktiverade pristyper och produktionsriktning när den ska erbjudas. Jämför offert, accepterad snapshot, portalvillkor och avräkningssemantik.

Prisscenarierna ska minst täcka verkligt nollpris, negativa spotpriser, saknad komponent, null, SEK/öre, moms inkluderad/exkluderad/noll, månadsavgift och årsbelopp, vald områdesprisrad, fördröjda svar, nyckelrotation och passerat `valid_until`. Marknadsdatum ska täcka 23/24/25-timmarsdygn, kvartsintervall, midnatt och ofullständiga källdata. Fasta priser kan låsa energipris; rörliga/portföljavtal ska visa vad kunden accepterar enligt settlement och hur faktisk avräkning bestäms.

**För offerter utan timer krävs:** samma oförändrade signerade offert efter fem minuter, efter passerat kompatibilitetsdatum och efter teknisk adressförnyelse; ingen omräkning, ingen nedräkning, inget krav att kunden börjar om. Ändring av adress, årsvolym, produkt eller andra prisstyrande val ska däremot hindra att ett tidigare svar visas eller används för fel uppgifter.

## Reproducerbart underlag och kvarvarande gränser

- [Pris-/portalmappning och rendering](pricing-reproduce.mjs), [resultat](pricing-results.txt).
- [Marknadsdatum och datakvalitet](market-reproduce.mjs), [resultat](market-results.txt).
- [Webbläsartest av kalkylatorn](calculator-browser-reproduce.mjs), [testfixture](calculator-browser-fixture.txt), [resultat](calculator-browser-results.txt) och [observationer](calculator-browser-evidence.json).
- [Adminsparning, äldre signeringssida och fetch-antal](remaining-reproduce.mjs), [resultat](remaining-results.txt).
- [Prisdatabasens aggregerade kontroll och katalog](pricing-database-evidence.json), [legacy-katalog](legacy-database-evidence.json), [mejltabell och fakturaantal](remaining-database-evidence.json).
- [Publikt produktionspris-API](pricing-public-http-evidence.json) och [test av offerter utan tidsutgång](no-expiry-results.txt).

Node 22.23.3 och exakt låsta beroenden användes i en isolerad kopia. MJS-reproduktionerna körs där med projektets `tests/typescript-alias-loader.mjs`, eller bifogad `pricing-audit-loader.mjs` för TSX och syntetiska servicegränser. Webbläsartestet behöver fixture-filen som temporär `app/audit-price/page.tsx` och en lokal server på port 3211. `/api` är stubbat, externa webbläsaranrop blockeras och inga verkliga nycklar används. Test-fixturen ska inte levereras till produktion.

Grundgranskningens tester, typkontroll, byggsteg och supportkontroller passerade tidigare. Fortsättningen har endast lagt till granskningsunderlag, inga produktändringar; riktade reproduktioner och befintliga offertgiltighetstester passerar. En full ny build skulle inte bevisa att de dokumenterade produktfelen är rättade.

Autentiserat skarpt offert-/ansökningsflöde, faktisk fakturering, mejlleverans och prisadministration mot OPS-produktion är fortfarande inte end-to-end-bevisade. Ingen full penetrationstest, driftbelastningstest eller intern OPS-avräkningsrevision har genomförts. Den lokala Web-revisionen och aktiv produktion skiljer sig enligt F03. Kataloggranskning och lokala reproduktioner måste därför följas av verifiering av den exakta release som ska driftsättas.


## Mina sidor och mejl F32–F42

Granskad 2026-10-06. Tillägg till [huvudrapporten](RAPPORT.md) och [prisgranskningen](PRISER-OCH-RESTERANDE.md). **Ytterligare 11 punkter, F32–F42, behöver hanteras.** Tio gäller reproducerade kod-/kundflödesfel; den sista gäller en verifierad brist i leveranshändelsernas prenumeration. Skarp SMTP-konfiguration, Auth-mallar och faktisk mottagning av verifieringsmejl är fortfarande inte bevisade.

Web-revisionen är fortsatt `188e475d18341a9ec9a531d9705da8988d9e9f6b`. Läsningar av gridex-prod använder projekt `ayiuxjlfazkjmmtlvhsl`. Aktiv produktion var en äldre Web-revision i grundgranskningen; lokal reproduktion är därför inte samma sak som ett test av alla skarpa kundkonton. OPS lokala DTO-projektion har lästs som referens till samma API-gräns, utan att OPS ändrats eller internreviderats.

Ingen produktionskod, databas, mejlmall, DNS-post eller webhookkonfiguration har ändrats. Inga mejl har skickats, inga verifieringstoken har genererats och inga verkliga kunders sessioner har använts. Leveranskontrollen bygger på providerinställningar, offentlig DNS, aggregerade databasvärden och lästa driftloggar.

## Mejlleveransen: vad underlaget faktiskt visar

| Del | Observerat | Slutsats |
|---|---|---|
| Avsändardomän | Resend anger `gridex.se` som verified, sending enabled, eu-west-1 | Providerdomänen är konfigurerad för utskick |
| DKIM | Resend anger verified; offentlig `resend._domainkey.gridex.se` innehåller motsvarande nyckel | DKIM-underlag finns; faktisk mejlsignering kräver ett mottaget mejl |
| SPF | Domänens TXT innehåller Strato och Amazon SES; Resend anger verifierad return-path-konfiguration | Grundunderlag finns; faktisk envelope-avsändare och alignment är inte uppmätta |
| DMARC | `_dmarc.gridex.se` har `p=none; pct=100` | DMARC finns i övervakningsläge; detta är inte ett bevis på leveransfel |
| Resend-webhook | Enabled till `https://app.gridex.se/api/webhooks/resend` | Affärsmejlens leveranshändelser ska tas emot av OPS |
| Prenumererade händelser | `email.bounced`, `email.delivered`, `email.failed`, `email.suppressed` | Klagomål och fördröjningshändelser saknas, se F42 |
| Providerstatistik | Returnerad period 7 september–6 oktober: 0 sent/delivered/bounced/failed för domänfiltret | Inga utskick bevisas av denna statistik; annat SMTP-konto eller annan transport kan användas |
| Supabase Auth | 6 ej raderade Auth-användare, 3 med bekräftad e-post; 4 med registrerad inbjudan/bekräftelsebegäran | Auth-tidsstämplar är inte kvitto på mottaget mejl |
| Portal-onboarding | 5 pending-jobb, alla Auth-bundna till obekräftad e-post, alla äldre än ett dygn och redo för nästa körning | Kundkoppling väntar; antal jobb är inte antal unika kunder och bevisar inte mejlfel |
| Auth-loggar | Lästa senaste 24 timmarna omfattade adminläsningar, inga observerade SMTP-/mejlhändelser | Loggfönstret bevisar ingen ny leverans eller att SMTP fungerar |
| Webs miljövariabler | Relevanta Supabase-, site-, OPS- och cron-variabler finns för production/preview | Endast namn/typer/targets har lästs. Värden och faktisk SMTP-/projektbindning är inte verifierade |

Resends metrics-endpoint begränsade det begärda datumintervallet; rapporten använder intervallet i dess faktiska svar. Nollvärden får inte tolkas som att alla mejl uteblivit eller att inga mejl skickats genom andra transportsystem. Providerstatus ”delivered” betyder mottagarserverns accept, inte garanterad placering i inkorgen eller att kunden läst mejlet.

DNS-läsningen av `send.gridex.se` gav ingen TXT-rad trots provideruppgift om verifiering. Kontrollera den faktiska return-path-domänen och full DNS-kedja i samband med SMTP-verifiering; root-SPF och providerstatus räcker inte för att avgöra alignment för ett visst mejl. Ingen trasig mejlleverans har härletts enbart från denna observation.

Underlag: [provider](email-provider-evidence.json), [DNS](email-dns-evidence.json), [Auth-aggregat](customer-auth-database-evidence.json), [onboarding](customer-onboarding-evidence.json), [Auth-loggaggregat](customer-auth-log-evidence.json) och [miljövariabler utan värden](customer-env-metadata.json).

## Prioriterade nya fynd

| ID | Prioritet | Problem | Bevis |
|---|---|---|---|
| F32 | P2 | Markera notis som läst skickar fel API-fält | Verklig klient avvisas före nätverksanrop |
| F33 | P1 | Anläggningsmapper kräver fel referens och fel adressform | OPS referens-DTO → verklig portalmapper |
| F34 | P2 | Dokumentlänk och version försvinner | OPS referens-DTO → verklig mapper och sidrendering |
| F35 | P2 | Kundens nät-/elområdesfält tappas utan förklaring | Verklig validator |
| F36 | P2 | Juridisk dokumentversion och fullmaktens slutdatum tappas | Verklig mapper |
| F37 | P2 | Självservice säger ”uppdaterad” trots pending review utan access | Verklig komponent i webbläsare |
| F38 | P2 | Kundens retry skapar nytt operation-ID för samma flyttanmälan | Verklig komponent i webbläsare |
| F39 | P1 | Lyckad e-postverifiering kan följas av callbackfel | Verklig callback med modellerat DB-fel |
| F40 | P2 | Nyare bekräftad e-post tappas bakom pågående profilsynk | Verklig kökod med modellerad samtidighet |
| F41 | P2 | Begränsning av mejlutskick visas som felaktig e-postadress | Verklig återställningssida och SDK i webbläsare |
| F42 | P2 | Provider-webhook prenumererar inte på klagomål/fördröjning | Läsning av aktuell Resend-konfiguration |

### F32 – Notisläsning bryter det aktuella API-kontraktet

`lib/ops/client/portal.ts:373` skickar `{ notification_ids: ids }` till `/api/v1/customer/notifications/read`. Det aktuella API-formatet kräver `notification_references`, och tillåter inte det äldre fältet. Den riktiga klientens OpenAPI-validering kastar `OpsSchemaError` innan något nätverksanrop sker. Kundens ”Markera som läst” kan därför inte slutföras genom denna klient.

**Bygg korrekt:** översätt Webs eventuella interna formulärnamn till `notification_references` vid API-gränsen och använd opaka notisreferenser. Rätta också portal-readiness-proben, som använder samma gamla fält. Tolka `updated_count`, returnerade referenser och `read_at`; uppdatera UI efter verifierad operation. Att skriva lokal `is_read` är inte ersättning för kanoniskt resultat.

### F33 – Anläggningsdata kan slå ut kundöversikten

`lib/customerPortal/service.ts:286` kräver `site_reference`. OPS referensprojektion `publicPortalSite` skickar **`facility_reference`**. Den skickar dessutom `address` som objekt med `street`, `postal_code` och `city`, medan Web läser adressen som sträng och postort som fält på huvudobjektet.

En rad med OPS format gav `PORTAL_SITE_REFERENCE_MISSING` i verklig `getCanonicalCustomerResource('sites')`. Samma mapper används i översikten, där ett sådant fel avbryter hela läsningen. Efter endast ett byte av referensnamn skulle adressen fortfarande tappas. Detta är verifierad inkompatibilitet med lokal OPS referensprojektion; autentiserad payload för exakt skarp release har inte lästs.

**Bygg korrekt:** mappa `facility_reference` till den interna anläggningsidentiteten och läs nästlad adress uttryckligt. Bevara status och relevanta datum. Mätpunkter behöver läsas/bindas via den resurs och relation som OPS faktiskt tillhandahåller, utan att uppfinna fält på anläggningen. Använd samma kanoniska referens för visning, komplettering och flyttanmälan. Testa en riktig anläggningsrad i bundle och separat resurs, inte enbart tomma listor eller gamla platta testfixturer.

### F34 – Kunden kan sakna knappen för att öppna sitt dokument

OPS `publicPortalDocument` skickar `secure_url` och `version`. `lib/customerPortal/service.ts:344` läser bara `download_url`, sätter `file_url=null` och `version=null`. Den verkliga dokumentvyn erbjöd därför ingen ”Öppna dokument”-knapp trots en tillgänglig dokument-URL i underlaget.

**Bygg korrekt:** bevara kanonisk URL och dokumentversion. Kontrollera att länken är tillåten HTTPS och att utlämningen har rätt kundbehörighet och livslängd; läck inte intern storage-path. Om länken är tillfällig ska den hämtas om när den behöver användas. Testa öppning för rätt kund och avvisning för annan kund i staging. Dokumentets tillgänglighet får inte härledas från att ett bekräftelsemejl har skickats.

### F35 – Självservice samlar in fält som aldrig skickas vidare

`CustomerPortalSelfService` låter kunden fylla i nätområde och elområde och skickar `grid_area_code`/`price_area_code`. `syncFacilityItem` i `lib/customerPortal/writeValidation.ts:265` tar inte med dem. De försvinner innan OPS-anropet, samtidigt som UI kan säga ”Anläggningsuppgifterna är uppdaterade”.

**Bygg korrekt:** låt formuläret endast erbjuda sådant som den kanoniska skrivresursen stöder. Ett verifierat elområde ska inte bli auktoritativt bara för att kunden skriver SE3. Om kunden får lämna områdesförslag, använd dokumenterad API-komplettering och visa att det behöver verifieras. Avvisa eller förklara ej stödda fält i stället för att kasta bort dem tyst.

### F36 – Juridiska versioner och fullmaktsperioder går förlorade

OPS legal acceptance använder `document_version`; Web letar efter andra versionsnamn. OPS fullmakt använder `valid_to`; Web läser `valid_until`/`expires_at`. Båda tappades i testet. Fullmaktsvyerna visar inte heller den tillgängliga giltighetsperioden eller dess avtals-/anläggningskoppling.

**Bygg korrekt:** mappa dokumentreferens, version och hash samt fullmaktens `valid_from`, `valid_to`, scope och relationer. Visa juridiskt underlag för rätt avtal/anläggning, inklusive återkallelse och slutdatum. Håll observerad status skild från ett saknat värde; använd inte default ”active” som bevis när API-underlaget är okänt. Juridiska snapshots ska aldrig ersättas av dagens villkorsversion.

### F37 – Ett tekniskt lyckat HTTP-svar blir falsk affärsframgång

`components/customer/CustomerPortalSelfService.tsx:28` tolkar endast HTTP-status och `queued`. Den riktiga komponenten visade ”Kopplingen till Mina sidor är uppdaterad” för `{data:{ok:false,status:'pending_review',synced:{access_granted:false}},queued:false}`. API-klienten har redan en distinktion mellan linked och pending review utan access, men UI använder inte den.

**Bygg korrekt:** definiera Webs svarstyp med explicit affärsutfall. ”Uppdaterad” kräver att rätt koppling är bekräftad; pending review ska få ärlig väntestatus och ett nästa steg. Följ motsvarande regel för kompletteringar, flyttanmälningar och notisläsning. Varningar ska inte försvinna när de påverkar kundens resultat. Uppdatera relevanta läsningar efter lyckad operation så att gamla uppgifter inte ligger kvar som om ingenting hänt.

### F38 – Flyttanmälans återförsök tappar idempotensen

Självservice skapar `crypto.randomUUID()` vid varje klick. Efter ett osäkert svar och nytt klick fick exakt samma flyttpayload ett nytt `client_operation_id`. Reproduktionen använde första svar 503 och andra svar 200; ingen riktig flytt utfördes. OPS ser två olika operationer och Web kan därmed inte förlita sig på API-idempotens för att deduplicera dem. Andra affärskontroller kan fortfarande förhindra dubbletter.

**Bygg korrekt:** skapa operation-ID när en logisk åtgärd påbörjas och behåll ID + oförändrad payload vid retry och osäker nätverksstatus. Ändrade uppgifter innebär ny logisk åtgärd och nytt ID. Spara pågående operation tillräckligt beständigt för att tåla omladdning, och erbjud kontroll av tidigare resultat. Ett timeoutfel får inte automatiskt betyda att åtgärden inte mottagits.

### F39 – Databasfel kan avbryta återkomsten efter lyckad verifiering

`syncConfirmedUserProfileDurably` kör `recoverStaleAuthProfileSyncJobs` på rad 190 före sin try/catch. `/auth/confirm` anropar profilsynken efter lyckad `verifyOtp` utan en yttre felgräns kring det anropet. Ett modellerat recoveryfel fick den verkliga callbacken att kasta efter verifieringen i stället för att omdirigera. Kunden kan då se ett serverfel efter att Auth redan verifierat mejlen och använt engångslänken.

**Bygg korrekt:** Auth-verifiering och session ska inte ogiltigförklaras av en efterföljande projektionsstörning. Fånga även fel i recovery och etablering av serviceklient. Omdirigera säkert med tydlig väntestatus, bevara verifierad session och återuppta synk från beständig operation eller kanonisk Auth-identitet. Lova inte ”köad” om kön i själva verket inte gick att skriva. Kunden ska kunna återkomma genom vanlig inloggning utan ny ansökan.

### F40 – En nyare bekräftad e-post kan tappas i synkkön

`queueJob` i `lib/customerPortal/authProfileSync.ts:69` returnerar befintligt processing-jobb även när den nya e-postadressen/operationen skiljer sig. Det nyare bekräftade värdet lagras aldrig. Worker använder senare jobbets gamla e-post utan att först verifiera aktuell Auth-identitet, skriver den till profil och kan markera jobbet completed.

Reproduktionen körde den riktiga kökoden: nytt bekräftat `new@example.invalid` medan `old@example.invalid` bearbetas, därefter ett återförsök av det äldre jobbet. Profilen fick old och jobbet completed. Detta är ett innehålls-/versionsfel, utöver outboxens claim-problem i F10.

**Bygg korrekt:** versionsbind varje bekräftad Auth-ändring eller behåll en beständig nyare önskad revision även när äldre jobb körs. Kontrollera aktuell serververifierad Auth-e-post före skrivning och jämför operation/revision vid completion. Äldre jobb får inte skriva över nyare verifierat tillstånd. Definiera separat hur inloggningsadress och OPS kontakt-/fakturaadress ändras; nuvarande Auth-action är inte bevis på att affärssystemets adresser ändrats.

### F41 – Fel vid återställningsutskick ger fel råd till kunden

`app/login/forgot-password/page.tsx:22` tolkar varje felmeddelande som innehåller ”email” som ogiltig adress. Med verklig Supabase SDK och stubbat `429 /auth/v1/recover` med `over_email_send_rate_limit` visade den riktiga sidan ”Ange en giltig e-postadress” för en korrekt formaterad adress. Kunden kan då byta adress eller börja om i onödan.

**Bygg korrekt:** använd Auth-felkod och HTTP-status: begränsning ska ge väntan/återförsök, tekniskt utskicksfel ska beskrivas som tillfällig störning, och formatfel ska gälla verkligt ogiltig input. Behåll neutralt svar för okänd adress så att kontoförekomst inte avslöjas. Verifiera även vägen till nytt verifieringsmejl vid utgången signup-/invite-länk; ett registerformulär med resend endast i sin tillfälliga success-vy är inte ett komplett återhämtningsflöde för alla länkar.

### F42 – Leveransuppföljningen saknar vissa providerhändelser

Den lästa aktiva Resend-webhooken prenumererar på bounced/delivered/failed/suppressed. `email.complained` och `email.delivery_delayed` saknas. OPS referenshandler har däremot kod för dessa händelser. Webhooken kan därför inte ge OPS de uppdateringarna genom denna prenumeration. Providerhanterad suppression kan fortfarande fungera; det är verksamhetens uppföljning som saknar dessa signaler.

**Bygg korrekt:** prenumerera på relevanta klagomåls- och fördröjningshändelser och verifiera signerad, idempotent behandling med rätt provider message-ID. Behåll skillnaden accepted/sent/delivered/failed i kundstatus. Kontrollera också att Auth-SMTP:s meddelanden kan korreleras till rätt system och inte förväntas matcha en OPS-affärslogg som saknar dem. Prenumeration, implementation och drift måste verifieras för samma release. Inga konfigurationer eller testhändelser ändrades/skickades under granskningen.

## Vem ska äga respektive mejl och status?

| Mejlsituation | Ägare | Det som måste verifieras |
|---|---|---|
| Bekräfta ny kontoadress | Supabase Auth + dess verkliga SMTP/hook | Rätt mottagare, TokenHash-format, cookie/session, återhämtning från utgången länk |
| Inbjudan efter teckning | Webs onboarding → Supabase Auth | Endast nya konton bjuds in; kundbindning och lösenordssättning kan återupptas |
| Återställa lösenord | Supabase Auth | Typ recovery, rätt reset-vy, neutral kontoförekomst, rätt feltext och återförsök |
| Ändra kontoe-post | Supabase Auth | Säker policy för gammal/ny adress, verifierat slutresultat, synk utan att tappas |
| Avtals-/affärsbekräftelse | OPS | Checkout/communication leveransstatus, korrekt dokumentversion och mottagare |
| Publik supportbekräftelse | Webs separata intake/leveranskö | Beständigt mejl och riktiga returnerade fel; tidigare F30 gäller |

Den lokala registreringssidan har resend med 60 sekunders UI-cooldown, och onboarding använder Auth-inbjudan för nya konton. Befintlig kund får inte automatiskt lösenordsåterställning eller kundkoppling enbart för att någon lämnar samma e-post. Den senaste riktade befintliga testsuiten för detta passerar **32/32 tester**. Redirect-valideringen avvisade extern destination i positiv kontroll.

E-postverifiering och giltigt elavtal är skilda tillstånd. Att `inviteUserByEmail` inte ger fel eller att ett Auth-fält heter `confirmation_sent_at` bevisar inte leverans. Att OPS registrerat signering bevisar inte att bekräftelsemejlet kommit fram. Den tidigare granskningens F04/F05 för checkout/kommunikation behöver fortfarande rättas; återanvänd det arbetet i kundstatus i stället för att skapa ännu en lokal slutsats om mejlet.

## Skarpa inställningar och verifiering som fortfarande krävs

De tillgängliga Supabase-verktygen exponerar inte projektets Auth-konfiguration, SMTP-hemligheter eller aktiva mejlmallar. Vercel-miljövariabler har endast lästs utan dekryptering. **Faktisk mejlleverans kan därför inte godkännas ännu.** Detta är en verifieringslucka, inte ett konstaterat SMTP-fel.

Kontrollera följande i den exakta staging-/produktionsmiljön före godkännande:

1. Auth Site URL, tillåtna redirect-URL:er, confirm-email-policy, secure email change-policy, aktiv SMTP eller send-email-hook samt avsändare. Auth måste använda en leverantör/avsändare som faktiskt får skicka till kunderna.
2. Aktiva mallar för signup, invite, recovery och email change. Webs callback accepterar `token_hash` tillsammans med type **email / invite / recovery / email_change**. Den implementerar inte code-exchange. Om en mall i stället använder standardlänk som återkommer med `code`, URL-fragment eller `type=signup` fungerar inte den callbacken som byggd. Det skarpa mallformatet är inte läst och sådant fel är därför villkorligt.
3. Länkarna ska gå till rätt Web-domän och bevara endast tillåtet nästa steg. Invite/recovery ska leda till lösenordssättning; signup till verifierad kontoåtkomst; email change till faktiskt verifierat kontotillstånd. Verifiera med olika webbläsare/enheter och med mejlklientens länkskydd. Engångslänkens säkerhetslivslängd är tillåten och ska inte blandas ihop med kundoffertens giltighet.
4. Använd godkända testadresser för en full kedja: API-request → provider message-ID → leveranshändelse → mottaget mejl/header med SPF/DKIM/DMARC → klick → verifierad server-session → rätt OPS-kundkoppling → kundens egna avtal/dokument. Kontrollera också studs, utgången/återanvänd länk, utskicksbegränsning och tillfällig DB-störning.
5. Separat OPS-avtalsbekräftelse: kontrollera mottagare, rätt accepterat dokument och `checkout.confirmation_email`/communication-status. Ta med queued, delivered och failed; UI ska inte säga levererat innan källa bekräftat det.
6. Kontobyte: verifiera nödvändiga bekräftelser på gammal/ny adress och om OPS kontakt-/fakturaadress ska följa med genom ett eget godkänt flöde. Lova inte en generell e-poständring om bara Auth-inloggningsadressen ändras.

## Övriga kundvyer och rekommenderad byggordning

Mina sidor och dashboard har två översikter som delvis visar samma saker men med olika funktioner. `/mina-sidor` har läsvyer/länkar; självservice ligger på `/dashboard`. Båda är sessionkontrollerade och märkta för att inte indexeras. Samla kundens huvudingång och navigering så att status, komplettering och dokument fungerar konsekvent. En ny kontoregistrering utan färdig OPS-koppling behöver en begriplig väntestatus, inte en portal som förutsätter att alla resurser redan finns.

Det finns flera återstående beroenden från tidigare rapporter: kundidentitetsskydd F01, assertion F06, supportfel som slår ut översikten F07, statuspollning F13, fakturornas null-belopp F24 och avtalspris/villkor F25. De ska ingå i samma verifiering och är inte nya separata fynd här.

Koden hämtar mätvärden i bundle men ingen separat visning av dem hittades i kundvyerna. Om kundportalen ska erbjuda förbrukningsöversikt behöver den byggas med rätt anläggning, energiriktning, intervall och enhet. Detta är ett funktionsområde att besluta/leverera, inte bevis på felaktig mätvärdesberäkning. Samtliga anläggningar och fullmakter behöver kunna väljas och kopplas till rätt avtal; självservice använder i dag första anläggningen i översikten.

Rekommenderad ordning:

1. Rätta anläggnings- och dokumentmappning, notisläsning och efterverifieringsfel. Använd API-gränsens riktiga namn och objektform i testsvaren.
2. Rätta väntestatus, kvarhållna operation-ID:n och revisionssäker Auth-synk. Gör väntande kundkoppling användbar och återupptagbar utan ny teckning.
3. Verifiera SMTP/mallar och end-to-end-leverans för konto och avtal separat. Komplettera leveranshändelser och uppföljning.
4. Verifiera alla berörda kundvyer med två syntetiska kunder, flera anläggningar, tomma resurser och partiella driftfel i den faktiska release som ska driftsättas.

**Kravet om offerter utan timer kvarstår:** inga femminutersgränser eller tyst omprisning införs som en del av konto-, mejl- eller portalarbetet. En säkerhetslänks utgång får inte kräva en ny elavtalsansökan eller ny prisförfrågan.

## Testunderlag

- [Verkliga portal-/Auth-reproduktioner](customer-reproduce.mjs), [offline-loader](customer-audit-loader.mjs), [resultat](customer-results.txt).
- [Verkliga självservice-/återställningskomponenter i webbläsare](customer-browser-reproduce.mjs), [lokal fixture](customer-browser-fixture.txt), [resultat](customer-browser-results.txt).
- [32 befintliga kundkopplings-/Auth-tester](existing-customer-tests.log).
- [OPS referensprojektionens fältnamn och adress-/dokumentform](portal-reference-dto-evidence.json).

Node 22.23.3, exakt låsta beroenden och samma isolerade kopia som tidigare användes. Browser-fixturen ska endast finnas temporärt i `app/audit-customer/page.tsx` i testkopian på port 3211. Alla service-/Auth-anrop i webbläsaren stubbas och andra externa webbläsaranrop blockeras. Inga produktfiler har ändrats; underlaget dokumenterar fortfarande befintliga fel, inte att de är rättade.
