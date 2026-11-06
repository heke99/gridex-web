# Gridex El – masterplan för kundapp och återanvändbar appplattform

Version 2.0 · 6 november 2026 · Gemensamt repo och databas, portabel appgrund

## 1. Mål och omfattning

Bygg en fristående kundapp för iPhone och Android där Gridex kunder kan teckna elavtal, logga in på Mina sidor, se elpriser och förbrukning, läsa fakturor, hantera kunduppgifter, kontakta support och byta sitt befintliga elavtal.

Appen ska från början ha en gemensam produktgrund som kan användas av andra elhandelsbolag. Gridex blir den första bolagskonfigurationen. Nya bolag ska kunna läggas till genom konfiguration, integration och publicering utan en separat kopia av produktkoden.

Kundfunktionerna på Gridex Web är utgångspunkten för funktionsomfattningen. Mobilens skärmar och navigation anpassas till telefonen. Administrationssidor och personalens supportverktyg hör till sina befintliga system.

Detta dokument är en genomförandeplan. Underlaget är en riktad granskning av källkod och API-dokumentation; den innebär inte att driftsatta flöden är verifierade.

## 2. Nuläge och återanvändning

Granskade referenser:

- Gridex Web: `1fc033ef791b5bb62ac6672576e64c83727c17d0`.
- Gridex OPS: `f23c1dc0c58f8bb1a55b83d8409e5712177b51b6`.
- OPS-dokumentationsrevisionen är `2026-10-12.1`; det beskrivna standardkontraktet för svar är `2026-10-09.1`. Kompatibilitet och eventuell versionsbindning per integrationsnyckel verifieras vid implementation. Web innehåller även äldre integrationsdokument.

| Område | Vad som redan finns i granskat underlag | Följd för appen |
| --- | --- | --- |
| Avtalsteckning | Publicerade avtal, elområdesupplösning, offert, offertvalidering, ansökan och ansökningsstatus i OPS | Återanvänd affärsflödet med ett mobilt gränssnitt |
| Mina sidor | Profil, avtal, anläggningar och samlad kundöversikt | Bygg appvyer mot samma kundidentitet |
| Förbrukning | Mätvärden med period, anläggningsfilter och paginering i den granskade rutten | Använd hela den efterfrågade serien; en begränsad sida är inte en månadsförbrukning |
| Fakturor och dokument | Fakturalista, fakturadetaljer, dokumentmetadata och säkra länkar | Verifiera hämtning, behörighet och visning på telefon |
| Support | Kundärenden, meddelanden och bilagefunktioner i OPS | Anslut kundens supportvy; interna anteckningar ska förbli interna |
| Notiser | Notiser och läsmarkering i kund-API:t | Mobil push kräver en separat leveransfunktion |
| Inloggning | Web använder Supabase Auth med bland annat e-post och lösenord | Återanvänd befintliga Gridex-konton genom mobil sessionshantering |
| BankID | Den granskade publika webbrutten är avstängd och API-guiderna beskriver ingen aktiverad BankID-tjänst i dessa flöden | Planera och verifiera BankID separat innan det erbjuds |
| Byte av befintligt avtal | Ingen särskild kundoperation för avtalsbyte identifierades i granskad OpenAPI och ruttyta | Utforma och implementera ett granskat OPS-kontrakt för detta |
| Prisgrafer | OPS har en operation för aktuell prisperiod; ingen publicerad serie för idag, imorgon eller historik identifierades | Komplettera API-stödet för prisserier |

OPS använder en bolagsbunden integrationsnyckel. Den hör hemma i serverdelen. Appen ska inte anropa de privilegierade integrationsoperationerna med en sådan nyckel lagrad i telefonen.

## 3. Föreslagen arkitektur

Bygg i befintliga `heke99/gridex-web` som ett monorepo med hemsida, support och mobilapp. Mobilappen får egen byggprocess och butikspublicering. Återanvänd Gridex Webs befintliga Supabase-projekt för identitet, konton och relevanta kontokopplingar. Skapa ingen separat mobil produktionsdatabas och inga dubbla kundposter. OPS behåller sitt eget repo och sin befintliga databas för energiverksamhetens data och regler; appen använder OPS genom API.

