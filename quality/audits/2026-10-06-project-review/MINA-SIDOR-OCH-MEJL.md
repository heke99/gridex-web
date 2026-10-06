# Mina sidor, kontoverifiering och mejlleverans

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
