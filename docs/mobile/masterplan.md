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


## Genomförandeläge – native-grund, 6 november 2026

Expo SDK 58-grund tillagd under apps/mobile, med egen låsfil för beroenden för
att hålla mobilens React-version åtskild från hemsidans. Fem flikar och en
varumärkesstyrd layout finns. OTA-uppdateringar är avstängda i utvecklingskonfigurationen.
Typkontroll och Android-bundling är verifierade lokalt. Detta är inte ett
signerat installationspaket eller en testad kundresa på fysisk telefon.
Nästa funktionella del är befintlig kundinloggning och serververifierad kundöversikt
mot OPS. Inga nya databaser eller kundposter har skapats av denna grund.


### Kundinloggning och avtalsläsning – kodad testkandidat

Appen har nu e-post/lösenordsformulär mot samma konfigurerade Supabase-projekt
som hemsidan och en avtalsvy mot den nya servervägen. Sessionen är endast i minnet;
återställning av lösenord, beständig säker lagring och automatisk förnyelse återstår.
Servervägen verifierar bearer-token genom Auth, läser kundprofil med användarens
RLS och anropar befintligt OPS-API. Den tar inga kund-ID:n från mobilen och är
avstängd som standard tills testmiljön kvalificerats.

Verifierat lokalt: sex serverbeteendetester, sex portabilitetstester, tre riktiga
HTTP-kontroller, typkontroller, riktad lint, Next-produktionsbygge samt Android-
och iOS-bundling. Riktiga provideruppgifter och en testkund behövs för att verifiera
hela lyckade inloggningsresan och den faktiska kundbindningen; det är ännu inte gjort.


### Fyra byggdelar – beständig session, återställning, anläggningar och fakturor

- SecureStore-adapter med storleksbegränsade Unicode-säkra delar, atomiskt
  generationsbyte, seriella lagringsoperationer och ingen okrypterad reservlagring.
  Sparad session förnyas före visning efter start/återgång. Bakgrund döljer data.
- Lösenordsåterställning överlämnas från appen till den befintliga webbens
  återställningsflöde på konfigurerat bolags HTTPS-origin, utan credentials i URL.
- Anläggningsvy och serverroute mot OPS med verifierad subject/RLS-kundbindning.
- Fakturalista och serverroute mot OPS med belopp, valuta, status och förfallodag.
  Saknade belopp markeras och kreditbelopp bevaras. PDF och komplett paginering
  är separata återstående delar; denna vy visar de rader aktuellt API lämnar.

Alla delarna använder befintliga Gridex-konton/databas och OPS. Ingen ny
produktionsdatabas skapas. Resurserna hämtas oberoende så att ett delfel inte
slår ut andra vyer. Detta ersätter föregående versions begränsning till enbart
minnessession och avtalslista. Fysisk enhet, rätta provideruppgifter och lyckad
hela-kundresan-verifiering återstår före aktivering.

Verifiering av fyrdelarsleveransen: 32 riktade tester, full lint, typkontroller,
Next-produktionsbygge och Android-/iOS-bundling passerar lokalt. Nio HTTP-kontroller
bevisar nekad åtkomst/parametrar/avsaknad av providerkonfiguration på tre routes.
Det är inte bevis för lyckad livekundinloggning eller riktig enhet. ESM Metro-config
rättar förra versionens CI-lintfel. Publicerat OPS-manifest hämtat direkt anger
release/specs/guide 2026-10-12.1 men runtime 2026-10-09.1; befintlig preflight
stoppar på detta. Versionsspärren behålls tills integrationskontraktet kvalificerats.


### Femdelarsleverans – fakturadetalj, rader, dokument, supportlista och meddelanden

1. Fakturadetaljen läser nu det verifierade OPS-formatet data.invoice med separata
   data.lines och data.documents. Den tidigare utkasttolkningen är ersatt. Fel
   fakturareferens avvisas och vald faktura bevaras vid retry/återgång.