Gemensamt repo och databas beskriver Gridex-installationen. Den återanvändbara appgrunden ska kunna brytas ut till ett nytt repo och kopplas till en köpares egen installation.

| Del | Teknik/föreslagen placering | Ansvar |
| --- | --- | --- |
| Mobilapp | React Native, Expo och TypeScript; `apps/mobile` | Skärmar, navigation, formulär, grafer och mobil funktionalitet |
| Appens serverdel | TypeScript på Vercel; `apps/api` | Verifiera session, härleda bolag och kund, anropa OPS och förmedla dokument |
| API-kontrakt | `packages/api-contracts` | Versionshanterade typer och validering från OPS och appens API |
| OPS-adapter | `packages/ops-server` | Serverkod för OPS-anrop, scopes, felhantering och identitetsassertioner |
| Portabel grund | `packages/mobile-foundation` | Publik varumärkesmodell och leverantörsoberoende integrationsgränser |
| Visuella komponenter | `packages/ui` | Gemensamma mobilkomponenter, färger, typografi och tillgänglighet |
| Bolagskonfiguration | `apps/mobile/brands` | Installationsspecifikt varumärke, funktioner, publika länkar och bygginställningar utanför den portabla kärnan |

Versionsnummer väljs och låses till kompatibla stabila versioner vid projektstart. Befintlig användaridentitet ska kunna återanvändas även om app och hemsida publiceras oberoende.

### Fördelning av data och regler

| Ägare | Innehåll |
| --- | --- |
| OPS | Kanonisk kund, anläggningar, avtal, publicerade erbjudanden, offertregler, leverantörsbyte, mätvärden, fakturor och kundärenden |
| Bolagets identitetstjänst | Inloggningskonto, verifierad identitet, session och återställning |
| Appens serverdel | Verifierad koppling till kundkontot, bolagskonfiguration, pushregistrering och leveransstatus där det behövs |
| Telefonen | Gränssnitt, begränsad cache och säkert lagrade sessionsuppgifter |

Nya kundkonton eller en ny kunddatabas skapas inte enbart för att kunden installerar appen. För Gridex är målet samma konto som på hemsidan. Kopplingen mellan konto och OPS-kund måste ske med en verifierad bindning, aldrig enbart genom att e-postadresser råkar matcha.

Serverdelen ska vara tunn. Prisberäkning, behörighet till erbjudanden, bytesregler och ändring av energikontrakt hör till OPS. Appen använder beslut och resultat därifrån.

## 4. Appens kundupplevelse

Föreslagen huvudnavigation: **Hem · Elpriser · Förbrukning · Avtal · Mer**. Under Mer ligger fakturor, dokument, profil, support och inställningar. Nya kunder ska kunna se priser och inleda avtalsteckning före inloggning där det befintliga flödet tillåter det.

| Funktion | Kundens upplevelse | Krav för att räknas som färdig |
| --- | --- | --- |
| Hem | Översikt över vald anläggning, avtal, senaste tillgängliga förbrukning, pris och meddelanden | Visar tydligt när uppgifter gäller och när data saknas |
| Teckna avtal | Välj erbjudande, lämna uppgifter, se pris/villkor, acceptera eller signera och få bekräftelse | Exakt accepterad offert och dokumentversion sparas; återförsök ger inte dubbla ansökningar |
| Mina sidor | Se egna uppgifter, anläggningar, avtal och pågående processer | Samma kanoniska kund som på webben; stöd för flera anläggningar och avtal |
| Elpriser | Se SE1–SE4, dagens intervall, imorgon när det publicerats och historik enligt tillgängligt underlag | Källa, enhet, moms, avgiftsomfattning och tidpunkt framgår |
| Förbrukning | Byt period och anläggning; se serie och summering | Korrigeringar räknas en gång, saknade intervall markeras och historik avgränsas till kundens rätt till uppgifterna |
| Fakturor | Se belopp, förfallodag, status, detaljer och tillgänglig PDF | Ingen annan kunds faktura eller dokument kan hämtas |
| Byta elavtal | Se tillåtna erbjudanden, startdatum, villkor och eventuella kostnader; bekräfta och följ status | OPS registrerar en riktig bytesprocess för rätt befintligt avtal |
| Support | Skapa ärende, läsa svar, svara och hantera tillåtna bilagor | Endast kundens ärenden och kundsynliga meddelanden visas |
| Profil | Ändra tillåtna kontaktuppgifter och hantera kontot | Ändringar verifieras och sparas genom rätt API |
| Notiser | Se meddelanden i appen och välja mobilaviseringar | Meddelandet öppnar rätt vy efter behörighetskontroll och avslöjar inte känsliga uppgifter på låsskärmen |

