# Gridex Web och gridex-prod – teknisk genomgranskning

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