2. Fakturarader visas med antal, à-pris, moms och belopp där data finns. Nollor,
   kreditbelopp och saknade värden hålls isär. Appen räknar inte om OPS-totalen.
3. Dokumentöppning begär en ny Auth/RLS/OPS-kontroll för varje klick och kräver att
   dokumentet hör till just den fakturan. Befintliga HTTPS-länkar lämnas endast
   ut från konfigurerade GRIDEX_MOBILE_DOCUMENT_ORIGINS. API-bearer skickas inte
   till extern läsare; länken sparas inte i appens detaljstate. Ingen URL hämtas
   av servern. Logout/bakgrund stoppar sen extern navigering. Verklig provider-
   behörighet, länkars giltighet och läsaröverlämning måste kvalificeras i staging.
4. Kunden kan läsa sina supportärenden via befintligt OPS kundsupport-API, med
   samma betrodda Auth-subject och profilbindning som övriga kundresurser.
5. Ärendetalj och kundsynliga meddelanden visas utan interna anteckningar eller
   personal-ID:n. Fristående meddelandeläsning verifieras mot begärt ärende.
   Vyn är läsande; skrivning går tills vidare via befintliga Mina sidor på webben.

Verifierat lokalt: 59 riktade mobil-/server-/portabilitetstester, befintliga
kundsupportregressioner (27 API-fall och 9 handoff-fall), 21 HTTP-kontroller för
nekad åtkomst/ogiltiga parametrar/saknad konfiguration, typkontroller, full lint,
Next-produktionsbygge samt Android-/iOS-Hermes-export. Auth/OPS-providergränserna i
beteendetesterna är syntetiska; lyckad livekundresa och fysisk enhet är fortfarande
inte verifierade. Inget har aktiverats i produktion och ingen databas har skapats.

Kvar: full paginering, native stöd för att skriva i ärenden/ladda upp bilagor,
inbyggd PDF-läsare, förbrukning och elprisserier, avtalsteckning/avtalsbyte samt
fortsatt bevis för export av hela appen. Publicerat OPS-manifests versionsskillnad
är fortsatt separat releaseblockerare; integritetsgrinden har inte försvagats.


### Nästa supportsteg – ärendeskapande, svar och ärendepaginering

Appen har nu native-formulär för nya ärenden och svar, kopplade till befintliga
OPS-writeoperationer. Servern verifierar samma Auth-subject/RLS-profil och accepterar
inte author, visibility eller kund-ID från mobilen. Body begränsas vid strömläsning.
Samma osäkra skickförsök behåller idempotensnyckel vid oförändrad användare/text;
nyckeln är än så länge processlokal, inte en beständig kö över appomstarter.
Lyckat svar måste bekräftas av servern innan formuläret rensas. Sena svar efter
utloggning ignoreras. Native-vyn erbjuder också Visa fler ärenden med OPS-cursor
och sammanslagning utan duplicerade referenser. Meddelandepaginering inväntar
kontraktskvalificering: låst lokal GET messages-specifikation saknar cursor.
Ingen faktisk kundmutation, e-post eller produktionsaktivering har utförts här.

### Fem kundvyer – profil, meddelanden, dokument, fullmakter och godkännanden

Fem separata native-vyer hämtar nu befintliga OPS-resurser via mobilens
serveradapter: me, notifications, documents, powers-of-attorney och
legal-acceptances. Samma verifierade Supabase-subject och kundprofil används;
telefonen väljer aldrig kund eller tenant. Endast uttryckligen tillåtna fält
returneras. Profilen visas enligt OPS me-svar (data direkt); meddelanden använder
message/read_at. Fullmakter visar omfattning och giltighet; godkännanden visar
registrerad dokumentversion, tid och källa utan att tillskriva BankID-verifiering.

Dokumentlistan lämnar inte ut länkar. Öppna dokument gör en ny Auth-/RLS-/OPS-kontroll,
kräver en unik dokumentreferens i kundens egna dokument och en tillåten HTTPS-origin.
Den externa läsaren får enbart länken, ingen sessionsheader. Appen rensar även
dessa vyer vid utloggning och när den går i bakgrunden.