Flyttanmälan, fullmakter, juridiska dokument och övriga kundfunktioner på webben tas med i den fullständiga funktionsmatrisen i etapp 0. De försvinner inte ur omfattningen för att de ligger under Mer.

### Pris och förbrukning

Håll isär marknadens spotpris, kundens avtalspris och faktisk fakturerad kostnad. En uppskattning ska märkas som uppskattning. Appen ska använda publicerade prisvillkor från OPS och kunna förklara ingående komponenter utan att hårdkoda Gridex avgifter.

Tidsserier ska stödja de intervall som källan faktiskt levererar. Lagra tidsstämplar entydigt och visa dem i Europe/Stockholm. Sommar- och vintertidsdygn kan ha annat antal intervall än ett normalt dygn. Imorgondagens priser visas först när källan har publicerat dem.

För månadskort behövs ett auktoritativt OPS-kontrakt för summering, korrigeringar och fullständighet, alternativt en uttryckligt verifierad API-lösning över hela serien. Summera aldrig endast portalöversiktens senaste mätvärden.

## 5. Inloggning, kundbindning och säkerhet

1. Kunden autentiserar sig med bolagets konfigurerade identitetstjänst. Gridex ska i första hand återanvända sitt befintliga Supabase Auth-konto.
2. Mobilappen anropar appens serverdel med en användarsession. Servern verifierar signatur, utfärdare, mottagare, giltighet och relevant kontostatus.
3. Servern härleder betrott bolag och verifierad kundbindning. Kundnummer eller bolags-ID från ett formulär ger aldrig åtkomst i sig.
4. Servern anropar OPS med rätt bolagsnyckel och verifierad kundidentitet. OPS stöd för signerad kundassertion används där det är konfigurerat; token och nycklar stannar på rätt sida av gränsen.
5. Svar och cache avgränsas till bolag, kund och vid behov anläggning. Utloggning och kontobyte rensar kundens lokala data och pushbindning.

Mobil sessionshantering ska stödja utgångna och förnyade sessioner, återkallelse, lösenordsåterställning och verifieringslänkar. Små känsliga sessionsvärden lagras med en granskad SecureStore-lösning; stora sessioner får inte kapas eller falla tillbaka till oskyddad lagring. Ominstallation får inte antas rensa alla iOS-nyckelringsuppgifter: kvarvarande session måste verifieras eller rensas enligt kontots aktuella status. Hemliga OPS-nycklar och Supabase service-nycklar får aldrig finnas i apppaketet.

BankID-inloggning och BankID-signering är två skilda flöden. Om de införs ska leverantörens slutförande verifieras på servern och bindas till rätt session, kund och åtgärd. En returlänk eller ett klientfält som säger BankID är inte signeringsbevis. Testa start, avbrott, timeout, återgång och återupptagning på både iPhone och Android.

Domänoperationer som avtalsteckning och avtalsbyte kräver nätanslutning och bekräftat serverresultat. Vid timeout visar appen osäker status och hämtar befintlig process innan den försöker igen. Samma åtgärd behåller samma idempotensnyckel.

## 6. API-arbete som måste planeras

Frys den aktuella OPS-versionen vid implementation och generera typer. Tabellen anger återanvändning eller behov; nya kontrakt nedan är planerade, inte befintliga endpoints.