Detta paket ger läsning, inte profiländring, markera som läst eller ny signering.
Listantalet avser hämtade poster, inte ett garanterat totalt antal i OPS. Endast
supportärenden har kvalificerad cursor-fortsättning i nuvarande mobiladapter.
Vyerna och kundisoleringen är kontrollerade med syntetisk Auth/OPS; faktisk
kundinloggning, signerade enhetsbyggen och produktionskoppling återstår.
Den tidigare dokumenterade OPS-manifests versionskonflikt kvarstår som releasegrind.
Samma repo och befintliga databas används. Appmallens konfiguration och UI hålls
separerade från Gridex, men export av hela appen är ännu inte verifierad.

### Hela mobilens källkod går nu att exportera

`scripts/export-mobile-app.mjs` exporterar mobilappen och den delade grunden till
en ny katalog utanför Gridex-repot. `npm run mobile:export -- /ny/katalog` ger en
neutral mall; en valfri JSON-fil styr namn, tema, brand-ID, app-ID och URL-schema.
Appens ursprungliga branding och konfiguration ändras inte. Exporten använder en
explicit fillista, avvisar källsymlänkar och befintliga mål, och skriver SHA-256
för varje överförd fil i source-manifest.json. Miljöfiler, beroendekataloger,
databasdata, Gridex-specifik branding och serverhemligheter ingår inte.

Den kompletta exporterade native-källan har installerats med sin egen låsfil,
typkontrollerats och paketerats till Android/iOS Hermes utanför ursprungsrepot.
Fem exporttester verifierar även alternativ kundbranding, bevarade källfiler,
filhashar och avvisade felaktiga mål/konfigurationer. CI har ett separat jobb som
upprepar extraktion, installation, typkontroll och båda plattformsexporterna.
Detta ersätter tidigare statusen att bara foundation-exporten var verifierad.

Backend ingår inte i denna källkodsmall. backend-contract.md beskriver de befintliga
mobil-endpointsen och kraven på Auth, kundisolering, dokumentlänkar och support.
En köpare behöver sin egen backendadapter och Auth/databas, eller en separat
avtalad integration. Automatisk backend-/databasmigrering är inte byggd. Gridex
fortsätter använda samma repo och samma befintliga databas. Ingen ny databas,
produktionsaktivering eller kunddataöverföring har gjorts.

Kvar: kvalificerad riktig Auth/OPS/enhet, signerade mobilbyggen, pris-/förbrukningsvyer,
avtalsteckning/byte, fler kvalificerade sidindelningar och beständiga supportförsök.
OPS:s tidigare dokumenterade manifestkonflikt kvarstår som releasegrind.

### Fyra fortsatta delar – valfri backend, referensserver, avtalslänkar och Gridex-koppling

1. Mobilen använder nu en gemensam validerad endpoint-byggare. API-origin ska vara
   en ren HTTPS-origin; EXPO_PUBLIC_CUSTOMER_API_PATH kan bytas från Gridex-standard
   /api/mobile/customer till exempelvis /customer/v1. Identitetsvärden accepterar
   inte URL/path-injektion. Samma kundladdare är testad mot en backend utan OPS.
2. Exporten inkluderar packages/customer-backend: en Request/Response-adapter utan
   OPS- eller databas-SDK. En köpare implementerar tokenverifiering, kundbindning,
   dataläsning och eventuell supportskrivning mot egna system. Adaptern validerar
   identitet och input, projicerar publika fält och kontrollerar dokumentorigins.
   Den körbara demonstrationen använder syntetiska data, är läsbar utan externa
   paket och har ingen produktionsauth eller databas. Den ersätter inte köparens
   produktionsintegration. Native-auth använder fortfarande Supabase-adaptern.
3. Gridex-appen har nu konkreta webblänkar för Teckna nytt avtal, Visa befintliga
   avtal och Få hjälp att byta avtal. Dessa skickar inga sessionstoken till webben.
   Signering och eventuellt stödärende slutförs där. Detta är inte native
   BankID-signering eller ett automatiskt avtalsbyte. Exporterad mall visar dessa
   länkar endast med EXPO_PUBLIC_CONTRACT_WEB_ORIGIN konfigurerad.
4. Gridex Vercel-konfiguration har granskats utan att exponera nyckelvärden.
   Mobilaktivering saknades. GRIDEX_MOBILE_API_ENABLED=true har lagts till endast
   för preview på codex/mobile-portability-20261106. Produktionsflaggan är inte
   aktiverad. scripts/check-mobile-readiness.mjs kontrollerar API-skydd utan att
   påstå att en riktig kund har verifierats. Skyddade preview-URL:er kräver även
   Vercel-åtkomst och är inte färdiga publika mobil-API-adresser.

Skarp OPS-kontroll 2026-11-06 misslyckas fortfarande: release/specifikation/guide
är 2026-10-12.1 medan runtime_contract_version är 2026-10-09.1. Grinden behålls.
Riktig kundinloggning, kundbindning och dokumentåtkomst i enheten samt signerade
byggen återstår före produktionsbesked. Inga riktiga kundmutationer har körts.
Tidigare text om att ingen backendkod alls följer med exporten ersätts av den
neutrala referensadaptern ovan; automatisk backend-/databasmigrering återstår.

### Aktuell verifiering och paketfix efter preview

På commit880d196 är mobilens standalone-export, native-shell och
portable-native-export gröna i GitHub CI. Vercel-preview byggde klart (READY),
och API:t avvisade customerId-override med400 och private/no-store. Direktanrop
utan Vercel-åtkomst ger302; den skyddade preview-adressen ska därför inte beskrivas
som en färdig publik mobil-backend. Verifierad riktig kundsession saknas fortfarande.
Lokalt passerar104 riktade tester samt Gridex och fristående Android/iOS-exporter.

Bred CI hittade dessutom11 sårbarhetsrapporter i webbprojektets låsta paketträd.
Next har uppdaterats från16.3.8 till16.4.5; fast-uri till3.1.9, estree-grenens
minimatch till11.0.5 och zod till4.6.7. Ingen automatisk tvångsuppgradering eller
nedgradering av Next har använts. Aktuell npm audit för rotprojektet rapporterar0.
API-kontraktsregressioner, kundsupport och audit-hardening går grönt efter bytet.
Mobilens separata låsfil berörs inte av dessa webbuppdateringar. OPS-manifestets
blandade versioner är fortfarande en separat felande kontroll.
Rotprojektets Next16.4.5-produktionsbygge och18 HTTP-kontroller av mobil-API:ts
skydd gick också igenom efter paketuppdateringen, utan riktiga kunduppgifter.

### Rättad versionskontroll och fungerande native elprisvy

Tidigare besked om en felaktig OPS-release korrigeras: OPS publicerar avsiktligt
API_DOCUMENTATION_VERSION=2026-10-12.1 och stabil wire-revision2026-10-09.1.
Det bekräftas både i OPS:s websiteIntegrationContract.ts och de publicerade
specifikationernas info.version respektive x-contract-schema-version. Felet låg
i Webs antagande att dokumentations- och runtimeversion måste vara samma sträng.
OPS-kod eller runtime har inte ändrats här.

Web har nu separata GRIDEX_API_DOCUMENTATION_VERSION och GRIDEX_API_CONTRACT_VERSION.
Releasevalideringen kontrollerar dokumentationssamstämmighet, giltiga datumrevisioner,
minimum<=runtime<=documentation, kompatibel dokumentationsrevision, exakta URL:er,
specifikationsversioner och SHA-256. Specifikationernas wire-extension måste matcha
manifestets runtimeversion. Hash- och driftkontroller består. De verkligt publicerade
specifikationerna har synkats och typer/hashar genererats om. api:preflight går grönt,
inklusive live-byte-/hashjämförelse och strikt kompatibilitet utan undantagsflagga.
Readiness jämför nu respektive revision mot rätt verifieringsfält. Tester med
aktuella fejkservrar använder verifierad wiremetadata; historiska kommersiella
originaldata bevaras. Downgrade, identitets- och idempotenskrav är inte försvagade.