| Kundflöde | Befintligt underlag | Åtgärd |
| --- | --- | --- |
| Integrationskontroll | `GET /api/v1/integration/context` | Verifiera bolag, scopes och kompatibilitet på servern |
| Erbjudanden | `GET /api/v1/website/public-contracts` | Återanvänd publicerade erbjudanden och juridisk version |
| Nytt avtal | Elområdesupplösning, quote, quote/validate, customer-applications och status | Bevara prisreferenser, kundbindning, accepterad juridik och idempotens |
| Kundöversikt | `/api/v1/customer/me`, `/contracts`, `/sites`, `/portal-bundle` | Mobil API-yta med verifierad användarsession |
| Förbrukningsserie | `/api/v1/customer/metering-values` | Verifiera filter, paginering, revisioner och kundens tidsmässiga åtkomst |
| Förbrukningssummering | OPS har intern månadsaggregering | Publicera ett kontrakt för periodtotal och fullständighet med samma regler |
| Fakturor och dokument | Kundens invoice- och document-operationer | Verifiera säkra länkar, filhämtning, utgång och mobil visning |
| Support | `/api/v1/customer/support/cases` med underresurser | Återanvänd befintliga läs-/skrivscopes och bilageregler |
| Aktuellt marknadspris | `POST /api/v1/website/market-price/current` | Återanvänd med korrekt elområdesbindning |
| Prisgrafer | Ingen publicerad komplett serie identifierad | Specificera OPS-operation för elområde, datumintervall, upplösning, källa, enhet och publiceringstid |
| Avtalsbyte | Ingen särskild publik kundoperation identifierad | Specificera behöriga erbjudanden, förhandsbedömning, bekräftelse och status |
| Mobil push | Portalnotiser finns | Bygg enhetsregistrering och leverans med verifierade OPS-händelser eller avtalad hämtning |

### Särskilt om byte av befintligt elavtal

OPS ska avgöra vilka erbjudanden kunden får byta till, tidigast möjliga datum, bindnings- och uppsägningstid, möjliga avgifter och vilka godkännanden som behövs. Kunden får en sammanställning före bekräftelse. Bekräftelsen binds till den förhandsbedömning och juridiska version kunden faktiskt har sett.

OPS registrerar bytesbeställningen, förhindrar dubbletter och motstridiga parallella byten samt återger status. Det befintliga avtalet och dess historik bevaras. Leverantörsbyte och byte av avtalsprodukt inom samma elbolag ska behandlas som skilda processer.

## 7. Återanvändning och utbrytning för andra elbolag

| Konfiguration per bolag | Innehåll |
| --- | --- |
| Varumärke | Appnamn, logotyp, ikoner, färger, typografi och texter |
| Integration | Betrodd OPS-bolagsbindning, hemlighetsreferenser och scopes på servern |
| Identitet | Godkänd identitetsutfärdare och kundbindning |
| Produkt | Aktiverade funktioner och länkar till publicerade avtal |
| Kontakt och juridik | Supportkanaler, bolagsuppgifter, integritetstext och rätt villkorskälla |
| Distribution | Bundle ID, Android package name, Expo/EAS-projekt, uppdateringskanaler och runtime-bindning, byggsignering, returlänkar, pushuppgifter och butiksmaterial per bolag/miljö |

Affärspriser och avtalsregler hämtas från OPS. Visuell konfiguration eller funktionsflaggor ersätter aldrig serverns behörighetskontroll.

### Samma databas nu, flyttbar implementation senare

- Gridex hemsida och mobilapp använder samma befintliga Gridex Web Supabase-projekt. Supabase-specifik klientkod hålls i tydliga identitets- och lagringsadaptrar. Appens layout och generella funktioner importerar inte webbens interna moduler eller databas-SDK direkt.
- Appens eventuella nya tabeller, index, behörigheter och funktioner dokumenteras som ett avgränsat logiskt område i samma databas med vanliga versionshanterade migreringar. Ett eget schema väljs bara där det passar existerande åtkomstmodell. Inga tabeller skapas enbart för att etablera projektgrunden.
- Den portabla appkärnan får inga hårdkodade Gridex-projekt-ID:n, URL:er, autentiseringsnycklar, kund-ID:n eller FK-beroenden till webbens interna tabeller. Konfiguration och adaptrar ger den nödvändiga kopplingen.
- En mallförsäljning omfattar avtalad källkod, layoutkomponenter, källtillgångar som får överlåtas, konfigurationsmallar, adapterkontrakt och applikationens egna schemamigreringar. Gridex kunddata, Auth-användare, nycklar, signeringscertifikat och providerkonton ingår inte.
- En köpare konfigurerar egen identitet och lagring samt en egen tenant i OPS eller en kompatibel API-adapter. Flyttbar app betyder inte att OPS affärsfunktioner automatiskt ingår i en malllicens.
- Om Gridex egen installation någon gång ska flyttas behövs en separat datamigrering: inventera referenser, mappa konton och kundbindningar, verifiera tenantfiltrering och radantal, kontrollera sessioner och providerlänkar samt genomför testad övergång med återställningsplan. Detta ingår inte i en vanlig mallexport.