Elpriser-fliken innehåller nu native-priser för SE1–SE4, aktuell publicerad period,
varaktighetsvägt medelpris, hela intervallistan, källa och avgiftsinformation. Den
använder samma publika tjänst som Gridex webb, utan kundtoken eller OPS. Dagens
skarpa SE3-svar verifierades med96 kvartsvärden. Priser hanterar noll, negativa värden,
saknade perioder och Stockholms datum/tidsomställning. Fel elområde, gammalt dygn,
överlappande intervall och sena svar för annat valt område avvisas. Bakgrundsläge
avbryter hämtning; återgång/uppdatering hämtar nytt. Det är spotpris, inte kundens
slutliga avtalskostnad. Köpare kopplar egen källa med EXPO_PUBLIC_PRICES_ORIGIN och
EXPO_PUBLIC_PRICES_PATH; utan sådan konfiguration gör mallen inget prisanrop.

Kundsession är ännu inte verifierad: webbläsaren nådde Gridex login för Mina sidor,
men någon kund var inte inloggad. Det kräver kontoinnehavarens säkra inloggning.
Produktionsaktivering, publik mobil-API-adress och signerade enhetsbyggen är fortfarande
separata återstående steg; native förbrukning och native signering/avtalsbyte är inte
färdiga i detta paket. Tidigare manifestkonflikt är däremot inte längre en blockerare.

### Telefonändring och lässtatus i kundappen

Profilvyn kan nu spara kundens telefonnummer. POST profile accepterar enbart
telefonfältet, verifierar Auth-subject/RLS-bindning och använder befintlig OPS-write.
Native-success kräver status accepted och profile_updated=true från det kanoniska
svaret. Inloggningsadress, roller och kund-/tenantidentitet kan inte ändras här.
Ingen direkt SQL-skrivning, e-post eller ny databas används.

Notiser kan markeras som lästa. Servern tar en kanonisk notisreferens, använder
behörig kundidentitet och kontrollerar därefter kundens egna notiser igen. Bara en
entydig match med status read och ett giltigt read_at ger bekräftelse till appen.
Den lokala raden uppdateras först efter den bekräftelsen. Saknat läskvitto eller
osäker transport behåller försöksnyckeln; sena svar efter utloggning/bakgrund får
inte återställa privata uppgifter. Telefonnummer behålls i formuläret vid fel och
visas som sparat först efter bekräftelse. Generiska konflikt-/försöksgränssvar visas.
Försöksidentiteten är fortfarande processlokal, inte beständig över appomstarter.

Den OPS-fria backendadaptern stöder samma phone och notificationRead-operationer
via köparens provider.write. För lässtatus krävs ett serverbekräftat readAt. Den
syntetiska demon är fortsatt läsbar utan externa paket och kan inte skriva data.
För köparens produktion krävs egna lagrings-, ägarskaps- och idempotensregler.

Användaren har inget Gridex-kundkonto ännu. Det blockerar inte fortsatt bygge eller
syntetisk verifiering. Inloggningsförfrågan avböjdes och kommer inte upprepas utan
nytt önskemål. Inget riktigt konto har skapats och ingen kundmutation har gjorts.
Det här är Gridex El-kundappen; OPS operatörsapp är ett separat arbete.
Lokalt verifierat:127 unika riktade tester, typkontroller, lint och webbbygge samt
Gridex Android/iOS-paketering. Sex HTTP-kontroller mot byggda POST-vägar gick också
grönt. Tester använder syntetisk identitet och provider; detta är inget påstående
om ändringar i en riktig kundprofil. Riktigt kundkonto behövs först för senare
skarp kundverifiering, inte för att fortsätta kodarbetet.

### Samlad testkörning

npm run mobile:verify kör kundroutes, konto-/provider-/export-/pristester,
verkliga native-hooks och UI-komponenter med syntetiska beroenden samt native/web
typkontroll och lint. Oberoende testgrupper fortsätter efter fel. JSON-rapporten
binder resultatet till HEAD och anger om arbetskopian har ändringar. Riktig
kundverifiering, signerad enhetsinstallation och produktionsaktivering markeras
uttryckligen som ej verifierade; gröna syntetiska tester ersätter inte dessa.
Standardrapporten skrivs till /tmp/gridex-mobile-verification.json.

### Fyra listförbättringar

Fakturalistan har lokal sökning på fakturanummer/referens och statusfilter.
Supportlistan har sökning i rubrik/beskrivning/referens kombinerad med statusval.
Avtalskort visar kanonisk referens och kontrollerat svenskt kalenderdatum utan
att hitta på saknade avtalsvillkor. Listöversikten visar antal och statusfördelning
för hämtade poster, uttryckligen inte totalen i OPS. Filter kan rensas; listans
sökstate försvinner när kundvyn avmonteras vid utloggning. Ingen extra kunddata
hämtas eller skickas till söktjänst. Förbättringarna följer med mallexporten.

### Paket1–2: produktionskoppling och förbrukning (6 november, pågående leverans)

Förbrukningsfliken har anläggningsval,7/30 kalenderdagar i Europe/Stockholm,
startdygnsdiagram, summering av hämtade värden, delvis/komplett källstatus, tomläge
och återförsök. Sena svar efter anläggningsbyte, utloggning eller bakgrund visas
inte. Perioder kring båda tidsomställningarna testas. Inga luckor fylls med noll.
Den fristående mallexporten innehåller samma UI och ett OPS-oberoende,
leverantörsneutralt förbrukningskontrakt med verifierade leveransfönster.

**Gridex förbrukning är fortfarande blockerad**, trots färdigt gränssnitt och
syntetiskt verifierad provider. Den aktuella OPS-mätvärdesrutten filtrerar på
bolag/kund, men inte på kundens leveransperiod. DTO:n saknar auktoritativa
leveransfönster per anläggning. Mobilservern svarar därför503 före mätvärdeshämtning.
Inflyttningsdatum, mätarinstallation eller ett annat avtal används inte som
ersättning. OPS måste först leverera verifierbara tidsgränser och korrekt
anläggningskoppling samt hantera revisioner/paginering. Detta får inte döljas bakom
en grön versions-/OpenAPI-kontroll. OPS har inte ändrats eller produktionssatts här.

Paket1 gäller den publika serveranslutningen; verifiering med ett riktigt kundkonto
är en separat öppen kontroll. Signerade butiksversioner hör till paket4.
Aktuell leverans och de två egengranskningarna dokumenteras i
`docs/mobile/release-package-1-2.md`.

Produktionsbasen visade sig vara7c215d13,47 levererade commits efter nuvarande
GitHub main1fc033e. Appkandidaten förenas med denna faktiska produktionshistorik
före publicering. Befintlig kundaktivering, integritetsflöden, supportåterställning,
cache- och SEO-arbete behålls. Webs uttryckligen stödda svarsprofiler4.1/9.1
behålls med fulla krav på affärsfälten; godtyckliga äldre profiler avvisas.
Staff-specifikationens verifiering behålls tillsammans med webb- och kund-API:t.


Produktionsstatus efter paket1–2: PR #56 är mergad som84278b7 och den granskade
applikationskoden är driftsatt på gridex.se (dpl_97r9w3PvvjavCfpHgJiUEVyjBujw).
Mobil-API:t är produktionsaktiverat.30 publika HTTP-grindtester går grönt och dagens
skarpa SE3-priser har96 intervall som godkänns av appens parser. CI:s webb-, support-,
webbläsar-, isolerings- och mallexportkontroller är gröna på samma applikationsträd.
Förbrukningsvyn/mallkontraktet är byggda, men Gridex verkliga förbrukning är spärrad
tills OPS levererar rätt leveransgränser. Riktig kundinloggning/återläsning är ännu
inte verifierad. Hela paket1–2 ska därför inte beskrivas som fullt färdigt.