### Bevis för att appen kan brytas ut

Ett exportkommando ska samla endast uttryckligt tillåtna källfiler och migreringar till en ny katalog. Exporten får inte ta med hela repot, miljöfiler, driftsnycklar eller kunddata. Den ska installeras, testas och byggas utan webbprojektet och kunna konfigureras för ett syntetiskt annat elbolag.

Första implementationen innehåller `packages/mobile-foundation` och `scripts/export-mobile-foundation.mjs`. Sex riktade tester verifierar bland annat att grundpaketet kan köras fristående och att exporten vägrar befintliga destinationer och otillåtna sökvägar. Detta är den första grunden: native-app, full layout, identitetsadapter, databasadapter och kundflöden återstår och ska läggas till i samma exportbevis när de byggs.


Börja med en separat serverdeployment per elbolag, byggd från samma kod, för tydlig konfigurations- och nyckelseparation. Gridex och en syntetisk testleverantör ska fungera redan under utvecklingen. Testleverantören bevisar att inga Gridex-namn, konton, länkar eller data följer med av misstag. Den publiceras inte som en extra butikskopia.

Varje framtida elbolag planeras publicera sin app genom sina egna utvecklarkonton. Apple har särskilda regler för kommersiella appmallar och både Apple och Google bedömer likartade appar och tjänstens faktiska värde. Eget konto och ny logotyp garanterar inte godkännande; bolagets egen kundtjänst, innehåll och anpassade upplevelse måste framgå.

## 8. Byggordning och leveranser

### Etapp 0 – fastställ funktionsomfattning och kontrakt

- Inventera kundens skärmar och åtgärder på Gridex Web och markera vilka som är driftsatta, kodade, avstängda respektive saknar underlag.
- Mappa varje funktion till OPS-operation, scope, identitet och förväntat resultat.
- Verifiera senaste main och den driftsatta API-versionen. Dokumentera skillnader.
- Bekräfta Gridex identitetsprojekt och konto–kundbindning för återanvändning i mobilen.
- Specificera API-arbetet för avtalsbyte, prisserier och förbrukningssummering.

**Leverans:** funktionsmatris, API-matris, granskade kontraktsförslag och prioriterad backlog. Alla kundfunktioner har en uttalad plats i planen.

### Etapp 1 – projektgrund och två bolagskonfigurationer

- Utöka befintliga gridex-web med app, serverdel, delade paket, låsta beroenden och CI.
- Separera Gridex-konfiguration och databas-/identitetsadaptrar från appkärnan. Verifiera export till nytt repo utan hemsidan eller kunddata.
- Bygg Gridex-tema, navigation, gemensamma formulär och tillstånd för laddning, tom data och fel.
- Lägg upp separata utvecklings-, test- och produktionskonfigurationer.
- Skapa Gridex och syntetiskt bolag, separata app-ID:n och testbyggen för riktiga telefoner.
- Anslut serverdelen till OPS integrationskontext utan att exponera hemligheter.

**Leverans:** installerbar grund på iPhone och Android och demonstrerad konfigurationsseparation.

### Etapp 2 – inloggning och första kompletta kundflödet

- Anslut befintligt Gridex-konto, verifiera session och härled OPS-kund.
- Bygg Hem, Mina sidor, anläggningsväljare och avtalsdetalj.
- Testa återstart av appen, utgången session, återställning och utloggning.
- Verifiera att två kunder och två bolag aldrig kan läsa varandras uppgifter.

**Leverans:** kunden loggar in på telefonen och ser rätt befintligt avtal från OPS. Detta är första användbara testversionen.

### Etapp 3 – elpriser, förbrukning, fakturor och dokument

- Leverera nödvändiga OPS-kontrakt för serier och periodsummeringar.
- Bygg prisgrafer, elområdesval, förbrukningsvyer och märkning av ofullständig data.
- Bygg fakturalista, detaljer och säker dokumentvisning.
- Lägg till relevanta profil- och flyttfunktioner från funktionsmatrisen.

**Leverans:** en fungerande kundöversikt med verifierade priser, förbrukning och dokument på båda plattformarna.

### Etapp 4 – teckna och byta avtal

- Bygg hela flödet för nytt avtal mot OPS erbjudanden och offertvalidering.
- Stöd både nya kunder och befintliga kunder med ytterligare anläggning utan dubbla kundposter.
- Implementera och anslut OPS-processen för byte av befintligt avtal.
- Verifiera acceptans-/signeringsbevis, dokument, datum, avgifter, dubbletter och återhämtning efter avbrott.
- Genomför en separat BankID-integration om den ska erbjudas; aktivera den först efter verifiering av leverantörens verkliga flöde.

**Leverans:** riktiga ansökningar och avtalsbyten kan genomföras och följas i testmiljön. Knappar som endast skapar en generell händelse räknas inte som avtalsbyte.

### Etapp 5 – support och mobilaviseringar

- Bygg kundärenden, meddelanden och tillåtna bilagor mot OPS.
- Anslut portalnotiser, läsmarkering och godkända pushhändelser.
- Registrera enheter med bolag och användare; hantera tokenbyte, avregistrering och kontobyte.
- Lägg till tydliga notisinställningar och säkra länkar till appens vyer.

**Leverans:** kundens ärende kan följas hela vägen till svar från support, och push öppnar rätt innehåll för rätt inloggad kund.

### Etapp 6 – verifiering, pilot och butikspublicering

- Verifiera hela funktionsmatrisen mot samma releaseversion och aktuell OPS-version.
- Genomför riktade säkerhets- och isoleringstester, API-kontraktskontroller och relevanta regressionskontroller i OPS.
- Kör kompletta kundresor på riktiga iPhone- och Android-enheter med svagt nät, avbrott och appåterstart.
- Verifiera tillgänglighet, större text, skärmläsare, långa listor och tidsserier.
- Förbered integritetsuppgifter, kontohantering/kontoborttagning, butikstexter, supportlänkar, appikoner och produktbilder.
- Distribuera pilot via TestFlight och Google Plays testspår, följ fel och rätta innan offentlig lansering.
- Dokumentera release, återställning och hur en äldre installerad app hanteras vid API-ändringar.

**Leverans:** dokumenterad releasekandidat, godkänd pilot och därefter butiksinlämning. Publiceringens datum beror även på konton, externa integrationer och butikernas granskning.

## 9. Obligatoriska acceptansfall

| Område | Bevis som krävs |
| --- | --- |
| Identitet | Samma kund kan använda webben och appen; fel utfärdare, utgången eller återkallad session och avstängt konto ger ingen åtkomst; ominstallation ger inget undantag |
| Isolering | Ändrat kund-, faktura-, dokument-, ärende- eller bolags-ID ger aldrig en annan parts data |
| Flera anläggningar | Rätt avtal, värden, dokument och bytesstatus följer vald anläggning |
| Nyteckning | Dubbeltryck och återförsök efter timeout ger en ansökan för samma försök |
| Avtalsbyte | Behörighet, avgifter, datum, villkor, signering och parallella ändringar kontrolleras av OPS |
| Historik | Kunden får endast mätvärden för den period och anläggning kunden har rätt till, även vid inflyttning |
| Summering | Rättelser, paginering, saknade värden och sommar-/vintertid hanteras utan dubblering |
| Priser | Spotpris och kundpris hålls isär; moms och avgiftsomfattning visas rätt; saknade priser visas som saknade |
| Dokument | Säker hämtning fungerar och en utgången länk kan hanteras utan att dokumentet blir publikt |
| Support | Kundsynliga svar och bilagor fungerar; interna anteckningar förblir interna |
| Push | Utloggning och kontobyte tar bort tidigare bindning; händelser dedupliceras och öppnar rätt behörighetskontrollerade vy |
| Återanvändning | Ett andra syntetiskt bolag byggs från samma kod och kan inte nå Gridex-data; dess fjärruppdateringar kan inte installeras i Gridex-appen |
| Utbrytning | Appens källkod, layout och egna migreringar kan exporteras, installeras, testas och byggas utan webbprojektet. Köparen konfigurerar egna provideruppgifter och får inga Gridex-kunder eller hemligheter |
| Gemensam databas | Gridex webb och app återanvänder befintligt identitetsprojekt och samma verifierade kundbindningar; ingen separat mobil kunddatabas behövs |
| API-versioner | Kontraktsändringar upptäcks i CI; äldre appversioner får ett kontrollerat svar |

## 10. Arbetsform och färdigdefinition

Arbeta i små sammanhängande leveranser. Varje leverans innehåller gränssnitt, API-koppling, relevanta beteendetester och dokumenterat resultat. Kör riktade kontroller under arbetet och samla den breda mobil- och releaseverifieringen till en bestämd kandidat.

OPS-ändringar görs i egna avgränsade PR:er och samordnas med pågående arbete där. Ingen parallell skrivning i redan ägda filer eller dubblering av gemensamma testproducenter. Apparbetet ska inte ändra pågående Ediel-simuleringar eller deras underlag utan ett uttryckligt relevant uppdrag.

Appen är färdig för lansering när alla överenskomna kundfunktioner i matrisen fungerar genom de riktiga API:erna på båda plattformarna, kritiska fel är rättade, rätt juridik och pris visas, isolering är verifierad och piloten är godkänd. Att skärmarna finns eller att appen går att bygga räcker inte.

För projektstart används befintliga gridex-web-repot, verifierad testmiljö i OPS och Gridex befintliga identitetsprojekt. För testdistribution och publicering behövs Gridex Apple-/Google-konton och byggsignering. BankID-provider behövs endast för de BankID-flöden som faktiskt ska aktiveras. Detta är projektberoenden att ordna, inte skäl att stoppa oberoende grundarbete.

**Första implementationen:** skapa projektgrunden, etablera Gridex-konfigurationen, verifiera mobil inloggning och visa ett befintligt kundavtal från OPS på iPhone och Android.

## Källor och kontrollpunkter

### Granskad projektkod

- [Gridex Web – inloggning](https://github.com/heke99/gridex-web/blob/1fc033ef791b5bb62ac6672576e64c83727c17d0/app/login/actions.ts).
- [Gridex Web – avstängd publik BankID-rutt](https://github.com/heke99/gridex-web/blob/1fc033ef791b5bb62ac6672576e64c83727c17d0/app/api/bankid/initiate/route.ts).
- [Gridex Web – kund-, avtals- och anläggningsmodell](https://github.com/heke99/gridex-web/blob/1fc033ef791b5bb62ac6672576e64c83727c17d0/docs/customer-portal-contract-and-facility-model.md).
- [Gridex Web – OPS-kundklient](https://github.com/heke99/gridex-web/blob/1fc033ef791b5bb62ac6672576e64c83727c17d0/lib/ops/client/portal.ts).
- [OPS – kund-API-guide](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/docs/gridex-customer-portal-api.md).
- [OPS – webbens integrationsguide](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/docs/external-website-api-integration-guide.md).
- [OPS – kund-OpenAPI](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/docs/openapi/customer-portal-v1.json).
- [OPS – webb-OpenAPI](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/docs/openapi/website-integration-v1.json).
- [OPS – mätvärdesrutt](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/app/api/v1/customer/metering-values/route.ts).

### Officiell plattformsdokumentation, kontrollerad 6 november 2026

- [Expo – autentisering och returlänkar](https://docs.expo.dev/guides/authentication/). Vid OAuth/OIDC krävs utvecklingsbygge för korrekta appreturer; Expo Go räcker inte för det testet.
- [Expo – SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/). Använd för små känsliga värden och verifiera lagringsgränser och livscykel.
- [Expo – appvarianter](https://docs.expo.dev/build-reference/variants/). Separata byggvarianter använder separata appidentifierare.
- [Expo – miljövariabler](https://docs.expo.dev/guides/environment-variables/). Publika appvariabler kan läsas ur apppaketet.
- [Supabase – React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native). Underlag för mobil kontohantering och sessionslivscykel.
- [Apple – App Review Guidelines, särskilt 4.2 och 4.2.6](https://developer.apple.com/app-store/review/guidelines/). Regler för appfunktionalitet och kommersiella mallappar.
- [Google Play – Spam / Repetitive content](https://support.google.com/googleplay/android-developer/answer/9899034/spam?hl=en-GB). Regler för repetitiva appar och tjänstevärde.
