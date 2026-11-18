# Gridex Web – samlad felgranskning den 17–18 november 2026

Granskningen omfattar API och integrationer, cache, laddningstid och prisvisning, teckning och kvitton, avtalsstart, avtalsvillkor, dokument och fullmakter, Mina sidor, fakturor, mätvärden, profil och konto, webbanalys, integrationsimporter, schemalagda jobb och kundservice. Den samlar **174 fynd från 32 granskningsomgångar**, varav 34 har hög prioritet. De högprioriterade fynden omfattar bland annat felaktiga pris-, avtals- och kontaktuppgifter, fakturor som kan flyttas mellan kundprofiler, teckningsreferenser i webbanalysen, fel datum för ångerfristen, otydlig fullmaktsomfattning, otillgängliga fakturaunderlag och mätvärden, avbruten kontoaktivering och kundåtgärder som kan hamna på fel anläggning.

## Arbetsunderlag för Cline

Det här är den samlade rapporten för Gridex Web. Den innehåller **209 poster från två underlag**. Den egna granskningen står för **174 GW-fynd**. Bilagan innehåller **30 fynd med bevisbeskrivning (F140–F169)** och **fem åtgärdsnoteringar (F135–F139)**. F1–F134 omnämns i källmaterialet, men deras fyndtexter ingick inte i bilagan. Antalet poster inkluderar överlapp och åtgärdsnoteringar.

1. Utgå från aktuell `main` när arbetet börjar. Reproducera varje valt fynd på den revisionen med syntetiska data och markera de fynd som redan är lösta. Källänkarna visar de granskade revisionerna. Bilagans verifieringsresultat återges från bilagan.
2. Börja med kunddata, fakturor, pris, teckning och signering. Följ sedan upp API-fel och prestanda. Välj en avgränsad kodväg per ändring och behåll de berörda fynd-ID:na i ändringens beskrivning.
3. Kontrollera Web, mobil och OPS när samma kontrakt används av flera klienter. Gör OPS-ändringar i OPS-repot med ett separat underlag. Behåll kund- och bolagsbindning, kontroller av gällande pris och dokumentversion, samt idempotens och säkra återförsök.
4. Lägg till ett riktat regressionstest för varje verifierat fel och kör befintliga tester för det berörda flödet. För prestandafynd, jämför före och efter med samma data. Redovisa till exempel antal OPS- och databasanrop, svarsstorlek, 95:e percentilen och tid till visat resultat.

### Föreslagen arbetsordning

| Ordning | Arbete | Börja med |
| --- | --- | --- |
| 1 | Stoppa felaktig fakturatillhörighet, informationsförlust och överföring av privata referenser | [GW140](#gw140), [GW141](#gw141), [GW14](#gw14), [GW115](#gw115), [GW84](#gw84), [GW87](#gw87) |
| 2 | Säkerställ pris, avtal, signering, kvitton och status | [GW01](#gw01), [GW02](#gw02), [GW12](#gw12), [GW06](#gw06), [GW48](#gw48), [GW57](#gw57), [GW130](#gw130) och övriga P1 |
| 3 | Återställ kundens åtkomst till fakturor, förbrukning, äldre supportärenden och fullmakter | [GW17](#gw17), [GW64](#gw64), [GW68](#gw68), [GW78](#gw78), [F147](#f147), [F152](#f152) |
| 4 | Stabilisera aktivering, kvitton, avbrott och återförsök | [GW30](#gw30), [GW32](#gw32), [GW33](#gw33), [GW163](#gw163)–[GW166](#gw166), [F143](#f143)–[F144](#f144), [F157](#f157), [F159](#f159), [F165](#f165)–[F169](#f169) |
| 5 | Minska onödiga läsningar, svarsstorlek och väntan | [GW91](#gw91), [GW104](#gw104), [GW167](#gw167), [GW169](#gw169)–[GW174](#gw174), [F135](#f135)–[F140](#f140), [F145](#f145)–[F146](#f146), [F150](#f150)–[F154](#f154), [F163](#f163) |

### Fynd som kan åtgärdas tillsammans

| Bilaga | Samlat arbete |
| --- | --- |
| [F151](#f151) och [GW124](#gw124) | Samma onödiga omläsning av ordinarie dokument vid bläddring i fullmaktsarkivet. |
| [F160](#f160) och [GW155](#gw155) | Samma onödiga behörighetsuppslag. Testa både Mina sidor och fakturor; behåll villkoren för administration och `/dashboard`. |
| [F161](#f161) och [GW156](#gw156) | Samma sekventiella väntan för logg och aktivering. Prova både tom kö och loggfel. |
| [F164](#f164) och [GW157](#gw157) | Samma förlust av returväg vid tillfälligt Auth-fel efter godkänt lösenord. Testa både dokument och fakturor. |
| [F135](#f135), [F136](#f136), [F153](#f153) och [GW168](#gw168) | Gemensam avbrottshantering i transporten. Kontrollera separat mätvärdessidor, PDF och adresskontroll. |

## Omfattning och verifiering

- Produktion på [gridex.se](https://gridex.se) körde commit [`1550174`](https://github.com/heke99/gridex-web/commit/155017475eb7d713e295db04d096b0af74350e48) enligt [Vercels driftsättning](https://vercel.com/div3rsa/gridex-web/32GYTAgPRfZJzZSuuBkHrqp7Rr3W). [Support123](https://support123.gridex.se) körde [`e4d0718`](https://github.com/heke99/gridex-web/commit/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea) enligt [supportens driftsättning](https://vercel.com/div3rsa/gridex-support/2xyCuU27E2nNUvp3dXZYdtQyDFp2).
- De lokala reproduktionerna kördes på GitHubs `main` vid `e4d0718`, i en separat kopia med Node 22. Skillnaden mellan webbens produktionsrevision och `main` bestod av tre filer för Androids produktionsverifiering. Arbetsytans tidigare revision `1fc033e` användes även för baslinjen `npm test`. [Jämförelse av revisionerna](https://github.com/heke99/gridex-web/compare/155017475eb7d713e295db04d096b0af74350e48...e4d071805240fb5fa4c2e517cd17d33c4a1b7dea)
- **Produktion** betyder observerat i ett publikt svar. **Lokalt** betyder reproducerat med riktiga kodvägar och syntetiska tjänster eller testdata. **Kodgranskning** betyder att slutsatsen följer av koden. P1 prioriterar pris, teckning, fakturaåtkomst och beständigt kund- eller köläge. P2 omfattar övriga funktions-, prestanda- och driftrisker.


### API-granskning den 18 november

Kartläggningen omfattade 73 routfiler i webbens `app/api` och en separat intern API-rutt i Support123. Av webbens routfiler tillhör 24 `web`, 16 `mobile` och 7 `checkout`. Övriga 26 täcker bland annat Auth, BankID, prisdata, administration, integrationer, webhookar och schemalagda jobb. Antalet avser routfiler. En fil kan hantera flera HTTP-metoder.

Den riktade granskningen följde teckningsklienten, den gemensamma JSON-gränsen, marknads- och portföljpris, OPS-transport, återförsök, anropsbegränsning och versionskontroll för Website, Customer Portal och Staff. Tidigare fynd om kund-API, webhookar och import finns kvar i den numrerade listan. De riktade kontrollerna kördes lokalt med simulerade beroenden och täcker de berörda kodvägarna.

## Fynd

<a id="gw01"></a>

### GW01 · P1 · Avtalscachen märker gammal data som aktuell

**Lokalt.** Ett isolerat Next.js-test returnerade `200` med en 20 minuter och 16 sekunder gammal snapshot och `stale: false` efter att OPS-omhämtningen misslyckats. Åldersgränsen på normalt 15 minuter gäller när data läses in i cachen. Svaret kontrollerar den inte på nytt efter en cacheträff. Besökare kan se gamla erbjudanden som om de vore aktuella. Den slutliga prisvalideringen kontaktar OPS med reservdata avstängd.

Kontrollera åldern när cachen läses. Märk eventuell reservdata som gammal och stoppa visningen när den maximala åldern passerats. Testa ett avbrott som varar längre än gränsen. [Avtalscachen](https://github.com/heke99/gridex-web/blob/1550174/lib/website/publicContractFeed.ts#L120-L135) · [Cacheläsningen](https://github.com/heke99/gridex-web/blob/1550174/lib/website/publicContractFeed.ts#L222-L236) · [Åldersgränsen](https://github.com/heke99/gridex-web/blob/1550174/lib/website/publicContractSnapshotStore.ts#L93-L98) · [Prisvalideringen](https://github.com/heke99/gridex-web/blob/1550174/app/api/checkout/quote/validate/route.ts#L59-L65)

<a id="gw02"></a>

### GW02 · P1 · Livepris rapporterar noll när prisdata saknas

**Produktion.** SE3 för 1 december 2026 gav `200`, noll mätpunkter och värdet `0` för snitt, lägsta och högsta pris. Prissidan använder samma sammanställning och kan därför visa 0 öre/kWh vid databortfall.

Returnera ett uttryckligt tillstånd för saknad prisdata. Visa det i gränssnittet och behåll stöd för verkliga nollpriser och negativa priser. [Produktionssvaret](https://gridex.se/api/elpris/live?area=SE3&date=2026-12-01) · [Prisberäkningen](https://github.com/heke99/gridex-web/blob/1550174/lib/gridex/livePrices.ts#L98-L107)

<a id="gw03"></a>

### GW03 · P2 · Publiceringswebhooken kvitterar misslyckad cacheinvalidering

**Kodgranskning.** När Next.js-invalideringen kastar ett fel kan webhooken ändå svara `200` och `ok: true` med `cache_revalidated: false`. En avsändare som styr återförsök på HTTP-status kan då lämna webbens cachade avtalslista utan omedelbar invalidering.

Gör misslyckad invalidering återförsökbar via HTTP eller ett beständigt jobb. Testa att en dubblett kan slutföra invalideringen efter att publiceringshändelsen redan sparats. [Felhanteringen](https://github.com/heke99/gridex-web/blob/1550174/lib/webhooks/publicationChanged.ts#L93-L114) · [Kvittensen](https://github.com/heke99/gridex-web/blob/1550174/lib/webhooks/publicationChanged.ts#L218-L236)

<a id="gw04"></a>

### GW04 · P2 · Elprissidan gör upp till 124 historiska hämtningar vid kall cache

**Kodgranskning.** Sidan hämtar dagens pris och väntar samtidigt på föregående månads snitt för fyra elområden. Vid kall cache och en månad med 31 dagar behövs 124 hämtningar för historiken och fyra för dagens pris. Färdiga månadssnitt ligger i en fem minuter lång processlokal cache. Det uppmätta antalet externa anrop i produktion är okänt.

Lagra färdiga månadssnitt i en delad cache eller som en förberäknad sammanställning. Låt dagens priser visas även när historiken väntar. [Sidans datahämtning](https://github.com/heke99/gridex-web/blob/1550174/app/%28public%29/elpriser/elpris-idag/page.tsx#L45-L64) · [Månadsberäkningen](https://github.com/heke99/gridex-web/blob/1550174/lib/gridex/pricing/elprisetjustnu.ts#L297-L320) · [Månadscachen](https://github.com/heke99/gridex-web/blob/1550174/lib/gridex/pricing/elprisetjustnu.ts#L352-L371)

<a id="gw05"></a>

### GW05 · P2 · CI:s beroendekontroll fallerar

**Lokalt.** `npm audit` gav exitkod 1 och rapporterade tio höga poster i ESLint-beroendekedjan kring `picomatch`. `npm audit --omit=dev` gav noll fynd i produktionsberoendena. CI kör den fullständiga kontrollen.

Uppdatera utvecklingsberoendena och låsfilen. Kör om audit, lint, tester och byggen. [CI-kontrollen](https://github.com/heke99/gridex-web/blob/e4d0718/.github/workflows/remediation-quality.yml#L53-L56) · [Advisory för picomatch](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

<a id="gw06"></a>

### GW06 · P1 · Leverantörsbyte visas som väntande oavsett faktisk status

**Lokalt.** Den riktiga API-routen fick avtalsenliga OPS-svar med `switch.status` satt till `completed`, `failed` och `submitted`. Alla gav `pending`, `terminal: false` och ett tomt uppdateringsdatum. Routen letar efter dessa uppgifter på rotnivå. Kunden på kvittosidan får därmed fel besked och sidan fortsätter fråga efter status.

Läs `switch.status` och `switch.updated_at` enligt OPS-kontraktet. Använd en uttrycklig mappning av statusar och testa även `switch: null`. [Webbrouten](https://github.com/heke99/gridex-web/blob/1550174/app/api/checkout/switch-status/route.ts#L26-L41) · [OPS-kontraktet](https://github.com/heke99/gridex-web/blob/1550174/docs/openapi/website-integration-v1.json#L11699)

<a id="gw07"></a>

### GW07 · P1 · En äldre kvittolänk kan skriva över en nyare kvittopost

**Lokalt.** Jag skapade först ett verifierat kvitto med `processing` och därefter ett med `accepted` för samma syntetiska teckning. När den äldre länken lästes skrev kvittolagringen tillbaka `processing` till den nyare posten. Varje läsning av en sådan länk försöker dessutom skriva hela kvittot igen, även från statusuppdateringen i webbläsaren.

Gör vanlig verifiering skrivfri. Låt en eventuell reparation fylla en saknad post eller tillämpa en kontrollerad versionsjämförelse atomiskt. Testa att ett gammalt kvitto kan läsas utan att nyare kvittodata ersätts. [Kvittolagringen](https://github.com/heke99/gridex-web/blob/1550174/lib/website/applicationResultStore.ts#L296-L318)

<a id="gw08"></a>

### GW08 · P1 · Samtidig köläggning kan skriva över ett aktivt teckningsjobb

**Lokalt.** I testet tog en körning ett jobb mellan köläggningens läsning och skrivning. Den senare skrivningen satte tillbaka jobbet till `pending`, återställde försöksräknaren från 1 till 0 och ersatte det accepterade innehållet med `submitting`. Detta kan försena eller förlora lokal registrering av en redan mottagen teckning.

Gör köskrivningen atomisk. Skydda aktiva och slutförda jobb och bevara det starkare tillståndet `accepted`. Lägg ett konkurrenstest vid databasgränsen. [Köskrivningen](https://github.com/heke99/gridex-web/blob/1550174/lib/website/submissionStore.ts#L378-L405)

<a id="gw09"></a>

### GW09 · P2 · Tillfälligt databasfel stoppar statusuppdateringen för databaslagrade kvittolänkar

**Lokalt.** Vid ett simulerat lagringsfel klassificerade kvittolagringen svaret som `storage_error`. Båda statusrutterna returnerade sedan `404 application_not_found`. Webbläsaren slutar fråga efter status vid `404`, även om databasen blir tillgänglig igen.

Låt rutterna behålla skillnaden mellan ogiltigt kvitto, utgången länk och tillfälligt fel. Returnera `503` vid tillfälligt lagringsfel så att webbläsaren försöker igen. [Kvittolagring](https://github.com/heke99/gridex-web/blob/1550174/lib/website/applicationResultStore.ts#L323-L353) · [Ansökningsstatus](https://github.com/heke99/gridex-web/blob/1550174/app/api/checkout/applications/%5BapplicationId%5D/route.ts#L34-L39) · [Webbläsarens återförsök](https://github.com/heke99/gridex-web/blob/1550174/components/signup/ApplicationStatusCard.tsx#L42-L54)

<a id="gw10"></a>

### GW10 · P2 · Felande webhookposter kan hålla kvar senare poster i kön

**Lokalt.** Två körningar med batchstorlek 1 valde samma felande post. När RPC-anropet kommer tillbaka med fel räknas felet i svaret, medan nästa försökstid ligger kvar. Om sådana poster fyller en batch kan senare händelser bli liggande. Detta gäller fel som hindrar en beständig uppdatering av raden, snarare än ett redan sparat återförsök i RPC-funktionen.

Spara ny försökstid och felstatus när databasen är nåbar. Lägg återkommande fel för manuell hantering efter en bestämd gräns och synliggör körningar som helt misslyckas. [Urvalet](https://github.com/heke99/gridex-web/blob/1550174/lib/webhooks/retry.ts#L49-L59) · [Felgrenen](https://github.com/heke99/gridex-web/blob/1550174/lib/webhooks/retry.ts#L108-L112)

<a id="gw11"></a>

### GW11 · P2 · Separata jobbhemligheter kan blockera Vercels schemalagda körningar

**Lokalt under angiven konfiguration.** Med olika värden för `CRON_SECRET` och de separata jobbhemligheterna svarade fyra riktiga rutter `401` på Vercels typ av anrop. Det gäller kontoupplägg, kundskrivningar, notismatchning och webhook-återförsök. Det återstår att verifiera om konfigurationen i produktion uppfyller villkoret.

Låt de schemalagda anropen använda den dokumenterade Vercel-hemligheten. Testa både när en separat hemlighet finns och när den saknas. [Schemat](https://github.com/heke99/gridex-web/blob/1550174/vercel.json#L19-L34) · [Behörighetskontroll för kontoupplägg](https://github.com/heke99/gridex-web/blob/1550174/app/api/internal/customer-portal/onboarding/process/route.ts#L9-L18)

<a id="gw12"></a>

### GW12 · P1 · Månadsimporten sparar en nästan tom månad som prisunderlag

**Lokalt.** Av 28 februaridagar svarade den syntetiska prisleverantören med data för en dag. Dagen innehöll ett värde på 2 kr/kWh och ett nullvärde. Importen behandlade null som 0 och sparade 100 öre/kWh som månadssnitt från två mätpunkter. Den äldre importvägen kontrollerar varken fullständig period eller intervallängder. Den ordinarie schemakörningen har `publish=false`, medan integrationsrouten även stödjer publicering.

Återanvänd den striktare prisparsern med tidsviktad beräkning. Kräv en komplett period före beständig lagring som färdigt månadsunderlag och testa nullvärden och saknade dygn. [Importens parser](https://github.com/heke99/gridex-web/blob/1550174/lib/integrations/spotMarket.ts#L98-L159) · [Lagring och publicering](https://github.com/heke99/gridex-web/blob/1550174/lib/integrations/spotMarket.ts#L218-L247) · [Schemat](https://github.com/heke99/gridex-web/blob/1550174/vercel.json#L14-L18)

<a id="gw13"></a>

### GW13 · P2 · Ogiltig prisimport kan starta en bredare import

**Lokalt.** Ett trasigt JSON-anrop och ett anrop med `areas: ["SE5"]` gav båda `200` och anropade importen för SE1–SE4. Trasig JSON blir tomma standardvärden och en lista helt utan giltiga elområden tolkas som alla områden.

Returnera `400` för trasig JSON och ogiltiga uttryckliga områdesval. Använd standardområden när fältet saknas avsiktligt. [POST-routen](https://github.com/heke99/gridex-web/blob/1550174/app/api/integrations/spot-prices/import/route.ts#L44-L63) · [Områdesvalet](https://github.com/heke99/gridex-web/blob/1550174/lib/integrations/spotMarket.ts#L43-L51)

<a id="gw14"></a>

### GW14 · P1 · Misslyckad fakturaimport kan lämna kundprofilen ändrad

**Lokalt.** När fakturaskrivningen tvingades misslyckas hade den riktiga importfunktionen redan skrivit till kundprofilen. Importen returnerade fel och nådde aldrig synkloggen. Profiluppdateringen kan bland annat ändra kontaktfält och verifieringsstatus. Effekten är avgränsad till den lokala integrationsvägen i Gridex Web.

Gör de beroende skrivningarna i samma databastransaktion eller inför en uttrycklig beständig process med återställning. Testa ett fel vid fakturaskrivningen efter att profiluppdateringen har förberetts. [Profiluppdateringen](https://github.com/heke99/gridex-web/blob/1550174/lib/integrations/invoices.ts#L169-L210) · [Skrivordningen](https://github.com/heke99/gridex-web/blob/1550174/lib/integrations/invoices.ts#L342-L384)

<a id="gw15"></a>

### GW15 · P2 · Saknat fakturabelopp skrivs som noll

**Lokalt.** En faktura utan totalbelopp och moms accepterades och båda beloppen skickades som `0` till lagringen. Samma upsert används för befintliga fakturor med samma externa referens, så ett ofullständigt återförsök kan ersätta tidigare belopp.

Kräv ett uttryckligt totalbelopp för ny faktura. För uppdateringar behöver integrationskontraktet ange vilka uteblivna värden som ska bevaras. Testa avsiktligt nollbelopp separat. [Beloppsvalideringen](https://github.com/heke99/gridex-web/blob/1550174/lib/integrations/invoices.ts#L77-L85) · [Validerade fält](https://github.com/heke99/gridex-web/blob/1550174/lib/integrations/invoices.ts#L309-L320) · [Fakturaskrivningen](https://github.com/heke99/gridex-web/blob/1550174/lib/integrations/invoices.ts#L350-L373)

<a id="gw16"></a>

### GW16 · P2 · Profilsidan bekräftar synkning trots misslyckad lokal skrivning

**Lokalt.** Efter ett simulerat godkännande från OPS och ett misslyckat Supabase-upsert styrde serveråtgärden ändå om till `profile-updated`. Profilsidan läser lokala kontaktuppgifter och visar samtidigt att de har sparats och synkats. Kunden kan därför mötas av gamla värden efter ett framgångsbesked.

Visa att OPS har tagit emot ändringen och att lokal synkning väntar. Schemalägg återförsök eller läs tillbaka de bekräftade canonical-värdena innan synkningen redovisas som klar. [Serveråtgärden](https://github.com/heke99/gridex-web/blob/1550174/app/dashboard/profile/actions.ts#L74-L101) · [Profilsidans läsning och besked](https://github.com/heke99/gridex-web/blob/1550174/app/dashboard/profile/page.tsx#L22-L43)

<a id="gw17"></a>

### GW17 · P1 · Webbens fakturadetalj avvisar ett korrekt OPS-svar

**Lokalt.** Webbens fakturadetaljrutt svarade `502 PORTAL_INVOICE_REFERENCE_MISSING` med ett syntetiskt OPS-svar där referensen låg i `data.invoice.invoice_reference`. OPS skickar fakturadetaljen som `data.invoice`, `data.lines` och `data.documents`. Webbens gemensamma listmappning försöker i stället läsa fakturareferensen direkt från `data`.

Mappa detaljsvaret enligt OPS-strukturen, kontrollera att fakturareferensen stämmer och bevara relevanta fakturarader och dokument. Lägg ett test som kör webbrouten med ett representativt detaljsvar. [Fakturadetaljrouten](https://github.com/heke99/gridex-web/blob/1550174/app/api/web/customer/invoices/%5Bid%5D/route.ts#L17-L28) · [Webbens mappning](https://github.com/heke99/gridex-web/blob/1550174/lib/customerPortal/service.ts#L672-L721) · [Befintlig mobilmappning](https://github.com/heke99/gridex-web/blob/1550174/lib/mobile/customerDetails.ts#L27-L41)

<a id="gw18"></a>

### GW18 · P2 · Kundportalen tappar senare supportmeddelanden och bilagor

**Lokalt för meddelandevyn, kodgranskat för bilagor.** Supportsidan visade den första meddelandesidan utan kontroll för fortsatt läsning. OPS returnerar meddelanden och bilagor i äldst-först-ordning, högst 500 respektive 100 per svar. Fortsättningsvärdet skickas i `X-Gridex-Next-Cursor`. Webbens OPS-klient returnerar bara svarskroppen och hjälpfunktionerna för meddelanden och bilagor saknar cursorparameter. Nyare kundsvar eller filer kan därför bli osynliga i långa ärenden.

För vidare fortsättningsvärdet och lägg separata kontroller för meddelanden och bilagor. Testa att kunden når en senare sida medan ärendevalet bevaras. [OPS-kontrakt för meddelanden](https://github.com/heke99/gridex-web/blob/1550174/docs/openapi/customer-portal-v1.json#L10713) · [OPS-kontrakt för bilagor](https://github.com/heke99/gridex-web/blob/1550174/docs/openapi/customer-portal-v1.json#L11559) · [OPS-klienten](https://github.com/heke99/gridex-web/blob/1550174/lib/ops/client/portal.ts#L235-L243)

<a id="gw19"></a>

### GW19 · P2 · Ett bilagefel kan slå ut hela kundens supportsida

**Lokalt.** Två syntetiska ärenden hade tillgängliga ärendedata och meddelanden. När bilagehämtningen för ett av dem gav timeout avbröts renderingen av hela sidan. Supportsidan inväntar samtliga ärendens meddelanden och bilagor i samma `Promise.all`, utan felhantering per ärende.

Visa ärendelistan och de sektioner som kunde hämtas. Visa återförsök vid den berörda bilage- eller meddelandesektionen. [Sidans datahämtning](https://github.com/heke99/gridex-web/blob/1550174/app/dashboard/support/page.tsx#L105-L119)

<a id="gw20"></a>

### GW20 · P2 · Support123 kan tappa ett tillgängligt ärende när personalkatalogen svarar med fel

**Lokalt.** Ärendedata kom tillbaka korrekt. Ett simulerat tillfälligt fel från personalkatalogen avbröt ändå hela ärendevyn. Katalogen behövs för val av handläggare, medan ärendehistorik och bilagor hämtas separat. Koden hanterar redan `403` för katalogen men kastar vidare andra fel.

Visa ärendet och dess tillgängliga innehåll. Låt katalogfel påverka handläggarvalet med lokal feltext och möjlighet att försöka igen. [Support123:s ärendevy](https://github.com/heke99/gridex-web/blob/e4d0718/apps/support/app/%28workspace%29/cases/%5Breference%5D/page.tsx#L25-L45)

<a id="gw21"></a>

### GW21 · P2 · Bilageformuläret visar framgång för ett oväntat 2xx-svar

**Lokalt.** Det delade bilageformuläret fick ett syntetiskt `200 text/html`. Det visade att bilagan hade skickats för kontroll, tömde det valda fältet och rensade försöksnyckeln. Båda uploadrutterna använder `201` med ett uttryckligt JSON-kvitto för lyckad uppladdning.

Kräv förväntad status och ett giltigt kvitto före framgångsbesked. Behåll filval och försöksnyckel om svaret är oklart. Testa HTML och trasig JSON för både kund- och personalformuläret. [Bilageformuläret](https://github.com/heke99/gridex-web/blob/1550174/components/support/AttachmentUpload.tsx#L23-L41) · [Kundroutens kvitto](https://github.com/heke99/gridex-web/blob/1550174/app/api/customer-support/cases/%5Breference%5D/attachments/route.ts#L15-L20)

<a id="gw22"></a>

### GW22 · P1 · Partiella OPS-svar kan visas som tom kundhistorik

**Lokalt.** Med `bundle_status.status: partial` och dokument samt notiser markerade som otillgängliga returnerade den riktiga översiktstjänsten `authoritative: true` och `dataFreshness: live`. Översikten visade ”Inga meddelanden ännu.” OPS kan returnera HTTP 200 när valfria sektioner misslyckas. Webbens normalisering tappar `bundle_status`, så framgångsrikt lästa tomma listor och otillgängliga sektioner får samma presentation.

För vidare status per sektion och visa tillfälligt fel där hämtningen misslyckats. Visa övriga sektioner som vanligt. Testa både en dokumentsektion som är otillgänglig och en notissektion som laddats men är tom. [OPS-svaret](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/app/api/v1/customer/portal-bundle/route.ts#L315-L339) · [Normaliseringen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/client/portal.ts#L316-L337) · [Översiktens besked](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/page.tsx#L147-L162)

<a id="gw23"></a>

### GW23 · P2 · Notisknappen kan markera ett dolt meddelande som läst

**Lokalt.** Med en nyaste, redan läst notis och en äldre, oläst notis visade översikten bara den nyaste. Knappen för att markera som läst fick den äldre notisens referens. Kunden ser alltså ett meddelande samtidigt som åtgärden gäller ett annat.

Visa den notis som åtgärden gäller tillsammans med knappen, eller koppla knappen till den visade notisen. Testa blandad lässtatus. [Visad notis](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/page.tsx#L53-L57) · [Notis vald för åtgärd](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/page.tsx#L166-L176) · [Läskvittot](https://github.com/heke99/gridex-web/blob/e4d0718/components/customer/CustomerPortalSelfService.tsx#L144-L155)

<a id="gw24"></a>

### GW24 · P2 · Läskvittot använder fel sorts referens i den lokala databasen

**Lokalt med PostgreSQL.** Efter simulerad OPS-bekräftelse använde webben den publika OPS-referensen i filtret för den lokala UUID-kolumnen `customer_notifications.id`. PostgreSQL avvisade typen med `22P02`. Webbtjänsten svarade med `opsSynced: true`, `localSynced: false` och `queued: false`. Det finns ingen reparationskö i denna kodväg. Felet påverkar den lokala kopian, medan läskvittot i OPS lyckades i testet.

Knyt den lokala uppdateringen till en explicit och verifierad översättning av referensen. Om den lokala kopian krävs bör misslyckade uppdateringar få ett beständigt återförsök och synlig status. [Läskvittots databasfilter](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L818-L842) · [UUID-kolumnen](https://github.com/heke99/gridex-web/blob/e4d0718/supabase/migrations/20260306_customer_portal_enterprise.sql#L206-L219)

<a id="gw25"></a>

### GW25 · P2 · Vanliga kunddokument saknar fortsatt bläddring

**Lokalt.** Med en syntetisk dokumentlista där OPS angav `has_more: true` och ett fortsättningsvärde returnerade webbens dokument-API bara första listan utan sidmetadata. Dokumentsidan erbjuder sidväxling för fullmaktsarkivet, medan ordinarie dokument saknar motsvarande kontroll. Senare sidor kan därför inte nås därifrån.

För vidare sidmetadata och lägg stöd för separat sidväxling av ordinarie dokument. Testa två sidor plus oberoende sidväxling för fullmakterna. [OPS:s dokumentlista](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/app/api/v1/customer/documents/route.ts#L30-L35) · [Webbens svar](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L724-L747) · [Ordinarie dokumentvyn](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/documents/page.tsx#L46-L84)

<a id="gw26"></a>

### GW26 · P2 · Ett fel i ordinarie dokumentlista döljer även tillgängliga fullmakter

**Lokalt.** Hämtningen av det separata fullmaktsarkivet lyckades, men ett simulerat fel vid hämtning av övriga dokument fick hela dokumentsidan att avbrytas före rendering. Det omvända fallet hanteras redan genom att arkivsektionen har en egen feltext.

Ge ordinarie dokument en egen felstatus och möjlighet att försöka igen, så att ett tillgängligt fullmaktsarkiv fortfarande visas. [Dokumentsidans läsningar](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/documents/page.tsx#L31-L46) · [Arkivets felhantering](https://github.com/heke99/gridex-web/blob/e4d0718/components/customer/PoaArchiveDocuments.tsx#L5-L24)

<a id="gw27"></a>

### GW27 · P1 · Flyttanmälan låses till den första anläggningen

**Lokalt.** För ett syntetiskt kundkonto med två anläggningar fick självserviceformuläret endast den första anläggningens referens. Flyttformuläret har inget val av anläggning och visar bara datumfältet. Normaliseringen inför OPS prioriterar det medskickade `site_id` framför anläggnings-ID. En kund som vill flytta från den andra anläggningen kan därför skicka en anmälan för den första. Testet körde renderingen och normaliseringen utan att skapa en flyttanmälan.

Låt kunden välja anläggning och visa adress samt anläggningsreferens före inskickning. Testa ett konto med två platser och kontrollera att vald plats följer med hela vägen. [Översiktens val](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/page.tsx#L53-L57) · [Formulärets data](https://github.com/heke99/gridex-web/blob/e4d0718/components/customer/CustomerPortalSelfService.tsx#L120-L131) · [Normalisering inför OPS](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/writeValidation.ts#L114-L133)

<a id="gw28"></a>

### GW28 · P1 · Självservice bekräftar en anläggningsändring som OPS hoppade över

**Lokalt.** Den riktiga synkrouten och formulärets händelsehanterare kördes med ett syntetiskt OPS-resultat på övergripande status `synced` men med `updated: 0` och `skipped: 1` i sammanställningen för anläggningar. Formuläret visade ”Anläggningsuppgifterna är uppdaterade.” Klienten letar efter ett annat fält och använder därför det övergripande resultatet som bekräftelse på den enskilda ändringen.

Kontrollera sammanställningen för den begärda åtgärden och skilj mellan sparad ändring, uppgifter som redan stämde och en överhoppad ändring. Testa det faktiska OPS-svarsformatet genom webbrouten och formuläret. [OPS-svaret](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/app/api/v1/customer/sync/route.ts#L44-L56) · [Klientens svarskontroll](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/writeResponse.ts#L35-L39) · [Formulärets besked](https://github.com/heke99/gridex-web/blob/e4d0718/components/customer/CustomerPortalSelfService.tsx#L97-L115)

<a id="gw29"></a>

### GW29 · P2 · Kundsynken tappar delar av begäran utan att redovisa bortfallet

**Lokalt.** En begäran innehöll 21 giltiga anläggningsposter och två dokumentposter, varav en saknade obligatoriska fält. Webbrouten skickade 20 anläggningar och ett dokument vidare och svarade `200` efter ett simulerat lyckat OPS-svar. Normaliseringen kapar listor vid fasta gränser och filtrerar bort ogiltiga poster. Routen accepterar resten utan att redovisa vilka poster som utelämnades.

Avvisa ett överskridet maxantal och peka ut ogiltiga poster före skrivning. Om API:t ska tillåta delvis behandling behöver svaret ange resultat per post. [Synkrouten](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/web/customer/sync/route.ts#L26-L40) · [Begränsning och filtrering](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/writeValidation.ts#L280-L325)

<a id="gw30"></a>

### GW30 · P1 · Ett verifierat databaslagrat kvitto fungerar inte för kundkoppling

**Lokalt under reservkonfigurationen.** När `WEBSITE_RESULT_TOKEN_SECRET` saknades utfärdade systemet ett databaslagrat kvitto för en accepterad syntetisk teckning. Kvittot gick att verifiera, men länken för kundkoppling ledde till `portal_link=invalid`. Databasen sparar teckningens ID och eventuell användarbindning. Kvittoläsningen hämtar och returnerar ingetdera för databaslagrade länkar, och kundkopplingen kräver teckningens ID.

Låt reservvägen returnera den sparade teckningsreferensen och användarbindningen genom samma verifierade resultatformat. Behåll de befintliga kontrollerna av identitet och teckning. Testa både databaslagrade och krypterade kvitton. [Sparade kvittofält](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/applicationResultStore.ts#L243-L265) · [Databasläsningen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/applicationResultStore.ts#L323-L342) · [Kundkopplingens krav](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/portalClaim.ts#L206-L223)

<a id="gw31"></a>

### GW31 · P2 · Mina sidor tappar beskedet från kundkopplingen

**Lokalt.** Kopplingsrouten lägger `completed`, `pending`, `review` eller `invalid` i `portal_link` vid omdirigering. Genom att rendera Mina sidor med samma kunddata och köläge kunde jag verifiera att alla fyra utfallen gav samma innehåll. Vyn tittar endast på det aktuella köläget. En avvisad eller ogiltig koppling kan därför se ut som vanlig navigering.

Visa ett tydligt besked från kopplingsförsöket. Använd verifierat serverläge för att bekräfta faktisk åtkomst och visa en lämplig åtgärd vid ogiltig länk eller manuell granskning. [Omdirigeringens utfall](https://github.com/heke99/gridex-web/blob/e4d0718/app/auth/portal-claim/route.ts#L28-L43) · [Mina sidors dataläsning](https://github.com/heke99/gridex-web/blob/e4d0718/app/mina-sidor/page.tsx#L38-L53)

<a id="gw32"></a>

### GW32 · P1 · Ett fel i profilkön kan avbryta en redan verifierad inloggningslänk

**Lokalt.** Auth accepterade den syntetiska engångslänken. Därefter fick profiljobbet ett simulerat databasfel när det skulle tas för behandling. Bekräftelserouten kastade felet före omdirigeringen. Profilfunktionen returnerar det asynkrona jobbet direkt från ett `try`-block, vilket gör att avvisningen går förbi dess felhantering och att det avsedda väntandebeskedet uteblir.

Vänta på profiljobbet inom felhanteringen och bevara den lyckade verifieringen. Visa status för profilsynkningen och låt det sparade jobbet försöka igen. Testa ett fel vid jobbstart efter lyckad verifiering. [Profilfunktionens felhantering](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/authProfileSync.ts#L121-L137) · [Bekräftelserouten](https://github.com/heke99/gridex-web/blob/e4d0718/app/auth/confirm/route.ts#L45-L74)

<a id="gw33"></a>

### GW33 · P1 · Ny köläggning kan skriva över ett aktivt jobb för kundkoppling

**Lokalt.** Ett syntetiskt kontoaktiveringsjobb hade status `pending` när köläggningen läste det. En annan körning tog jobbet mellan läsningen och skrivningen. Köskrivningen återställde sedan status till `pending`, försöksräknaren från 1 till 0 och låstiden till null. Den aktiva körningen kan därmed förlora sin rätt att slutföra jobbet. Det här gäller kön för kontoaktivering. GW08 gäller den separata kön för teckningsavstämning.

Gör kontroll och skrivning atomiska. Bevara den aktiva körningens lås och försöksräknare vid samtidig köläggning. Testa samma teckning med två samtidiga körningar. [Köläggningen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/onboarding.ts#L343-L386) · [Kontroll av aktivt jobb](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/onboarding.ts#L280-L291)

<a id="gw34"></a>

### GW34 · P2 · Mina sidor lovar automatiska återförsök vid manuell hantering

**Lokalt.** Ett syntetiskt kundkopplingsjobb i `manual_review` valdes inte av det schemalagda jobbet. Mina sidor visade samtidigt ”Systemet försöker automatiskt igen”. Statuskontrollen på Mina sidor grupperar manuell hantering med jobb som fortfarande kan behandlas automatiskt.

Visa om jobbet väntar på kundservice eller på automatisk behandling. Testa båda tillstånden i samma vy. [Schemakörningens urval](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/onboarding.ts#L599-L606) · [Statuskontrollen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/onboarding.ts#L677-L688) · [Kundbeskedet](https://github.com/heke99/gridex-web/blob/e4d0718/app/mina-sidor/page.tsx#L109-L113)

<a id="gw35"></a>

### GW35 · P2 · Ett databasfel kan hålla kvar oskickade supportkvittenser i låst läge

**Lokalt.** Kvittensjobbet tog två syntetiska poster i samma batch. Den första fick ett lyckat svar från e-postleverantören, men lagringen av resultatet misslyckades. Routen svarade `503`, den andra kvittensen skickades aldrig och båda posterna låg kvar i `processing`. Databasjobbet gör sådana poster valbara på nytt först när låset hunnit bli äldre än 15 minuter och en ny schemakörning hämtar kön.

Avgränsa fel till den berörda posten. Låt nästa post behandlas när det går, eller frigör de övriga poster som körningen ännu inte har försökt skicka. Behåll samma idempotensnyckel för en kvittens som kan ha accepterats. [Bearbetningen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/publicSupportReceipts.ts#L13-L39) · [Återtagning av lås](https://github.com/heke99/gridex-web/blob/e4d0718/supabase/migrations/20261006205027_public_support_durable_receipts.sql#L43-L51)

<a id="gw36"></a>

### GW36 · P2 · Ett tillfälligt Resend-svar stoppar automatiska återförsök

**Lokalt.** När den syntetiska e-postleverantören svarade `409 concurrent_idempotent_requests` flyttade kvittensjobbet posten till `manual_review`. Resend dokumenterar det svaret som en pågående parallell begäran och anger att klienten ska försöka igen senare. Koden använder HTTP-statusen och skiljer inte denna felkod från en verklig konflikt i innehållet.

Schemalägg ett nytt försök med samma idempotensnyckel för den dokumenterade tillfälliga felkoden. Behåll manuell hantering vid innehållskonflikt. [Felklassificeringen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/publicSupportReceipts.ts#L23-L37) · [Resends felkoder](https://resend.com/docs/api-reference/errors#concurrent-idempotent-requests)

<a id="gw37"></a>

### GW37 · P2 · Ett övergivet kundjobb kan köras efter att försöksgränsen nåtts

**Lokalt.** Ett syntetiskt kundjobb hade 10 använda försök av maximalt 10 och ett utgånget lås. Köjobbet gjorde det valbart igen, ökade försöksräknaren till 11 och anropade den simulerade mottagaren. Maxgränsen kontrolleras först när körningen fångar ett fel från ett nytt försök. Avbrutna körningar kan därför överskrida den konfigurerade försöksgränsen.

Kontrollera gränsen när utgångna lås återtas och inför ett nytt försök. Låt jobb vid gränsen gå till manuell hantering med bevarad historik, eller definiera ett särskilt avstämningssteg när utfallet från sista försöket är okänt. [Återtagning och nytt försök](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/outbox.ts#L235-L276) · [Nuvarande kontroll av försöksgränsen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/outbox.ts#L302-L320)

<a id="gw38"></a>

### GW38 · P1 · Förnyad adresskontroll kan stoppa en teckning trots oförändrat elområde

**Lokalt.** En giltig syntetisk offert hade en utgången adresskontroll. Vid övergången från kalkylen till teckningen bekräftade en ny kontroll samma elområde och överlämningen svarade `200`. Den sparade överlämningen kombinerade den nya adresskontrollens signerade referens med prisofferten som var bunden till den ursprungliga adresskontrollen. När teckningsflödet validerade kombinationen svarade servern `409 quote_resolution_mismatch`.

Bevara offertens ursprungliga adressreferens tillsammans med det signerade prisunderlaget. Hantera en förnyad kontroll separat så att servern kan kontrollera både den ursprungliga kopplingen och aktuell adressstatus. Testa båda stegen tillsammans med utgånget adressbevis och oförändrat elområde. [Kontroll av offertens adressreferens](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/canonicalQuoteValidation.ts#L182-L185) · [Förnyad adresskontroll](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/canonicalQuoteValidation.ts#L208-L217) · [Sparad överlämning](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/context/route.ts#L129-L140)

<a id="gw39"></a>

### GW39 · P2 · Långa signerade prisofferter blir ogiltiga när servern kapar dem

**Lokalt.** Applikationens signerare utfärdade en giltig syntetisk offerttoken på 16 697 tecken med 40 prisantaganden. Valideringsrouten verifierade först hela strängen, men skickade bara de första 12 000 tecknen vidare. Både offertvalideringen och överlämningen svarade `409` trots att den signerade tokenen gick att verifiera i sin helhet.

Använd samma storleksgräns när offerten utfärdas och när den tas emot. Avvisa överskriden gräns uttryckligen och verifiera den signerade strängen i sin helhet. Testa längder runt gränsen. [Signeringen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/pricingQuote.ts#L236-L250) · [Första valideringen](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/quote/validate/route.ts#L16-L32) · [Vidare validering](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/quote/validate/route.ts#L67-L78) · [Överlämningen](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/context/route.ts#L43-L53)

<a id="gw40"></a>

### GW40 · P2 · Samma långa gatuadress behandlas olika i kalkylen och teckningen

**Lokalt.** För en syntetisk gatuadress över 180 tecken accepterade överlämningen offertens adressbevis och svarade `200`. Nästa valideringssteg svarade `409` eftersom adressbeviset inte matchade den adress som användes där. Adresskontrollen, offertgenereringen och överlämningen kapar vid 180 tecken. Nästa validering använder upp till 240 tecken. Kalkylatorns gatufält saknar motsvarande gräns.

Använd gemensam validering och normalisering för adressfält i samtliga steg. Visa en längdgräns direkt i formuläret om längre värden måste avvisas. [Adresskontroll](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/energy-area/resolve/route.ts#L69-L76) · [Offertgenerering](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/quote/route.ts#L91-L98) · [Överlämning](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/context/route.ts#L43-L53) · [Offertvalidering](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/quote/validate/route.ts#L34-L38) · [Kalkylatorns gatufält](https://github.com/heke99/gridex-web/blob/e4d0718/components/ElectricityCalculator.tsx#L811-L824)

<a id="gw41"></a>

### GW41 · P2 · JSON-värdet `null` får offertvalideringen att kasta ett ohanterat fel

**Lokalt.** Offertvalideringen kastade `TypeError` för en syntaktiskt giltig JSON-begäran med värdet `null`. JSON-läsaren godkänner värdet och routen läser därefter `pricing_token` innan felhanteringen börjar. Klienten får därmed inget strukturerat valideringssvar från routen.

Kontrollera att den avkodade JSON-kroppen är ett objekt före fältläsning. Returnera samma `400`-format som vid andra ogiltiga indata. [JSON-läsningen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/api/webBoundary.ts#L120-L129) · [Första fältläsningen](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/quote/validate/route.ts#L28-L33)

<a id="gw42"></a>

### GW42 · P2 · Blockerad sessionslagring kan avbryta priskalkylatorns initiering

**Lokalt.** När åtkomsten till `sessionStorage` simulerades kasta `SecurityError` kastade kalkylatorns effekter två ohanterade fel. Det första inträffade vid läsning av sparad kundtyp och det andra vid rensning av sparad förbrukningsprofil. Det finns också en oskyddad skrivning av kundtyp när avtalsvalet ändras.

Fånga lagringsfel vid läsning, skrivning och rensning. Låt kalkylatorn fungera med sina aktuella värden i minnet om webbläsaren blockerar lagringen. [Läsning av kundtyp](https://github.com/heke99/gridex-web/blob/e4d0718/components/ElectricityCalculator.tsx#L377-L387) · [Rensning av profil](https://github.com/heke99/gridex-web/blob/e4d0718/components/ElectricityCalculator.tsx#L420-L436) · [Skrivning vid avtalsval](https://github.com/heke99/gridex-web/blob/e4d0718/components/ElectricityCalculator.tsx#L527-L532)

<a id="gw43"></a>

### GW43 · P1 · Avvisad teckning visas som pågående även efter att statuskontrollen avslutats

**Lokalt.** För två osignerade syntetiska teckningar byggde OPS `page_state: processing` tillsammans med slutstatus `rejected` respektive `failed`. Webbens statuskort hämtade respektive svar, visade ”Behandlas” och avslutade automatisk uppdatering eftersom det använde slutstatusen för att avgöra om fler hämtningar behövdes. Kunden kan alltså bli kvar med ett besked som antyder att teckningen fortskrider.

Låt ett definitivt besked om teckningen styra statuskortets text före den generella visningsstatusen. Verifiera samma statuskombinationer i både visningen och logiken för fortsatta hämtningar. [OPS slutstatus](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/lib/website/customerApplicationStatus.ts#L132-L146) · [OPS visningsstatus](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/lib/website/publicCheckoutResult.ts#L113-L142) · [Webbens statuskort](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/ApplicationStatusCard.tsx#L55-L81)

<a id="gw44"></a>

### GW44 · P2 · Kvittot visar fortsatt handläggning när avtalet senare har signerats

**Lokalt.** Kvittot utfärdades medan den syntetiska teckningen behandlades. Ett senare OPS-svar innehöll ett signerat avtal med avtalsnummer och sista datum för ångerrätt. Statuskortet visade att teckningen var färdigbehandlad. Sidans huvudrubrik och avtalsdel låg samtidigt kvar på inskickningsläget, avtalsdelen visade ”Avtalet behandlas fortfarande” och ångerfristen saknades. Sidan hämtar de delarna från det ursprungliga kvittot även efter att statuskortet fått nya uppgifter.

Uppdatera aktuell status och avtalsuppgifter från samma verifierade statussvar. Märk information som beskriver inskickningstillfället. Testa en signering efter att kvittot har utfärdats. [OPS avtalsuppgifter i statussvaret](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/lib/website/publicCheckoutResult.ts#L139-L152) · [Kvittots rubrik och avtalsuppgifter](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/tack/SignupThanksPage.tsx#L120-L155) · [Statuskortets visning](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/ApplicationStatusCard.tsx#L68-L85)

<a id="gw45"></a>

### GW45 · P2 · Ett fördröjt OPS-svar kan återställa teckningens sparade status

**Lokalt.** Två samtidiga hämtningar gällde samma syntetiska teckning. Det nyare källsvaret med `completed` sparades först. När ett äldre svar med `processing` sedan kom fram skrev det över `completed`. Båda hämtningarna svarade `200`. Uppdateringen filtrerar på ärendenummer och använder webbserverns skrivtid, utan att jämföra källans version eller tidsstämpel.

Spara en källversion för status och jämför den atomiskt vid uppdatering. Verifiera att äldre svar lämnar den nyare statusen intakt och att legitima ändringar från OPS fortfarande kan sparas. [OPS källtidsstämpel](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/lib/website/customerApplicationStatus.ts#L447-L457) · [Webbens statusanrop](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/applications/%5BapplicationId%5D/route.ts#L47-L65) · [Statusuppdateringen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/submissionStore.ts#L298-L327)

<a id="gw46"></a>

### GW46 · P2 · Första statushämtningen ersätter det ursprungliga teckningssvaret i databasen

**Lokalt.** När den syntetiska teckningen accepterades sparades OPS ursprungliga svar i `ops_result_snapshot`. En vanlig statushämtning ersatte hela fältet med den annorlunda strukturen från status-API:t. Testet verifierade att bland annat fortsättningsjobbets referens försvann ur själva ögonblicksbilden. Referensen har en separat kolumn, men det ursprungliga svaret går inte längre att läsa ur `ops_result_snapshot` vid felsökning.

Spara inskickningssvaret och senaste statussvaret i separata fält. Testa att det ursprungliga svaret bevaras efter flera statushämtningar. [Inskickningssvarets innehåll](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/client/application.ts#L688-L710) · [Lagring vid accepterad teckning](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L1377-L1401) · [Ersättning vid statusuppdatering](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/submissionStore.ts#L311-L324)

<a id="gw47"></a>

### GW47 · P2 · Ett återförsök kan omedelbart göra den första kvittolänken ogiltig

**Lokalt under reservkonfigurationen.** När `WEBSITE_RESULT_TOKEN_SECRET` saknades utfärdades en verifierbar databaslagrad kvittolänk för en syntetisk teckning. Vid ny utfärdning för samma försök skapades en annan länk. Den första blev genast ogiltig inom giltighetstiden. Varje utfärdning genererar en slumpmässig token och ersätter den lagrade hashen för samma försök. Kunden kan tappa åtkomst till ett tidigare öppnat eller sparat kvitto efter en upprepad inskickning. GW07 gäller hur läsning av äldre krypterade kvitton påverkar den lagrade kvittoposten.

Gör upprepad utfärdning idempotent för samma verifierade resultat, eller låt tidigare utfärdade länkar upphöra vid sin ordinarie giltighetstid. Testa parallell utfärdning och återförsök med databaslagrade kvitton. [Slumpmässig token](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/applicationResultStore.ts#L113-L118) · [Utfärdning och ersättning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/applicationResultStore.ts#L235-L267) · [Verifiering via hash](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/applicationResultStore.ts#L323-L335)

<a id="gw48"></a>

### GW48 · P1 · En obligatorisk fullmakt kan godkännas utan att texten går att öppna

**Lokalt i Chromium.** Ett syntetiskt avtal hade låst fullmaktsversion, dokumenthash och källdokument, men saknade URL både för fullmakten och för dess källdokument. Avtalet bedömdes teckningsbart. Formuläret visade den obligatoriska kryssrutan utan någon länk till fullmaktstexten. Efter att rutorna kryssats i aktiverades knappen och formuläret skickade fullmakten som godkänd till testets mottagare. Webbens reservvisning kräver att minst ett källdokument har en länk och visar ingen text när samtliga länkar saknas.

Gör det möjligt att läsa exakt den låsta versionen från en verifierad dokumentkälla. Om innehållet inte kan öppnas behöver formuläret stoppa det berörda godkännandet och visa en väg vidare. Testa att referenser och hash kan finnas samtidigt som alla länkar saknas. [Teckningsbarhet när dokumentlänk saknas](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/publicContractDisplay.ts#L584-L598) · [Fullmaktslänk och reservvisning](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/CustomerApplicationForm.tsx#L692-L718)

<a id="gw49"></a>

### GW49 · P2 · En relativ länk till avtalsvillkor öppnas på webbens domän

**Lokalt i Chromium under reservkonfigurationen.** OPS kan returnera en relativ `/legal/...`-länk när tjänsten saknar en basadress. Webbformuläret använder länken direkt. Med en syntetisk länk i det formatet valde Chromium webbens egen origin, där den isolerade webbinstansen svarade `404`. Webbprojektet saknar en motsvarande dokumentroute. Felet gäller den konfiguration där OPS faktiskt skickar en relativ länk.

Använd dokumenttjänstens verifierade publika adress för relativa dokumentlänkar, eller leverera dokumentet via en webbroute som känner till den exakta versionen. Testa absoluta och relativa länkar. [OPS reservlänk](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/lib/legal/publicLegalDocuments.ts#L98-L124) · [OPS konfiguration av basadress](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/lib/auth/urls.ts#L3-L19) · [Webbens länkkomponent](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/CustomerApplicationForm.tsx#L739-L741)

<a id="gw50"></a>

### GW50 · P2 · En separat fakturaadress via e-post kräver också att gatuadressen anges igen

**Lokalt.** Formuläret säger att kunden kan använda andra fakturauppgifter för adress eller e-post. Jag avmarkerade den gemensamma kryssrutan och fyllde i en annan faktura-e-post. Chromium lät mig gå vidare till granskningen med tom fakturagatuadress. Serveråtgärdens verkliga validering skickade därefter tillbaka flödet till första steget med ett allmänt fel om namn, identitetsnummer, kontaktuppgifter och startdatum. Det enskilda fakturafältet fick inget felmeddelande. Ett gemensamt val styr både faktura-e-post och postadress.

Låt kunden välja faktura-e-post och fakturapostadress oberoende av varandra. Kontrollera de fält som behöver fyllas i före granskningen och visa varje fel vid sitt fält. [Fakturaval och fält](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/CustomerApplicationForm.tsx#L520-L545) · [Val av adress på servern](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L646-L664) · [Serverns felmeddelande](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L808-L839)

<a id="gw51"></a>

### GW51 · P2 · Kunden kan inte granska fakturauppgifter och anläggnings-ID före signeringen

**Lokalt i Chromium.** Jag fyllde i separat faktura-e-post och anläggnings-ID. Värdena fanns i dolda formulärfält och skickades till testets mottagare, men saknades i den synliga granskningen före signering. Granskningssteget visade kontaktens e-post och leveransadress. Faktura- och anläggningsuppgifterna läses separat av serveråtgärden och skickas vidare till OPS.

Visa avvikande fakturauppgifter och de anläggnings- och leverantörsuppgifter kunden fyllt i. Testa att den synliga granskningen stämmer med de uppgifter som skickas. [Dolda formulärfält](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/CustomerApplicationForm.tsx#L624-L645) · [Synlig granskning](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/CustomerApplicationForm.tsx#L647-L680) · [Uppgifter som skickas till OPS](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L1173-L1209)

<a id="gw52"></a>

### GW52 · P2 · Uppdaterade villkor lämnar kvar den gamla versionen i formuläret

**Lokalt.** Med ett uppdaterat syntetiskt villkorspaket avvisade serveråtgärden inskickningen och bad kunden ladda om sidan. I Chromium visade formuläret samma besked, behöll det gamla godkännandet ikryssat och lät kunden trycka på teckningsknappen igen med den tidigare versionen. När jag följde uppmaningen att ladda om försvann de ifyllda kontakt- och identitetsuppgifterna. Servern kräver rätt version och klienten saknar en väg att uppdatera dokumenten samtidigt som den behåller uppgifterna.

Ladda om det låsta villkorspaketet och uppdatera det bundna prisunderlaget när det behövs. Bevara ifyllda fält i det pågående flödet, nollställ godkännandena för den ersatta versionen och spärra inskickning tills kunden granskat den nya. [Serverns versionskontroll](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L734-L749) · [Formulärets lokala tillstånd och felhantering](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/CustomerApplicationForm.tsx#L221-L269) · [Villkor för aktiverad teckningsknapp](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/CustomerApplicationForm.tsx#L408-L411)

<a id="gw53"></a>

### GW53 · P1 · ”Så snart som möjligt” kan avvisa priset för den tidigaste möjliga avtalsstarten

**Lokalt med kontrollerad klocka.** För ett syntetiskt erbjudande kunde prisalternativet användas för start från den 1 december. OPS kod för ett vanligt leverantörsbyte beräknade den 14 december som tidigaste start när dagens datum var den 30 november. Priskalkylen använde ändå den 30 november för prisvalet och svarade `409 price_option_invalid`. Samma begäran med samma adressbevis gav `200` efter Stockholms midnatt, när kalkylen började använda den 1 december. Både anropet till OPS och webbens kontroll av prisalternativet använder webbens kalenderdatum för det här startvalet.

Låt OPS ta fram det datum eller startintervall som ska styra prisvalet för ”Så snart som möjligt”. Kontrollera prisalternativet mot den referensen i båda tjänsterna. Testa ett erbjudande där prisfönstret börjar vid nästa månadsskifte. [Datumet webbens offert använder](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/quote/route.ts#L100-L107) · [Datumet som används hos OPS och i webbens prisval](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/quote/route.ts#L153-L189) · [OPS ledtid för leverantörsbyte](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/lib/operations/switchStartDate.ts#L125-L150)

<a id="gw54"></a>

### GW54 · P2 · Ett redan passerat startdatum kan signeras in i prisunderlaget

**Lokalt med kontrollerad klocka.** Den 30 november bad en syntetisk kund om start den 29 november. Offertrouten svarade `200` och signerade det passerade datumet. Överlämningen till teckningen svarade också `200` och sparade datumet. Separat körning av OPS planeringsfunktion för ett vanligt leverantörsbyte flyttade det effektiva datumet till den 14 december. Kalkylens datumfält saknar en nedre gräns och servern kontrollerar att värdet är ett kalenderdatum.

Validera startvalet mot aktuell affärsdag och tillämplig startregel. Om OPS behöver flytta datumet ska kunden få veta vilket datum som kan gälla innan teckningen går vidare. Testa både ny offert med passerat datum och återupptagning efter att det tidigare datumet passerat. [Kalkylens datumfält](https://github.com/heke99/gridex-web/blob/e4d0718/components/ElectricityCalculator.tsx#L1062-L1075) · [Datumvalideringen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/requestedStart.ts#L15-L37) · [Startdatum som sparas vid överlämningen](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/context/route.ts#L142-L152) · [OPS hantering av för tidigt datum](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/lib/operations/switchStartDate.ts#L168-L190)

<a id="gw55"></a>

### GW55 · P2 · Mina sidor saknar ett bekräftat startdatum som finns i OPS

**Lokalt.** OPS publika avtalsobjekt slog ihop ett önskat datum den 5 december och ett bekräftat datum den 14 december till fältet `start_date` med värdet 14 december. Webben läste det som ett generellt startdatum och satte de särskilda fälten för önskad, bekräftad och faktisk start till `null`. Den riktiga vyn för Mina sidor visade därefter streck vid ”Bekräftat startdatum”. Avtalssidan använder samma tomma fält.

För vidare separata startdatum i OPS kundkontrakt där de finns och mappa dem till motsvarande fält på webben. Visa ett generellt startdatum med en tydlig etikett för äldre svar. Testa en teckning där önskat och bekräftat datum skiljer sig. [OPS avtalsprojektion](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/lib/customer-portal/publicDto.ts#L83-L105) · [Mappningen på webben](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L266-L282) · [Datum i Mina sidor](https://github.com/heke99/gridex-web/blob/e4d0718/app/mina-sidor/page.tsx#L149-L155) · [Datum i avtalslistan](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/contracts/page.tsx#L63-L67)

<a id="gw56"></a>

### GW56 · P2 · Kvittots liveuppdatering visar inget startdatum när bytet har fått ett datum

**Lokalt.** Statuskortet hämtade ett syntetiskt svar med önskat datum den 5 december och bekräftat datum den 14 december. Kortet visade ”Klart” och återgav inget av datumen. Webbens status-API förmedlar båda fälten från OPS, medan kortets kundvy enbart använder status och besked om bekräftelsemejl. Fyndet gäller startdatum från status-API:t även när avtalet var signerat när kvittot utfärdades. GW44 gäller avtalsuppgifter som saknades vid det första kvittot.

Visa bekräftad start i kvittots aktuella status och märk ett önskat datum tydligt när bekräftelse saknas. Testa ett senare statussvar där OPS har bekräftat ett annat datum än kunden önskade. [Datum som kommer från OPS](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/client/website.ts#L603-L618) · [De publika statusfälten](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/applications/%5BapplicationId%5D/route.ts#L47-L65) · [Statuskortets visning](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/ApplicationStatusCard.tsx#L68-L86)

<a id="gw57"></a>

### GW57 · P1 · Kvittot kan visa ångerfristen på fel kalenderdag

**Lokalt med serverns tidszon satt till UTC.** Kvittots verkliga serverrendering visade `14 dec. 2026 23:30` för en syntetisk ångerfrist som motsvarade `15 dec. 2026 00:30` svensk tid. Samma formatterare används för signeringstidpunkten. Det svenska språket väljs uttryckligen, men formatteringen använder serverns tidszon och kvittot visar ingen tidszon.

Visa avtalets tidpunkter i `Europe/Stockholm` och gör tidszonen tydlig för ångerfristen. Testa vinter- och sommartider där det svenska kalenderdatumet skiljer sig från UTC. [Kvittots tidsformatering](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/tack/SignupThanksPage.tsx#L53-L58) · [Kundens avtals- och ångerbesked](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/tack/SignupThanksPage.tsx#L134-L139)

<a id="gw58"></a>

### GW58 · P2 · En enda kvart kan visas som hela dygnets genomsnittspris

**Lokalt.** En syntetisk prisserie innehöll en kvart på 300 öre/kWh. Dags-API:t gav `200` med ett medelvärde på 300 öre/kWh och en mätpunkt. Elprissidan visade ”Dagens snitt” utan uppgift om att 95 av 96 kvartar saknades. Webbens separata beräkning för kompletta marknadsdygn avvisade samma serie. Dags-API:t filtrerar varje rad och beräknar statistik utan att kontrollera dygnets täckning.

Visa bara ett dygnssnitt vid full täckning, eller märk ett partiellt medelvärde med täckningsgrad. Beräkna det väntade dygnet i svensk tid så att sommartidsdygn hanteras korrekt. [Dags-API:ts inläsning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/gridex/livePrices.ts#L122-L148) · [Sidans statistik](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/elpriser/elpris-idag/page.tsx#L137-L154) · [Kontrollen för kompletta dygn](https://github.com/heke99/gridex-web/blob/e4d0718/lib/gridex/pricing/elprisetjustnu.ts#L162-L181)

<a id="gw59"></a>

### GW59 · P1 · Aktuellt elpris avgörs av radordningen när intervall överlappar

**Lokalt.** Två syntetiska prisrader täckte samma tid och innehöll 100 respektive 300 öre/kWh. När radernas ordning vändes ändrades aktuellt pris från 100 till 300 öre/kWh. Sammanställningen vägde dessutom in båda radernas överlappande minuter. Webbens dags-API gav `200`, medan mobilappens prisparser avvisade svaret. Livefunktionen väljer första raden som täcker den aktuella tidpunkten.

Kontrollera tidslinjen före prisval och statistik. Avvisa motstridiga överlapp och testa att ordningen i källsvaret aldrig ändrar kundens pris. [Val av aktuellt pris och vägning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/gridex/livePrices.ts#L87-L119) · [Dags-API:ts svar](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/elpris/day/route.ts#L13-L23) · [Mobilappens överlappskontroll](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/marketPriceData.ts#L19-L31)

<a id="gw60"></a>

### GW60 · P1 · Ogiltiga värden från priskällan räknas som verkliga nollpriser

**Lokalt.** Jag bytte en i övrigt korrekt kvart från ett numeriskt pris till blanksteg, `false` respektive en tom lista. Alla tre gav 0 öre/kWh som aktuellt pris. I den separata beräkningen för hela dygn sänktes dygnssnittet från 100 till cirka 98,96 öre/kWh, med samtliga 96 kvartar kvar i statistiken. Båda inläsarna omvandlar värdet med JavaScripts `Number` utan en föregående typkontroll. GW02 gäller det separata fallet där hela prisserien saknas.

Acceptera ändliga tal samt dokumenterade numeriska strängar efter strikt validering. Avvisa blanksteg, booleska värden och listor och behåll stöd för riktiga nollpriser och negativa priser. [Liveprisets konvertering](https://github.com/heke99/gridex-web/blob/e4d0718/lib/gridex/livePrices.ts#L66-L84) · [Konvertering för dags- och månadssnitt](https://github.com/heke99/gridex-web/blob/e4d0718/lib/gridex/pricing/elprisetjustnu.ts#L62-L66) · [Validering av prisraden](https://github.com/heke99/gridex-web/blob/e4d0718/lib/gridex/pricing/elprisetjustnu.ts#L107-L119)

<a id="gw61"></a>

### GW61 · P2 · Månads-API:t ersätter uttryckligen ogiltiga val med ett annat pris

**Lokalt, kvarstående från oktober.** En begäran med ogiltigt elområde, år och månad gav `200` och returnerade ett syntetiskt snitt för SE3 i oktober 2026. De 31 källanropen avsåg den ersatta perioden. Varje ogiltig parameter ersätts för sig, så svaret kan också blanda en uttryckligen angiven giltig del med en del från standardperioden.

Använd standardområdet och standardperioden för utelämnade parametrar. Returnera `400` med uppgift om berört fält när kunden anger ett ogiltigt värde. [Månads-API:ts parameterhantering](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/elpris/monthly/route.ts#L8-L37) · [Oktobergranskningen](../2026-10-06-project-review/PRISER-OCH-RESTERANDE.md)

<a id="gw62"></a>

### GW62 · P2 · Månads-API:t rapporterar opublicerade prisdata som serverfel

**Lokalt.** En ännu opublicerad syntetisk månad gav `404` för varje dag hos källan. Månads-API:t svarade `500`. Routen har ett särskilt `404`-svar för saknat månadspris, men vid källans `404` skapar dagsläsaren en tom serie och månadsberäkningen kastar ett fel som routen klassificerar som serverfel.

Skilj mellan saknat underlag, ofullständig period och fel hos prisleverantören. Returnera ett tydligt svar för en opublicerad månad och ett återförsökbart svar vid ett tillfälligt leverantörsfel. [Källans `404`](https://github.com/heke99/gridex-web/blob/e4d0718/lib/gridex/pricing/elprisetjustnu.ts#L194-L204) · [Fel vid saknade dagar](https://github.com/heke99/gridex-web/blob/e4d0718/lib/gridex/pricing/elprisetjustnu.ts#L322-L333) · [Månads-API:ts statuskoder](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/elpris/monthly/route.ts#L33-L56)

<a id="gw63"></a>

### GW63 · P2 · Elprissidan kan visa förra kvartens pris redan när sidan öppnas

**Lokalt med kontrollerad klocka.** Dagens pris hämtades strax innan en kvartsgräns. Jag höll tillbaka svaren för månadshistoriken tills den nya kvarten hade börjat. Sidan visade då 100 öre/kWh som områdets framhävda pris medan en ny livesammanställning för samma område gav 400 öre/kWh. Sidan sparar vilket intervall som var aktuellt innan den väntar färdigt på historiken och visar ingen tid för det framhävda priset.

Välj aktuellt intervall när livepriset visas eller visa det berörda intervallets tider och uppdatera priset vid nästa gräns. Låt hämtningen av historiken uppdateras för sig. [När liveintervallet väljs](https://github.com/heke99/gridex-web/blob/e4d0718/lib/gridex/livePrices.ts#L177-L194) · [Sidans väntan på historiken](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/elpriser/elpris-idag/page.tsx#L45-L64) · [Sidans framhävda pris](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/elpriser/elpris-idag/page.tsx#L137-L145)

<a id="gw64"></a>

### GW64 · P1 · Webbens fakturalista saknar en väg till tillgängliga fakturadokument

**Lokalt.** Ett syntetiskt OPS-svar för fakturadetaljen innehöll en PDF som mobilens detalj-API markerade som tillgänglig. Webbens fakturalista för samma faktura visade ingen länk till fakturan eller underlaget. Listan hämtar sammanfattningen, där OPS inte skickar dokumenten. Webbens mappning sätter `pdf_url` till `null` och listans enda öppningsknapp kräver just det fältet. Även om detalj-API:t i GW17 rättas saknar kunden en väg dit från fakturalistan.

Länka listans fakturor till en autentiserad detaljvy via fakturareferensen. Låt vyn visa de underlag som detaljsvaret markerar som tillgängliga och kontrollera åtkomst och tillgänglighet på nytt vid öppning. [Webbens mappning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L330-L352) · [Webbens länk för fakturaunderlag](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/invoices/page.tsx#L73-L93) · [Dokument i OPS detaljsvar](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/app/api/v1/customer/invoices/%5Bid%5D/route.ts#L54-L91)

<a id="gw65"></a>

### GW65 · P2 · Webbens och mobilens fakturalistor stannar på första sidan

**Lokalt.** Ett syntetiskt OPS-svar hade `has_more: true` och en fortsättningsmarkör. Både webbens och mobilens faktura-API returnerade `200` med första sidans poster och utelämnade sidinformationen. Webben ignorerade markören i nästa begäran och hämtade samma sida igen. Mobilens fakturarutt avvisade en begäran med markören med `400`. Äldre fakturor kan därmed saknas i båda kundgränssnitten. GW25 beskriver motsvarande problem för vanliga kunddokument.

För vidare OPS sidinformation och använd dess fortsättningsmarkör när kunden väljer att visa fler fakturor. Testa två sidor i båda kanalerna samt en sista sida utan fortsättningsmarkör. [OPS fakturasidor](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/app/api/v1/customer/invoices/route.ts#L30-L35) · [Webbens route](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/web/customer/invoices/route.ts#L1-L8) · [Webbens svarsmappning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L733-L747) · [Mobilens fakturaläsning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/mobile/customerRuntime.ts#L29-L35) · [Mobilens parameter- och svarsvalidering](https://github.com/heke99/gridex-web/blob/e4d0718/lib/mobile/contractsHandler.ts#L11-L24)

<a id="gw66"></a>

### GW66 · P2 · Webben visar ”Status uppdateras” för makulerade och krediterade fakturor

**Lokalt.** En syntetisk makulerad faktura och en syntetisk krediterad faktura visade båda ”Status uppdateras” i webbens fakturalista. OPS skickar båda som giltiga publicerade fakturastatusar. Fakturavyn använder samma reservtext för dessa slutliga statusar som för okända värden, vilket gör det svårare för kunden att avgöra om en faktura fortfarande ska betalas.

Visa ”Makulerad” respektive ”Krediterad” och reservera det generella beskedet för okänd status. Testa samtliga publicerade OPS-statusar i kundvyn. [Publicerade fakturastatusar](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/lib/customer-portal/format.ts#L1-L4) · [Webbens statusmappning](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/invoices/page.tsx#L22-L35)

<a id="gw67"></a>

### GW67 · P2 · Betalningsdatum försvinner från webben och mobilens fakturadetalj

**Lokalt.** OPS skickade `paid_at` för en syntetisk betald faktura. Webbens fakturalista visade ”Betald” och förfallodatum men utelämnade betalningsdatumet trots att webbens datamappning behöll det. Mobilens lista behöll och använder `paidAt`. När samma faktura öppnades i mobilens detaljvy hade API-mappningen tagit bort datumet, så det gick inte att se där heller.

Visa betalningsdatum där kunden granskar en betald faktura. För vidare värdet i mobilens detaljsvar och använd gemensam datumvisning. Testa både betalda fakturor med datum och fakturor där datum saknas. [OPS fakturafält](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/lib/customer-portal/publicDto.ts#L197-L208) · [Webbens datamappning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L335-L346) · [Webbens fakturavy](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/invoices/page.tsx#L65-L78) · [Mobilens lista](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/CustomerAccess.tsx#L72-L78) · [Mobilens detaljmappning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/mobile/customerDetails.ts#L34-L41)

<a id="gw68"></a>

### GW68 · P1 · Millisekunder i en giltig leveransperiod kan stoppa hela förbrukningsvyn

**Lokalt.** OPS senaste `main` skapade ett syntetiskt bekräftat leveransfönster med start `2026-10-31T23:00:00.125Z`. Gridex Web tog emot fönstret och svarade `503` innan nästa begäran om mätvärden. Kontrollfallet med `2026-10-31T23:00:00.000Z` nådde mätvärdesanropet och gav `200`. OPS behåller millisekunder i leveransgränsen, medan webbens parser kräver hela sekunder.

Enas om tidsstämpelprecision och bevara de behörighetsgrundande gränserna utan att vidga perioden genom avrundning. Testa bråkdelar av sekunder från OPS, inklusive ett mätintervall som korsar en sådan gräns. [OPS tolkning av marknadstid](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/consumptionAccess.ts#L15-L21) · [OPS leveransgränser](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/consumptionAccess.ts#L38-L48) · [Webbens sekundkrav](https://github.com/heke99/gridex-web/blob/e4d0718/lib/mobile/opsConsumption.ts#L8-L16)

<a id="gw69"></a>

### GW69 · P2 · Appens 30-dagarsval kan aldrig visa hela perioden för två kvartsmätare

**Lokalt.** Två syntetiska mätare hade kvartsvärden för hela november, totalt 5 760 giltiga rader. Efter 40 sidor returnerade mobil-API:t de nyaste 4 000 raderna och markerade svaret som delvis hämtat. De första nio dagarna och början av den tionde saknades. API:t lämnar ingen fortsättningsmarkör till appen. Knappen för att hämta igen startar samma period från början, så ett stabilt källunderlag förblir ofullständigt.

Hämta perioden i avgränsade delintervall eller använd verifierade dygnsaggregat för längre perioder. Behåll en praktisk gräns per begäran och testa det valbara 30-dagarsläget med två kvartsmätare. [Gränsen för mätvärdessidor](https://github.com/heke99/gridex-web/blob/e4d0718/lib/mobile/opsConsumption.ts#L62-L80) · [API:ts svar utan fortsättningsmarkör](https://github.com/heke99/gridex-web/blob/e4d0718/packages/customer-backend/consumption.mjs#L25-L29) · [Appens periodval och uppdatering](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/ConsumptionPanel.tsx#L60-L71)

<a id="gw70"></a>

### GW70 · P2 · Appen visar samma nollsumma för saknade mätvärden som för uppmätt noll

**Lokalt.** Jag renderade förbrukningsvyn först med en tom serie och sedan med en publicerad kvart på 0 kWh. Båda visade ”0 kWh i hämtade mätvärden” och uppgav att hämtningen var komplett. Den tomma serien hade också en förklarande rad. För den uppmätta kvarten visades en dag i diagrammet, men resten av sjudagarsperioden saknade uppgift om täckning. Summa och hämtningsstatus räcker därmed inte för att avgöra hur mycket av perioden som faktiskt uppmätts.

Visa ”Mätvärden saknas” som huvudvärde när serien är tom. Visa mätt täckning skild från om alla tillgängliga sidor har hämtats. Behåll 0 kWh för perioder med faktiska nollvärden. [Summeringen och sidstatusen](https://github.com/heke99/gridex-web/blob/e4d0718/packages/customer-backend/consumption.mjs#L25-L29) · [Appens förbrukningsvisning](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/ConsumptionPanel.tsx#L54-L70)

<a id="gw71"></a>

### GW71 · P2 · Webbens mätvärdes-API ignorerar dateringen, anläggningen och fortsättningsmarkören

**Lokalt.** Webbens API fick en begäran med `from`, `to`, `facility_id` och `cursor`. Routen svarade `200` med första sidans värde utanför det valda datumintervallet och utelämnade OPS sidinformation. OPS stöder alla fyra parametrar. Webbens route läser inga frågeparametrar och anropar samma ofiltrerade resurs oavsett begäran. Felet gäller filtrering av den inloggade kundens egna mätvärden.

Validera och för vidare de filter som stöds och bevara sidinformationen. Testa två anläggningar, ett filter som utesluter första raden och hämtning av nästa sida. [Webbens mätvärdesroute](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/web/customer/metering-values/route.ts#L1-L8) · [OPS filter och sidmarkör](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/app/api/v1/customer/metering-values/route.ts#L31-L64) · [Webbens svarsmappning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L733-L747)

<a id="gw72"></a>

### GW72 · P2 · Webbens mätvärdes-API tappar mätpunkt, upplösning och status

**Lokalt.** Ett syntetiskt OPS-svar innehöll mätpunktens publika referens, kvart som upplösning, lagringsstatus och 2 kWh. Webbens svar behöll mängden, intervallets tidsgränser och kvalitetsstatusen. Det gav samtidigt `metering_point_id: null` och utelämnade den publika mätpunktsreferensen, upplösningen och lagringsstatusen. En klient kan därmed inte gruppera svaret efter den mätpunkt som OPS angav.

För vidare den publika mätpunktsreferensen och relevanta fält för tolkningen av mätvärdet. Testa två oberoende mätpunkter i samma anläggning med identiska tidsstämplar. [Mätvärdesfält från OPS](https://github.com/heke99/gridex-ops-platform/blob/f23c1dc0c58f8bb1a55b83d8409e5712177b51b6/lib/customer-portal/publicDto.ts#L315-L338) · [Webbens mätvärdesmappning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L484-L495)

<a id="gw73"></a>

### GW73 · P1 · Ett produktionsavtal kan visas som förbrukning på Mina avtal

**Lokalt.** Jag tog en syntetisk avtalsrad med `energy_direction: production`, begränsade den till kolumnerna i OPS kundportalfråga och körde sedan OPS publika avtalsmappning och webbens riktiga avtalssida. Kunden fick ”Förbrukning”. OPS teckningsflöde skriver energiriktningen på avtalet, men kundportalens ordinarie och äldre kolumnurval utelämnar den. När fältet saknas skickar OPS `consumption`.

Läs energiriktningen från kundens avtal och för den vidare till vyn. Visa okänd riktning för äldre underlag där den inte kan fastställas. Testa produktionsavtal och förbrukningsavtal genom kundportalens faktiska avtalsfråga. [Energiriktning vid teckning](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/website/customerApplicationOnboarding.ts#L302-L311) · [Kundportalens kolumnurval](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/apiData.ts#L106-L181) · [OPS standardvärde](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/publicDto.ts#L83-L102) · [Webbens visning](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/contracts/page.tsx#L63-L71)

<a id="gw74"></a>

### GW74 · P1 · Automatisk förlängning kan visas som avstängd när den är aktiverad

**Lokalt.** Med `auto_renew_enabled: true` på den syntetiska avtalsraden visade den publika OPS-mappningen `true` om den fick hela raden. Efter tillämpning av kundportalens verkliga kolumnurval gav samma mappning `false`, och Mina avtal visade ”Nej”. OPS frågar aldrig efter kolumnen i de två aktuella urvalen. Mappningen likställer därefter ett saknat värde med ett uttryckligt nej.

Hämta det registrerade villkoret och skilj mellan aktiverad, avstängd och okänd automatisk förlängning. Testa alla tre fallen från OPS urval till Mina avtal. [Avtalets sparade inställning](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/supabase/migrations/01_db1_schema_repair_core_helpers_and_canonical_tables.sql#L1152-L1157) · [OPS kolumnurval](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/apiData.ts#L138-L181) · [Konverteringen till `false`](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/publicDto.ts#L110-L118) · [Kundens besked](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/contracts/page.tsx#L68-L72)

<a id="gw75"></a>

### GW75 · P1 · En separat rörlig avgift döljs eller visas som påslag

**Lokalt.** Ett syntetiskt avtal hade 3 öre/kWh i påslag och 7 öre/kWh i rörlig avgift. Mina avtal visade enbart ”Påslag 3 öre/kWh”. Med samma rörliga avgift och tomt påslagsfält visade sidan i stället ”Påslag 7 öre/kWh”. OPS prissnapshot behandlar normalt dessa som två separata komponenter. Den publika avtalsmappningen använder den rörliga avgiften som reservvärde för påslaget och skickar inget separat avgiftsfält.

För vidare avgifterna som egna komponenter med rätt etikett och enhet. Testa båda tillsammans samt en ensam rörlig avgift. [Separata priskomponenter](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/pricing/contractSnapshot.ts#L215-L240) · [OPS publika avgiftsmappning](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/publicDto.ts#L108-L117) · [Webbens avtalspriser](https://github.com/heke99/gridex-web/blob/e4d0718/components/customer/ContractPricing.tsx#L19-L29)

<a id="gw76"></a>

### GW76 · P2 · Signerade och avbrutna avtal får samma statusbesked

**Lokalt.** Ett signerat avtal och ett avbrutet avtal visades båda med ”Status uppdateras” i Mina avtal. OPS skickade de publicerade avtalsstatusarna `signed` och `cancelled` oförändrade. Kundportalens gemensamma statustext saknar dessa koder, så kunden får samma besked för två olika avtalslägen.

Visa kundanpassade etiketter för avtalets livscykel. Testa signerade, aktiva, uppsagda och avbrutna avtal i samma vy. [OPS avtalsstatusar](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/supabase/migrations/20260718160000_v5_signature_switch_readiness_hardening.sql#L53-L61) · [Webbens statusetiketter](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/statusHelper.ts#L5-L39) · [Status på Mina avtal](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/contracts/page.tsx#L46-L56)

<a id="gw77"></a>

### GW77 · P2 · Mina avtal visar varken registrerat slutdatum eller ångerfrist

**Lokalt.** OPS skickade ett syntetiskt avtals slutdatum och ångerfrist. Båda fanns kvar i kundportalens datamappning. Mina avtal visade startdatum och när avtalet skapades, men saknade båda slutdatumen. Det här gäller att uppgifterna saknas i den inloggade avtalsvyn. GW57 gäller hur tidpunkten återges på teckningskvittot.

Visa avtalets slutdatum och relevant ångerfrist när de finns. Använd svensk tid för tidsstämplar och behåll kalenderdatum för rena datumfält. [OPS datumfält](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/publicDto.ts#L98-L106) · [Mappning på webben](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L275-L302) · [Datum som visas på Mina avtal](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/contracts/page.tsx#L63-L73)

<a id="gw78"></a>

### GW78 · P1 · Kunden kan inte se hela omfattningen av sin signerade fullmakt

**Lokalt.** En syntetisk signerad fullmakt omfattade leverantörsbyte och inhämtning av anläggningsuppgifter. OPS lagrar de godkända ändamålen i den signerade ögonblicksbilden, men kundportalens projektion skickade bara huvudkoden `supplier_switch`. Mina sidor använde sedan en generell statusöversättning för den koden och visade ”Omfattning: Status uppdateras”. Kunden fick därmed inget begripligt besked om vad fullmakten täckte. Fyndet gäller visningen av en redan signerad fullmakt. GW48 gäller åtkomst till texten före signering.

För vidare de signerade ändamålen från avtalsunderlaget och visa ett läsbart namn för varje ändamål. Testa en fullmakt med flera ändamål genom OPS och Mina sidor. [OPS signerade omfattning](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/website/customerApplicationLegal.ts#L1111-L1145) · [OPS kundprojektion](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/publicDto.ts#L253-L279) · [Omfattning på Mina sidor](https://github.com/heke99/gridex-web/blob/e4d0718/app/mina-sidor/page.tsx#L222-L235)

<a id="gw79"></a>

### GW79 · P2 · Webbens fullmaktsvyer utelämnar giltighetstiden och kan dölja signeringsstatusen

**Lokalt.** OPS skickade en signerad syntetisk fullmakt som gällde till den 14 mars 2027. Webbens mapper behöll slutdatumet, men varken Mina sidor eller Godkännanden och fullmakt visade det. Statusen `signed` visades samtidigt som ”Status uppdateras” på Mina sidor. Båda vyerna visar när kunden godkände fullmakten. Kunden kan fortfarande inte avgöra när den gäller till.

Visa giltighetstid och använd en statusetikett som gäller fullmakten. Testa signerade, återkallade och utgångna fullmakter med respektive datum. [OPS datum och status](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/publicDto.ts#L272-L278) · [Webbens fullmaktsmappning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L434-L445) · [Fullmaktsvyn](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/approvals/page.tsx#L65-L88)

<a id="gw80"></a>

### GW80 · P2 · Fullmaktsarkivet säger att en PDF förbereds när verifieringsuppgifter saknas

**Lokalt.** För arkivstatusen `incomplete_evidence` visade dokumentvyn ”Fullmaktsdokumentet förbereds”. I OPS betyder statusen att arkivposten redan har en filsökväg men saknar en giltig verifikationsreferens. OPS lämnar därför ingen nedladdningslänk. Webbens besked antyder att kunden kan vänta på att en fil skapas.

Visa ett eget besked när arkiverad fullmakt saknar verifieringsuppgifter eller när nedladdning är otillgänglig. Testa samtliga arkivstatusar i vyn. [OPS arkivstatusar](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/poaArchiveRead.ts#L76-L90) · [Arkivets kundbesked](https://github.com/heke99/gridex-web/blob/e4d0718/components/customer/PoaArchiveDocuments.tsx#L29-L47)

<a id="gw81"></a>

### GW81 · P2 · Mina dokument märker dokument som tillgängliga utan öppningslänk

**Lokalt.** En syntetisk publicerad dokumentpost saknade URL i OPS. Webbens dokumentlista visade ”Tillgängligt” men saknade öppningsknapp och besked om varför filen inte gick att öppna. Statusetiketten bygger på dokumentets publiceringsstatus och öppningsknappen bygger på om en giltig länk finns.

Skilj mellan dokumentets publicering och möjligheten att öppna filen. Visa ett tydligt kundbesked när dokumentet är publicerat men ingen fungerande länk finns i svaret. [OPS dokumentfält](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/publicDto.ts#L212-L228) · [Webbens länkmappning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L367-L380) · [Statusen och öppningsknappen](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/documents/page.tsx#L53-L75)

<a id="gw82"></a>

### GW82 · P2 · Godkännanden saknar en väg till den dokumentversion kunden godkände

**Lokalt.** För ett syntetiskt godkännande skickade OPS dokumentreferens, version och kontrollsumma. Webbens mapper behöll alla tre. I vyn Godkännanden och fullmakt visades titel, version och datum, men vyn saknade både länk till det godkända dokumentet och den referens som knyter posten till rätt version. Den separata dokumentlistan ger ingen väg från godkännandet till en specifik dokumentpost.

Knyt godkännandet till den godkända dokumentversionen genom den verifierade referensen. Visa länken om versionen kan hämtas och förklara hur kunden får tillgång till den om dokumentet saknar en öppningsbar fil. [OPS uppgifter för godkännandet](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/publicDto.ts#L231-L250) · [Webbens mappning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L403-L415) · [Godkännanden i kundvyn](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/approvals/page.tsx#L39-L55)

<a id="gw83"></a>

### GW83 · P2 · Ett tomt telefonfält blockerar ändringar av namn och språk på webben

**Lokalt.** Jag försökte ändra förnamnet för en syntetisk kund utan telefonnummer. Webbens serveråtgärd skickade `phone: null` tillsammans med namn och språk. OPS verkliga validering svarade `422` för telefonfältet och ingen ändring genomfördes i testet. Profilsidan gav ett allmänt felbesked. Samma serialisering gäller tomma för- och efternamn.

Skicka de ändrade fälten och utelämna tomma, oförändrade fält. Hantera avsiktlig rensning uttryckligen om den stöds. Visa valideringsfelet vid det fält som behöver rättas. [Webbens profilbegäran](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/profile/actions.ts#L39-L71) · [OPS profilvalidering](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/profileUpdateContract.ts#L4-L18)

<a id="gw84"></a>

### GW84 · P1 · En namnrättning på webben kan skriva tillbaka ett gammalt telefonnummer

**Lokalt.** Webbformuläret fylldes i med kundens tidigare syntetiska telefonnummer. Mobilens faktiska profilrutt sparade sedan ett nytt nummer hos den simulerade OPS-tjänsten. När kunden ändrade namnet i webbformuläret skickade det även det gamla numret. Det blev åter kundens telefonnummer i OPS. Webbformuläret läser den lokala profilen och skickar samtliga kontaktfält. OPS versionskontroll jämför med den rad som läses när begäran kommer in och fångar därmed inte att formuläret byggdes före mobiländringen.

Skicka bara fält som kunden faktiskt ändrat. Använd den version kunden såg när flera värden behöver bytas tillsammans. Testa mobiländring följd av en namnrättning från ett redan öppnat webbformulär. [Formulärets förifyllda kontaktfält](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/profile/page.tsx#L39-L44) · [Webbens sparade fält](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/profile/actions.ts#L39-L61) · [Mobilens uppdatering](https://github.com/heke99/gridex-web/blob/e4d0718/lib/mobile/accountWriteRuntime.ts#L5-L13) · [OPS läsning inför uppdatering](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/app/api/v1/customer/profile-update/route.ts#L63-L71) · [OPS versionsvillkor](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/app/api/v1/customer/profile-update/route.ts#L111-L125)

<a id="gw85"></a>

### GW85 · P2 · Mobilen behandlar ett ogiltigt telefonnummer som ett tillfälligt serverfel

**Lokalt.** Mobilrutten släppte igenom ett syntetiskt nummer med plustecken mitt i numret. OPS telefonvalidering avvisade formatet. När OPS-felet hade status `422` gjorde mobilrutten om det till `503` och bad kunden försöka igen med samma uppgifter. Appen behandlar felet som ett obekräftat sparförsök, även om formatet måste ändras för att begäran ska lyckas.

Använd samma telefonvalidering i mobilgränssnittet och servern, och förmedla avvisade telefonvärden som fältfel. Behåll återförsök med oförändrat innehåll för fall där utfallet är osäkert. [Mobilruttens validering och felmappning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/mobile/accountWrites.ts#L19-L28) · [OPS telefonvalidering](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-service/contactChange.ts#L70-L78) · [Appens felbesked](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/useCustomerAccount.ts#L210-L219)

<a id="gw86"></a>

### GW86 · P2 · Mina sidor kan visa det gamla fullständiga namnet efter en namnrättning

**Lokalt.** Den syntetiska ändringen sparade det nya förnamnet och byggde ett nytt fullständigt namn i den lokala profilen. Webbens OPS-begäran innehöll för- och efternamn men saknade `full_name`. OPS transaktion behåller tidigare `full_name` när fältet saknas och kundportalen föredrar OPS visningsnamn. Mina sidor fick därför det gamla fullständiga namnet trots att det nya förnamnet hade sparats.

Härled aktuellt visningsnamn i samma uppdatering som ändrar personens namn. Behåll ett separat företagsnamn och andra avsiktligt registrerade namnuppgifter. Testa att en ändring slår igenom i både kontaktformuläret och Mina sidor. [Fälten som skickas och sparas lokalt](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/profile/actions.ts#L39-L61) · [Lokal beräkning av fullständigt namn](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/profile/actions.ts#L79-L91) · [OPS bevarande av `full_name`](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/supabase/migrations/20261004084204_staff_customer_write_attribution.sql#L217-L228) · [Valet av visningsnamn](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L221-L234)

<a id="gw87"></a>

### GW87 · P1 · Bekräftad e-poständring kan lämna den gamla kontaktadressen på Mina sidor

**Lokalt.** En syntetisk befintlig kund utan väntande kontoaktivering bekräftade en ny e-postadress i webbens Auth-flöde. Bekräftelserouten skickade vidare till profilsidan, som visade den nya inloggningsadressen. Den lokala synkningen uppdaterade också adressen. När OPS fortfarande hade den tidigare kontaktadressen visade Mina sidor den tidigare adressen. Synkjobbet skriver till de lokala profiltabellerna och kundportalen föredrar kontaktadressen från OPS.

Skilj tydligt på inloggningsadress och kontaktadress om de kan ändras oberoende. Om ändringen ska gälla båda behöver den bekräftade ändringen också föras över till OPS med beständig uppföljning. Testa ett befintligt konto utan köjobb. [Webbens ändring av inloggningsadress](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/profile/actions.ts#L104-L121) · [Bekräftelseroutens synkanrop](https://github.com/heke99/gridex-web/blob/e4d0718/app/auth/confirm/route.ts#L59-L87) · [Synkjobbets lokala skrivningar](https://github.com/heke99/gridex-web/blob/e4d0718/supabase/migrations/20261006204008_customer_portal_audit_hardening.sql#L60-L74) · [Valet av kontaktadress](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L229-L236)

<a id="gw88"></a>

### GW88 · P2 · Startsidan väntar med rubrik och övrigt innehåll medan avtalskatalogen hämtas

**Lokalt.** Jag körde startsidans verkliga serverkomponent med en syntetisk katalog. Anropet returnerade vyn efter cirka 1 ms utan inlagd fördröjning och efter 251 ms med 250 ms fördröjning i katalogen. Sidan inväntar katalogen före hela sin retur, även för sidans rubrik, förtroendesektion och redaktionella innehåll. Det här påverkar framför allt rendering när en tidigare sidversion saknas eller regenereras. De publika stickproven i den här omgången serverades från cache.

Låt sidans statiska innehåll skickas medan kalkylatorns avtalsalternativ laddas. Testa att en långsam katalog inte håller kvar sidans rubrik, och att kalkylatorn fortsätter verifiera pris mot servern. [Kataloghämtningen](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/page.tsx#L32-L47) · [Startsidan och kalkylatorn](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/page.tsx#L78-L92)

<a id="gw89"></a>

### GW89 · P2 · Startsidan skickar prisstruktur som webbläsarens kalkylator aldrig använder

**Produktion och kodgranskning.** De två avtalen i startsidans serialiserade kalkylatoruppgifter omfattade 7 347 UTF-8-byte som kompakt JSON. Kalkylatorns produktval behöver namn, värde, erbjudandereferens, energiriktning och kundtyper. Med dessa fem fält blev samma data 538 byte i samma format, en minskning på cirka 93 procent för just avtalsobjekten. Skillnaden är 6 809 byte före komprimering. Priset hämtas och verifieras redan på servern när kunden ber om det.

Skicka bara fälten kalkylatorn behöver för att lista och välja avtal. Mät även hela sidans komprimerade svar efter en ändring och testa att prisbegäran fortfarande använder exakt rätt erbjudandereferens. [Startsidan skickar avtalsalternativ och priskomponenter](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/page.tsx#L47-L68) · [Kalkylatorns produktval](https://github.com/heke99/gridex-web/blob/e4d0718/components/ElectricityCalculator.tsx#L283-L300) · [Kalkylatorns prisbegäran](https://github.com/heke99/gridex-web/blob/e4d0718/components/ElectricityCalculator.tsx#L602-L625) · [Publik startsida](https://gridex.se/)

<a id="gw90"></a>

### GW90 · P2 · Den publika avtalslistan renderas per begäran

**Produktion och kodgranskning.** Tre anonyma `GET` mot `/elavtal` gav `200`, `x-vercel-cache: MISS` och `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. Tiden till första byte var 0,68–2,33 sekunder från granskningsmiljön. Sidan väljer `force-dynamic` trots att avtalslistan hämtas från den gemensamma publika avtalskatalogen. Cachen för katalogdata kan fortfarande fungera under renderingen.

Pröva att cachelagra den publika avtalslistan med tidsstyrd och publiceringsstyrd invalidering. Verifiera att ny publicering syns inom avsedd tid och att den publika representationen saknar kundspecifika uppgifter. [Sidans renderingsläge](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/elavtal/page.tsx#L10-L21) · [Den publika kataloghämtningen](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/elavtal/page.tsx#L113-L135) · [Publik avtalslista](https://gridex.se/elavtal)

<a id="gw91"></a>

### GW91 · P2 · Mina avtal hämtar och mappar hundratals mätvärden som vyn aldrig använder

**Lokalt och kodgranskning.** Ett syntetiskt OPS-svar med 500 mätvärden ökade det okomprimerade svaret från OPS med 162 389 byte. Mina avtals komponentträd var identiskt med och utan raderna. Webbklienten begär hela kundpaketet och mappar mätvärdena. OPS inkluderar som standard alla fem valbara sektioner och tillåter upp till 500 mätvärden. Avtalsvyn använder avtal, anläggningar och högst åtta händelser.

Be OPS om de sektioner varje vy behöver och begränsa händelser till åtta för Mina avtal. Mät svarsstorlek och antal läsningar med en syntetisk kund som har många mätvärden. [Webbens fullständiga kundpaket](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/client/portal.ts#L346-L355) · [OPS valbara sektioner](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/app/api/v1/customer/portal-bundle/route.ts#L73-L97) · [OPS gräns för mätvärden](https://github.com/heke99/gridex-ops-platform/blob/63111f0ef657a84a9de4180d00b1042636013097/lib/customer-portal/apiData.ts#L380-L390) · [Vad avtalsvyn visar](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/contracts/page.tsx#L122-L133)

<a id="gw92"></a>

### GW92 · P2 · Mina avtal väntar på en separat hämtning av supportärenden

**Lokalt.** När det syntetiska supportanropet svarade direkt returnerade den verkliga serverkomponenten för Mina avtal efter cirka 1 ms. Med 250 ms fördröjning i enbart supportanropet tog det cirka 251 ms. Sidan visar inga supportärenden. Den gemensamma översiktsfunktionen hämtar ändå upp till 50 ärenden och inväntar svaret tillsammans med avtalsuppgifterna.

Hämta supportärenden bara i vyer som använder dem och låt en långsam supporttjänst påverka den delen av sidan. Testa att Mina avtal renderas med ett långsamt supportsvar. [Gemensam support- och kundhämtning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L750-L763) · [Avtalsvyns data](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/contracts/page.tsx#L27-L29)

<a id="gw93"></a>

### GW93 · P2 · Mina sidor gör två sekventiella verifieringar av samma inloggning

**Lokalt.** Den verkliga serverkomponenten för `/mina-sidor` gjorde två `getUser`-anrop med simulerad Auth. Sidan verifierar först användaren via ett direkt anrop till Supabase. Den startar sedan översiktsläsningen, som verifierar samma användare via den befintliga tjänstefunktionen. Ett direkt anrop ligger utanför den befintliga verifieringens React-cache för samma rendering.

Återanvänd den verifierade sessionen inom samma begäran och dela den aldrig mellan kunder eller begäranden. Testa ett enda Auth-anrop för `/mina-sidor` och att oinloggade fortfarande omdirigeras. [Sidans två steg](https://github.com/heke99/gridex-web/blob/e4d0718/app/mina-sidor/page.tsx#L38-L50) · [Översiktens sessionsläsning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L750-L753) · [Verifiering per rendering](https://github.com/heke99/gridex-web/blob/e4d0718/lib/supabase/server.ts#L19-L42)

<a id="gw94"></a>

### GW94 · P2 · Ett fel när teckningslänken skapas döljer ett färdigberäknat pris

**Lokalt.** Kalkylatorn på startsidan väntar med att visa priset tills `POST /api/checkout/context` har gett en teckningslänk. Den rutten hämtar en färsk avtalslista, verifierar offerten i OPS och sparar uppgifterna för teckningen. I testet hade prisanropet redan gett `200`. Kalkylatorn publicerade inget pris medan överlämningen väntade, och priset förblev dolt när den gav `503`. Kunden får därmed vänta på arbete som behövs först när den går vidare.

Visa det mottagna priset direkt och aktivera teckningslänken när överlämningen lyckas. Låt kunden försöka skapa länken igen med samma signerade underlag medan det gäller. Behåll kontrollen av offertens giltighet inför teckning. [Startsidan aktiverar överlämningen](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/page.tsx#L84-L91) · [Ordningen i kalkylatorn](https://github.com/heke99/gridex-web/blob/e4d0718/components/ElectricityCalculator.tsx#L666-L703) · [Avtalshämtning och offertvalidering](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/context/route.ts#L88-L111)

<a id="gw95"></a>

### GW95 · P2 · En ersatt prisberäkning fortsätter efter att kunden har ändrat uppgifterna

**Lokalt.** När adressen ändrades under ett pågående prisförsök kunde kalkylatorn starta en ny offert medan det första offertanropet ännu väntade. Det äldre anropet saknade en `AbortSignal`. Kalkylatorns kontroll förhindrade att det gamla svaret ersatte priset från det nya anropet. Servern kan ändå fortsätta räkna och spara ett underlag som kunden redan har ersatt. Samma avbrutna kalkyl kan lämna ett redan påbörjat anrop för teckningslänken.

Avbryt ersatta offert- och överlämningsanrop i webbläsaren. Kontrollera också om servern kan avbryta återstående arbete och vidarebefordra signalen innan kostsamma steg startar. Behåll kontrollen som hindrar gamla svar från att visas. [Återställning av priset](https://github.com/heke99/gridex-web/blob/e4d0718/components/ElectricityCalculator.tsx#L518-L525) · [Offertanropet](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/publicApi.ts#L294-L309) · [Överlämningsanropet](https://github.com/heke99/gridex-web/blob/e4d0718/components/ElectricityCalculator.tsx#L666-L689) · [Lagring av prissnapshot](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/quote/route.ts#L230-L253)

<a id="gw96"></a>

### GW96 · P2 · Varje teckningslänk väntar på rensning av utgångna länkar

**Lokalt.** När en ny teckningslänk skapas gör lagringen först en `DELETE` för alla utgångna rader och väntar på svaret innan den sparar den nya länken. Med 150 ms simulerad väntan på rensningen kom insättningen efter cirka 152 ms. Databasen har ett index på utgångstiden. Läsningen filtrerar redan bort utgångna länkar, så den fördröjningen behövs enbart för lagringsunderhåll.

Flytta rensningen till ett schemalagt jobb med ett intervall som uppfyller reglerna för lagringstid. Behåll utgångskontrollen vid läsning. [Rensning och insättning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/checkoutContextStore.ts#L30-L54) · [Utgångskontroll](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/checkoutContextStore.ts#L57-L69) · [Databasindex](https://github.com/heke99/gridex-web/blob/e4d0718/supabase/migrations/20260718160000_website_checkout_contexts.sql#L3-L12)

<a id="gw97"></a>

### GW97 · P2 · Teckningssidan hämtar avtalslista, offertunderlag och session i serie

**Lokalt.** Den del av serverkomponenten som förbereder teckningssidan tog cirka 1 ms med omedelbara svar från de tre tjänsterna och 452 ms med simulerade fördröjningar på 150, 200 och 100 ms. Det gäller öppning via en teckningslänk. Avtalslistan, offertunderlaget från länken och sessionskontrollen har varsin indata och kan starta samtidigt. Valet av vilket avtal som visas kan göras när listan och underlaget har kommit tillbaka.

Starta hämtningarna parallellt efter att frågeparametrarna lästs och behåll felhanteringen för varje steg. Session och offertunderlag ska fortsatt hanteras per begäran. [Avtalslista och lagrat underlag](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L512-L548) · [Sessionskontroll](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L549-L555)

<a id="gw98"></a>

### GW98 · P2 · Ett skrivfel i verifieringsloggen blockerar en offert som OPS godkänt

**Lokalt.** Två anrop för samma giltiga signerade offert uppdaterade samma prissnapshot varsin gång innan teckningslänken skapades. När lagringen av kontrollresultatet gav ett isolerat fel svarade överlämningen `503` trots att OPS hade bekräftat offerten och dess referenser matchade. Den nya länken sparades aldrig.

Pröva att spara kontrollresultatet och den nya teckningslänken i samma transaktion eller att uppdatera loggen via en beständig kö om kraven på revision tillåter senare skrivning. Behåll kontrollen mot OPS. Testa återförsök och tillfälliga loggfel med en giltig offert. [OPS-validering och efterföljande loggning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/canonicalQuoteValidation.ts#L231-L265) · [Uppdatering av prissnapshot](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/pricingSnapshotStore.ts#L123-L138) · [Överlämningens felhantering](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/context/route.ts#L129-L158)

<a id="gw99"></a>

### GW99 · P2 · Teckningen hämtar hela avtalskatalogen även när revisionen är oförändrad

**Lokalt.** Både överlämningen och den slutliga teckningen anropar katalogklienten med `forceFresh`, vilket utelämnar `If-None-Match`. Den befintliga strikta kontrollen kan be OPS bekräfta samma revision via `304` och avvisar reservdata vid fel. Med samma testkatalog returnerade den ovillkorliga hämtningen `200` med 5 205 byte JSON och sparade katalogen igen. Den strikta villkorade hämtningen gav `304` utan svarskropp eller ny databasskrivning.

Pröva den strikta villkorade kontrollen för de två stegen. Kräv att OPS bekräftar rätt ETag eller levererar en ny giltig katalog. Testa avpublicering, äldre revisioner och ett uteblivet eller ogiltigt svar från OPS innan ändringen införs i teckningen. [Överlämningen](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/context/route.ts#L88-L98) · [Slutlig teckning](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L601-L614) · [Villkorad begäran](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/client/website.ts#L874-L917) · [Verifiering av svar utan ändring](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/client/website.ts#L933-L954) · [Lagring av fullständigt svar](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/client/website.ts#L1054-L1093)

<a id="gw100"></a>

### GW100 · P2 · Ett katalogavbrott döljer ett lokalt formulärfel i teckningen

**Lokalt.** När en begäran hade ogiltig kundtyp hämtade den verkliga serveråtgärden ändå en fullständig avtalskatalog innan den returnerade ett fältfel. När samma kataloghämtning simulerades som otillgänglig gav samma begäran ett allmänt driftfel utan fältfelet. Kunden kan därmed inte se vilken uppgift som behöver rättas.

Kontrollera kundtyp, obligatorisk avtalsreferens och övriga uppgifter som kan valideras lokalt före kataloganropet. Behåll kontrollerna som behöver ett aktuellt avtal efter hämtningen. [Kataloganrop och kundtypskontroll](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L598-L625)

<a id="gw101"></a>

### GW101 · P2 · Prisrutten väntar på en ny OPS-offert för ett avtal som katalogen redan saknar

**Lokalt.** Prisrutten hämtar katalogen samtidigt som den begär en ny offert från OPS och inväntar båda svaren före kontrollen av valt avtal. Den syntetiska katalogen saknade det begärda avtalet och svarade direkt. Rutten returnerade ändå `404` först efter att offertsvar med 150 ms simulerad fördröjning kommit fram. Hela begäran tog cirka 171 ms och gjorde ett offertanrop som webben aldrig använde.

Kontrollera om en verifierad katalog kan sålla bort otillgängliga avtal före offertanropet, samtidigt som normalfallet behåller sin parallellitet. Mät både avvisade anrop och svarstid för giltiga avtal. [Parallella anrop och efterföljande avtalskontroll](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/quote/route.ts#L148-L172)

<a id="gw102"></a>

### GW102 · P2 · En ny teckning gör sex databasanrop i följd innan ansökan skickas till OPS

**Lokalt.** Lagringen läser och skapar först teckningsförsöket, läser och låser datan som ska skickas och läser och sätter slutligen statusen `submitting`. De tre läsningarna begär samma breda kolumnurval med pris-, avtals- och villkorssnapshotar. När varje databasoperation fördröjdes med 30 ms tog de tre stegen cirka 187 ms tillsammans.

Pröva att sätta statusen samtidigt som datan låses med en villkorad databasoperation. Begränsa läsningarna till fälten som behövs i respektive steg och behåll skydden mot samtidiga ändringar, dubbletter och nedgradering av status. [Förberedelse och kolumnurval](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/submissionStore.ts#L59-L131) · [Låsning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/submissionStore.ts#L146-L178) · [Statusuppdateringens skydd](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/submissionStore.ts#L275-L293) · [Anropsordningen](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L1269-L1292)

<a id="gw103"></a>

### GW103 · P2 · Upprepad adresskontroll gör först ett skrivförsök som databasen avvisar

**Lokalt.** När OPS återanvänder samma områdesreferens skickar webben först en insättning som ger en unikhetskonflikt och gör sedan en separat läsning för att jämföra det sparade underlaget. Områdesrutten väntar på båda operationerna. Ett isolerat läsfel i testet avbröt upprepningen trots att den ursprungliga posten låg kvar.

Pröva en transaktion som skapar posten eller jämför den befintliga posten i samma databasanrop. Behåll ursprungligt revisionsbevis och avvisa en referens som återkommer med förändrat områdesunderlag. [Insättning och efterföljande jämförelse](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/energyAreaStore.ts#L112-L137) · [Adressrutten väntar på lagringen](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/energy-area/resolve/route.ts#L149-L165)

<a id="gw104"></a>

### GW104 · P2 · Dagsprisets API återanvänder inget CDN-svar för ett redan publicerat dygn

**Produktion.** Tre identiska anrop för SE3 den 16 november gav `200`, `x-vercel-cache: MISS` och `Cache-Control: public, max-age=0, must-revalidate`. Samtliga svar hade samma JSON-innehåll på 14 301 byte med 96 prisintervall och `current: null`. API-rutten renderas dynamiskt. Stickprovet gäller cachen för API-svaret. Priskällans antal anrop bakom rutten mättes inte.

Cacha verifierade, kompletta svar för ett explicit datum och elområde. Sätt en kortare livslängd för dagar där publicering eller korrigering fortfarande väntas och testa hur saknade intervall och rättade priser hanteras. Behåll postnummeruppslagningen utanför den delade svarscachen. [Publikt dagspris](https://gridex.se/api/elpris/day?area=SE3&date=2026-11-16) · [Routing och svar](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/elpris/day/route.ts#L5-L28)

<a id="gw105"></a>

### GW105 · P2 · Mobilens gårdagsvy hämtar om hela dygnet varje minut och tömmer prisvyn

**Lokalt.** Med mobilens spotprisvy öppen på **Igår** gjorde två simulerade minutskiften varsin ny begäran till exakt samma URL. Vid den första uppdateringen försvann priset som redan laddats och ersattes av en laddningsindikator. När servern svarade `503` låg priset kvar dolt bakom felmeddelandet. Samma timer används oavsett vald dag.

Använd de redan hämtade intervallen för att uppdatera vilken kvart som visas. Hämta om serien när datumet byts, när ny publicering kan väntas eller när användaren själv ber om en uppdatering. Behåll den senast laddade serien för samma område och datum under en uppdatering och visa om uppdateringen misslyckades. [Minuttimer och datahämtning](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/MarketPrices.tsx#L13-L33) · [Laddnings- och feltillstånden](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/MarketPrices.tsx#L39-L61)

<a id="gw106"></a>

### GW106 · P2 · Mobilens prisparser skapar 192 datumformaterare för ett normalt kvartsdygn

**Lokalt.** Parsern kontrollerar att både början och slutet på varje prisintervall hör till rätt marknadsdygn. Varje kontroll skapar en ny `Intl.DateTimeFormat` med samma inställningar. Ett dygn med 96 intervall skapade 192 instanser. När testet återanvände en instans gav parsern samma resultat. Mediankörtiden var cirka 26 ms med upprepade konstruktioner och 0,5 ms med återanvändning i Node 22. Tiderna mättes på granskningsdatorn.

Återanvänd en datumformaterare för svensk marknadstid och behåll valideringen av båda tidsgränserna. Kör regressionstester för sommartidsbyten och repetera mätningen på mobil. [Datumformateringen](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/marketPriceData.ts#L4-L11) · [Kontroll per prisintervall](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/marketPriceData.ts#L19-L32)

<a id="gw107"></a>

### GW107 · P2 · Månadspriset startar nya källanrop efter att API:t redan har svarat med fel

**Lokalt.** När priskällan gav `503` för månadens första dag svarade månads-API:t `500` efter att de fyra första källanropen startat. Övriga parallella hämtningar fick sedan sina svar och startade ytterligare 26 dagshämtningar. Det färdiga månadssnittet kräver alla dagar och kan inte levereras för den misslyckade begäran.

Sluta tilldela dagar när månadsberäkningen har misslyckats. Avbryt pågående hämtningar där det går och behåll deras individuella tidsgränser. Testa att ett tidigt fel stoppar nya anrop och att ett nytt legitimt försök kan slutföras. [Dagshämtning och tidsgräns](https://github.com/heke99/gridex-web/blob/e4d0718/lib/gridex/pricing/elprisetjustnu.ts#L184-L204) · [Parallell månadsberäkning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/gridex/pricing/elprisetjustnu.ts#L297-L329) · [Månads-API:ts felsvar](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/elpris/monthly/route.ts#L54-L57)

<a id="gw108"></a>

### GW108 · P2 · Publikt pris för ett angivet elområde kräver en oanvänd sessionsklient

**Lokalt.** Dagsprisets API, liveprisets API och sidan **Elpris idag** läste kakor och initierade Supabase före prisuppslaget. Utan Supabase-konfiguration gav båda API-rutterna `500` och sidan avbröt renderingen före första prisuppslaget. Med konfiguration tog dags-API:t emot en syntetisk prisserie och svarade `200` utan att göra någon nätverksbegäran till Supabase. Databasen används för postnummeruppslagningen. För ett angivet elområde finns området redan i begäran.

Skapa klienten först när ett postnummer behöver slås upp och låt prisvyer med fasta områden hämta de publika serierna direkt. Det tar bort ett beroende i prisvägen och gör det enklare att införa cache från GW104. [Dags-API:t](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/elpris/day/route.ts#L9-L23) · [Live-API:t](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/elpris/live/route.ts#L9-L20) · [Elpris idag](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/elpriser/elpris-idag/page.tsx#L45-L64) · [Val av elområde](https://github.com/heke99/gridex-web/blob/e4d0718/lib/gridex/livePrices.ts#L151-L181)

<a id="gw109"></a>

### GW109 · P2 · Priskorten skickar kunden tillbaka till samma översikt via en områdessida

**Produktion.** Både dagskortet och månadskortet för SE3 länkade till `/elpriser/se3`. Där leder knappen ”Se livepris och snitt för SE3” tillbaka till `/elpriser/elpris-idag` utan områdesval eller ankare. Kunden kommer tillbaka till samma fyra områden efter två navigationer. Samma länkmönster finns i koden för SE1–SE4.

Låt priskorten öppna vald periods prisdetalj för området. Om områdessidan ska fungera som en guide kan den länka direkt till motsvarande avsnitt i översikten. [Priskorten i produktion](https://gridex.se/elpriser/elpris-idag) · [Områdessidan i produktion](https://gridex.se/elpriser/se3) · [Priskortens länkar](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/elpriser/elpris-idag/page.tsx#L137-L185) · [Områdessidornas tillbakalänk](https://github.com/heke99/gridex-web/blob/e4d0718/lib/seo/content.ts#L659-L669)

<a id="gw110"></a>

### GW110 · P2 · Mobilens förbrukningsvy hämtar en dold avtalslista och visar dess fel

**Lokalt.** Vid inloggning medan **Förbrukning** var vald gjorde appen tre kundanrop. Den hämtade avtal, anläggningar och mätvärden. Bara anläggningarna och mätvärdena används i vyn. När avtal svarade `503` visades ”Uppgifterna kunde inte hämtas” samtidigt som förbrukningssvaret visades. Sessionsåterställning med avtal som vald kundresurs gjorde samma tre anrop.

Låt den aktiva vyn styra vilka kunduppgifter som hämtas efter sessionskontrollen. Ladda avtalen när kunden öppnar avtalslistan och visa fel i den vy vars hämtning misslyckades. [Inloggning och sessionsåterställning](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/useCustomerAccount.ts#L135-L158) · [Villkor för visning och gemensamt felmeddelande](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/CustomerAccess.tsx#L52-L90)

<a id="gw111"></a>

### GW111 · P2 · Mobilen tappar anläggning och period när den återvänder från bakgrunden

**Lokalt.** Jag valde den andra anläggningen och 30 dagar i förbrukningsvyn. Appen dolde kunduppgifterna när den gick till bakgrunden. Vid återgång i förgrunden laddade den återigen anläggningslistan och visade första anläggningen med sju dagar. Förbrukningskomponenten avmonteras när appen blir inaktiv och håller båda valen i sitt eget tillstånd.

Behåll periodvalet och den valda referensen i minnet för samma verifierade session. Visa fortsatt inga kunduppgifter i bakgrunden. När appen blir aktiv kan den kontrollera att anläggningen fortfarande är tillgänglig och återskapa samma urval. Rensa valen vid utloggning eller kontobyte. [Inaktiv vy och montering](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/CustomerAccess.tsx#L35-L56) · [Period och anläggning](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/ConsumptionPanel.tsx#L37-L53)

<a id="gw112"></a>

### GW112 · P2 · Förbrukningsdiagrammet skapar tusentals datumformaterare varje gång det renderas

**Lokalt.** Diagrammet beräknar svensk kalenderdag två gånger per mätvärde och skapar en ny datumformaterare varje gång. I testet med 2 880 syntetiska kvartar skapade en omrendering 5 762 formaterare inklusive periodens två gränser. En omrendering tog cirka 259 ms i Node 22. En försökskörning med återanvändning av en formaterare tog cirka 18 ms och gav samma synliga innehåll. Testet kördes på granskningsdatorn.

Återanvänd datumformateraren, beräkna datumet en gång per rad och gruppera bara om när mätserien ändras. Kontrollera att dygnsgrupperingen fortsätter följa svensk tid vid sommartidsbyten. [Datumformateraren](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/ConsumptionPanel.tsx#L7-L20) · [Gruppering och rendering](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/ConsumptionPanel.tsx#L54-L69)

<a id="gw113"></a>

### GW113 · P2 · En långsam fakturahämtning låser övriga kundvyer i mobilen

**Lokalt.** När ett syntetiskt fakturaanrop väntade var **Profil** inaktiverad tillsammans med övriga kundknappar. Vyn startade inget profilanrop och köade inget byte. Först när fakturorna hade svarat kunde kunden trycka på **Profil** igen och öppna vyn. Den gemensamma läsningen har en tidsgräns på 20 sekunder.

Låt kunden byta kundvy medan en läsning pågår. Avbryt en ersatt läsning eller ignorera dess sena svar och fortsätt skydda pågående skrivningar och utloggningar. [Knapparnas låsning](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/CustomerAccess.tsx#L55-L59) · [Gemensam läsning och tidsgräns](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/useCustomerAccount.ts#L73-L92)

<a id="gw114"></a>

### GW114 · P2 · Återförsök i mobilens supportlista börjar om från första sidan

**Lokalt.** Två sidor med supportärenden hade laddats när den tredje gav `503`. De redan visade ärendena låg kvar efter felet. Knappen **Hämta igen** skickade därefter ett nytt anrop utan sidmarkör och ersatte listan med första sidan. Kunden behöver bläddra förbi tidigare sidor för att nå samma plats igen.

Spara sidmarkören för en misslyckad fortsättningshämtning och erbjud ett återförsök för just den sidan. Behåll redan hämtade ärenden och befintlig dubblettkontroll. [Vyns återförsök](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/CustomerAccess.tsx#L80-L89) · [Hämtning och listbyte](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/useCustomerAccount.ts#L73-L106) · [Hantering av sidmarkör](https://github.com/heke99/gridex-web/blob/e4d0718/apps/mobile/src/useCustomerAccount.ts#L159-L166)

<a id="gw115"></a>

### GW115 · P1 · Teckningslänkens privata referens följer med i webbanalysen

**Lokalt.** När mätsamtycke var aktivt hamnade en syntetisk teckningsreferens i både `page_location` och `page_path` i det anrop som webbplatsen lämnar till Google-taggen. Tack-sidan tar bort frågeparametrar, men teckningssidan gör det inte. Teckningsreferensen är avsedd att återställa pris- och adressunderlag. Testet använde en lokal mottagare och en syntetisk referens.

Skicka en rensad sida till mättjänsten genom en gemensam funktion som utgår från sökvägen och bara tillåter uttryckligen godkända mätparametrar. Testa att tecknings-, kvitto- och inloggningsreferenser utelämnas från mätanrop. Kontrollera befintliga mätdata för den berörda sökvägen. [Mätkodens URL-hantering](https://github.com/heke99/gridex-web/blob/e4d0718/components/analytics/GoogleMarketingTags.tsx#L78-L104) · [Teckningssidans återställning](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L533-L548) · [Vad teckningslänken refererar till](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/checkoutContextStore.ts#L9-L17)

<a id="gw116"></a>

### GW116 · P2 · Blockerad webbläsarlagring utlöser fel i cookiebannern och mätkomponenten

**Publik sida i Chromium med simulerad webbläsarinställning.** När läsning av lokal lagring kastade `SecurityError` vid sidladdning rapporterade webbens globala felhantering undantaget. Sidans huvudrubrik fanns kvar. Både bannern och mätkomponenten läser lokal lagring direkt när de hämtar samtycke. Bannern skriver också direkt till lagringen innan den uppdaterar sitt tillstånd.

Läs och skriv samtycke genom en gemensam funktion som hanterar lagringsfel. Låt mätning vara avstängd utan verifierat aktivt samtycke och använd ett tillfälligt val för den aktuella sidvisningen när valet inte kan sparas. [Bannerns läsning och skrivning](https://github.com/heke99/gridex-web/blob/e4d0718/components/legal/CookieBanner.tsx#L13-L42) · [Mätkomponentens läsning](https://github.com/heke99/gridex-web/blob/e4d0718/components/analytics/GoogleMarketingTags.tsx#L23-L51) · [Cookiewebbens inställningar](https://github.com/heke99/gridex-web/blob/e4d0718/components/legal/CookieSettings.tsx#L18-L35)

<a id="gw117"></a>

### GW117 · P2 · Ett sparat cookieval orsakar hydreringsfel på inställningssidan

**Publik sida i Chromium med syntetiskt sparat val.** Med ett sparat avvisande och fördröjd JavaScript-laddning visade `/cookies` först ”Inget val sparat” och den globala bannern. När JavaScript släpptes fram rapporterade React hydreringsfel `#418`. Därefter visades ”Avvisat” och bannern försvann. Serverns HTML utgår från att inget val finns medan inställningskomponentens första körning i webbläsaren läser det sparade valet direkt.

Ge servern och webbläsarens första rendering samma startvärde och läs det sparade valet när webbläsaren har tagit över. Visa ett neutralt tillstånd tills valet har lästs och testa tidigare accepterade och avvisade val med fördröjda skript. [Inställningssidans initiering](https://github.com/heke99/gridex-web/blob/e4d0718/components/legal/CookieSettings.tsx#L12-L22) · [Status som visas](https://github.com/heke99/gridex-web/blob/e4d0718/components/legal/CookieSettings.tsx#L37-L45) · [Bannerns servervärde](https://github.com/heke99/gridex-web/blob/e4d0718/components/legal/CookieBanner.tsx#L22-L44)

<a id="gw118"></a>

### GW118 · P2 · Publika sidladdningar startar en separat sessionskontroll även för anonyma besökare

**Produktion.** Vid två fullständiga anonyma sidladdningar, `/elpriser/se3` och `/guider`, anropade navigeringen `/api/auth/public-session`. Båda svaren hade `private, no-store` och tomt kontovärde. Kontrollen sker efter att sidans JavaScript har laddats. Servern initierar Auth-klienten när den är konfigurerad. Stickprovet mäter extra anrop från webbläsaren och säger inget om externa Auth-anrop.

Pröva att senarelägga kontrollen tills kontostatus behövs eller hoppa över den när en tillförlitlig signal säger att ingen session finns. Verifiera fortsatt autentisering på servern och behåll de individuella svarens privata cachepolicy. [Aktivering i den publika layouten](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/layout.tsx#L105-L108) · [Webbläsarens begäran](https://github.com/heke99/gridex-web/blob/e4d0718/components/layout/PublicHeader.tsx#L53-L86) · [Sessionsruttens svar](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/auth/public-session/route.ts#L6-L34)

<a id="gw119"></a>

### GW119 · P2 · Guidesidan förladdar ett typsnitt som den inte använder

**Produktion.** Vid en laddning av `/guider` i Chromium förladdades två typsnittsfiler. Geist Mono utgjorde 23 108 byte av typsnittsdatan. Den synliga texten på sidan använde ingen monospacefamilj. Typsnittet registreras i rotlayouten, där även sidor som saknar monospacetext får förladdningen.

Låt Geist Mono laddas där det används eller stäng av förladdningen och låt webbläsaren hämta filen vid behov. Mät mängden typsnittsdata vid en kall sidladdning och kontrollera startsidans siffror efter ändringen. [Guidesidan](https://gridex.se/guider) · [Rotlayoutens typsnitt](https://github.com/heke99/gridex-web/blob/e4d0718/app/layout.tsx#L2-L17) · [Startsidan använder monospace](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/page.tsx#L151-L175)

<a id="gw120"></a>

### GW120 · P2 · OPS hämtar fakturarader och bilagor i följd

**Lokalt.** OPS verifierar först vilken faktura kunden har tillgång till. Därefter väntar rutten på fakturaraderna innan den startar bilagefrågan. Frågorna använder samma verifierade faktura-ID och behöver inget resultat från varandra. Med 150 respektive 200 ms simulerad databasfördröjning tog fakturadetaljens svar cirka 358 ms totalt.

Hämta fakturarader och bilagor parallellt efter fakturakontrollen. Behåll samma kund- och fakturaavgränsning och testa att fel hanteras korrekt för båda frågorna. [Fakturakontroll och databasfrågor](https://github.com/heke99/gridex-ops-platform/blob/eafb4258113cc3971f04c416dd997e480cdfaa7f/app/api/v1/customer/invoices/%5Bid%5D/route.ts#L25-L61)

<a id="gw121"></a>

### GW121 · P2 · Varje fakturabilaga lägger till en separat kontroll av om filen finns kvar

**Lokalt.** Efter att OPS hämtat bilagorna kontrollerar rutten en fil i taget mot databasens regler för borttagna filkopior. Med tre bilagor och 50 ms simulerad fördröjning per kontroll tog rutten cirka 152 ms när övriga svar var omedelbara. I samma test utelämnades länken till den bilaga vars filkopia hade tagits bort.

Pröva en samlad kontroll för alla bilagor som tillhör den verifierade fakturan. Behåll skyddet mot att lämna ut borttagna filkopior och behåll avgränsningen till kundens faktura. Mät antal databasfrågor för fakturor med olika antal bilagor. [Kontroll per bilaga](https://github.com/heke99/gridex-ops-platform/blob/eafb4258113cc3971f04c416dd997e480cdfaa7f/app/api/v1/customer/invoices/%5Bid%5D/route.ts#L61-L89) · [Databasanrop för filstatus](https://github.com/heke99/gridex-ops-platform/blob/eafb4258113cc3971f04c416dd997e480cdfaa7f/lib/ediel/retention/invoiceFileRetention.ts#L69-L72)

<a id="gw122"></a>

### GW122 · P2 · Mobilen läser om alla fakturarader för att öppna en enskild bilaga

**Lokalt.** När kunden öppnar en bilaga hämtar mobil-API:t hela fakturadetaljen från OPS igen. I ett exempel med 120 syntetiska fakturarader innehöll raderna 41 061 byte JSON i det svar som mobil-API:t läste. Mobilens svar till appen innehöll bara den valda bilagans referens och länk. När enbart fakturaraderna ersattes med ett ogiltigt värde gav bilagerutten `503` trots att bilagan fortfarande var tillgänglig i OPS-svaret.

Inför ett avgränsat uppslag för den valda bilagan. Verifiera kunden och att bilagan hör till fakturan på nytt vid varje öppning. Returnera den aktuella godkända länken utan att hämta fakturaraderna. [Mobilens hämtning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/mobile/customerRuntime.ts#L49-L62) · [Validering av fakturadetalj och bilaga](https://github.com/heke99/gridex-web/blob/e4d0718/lib/mobile/customerDetails.ts#L27-L51)

<a id="gw123"></a>

### GW123 · P2 · Mobilen kan inte öppna ett dokument som har flyttats till nästa listsida

**Lokalt.** Ett dokument visades som tillgängligt i mobilens dokumentlista. Vid klick hämtade öppningsrutten första sidan från OPS igen. När det nya syntetiska svaret angav att fler sidor fanns och hade flyttat bort det valda dokumentet från den första sidan, gav knappen `503`. När dokumentet låg på första sidan igen gick det att öppna. Öppningsrutten letar efter dokumentet i en lista och hämtar det aldrig på referens.

Använd ett uppslag på dokumentreferensen inom den verifierade kundens dokument. Behåll kontrollen av godkänd dokumentlänk. Testa att ett dokument fortfarande kan öppnas när nya dokument har ändrat listordningen. [Mobilens öppningsrutt](https://github.com/heke99/gridex-web/blob/e4d0718/lib/mobile/customerRuntime.ts#L65-L73) · [Sökning i svarssidan](https://github.com/heke99/gridex-web/blob/e4d0718/lib/mobile/customerExtras.ts#L27-L34) · [OPS sidindelade dokumentlista](https://github.com/heke99/gridex-ops-platform/blob/eafb4258113cc3971f04c416dd997e480cdfaa7f/app/api/v1/customer/documents/route.ts#L18-L35)

<a id="gw124"></a>

### GW124 · P2 · Nästa sida i fullmaktsarkivet hämtar också om ordinarie dokument

**Lokalt.** Länken **Visa fler fullmakter** öppnar dokumentsidan igen med arkivets sidmarkör. Servern frågar på nytt efter kundens ordinarie dokument trots att endast fullmaktsmarkören har ändrats. Med omedelbart arkivsvar och 150 ms simulerad fördröjning i den ordinarie dokumentlistan tog serverkomponenten cirka 151 ms innan den returnerade sidinnehållet.

Låt fortsatt bläddring uppdatera arkivdelen för sig, eller låt arkivdelen renderas oberoende av den ordinarie dokumentlistan. Behåll samma sessions- och kundkontroller vid varje arkivhämtning. [Fullmaktslänken](https://github.com/heke99/gridex-web/blob/e4d0718/components/customer/PoaArchiveDocuments.tsx#L50-L54) · [Dokumentsidans båda hämtningar](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/documents/page.tsx#L31-L49)

<a id="gw125"></a>

### GW125 · P2 · Kundportalen läser samma profil sju gånger för fem supportärenden

**Lokalt.** När kundportalen laddade fem syntetiska ärenden gjordes sju databasläsningar av samma kundprofil. Ärendelistan läste profilen, bilagehämtningen tog fram samma kundidentitet igen och varje meddelandehämtning läste profilen på nytt. Alla anrop utgick från samma verifierade användare och rendering.

Beräkna kundidentiteten en gång för renderingen och använd den i alla tre läsvägar. Behåll åtkomstkontrollen för respektive ärende och använd inte identiteten mellan begäranden. [Sidans identitetsläsning](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/support/page.tsx#L102-L119) · [Tjänstens list- och meddelandeläsning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L603-L624) · [Profiluppslaget](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L664-L670)

<a id="gw126"></a>

### GW126 · P2 · Kundportalens supportformulär väntar på meddelanden och bilagor för alla ärenden

**Lokalt.** Med fem ärenden gjorde sidladdningen elva OPS-anrop för en ärendelista, fem meddelandelistor och fem bilagelistor. Bilagorna för varje ärende började hämtas först när dess meddelanden var klara. Med 200 ms simulerad väntan på meddelanden och 150 ms på bilagor för ett av ärendena tog serverkomponenten cirka 353 ms. Även formuläret för ett nytt ärende väntade på den hämtningen.

Visa ärendelistan och formuläret utan att invänta all historik. Hämta meddelanden och bilagor parallellt när kunden öppnar ett enskilt ärende och ge respektive sektion en egen laddningsindikator. [Sidans hämtning och formulär](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/support/page.tsx#L97-L150)

<a id="gw127"></a>

### GW127 · P2 · Support123 hämtar första historik- och bilagesidorna igen vid bläddring

**Lokalt.** Vid en fortsättningsladdning med två sidmarkörer anropade Support123 ärendedetaljen, de två fortsättningsrutterna och personalkatalogen. OPS ärendedetalj innehåller första sidan för både historik och bilagor, som ersattes av fortsättningssvaren. Personalkatalogen lästes på nytt även när personalen enbart bläddrade.

Låt bläddring hämta enbart den sektion som ändrades. Om hela sidan behöver laddas om kan en avgränsad ärendesammanfattning ersätta de första listsidor som annars laddas förgäves. Ladda ansvarigväljaren för sig. [Support123:s anropsordning](https://github.com/heke99/gridex-web/blob/e4d0718/apps/support/app/%28workspace%29/cases/%5Breference%5D/page.tsx#L25-L46) · [OPS ärendedetalj](https://github.com/heke99/gridex-ops-platform/blob/eafb4258113cc3971f04c416dd997e480cdfaa7f/lib/staff-api/caseHandlers.ts#L107-L124)

<a id="gw128"></a>

### GW128 · P2 · Bläddring bland bilagor återställer ärendehistorikens sida i Support123

**Lokalt.** Från en äldre historiksida ledde **Fler bilagor** till rätt bilagesida men återställde historiken till första sidan. Länkarna för både historik och bilagor skriver bara den egna sidmarkören. Därmed försvinner positionen i den andra sektionen.

Bevara den andra sektionens sidmarkör när en länk uppdaterar den ena. Testa att historik och bilagor kan bläddras oberoende från en senare sida i båda listorna. [Historikens länkar](https://github.com/heke99/gridex-web/blob/e4d0718/apps/support/app/%28workspace%29/cases/%5Breference%5D/page.tsx#L108-L119) · [Bilagornas länkar](https://github.com/heke99/gridex-web/blob/e4d0718/apps/support/app/%28workspace%29/cases/%5Breference%5D/page.tsx#L154-L165)

<a id="gw129"></a>

### GW129 · P2 · Ansvarigväljaren i Support123 visar bara de första 100 aktiva medarbetarna

**Lokalt.** Den syntetiska personalkatalogen returnerade 100 medarbetare och angav att ytterligare en sida fanns. Ärendevyn visade de 100 namnen och **Ej tilldelat**. Den begärde ingen fortsättningssida och erbjöd inget sätt att söka fram en medarbetare utanför första sidan.

Lägg till sökning eller fortsatt bläddring i ansvarigväljaren. Se till att en redan tilldelad medarbetare visas även när den personen ligger utanför första sidan. [Sidstorleken](https://github.com/heke99/gridex-web/blob/e4d0718/apps/support/app/%28workspace%29/cases/%5Breference%5D/page.tsx#L42-L45) · [Ansvarigväljaren](https://github.com/heke99/gridex-web/blob/e4d0718/apps/support/app/%28workspace%29/cases/%5Breference%5D/page.tsx#L264-L282) · [Befintligt sidstöd i klienten](https://github.com/heke99/gridex-web/blob/e4d0718/lib/staff-api/client.ts#L150-L165)

<a id="gw130"></a>

### GW130 · P1 · OPS kan koppla leverantörsbytets status till ett annat avtal på samma anläggning

**Lokalt.** En syntetisk ansökan för ett avtal saknade en direkt referens till ett leverantörsbyte. OPS hämtade då det senaste bytet för kunden och anläggningen, vilket tillhörde ett annat avtal. Svaret innehöll den begärda ansökans nummer tillsammans med det andra avtalets slutförda byte. Kundens webbvy läser för närvarande fel fält enligt GW06. Kopplingen i OPS behöver därför åtgärdas innan webbens statusvisning kan förlita sig på svaret.

Kräv en verifierad koppling mellan ansökan och bytet, exempelvis en direkt bytesreferens eller en entydig match på avtal och anläggning. Returnera ett uttryckligt tillstånd när kopplingen saknas. Testa två avtal för samma kund och anläggning. [OPS reservuppslag och svar](https://github.com/heke99/gridex-ops-platform/blob/6bcfdd5957699addc0f842740c1a275bca8f2894/lib/website/switchStatus.ts#L27-L89)

<a id="gw131"></a>

### GW131 · P2 · Kvittots bytesstatus hämtar upp till 100 händelser som den aldrig visar

**Lokalt.** OPS hämtade och returnerade 100 syntetiska händelser för ett leverantörsbyte. Kvittots webbrutt returnerade bara status, rubrik, meddelande, uppdateringstid och uppgift om slutläge. Alla 100 händelser föll bort innan svaret skickades till besökaren. Det extra uppslaget körs varje gång kvittot frågar efter bytesstatus och ett byte finns.

Använd ett kort statussvar för kvittots uppdateringar och hämta händelser där en historik visas. Mät databasfrågor och mängden OPS-data per statusuppdatering. [OPS händelsehämtning](https://github.com/heke99/gridex-ops-platform/blob/6bcfdd5957699addc0f842740c1a275bca8f2894/lib/website/switchStatus.ts#L68-L105) · [Webbens korta svar](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/switch-status/route.ts#L67-L76)

<a id="gw132"></a>

### GW132 · P2 · Fel i OPS webhooklogg kan stoppa kundens teckningsstatus

**Lokalt.** OPS laddade domänhändelser, webhookleveranser och webhookkön för att bygga en sammanställning. Kvittots statussvar i webbläsaren innehåller ingen sådan sammanställning. När endast frågan om webhookleveranser gav ett syntetiskt databasfel avbröt OPS statusberäkningen och webben svarade `503`.

Låt kundens statusuppdatering använda ett svar med de uppgifter kvittot behöver. Behåll webhookdiagnostiken för de interna flöden som använder den och testa att ett isolerat diagnostikfel lämnar kundens status tillgänglig. [OPS hämtning av domänhändelser](https://github.com/heke99/gridex-ops-platform/blob/6bcfdd5957699addc0f842740c1a275bca8f2894/lib/website/customerApplicationStatus.ts#L345-L361) · [Webhookfrågorna](https://github.com/heke99/gridex-ops-platform/blob/6bcfdd5957699addc0f842740c1a275bca8f2894/lib/website/customerApplicationStatus.ts#L369-L402) · [Urvalet i webbklienten](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/client/website.ts#L603-L619) · [Webbruttens svar och felhantering](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/applications/%5BapplicationId%5D/route.ts#L63-L73)

<a id="gw133"></a>

### GW133 · P2 · Kunden väntar på en revisionsskrivning även när statusen är oförändrad

**Lokalt.** Två hämtningar med samma OPS-status gjorde varsin uppdatering av teckningsposten i Supabase. När den efterföljande revisionsskrivningen simulerades med 250 ms väntan och sedan ett fel tog statussvaret cirka 253 ms. Routen loggade skrivfelet och svarade `200` med den redan tillgängliga statusen.

Skriv status när en ny källversion har tillkommit enligt GW45. Pröva beständig synk utanför kundens väntetid där revisionskraven tillåter det. Följ upp andelen statusanrop som skriver i databasen och hur ett isolerat skrivfel påverkar tiden till svar. [Statusrutten och dess skrivning](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/applications/%5BapplicationId%5D/route.ts#L47-L65) · [Databasuppdateringen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/submissionStore.ts#L298-L327)

<a id="gw134"></a>

### GW134 · P2 · Kvittots statuskort försöker igen tidigare än servern anger

**Lokalt.** Båda statuskorten fick `429` med `Retry-After: 240`. De schemalade nästa anrop efter 120 sekunder. Servern uppger hur länge klienten behöver vänta, medan båda korten använder sin egen intervallberäkning utan att läsa svarets väntetid.

Respektera `Retry-After` när fältet finns och använd den egna återförsöksfördröjningen som reserv. Testa både att nästa anrop aldrig sker före serverns angivna tid och att korten återhämtar sig efter fel utan väntetidsfält. [Serverns väntetid](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/applications/%5BapplicationId%5D/route.ts#L25-L46) · [Teckningskortets timer](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/ApplicationStatusCard.tsx#L34-L62) · [Byteskortets timer](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/SwitchStatusCard.tsx#L34-L61)

<a id="gw135"></a>

### GW135 · P2 · Kvittots status uppdateras först när en gammal timer löper ut efter att fliken blivit synlig

**Lokalt.** När kvittots flik var dold planerade båda statuskorten en ny kontroll efter 60 sekunder. Att göra fliken synlig startade inget statusanrop. Båda korten hämtade först när testet lät den kvarvarande timern löpa ut. Samma timers används när webbläsaren saknar anslutning.

Låt ett synlighets- eller onlinebesked starta en aktuell kontroll när uppgiften behöver förnyas. Samordna händelsen med den befintliga timern och respektera den tid servern har angett för återförsök. [Teckningskortets synlighetskontroll](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/ApplicationStatusCard.tsx#L34-L66) · [Byteskortets synlighetskontroll](https://github.com/heke99/gridex-web/blob/e4d0718/components/signup/SwitchStatusCard.tsx#L34-L67)

<a id="gw136"></a>

### GW136 · P1 · Prisimportens databasschema avvisar ett negativt månadssnitt

**Lokalt.** Importen beräknade ett negativt månadssnitt från 2 688 syntetiska kvartspriser över en komplett februari. När resultatet skulle sparas avvisade Postgres raden. Projektets migration kräver `avg_spot_ore >= 0`. Testet körde det verkliga tabellschemat i en lokal PGlite-databas. Det aktiva schemat i produktion kontrollerades inte i denna omgång.

Tillåt ändliga negativa månadssnitt i prisunderlaget och kontrollera att de bevaras genom hela importen och efterföljande läsning. Testa noll, negativa snitt och kompletta perioder tillsammans med täckningskontrollen i GW12. [Importens beräkning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/integrations/spotMarket.ts#L151-L160) · [Databaskravet](https://github.com/heke99/gridex-web/blob/e4d0718/supabase/migrations/20260602010000_market_price_and_invoice_integrations.sql#L6-L17)

<a id="gw137"></a>

### GW137 · P2 · Prisimportens standardperiod byts senare än den svenska kalendermånaden

**Lokalt.** Klockan 00.30 svensk tid den 1 januari 2027 valde importens standardfunktion november 2026. Samma tidpunkt gav december 2026 i webbens befintliga hjälpfunktion för svensk marknadstid. Importen använder UTC när år och månad utelämnas. Den ordinarie schemakörningen klockan 06.00 UTC infaller efter skillnaden vid månadsskiftet. Manuella körningar utan period kan påverkas närmast efter midnatt.

Använd samma marknadskalender för prisimporten och den övriga prisvisningen. Testa månads- och årsskiften för både svensk normal- och sommartid. [Importens standardmånad](https://github.com/heke99/gridex-web/blob/e4d0718/lib/integrations/spotMarket.ts#L71-L77) · [Tillämpning av standardperiod](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/integrations/spot-prices/import/route.ts#L17-L33) · [Svensk månadskalender](https://github.com/heke99/gridex-web/blob/e4d0718/lib/gridex/pricing/validators.ts#L27-L55) · [Schemat](https://github.com/heke99/gridex-web/blob/e4d0718/vercel.json#L14-L18)

<a id="gw138"></a>

### GW138 · P2 · Prisimporten gör upp till 124 källanrop i följd utan egen tidsgräns per anrop

**Lokalt.** När importen hämtade en månad på 31 dagar för alla fyra elområden gjorde den 124 anrop med som mest ett anrop i gång. Inget anrop fick en avbrottssignal. Med 8 ms simulerad väntan per källsvar tog körningen cirka 1,05 sekunder. Routens konfigurerade maxlängd är 60 sekunder. En genomsnittlig svarstid runt en halv sekund skulle överskrida den gränsen redan före lagring.

Återanvänd den striktare dagsinläsningen med begränsad parallellitet och en tidsgräns per källanrop. Testa en komplett import och att en långsam priskälla kan avbrytas utan att importen fastnar till plattformens tidsgräns. [Källanropet](https://github.com/heke99/gridex-web/blob/e4d0718/lib/integrations/spotMarket.ts#L98-L118) · [Sekventiell hämtning per dag](https://github.com/heke99/gridex-web/blob/e4d0718/lib/integrations/spotMarket.ts#L129-L140) · [Sekventiell hämtning per område](https://github.com/heke99/gridex-web/blob/e4d0718/lib/integrations/spotMarket.ts#L195-L216) · [Routens maxlängd](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/integrations/spot-prices/import/route.ts#L9-L15)

<a id="gw139"></a>

### GW139 · P2 · Misslyckad publicering lämnar importerade spotpriser kvar utan synkpost

**Lokalt.** En körning hämtade SE3 och begärde publicering av en period som saknade övriga områden. Den riktiga publiceringsfunktionen i den lokala databasen avvisade försöket eftersom alla fyra områden krävs. Testet läste därefter tillbaka den sparade SE3-raden på 74 öre/kWh. Ingen synkpost skapades eftersom körningen avbröts innan loggningen.

Gör import och publicering atomiska när API:t ska behandla dem som ett steg. Om importen ska sparas vid ett publiceringsfel behöver svaret och synkloggen redovisa båda utfallen så att ett återförsök kan fortsätta från rätt steg. [Skrivordningen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/integrations/spotMarket.ts#L218-L262) · [Publiceringskontrollen](https://github.com/heke99/gridex-web/blob/e4d0718/supabase/migrations/20260602010000_market_price_and_invoice_integrations.sql#L65-L93)

<a id="gw140"></a>

### GW140 · P1 · Fakturaimporten kan flytta en befintlig faktura till en annan kundprofil

**Lokalt.** När två giltiga kundreferenser i ett syntetiskt importunderlag pekade på olika profiler valde importen den första träffen. Den uppdaterade även den valda profilen med uppgifter från den andra profilen. Vid omsändning av en redan sparad faktura ändrade upserten fakturans tillhörighet. Testet gäller webbens lokala importväg.

Kräv att angivna kundreferenser är förenliga före varje skrivning. Bevara ägarskapet för en befintlig fakturareferens och hantera ändrad tillhörighet som ett särskilt verifierat ärende. Testa motstridiga referenser och ett försök att ändra en redan kopplad faktura. [Kundmatchning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/integrations/invoices.ts#L119-L166) · [Profiluppdatering](https://github.com/heke99/gridex-web/blob/e4d0718/lib/integrations/invoices.ts#L184-L210) · [Fakturans ägarskap och upsert](https://github.com/heke99/gridex-web/blob/e4d0718/lib/integrations/invoices.ts#L342-L373)

<a id="gw141"></a>

### GW141 · P1 · En ofullständig omsändning skriver över betalstatus och fakturaunderlag

**Lokalt.** En syntetisk betald faktura i EUR importerades på nytt med korrekta belopp men utan tidigare valfria uppgifter. Samma fakturapost ändrades till `issued` och SEK. Betalningsdatum, förfallodatum, PDF-länk, OCR och fakturarader försvann. Importen sätter standardvärden eller tomma värden för uteblivna uppgifter även när fakturan redan finns.

Precisera vilka fält som krävs för en fullständig omsändning och vilka uppdateringar som får utelämna dem. Bevara tidigare uppgifter för utelämnade fält och kräv ett uttryckligt besked för rensning eller ändrad betalstatus. [Datumen som skrivs](https://github.com/heke99/gridex-web/blob/e4d0718/lib/integrations/invoices.ts#L304-L321) · [Standardvärden och upsert](https://github.com/heke99/gridex-web/blob/e4d0718/lib/integrations/invoices.ts#L350-L373)

<a id="gw142"></a>

### GW142 · P2 · Identiska fakturaomsändningar upprepar skrivningar och skapar dubbla synkposter

**Lokalt.** Två identiska importer gav samma faktura-ID och två olika synk-ID:n med samma idempotensnyckel. Varje import gjorde fyra databasoperationer i testet, inklusive en profiluppdatering och en ny synkpost. Syntaxen för synkposten är en vanlig insättning. Migrationen anger inget unikhetskrav för dess idempotensnyckel.

Upptäck en identisk omsändning före muterande arbete och återanvänd det lagrade utfallet. Skilj på identiska försök och en ny giltig fakturaversion och säkerställ att samtidiga identiska anrop kan samordnas. [Nyckeln och fakturans skrivningar](https://github.com/heke99/gridex-web/blob/e4d0718/lib/integrations/invoices.ts#L304-L321) · [Synkpostens insättning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/integrations/invoices.ts#L256-L289) · [Synktabellens schema](https://github.com/heke99/gridex-web/blob/e4d0718/supabase/migrations/20260306_customer_portal_enterprise.sql#L131-L149)

<a id="gw143"></a>

### GW143 · P2 · Notismatchningen gör upp till 400 profiluppslag per batch

**Lokalt.** En batch med 100 syntetiska notiser för samma kund körde 400 profiluppslag, 100 notisuppdateringar och ett uppslag för hela batchen. De fyra kontrollerna för varje notis startade parallellt, men jobbet gjorde om samma uppslag för varje notis och väntade på den föregående notisens uppdatering innan nästa började.

Återanvänd varje unikt profiluppslag i samma batch eller slå upp referenserna samlat. Behåll kontrollen för motstridiga och tvetydiga identiteter och mät antal databasoperationer för batcher med både många och få unika kunder. [Profiluppslaget](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/internal/customer-portal/notifications/reconcile/route.ts#L30-L45) · [Batchens urval och matchning](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/internal/customer-portal/notifications/reconcile/route.ts#L68-L105)

<a id="gw144"></a>

### GW144 · P2 · Ett profilfel kan hindra senare notiser från att matchas

**Lokalt.** När ett profiluppslag för den första notisen gav ett isolerat databasfel avbröts den schemalagda rutten. Profiluppslagen för nästa notis startade aldrig. Den första notisen hade ingen sparad uppdatering av nästa försökstid och är därför fortfarande valbar vid nästa körning. Om felet upprepas kan den fortsätta hindra senare notiser.

Spara återförsök för den enskilda notisen efter ett isolerat fel och fortsätt med övriga notiser. Redovisa delvis lyckad behandling per batch och behåll en tydlig markering när en störning gäller hela databasen. [Profiluppslagets felhantering](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/internal/customer-portal/notifications/reconcile/route.ts#L30-L45) · [Loopen och sparad försökstid](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/internal/customer-portal/notifications/reconcile/route.ts#L82-L143)

<a id="gw145"></a>

### GW145 · P2 · Schemat begränsar supportkvittensjobbet till 24 försök per timme

**Lokalt och kodgranskat.** Av fem väntande syntetiska supportkvittenser behandlade den första körningen fyra. Den femte skickades i testets nästa körning. Schemat kör var tionde minut och rutten tar högst fyra poster per körning. Det ger en övre gräns på 24 behandlade poster per timme för det schemalagda jobbet. Återförsök använder samma kapacitet som nya kvittenser.

Dimensionera jobbfrekvens och batchstorlek efter normal trafik och kötoppar. Mät åldern på den äldsta väntande kvittensen. Pröva begränsad parallellitet med samma idempotensnycklar, låskontroller och leverantörsgränser. [Kvittensjobbets gräns och tidsbudget](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/internal/support/receipts/process/route.ts#L4-L18) · [Leverans per post](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/publicSupportReceipts.ts#L9-L39) · [Körschema](https://github.com/heke99/gridex-web/blob/e4d0718/vercel.json#L34-L38)

<a id="gw146"></a>

### GW146 · P2 · Kundskrivningar kan vänta ytterligare 58 minuter efter sin första återförsökstid

**Lokalt och kodgranskat.** Det första tillfälliga felet gav nästa försökstid två minuter efter körningen. Vercel-konfigurationen startar jobbet en gång i timmen. När testklockan följde schemat kom nästa anrop till OPS 58 minuter efter att posten blivit redo. Fördröjningen gäller när endast det schemalagda jobbet behandlar kön.

Anpassa jobbfrekvensen efter den kortaste avsedda återförsökstiden eller använd beständig schemaläggning per post. Följ tiden från angiven försökstid till faktisk start och respektera väntetider från OPS. [Körschema](https://github.com/heke99/gridex-web/blob/e4d0718/vercel.json#L19-L22) · [Lokal väntetid](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/outbox.ts#L86-L93) · [Val av körklara poster](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/outbox.ts#L250-L257) · [Sparad försökstid](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/outbox.ts#L302-L321)

<a id="gw147"></a>

### GW147 · P2 · Ett köfel döljer utfallet för två andra oberoende jobb

**Lokalt.** Samma rutt startar behandling av kontoaktiveringar, profilanpassningar och avstämning av teckningar. När den simulerade profilkön svarade med fel returnerade rutten direkt `500` utan information om övriga grenar. I Node-testet slutfördes de båda grenarna efter felsvaret. Hur länge arbete fortsätter efter att svaret skickats i produktion är okänt.

Vänta på och redovisa utfallet för varje gren med en egen tidsgräns, eller ge de oberoende köerna separata körningar och statusuppföljning. Testa att fel i en kö fortfarande ger ett verifierbart resultat för de andra. [Den gemensamma rutten](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/internal/customer-portal/onboarding/process/route.ts#L20-L35)

<a id="gw148"></a>

### GW148 · P2 · Kundskrivningskön väntar på rensning av gamla poster för anropsbegränsning

**Lokalt.** Jobbet väntade på en rensning i `distributed_rate_limits` innan det kontrollerade kundskrivningskön. Med 150 ms simulerad tid för rensningen väntade även en tom kö cirka 151 ms. När rensningen gav ett fel fortsatte jobbet utan att redovisa det i körresultatet.

Kör rensningen som separat underhåll och följ upp resultatet där. Låt kundskrivningsjobbet börja direkt med att återta utgångna kölås och hämta körklara poster. [Rensning och köläsning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/outbox.ts#L235-L258)

<a id="gw149"></a>

### GW149 · P2 · Ett klick på ett företagsavtal kan välja ett privatavtal i kalkylatorn

**Lokalt.** Ett syntetiskt avtal för enbart företag hade en fungerande länk från avtalskortet. Länken skickade avtalsreferensen. Teckningssidan skickade rätt referens till kalkylatorn men startade samtidigt i privatläge. Kalkylatorns startlogik ersatte därefter det valda företagsavtalet med det första privatavtalet.

Välj kundtyp utifrån det begärda avtalets tillåtna kundtyper när avtal bara stöder en typ. Be om ett uttryckligt val om den begärda referensen och kundtypen inte kan kombineras. Testa kedjan från avtalskort till första prisförsök för privat- och företagsavtal. [Avtalskortets länk](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/publicContractDisplay.ts#L627-L636) · [Teckningssidans kundtyp](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L1586-L1593) · [Kalkylatorns automatval](https://github.com/heke99/gridex-web/blob/e4d0718/components/ElectricityCalculator.tsx#L458-L462)

<a id="gw150"></a>

### GW150 · P2 · Avtalskatalogen kan märka ett avtal för båda kundtyperna som enbart privat

**Lokalt.** Inläsaren behöll kundtypslistan `["both"]` från ett syntetiskt avtal. Avtalskortet visade ”Gäller: Privatkund”. Webbens gemensamma regel för kundtyp tillåter samma avtal för både privatkunder och företag. Kortet gör en egen översättning där värden som inte matchar en lista över företagsord får privatetikett.

Använd den gemensamma kundtypsregeln även för kortets etikett. Testa kanoniska och äldre kundtypsvärden i både kort och kalkylator. [Katalogens etikett](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/elavtal/page.tsx#L23-L29) · [Inläsning av kundtyper](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/publicContractContract.ts#L536-L543) · [Gemensam regel och etikett](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/customerType.ts#L22-L35)

<a id="gw151"></a>

### GW151 · P2 · Avtalskorten erbjuder fortsatt teckning när webbteckningen är avstängd

**Lokalt.** Med webbteckningen avstängd i testkonfigurationen visade den publika avtalslistan ändå **Räkna pris och teckna** för avtalen. Länken ledde till en teckningssida som meddelade att webbteckningen var avstängd och satte `canSubmit` till `false`. Kortet bedömer avtalets registrerade villkor utan att väga in den övergripande inställningen som teckningssidan använder.

Låt katalogens knappar spegla samma aktiveringsläge. Om prisberäkning ska erbjudas även när avtalssignering är stängd behöver knappen förklara det. Testa båda inställningarna med samma giltiga avtal. [Katalogens teckningslänk](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/elavtal/page.tsx#L89-L105) · [Teckningens aktiveringskontroll](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L564-L568) · [Beskedet på teckningssidan](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L1579-L1593)

<a id="gw152"></a>

### GW152 · P2 · Avtalskatalogen bygger samma pris- och villkorsrader två gånger

**Lokalt.** Vid en rendering av tre syntetiska avtal byggde den riktiga katalogvägen sex visningsunderlag. Feedläsningen kör den fullständiga beräkningen för att avgöra om avtalet får visas. Den lämnar sedan tillbaka avtalet. När kortet renderas byggs samma prisrader, villkorsuppgifter och valideringsresultat igen.

Återanvänd det beräknade visningsunderlaget för korten inom samma laddning eller skilj kontrollen av om avtalet får visas från formateringen. Behåll kontrollerna av giltighet och villkor och mät kostnaden per katalogrendering. [Kontroll i feedläsningen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/publicContractFeed.ts#L238-L255) · [Kortets upprepade beräkning](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/elavtal/page.tsx#L23-L25) · [Underlagets innehåll](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/publicContractDisplay.ts#L600-L638)

<a id="gw153"></a>

### GW153 · P2 · Två avtalsreferenser i samma länk avbryter teckningssidans rendering

**Lokalt.** När frågeparametern för avtalsreferens var en lista med två syntetiska värden kastade teckningssidans verkliga kod `trim is not a function`. Next kan leverera en lista för upprepade parametrar. Sidan antar att värdet är en sträng. Felet inträffade efter att avtalsflödet redan hade hämtats.

Validera frågeparametrarnas form före kataloghämtningen. Visa ett begripligt fel när länken innehåller flera avtalsreferenser och lämna ett tydligt sätt att välja avtal på nytt. [Parametertyp och inläsning](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L79-L86) · [Kataloghämtning och avtalsval](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L517-L551)

<a id="gw154"></a>

### GW154 · P2 · Teckningssidan skickar prisalternativ som webbläsarens kalkylator inte läser

**Lokalt.** Servern skickade hela listan med prisalternativ för samtliga avtal till teckningskomponenten. Webbläsarens adapter flyttar uppgifterna till ett annat objekt, men visningsfunktionen gav exakt samma resultat när alternativen utelämnades i testet. För tre syntetiska avtal minskade den serialiserade JSON-storleken från 11 365 till 9 634 byte, cirka 15 procent av avtalslistans data i testet. Prisalternativen används i serverns offertkedja.

Begränsa teckningssidans avtalsdata till fälten som webbläsaren faktiskt behöver. Behåll prisalternativ i serverns offertval och kör tester för prisvisning och teckning efter att datan har minskats. [Serverns avtalsdata](https://github.com/heke99/gridex-web/blob/e4d0718/app/%28public%29/teckna-avtal/page.tsx#L111-L147) · [Webbläsarens adapter](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/signupContractOption.ts#L71-L101) · [Serverns prisval](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/quote/route.ts#L151-L178)

<a id="gw155"></a>

### GW155 · P2 · Vanlig kundinloggning väntar på administrativa behörighetskontroller

**Lokalt.** Inloggning med `/dashboard/invoices` som mål anropade både behörighetsfunktionen och rolltabellen. De två anropen körs parallellt och omdirigeringen väntar på båda. Med simulerade svarstider på 170 respektive 100 ms tog testet 171 ms. Resultatet används för administrativa mål och för att kunna skicka administratörer från exakt `/dashboard` till `/admin`.

Gör behörighetsanropen när målet behöver dem. Behåll administratörskontrollerna, den befintliga omdirigeringen från `/dashboard` och verifieringen av kundsessionen. [Behörighetsanrop](https://github.com/heke99/gridex-web/blob/e4d0718/app/login/actions.ts#L59-L76) · [Val av mål](https://github.com/heke99/gridex-web/blob/e4d0718/app/login/actions.ts#L120-L129)

<a id="gw156"></a>

### GW156 · P2 · Inloggningen väntar på revisionsloggen innan portalens återupptagning börjar

**Lokalt.** Inloggningens logganrop väntas in även när det slutar med ett fel som hanteras. Först därefter kan portalkopplingen återupptas. Med ett simulerat loggfel efter 180 ms och 80 ms i portalsteget kom omdirigeringen efter 260 ms.

Kontrollera om loggningen och portalkopplingen kan starta samtidigt. Behåll kopplingen mellan logghändelsen och den verifierade kunden och följ upp loggfel. [Sekventiella anrop](https://github.com/heke99/gridex-web/blob/e4d0718/app/login/actions.ts#L98-L118)

<a id="gw157"></a>

### GW157 · P2 · Tillfälligt verifieringsfel efter godkänt lösenord tappar kundens målsida

**Lokalt.** `signInWithPassword` lyckades. När efterföljande `getUser` fick ett simulerat 503-svar anropades `signOut` och kunden skickades tillbaka till inloggningen utan `next=/dashboard/invoices`. Ett nytt försök från den sidan behåller därför inte vägen till fakturorna.

Behåll den validerade returvägen vid verifieringsfel och uppmana kunden att försöka igen vid ett tillfälligt fel. Kräv verifierad session innan kunddata visas. [Validerad returväg](https://github.com/heke99/gridex-web/blob/e4d0718/app/login/actions.ts#L25-L33) · [Verifiering och felomdirigering](https://github.com/heke99/gridex-web/blob/e4d0718/app/login/actions.ts#L38-L57)

<a id="gw158"></a>

### GW158 · P2 · Auth-avbrott visas som fel e-post eller lösenord

**Lokalt.** Ett simulerat 503-svar från `signInWithPassword` gav kunden ”Fel e-post eller lösenord”. Kunden kan tolka avbrottet som att lösenordet måste återställas. Returvägen fanns kvar i detta fall.

Ge tillfälliga tjänstefel ett eget meddelande med möjlighet att försöka igen. Ge samma svar för ogiltiga inloggningsuppgifter oavsett om kontot finns. [Hantering av lösenordsinloggningens felsvar](https://github.com/heke99/gridex-web/blob/e4d0718/app/login/actions.ts#L36-L47)

<a id="gw159"></a>

### GW159 · P2 · En verifierad återställningslänk väntar på portaljobb före lösenordsformuläret

**Lokalt.** Efter simulerad verifiering av en återställningslänk hämtades användaren, profilen synkroniserades och portalkopplingen återupptogs. De två portalstegen kördes i följd före omdirigeringen till lösenordsformuläret. Med simulerade fördröjningar på 120 och 150 ms tog flödet 273 ms.

Låt återställningsflödet fortsätta till formuläret när återställningssessionen är verifierad. Utför portalarbetet där det behövs för kundens konto och behåll återförsök för väntande arbete. [Mål för återställning](https://github.com/heke99/gridex-web/blob/e4d0718/app/auth/confirm/route.ts#L15-L26) · [Verifiering och portaljobb](https://github.com/heke99/gridex-web/blob/e4d0718/app/auth/confirm/route.ts#L41-L87)

<a id="gw160"></a>

### GW160 · P2 · Glömt lösenord bryter vägen tillbaka till fakturorna

**Lokalt och kodgranskat.** Det renderade inloggningsformuläret behöll `/dashboard/invoices` som returväg medan länken ”Glömt lösenord” saknade den. Koden för återställningsmejlet väljer en fast väg till lösenordsformuläret. Efter lösenordsbytet väljer formuläret en fast väg tillbaka till inloggningen.

För den validerade interna returvägen genom återställningsflödet och använd den efter efterföljande inloggning. [Länk för glömt lösenord](https://github.com/heke99/gridex-web/blob/e4d0718/app/login/page.tsx#L156-L171) · [Mål för återställningsmejlet](https://github.com/heke99/gridex-web/blob/e4d0718/app/login/forgot-password/page.tsx#L58-L66) · [Omdirigering efter lösenordsbyte](https://github.com/heke99/gridex-web/blob/e4d0718/app/login/reset-password/page.tsx#L93-L107)

<a id="gw161"></a>

### GW161 · P2 · Teckningsklienten tappar serverns förklaring vid API-fel

**Lokalt.** Adressklienten fick ett strukturerat 400-svar med ett användarmeddelande under `error.message`. Den visade i stället ”Kunde inte kontrollera elområde just nu.” Den gemensamma klienten läser äldre svar med en sträng i `error`, medan den gemensamma API-gränsen skickar ett objekt där.

Läs det strukturerade felmeddelandet och behåll stöd för äldre svar. Behåll också felkod och begäran-id där klienten eller supporten behöver dem. [Klientens felhantering](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/publicApi.ts#L229-L255) · [Webb-API:ts felformat](https://github.com/heke99/gridex-web/blob/e4d0718/lib/api/webBoundary.ts#L28-L49)

<a id="gw162"></a>

### GW162 · P2 · HTTP 200 utan offert passerar teckningsklientens kontroll

**Lokalt.** Ett simulerat 200-svar med JSON-värdet `null` gjorde att `previewWebsitePricing` returnerade `null` som om det vore ett giltigt prisunderlag. Klienten kontrollerar statusen och gör en typkonvertering utan att kontrollera svarets form. Därmed flyttas felet till senare kod som förväntar sig en offert.

Kontrollera att ett lyckat svar innehåller obligatoriska offertfält där svaret tas emot. Ge ett kontrollerat fel när svaret saknas eller har fel format. [Läsning av API-svaret](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/publicApi.ts#L253-L265) · [Klientens offertsvar](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/publicApi.ts#L294-L309)

<a id="gw163"></a>

### GW163 · P2 · OPS-klienten lämnar olästa felsvar öppna

**Lokalt.** Vid ett simulerat HTML-svar med 503 avvisade OPS-klienten anropet utan att läsa eller avbryta svarskroppen. Testströmmen fick inget avbrott. Anropets tidsgräns städades samtidigt bort. Det kan hålla nätverksresurser upptagna längre vid fel i en proxy eller beroende tjänst.

Avbryt svarskroppen i de grenar där transporten ignorerar den. Behåll befintliga gränser för lästa svar och kontrollera att avbrottet fungerar även när svaret tar tid. [Hantering av innehållsformat och felsvar](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/transport.ts#L295-L354) · [Städning av tidsgräns](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/transport.ts#L359-L371)

<a id="gw164"></a>

### GW164 · P2 · Ett långsamt OPS-felsvar kan förvandla 429 till 504

**Lokalt.** OPS skickade i testet omedelbart status 429 och `Retry-After: 120`. När JSON-kroppen uteblev tog anropet ungefär en sekund med testets satta tidsgräns och avslutades som 504. Webbservern förlorade därmed uppgiften om när nästa försök tidigast bör göras.

Använd kända status- och svarshuvuden för anropsbegränsningen även om kroppen inte kan läsas färdigt. Begränsa tiden för att läsa kompletterande felinformation. [Mottagen status](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/transport.ts#L272-L279) · [Kroppsläsning, tidsgräns och återförsök](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/transport.ts#L314-L354)

<a id="gw165"></a>

### GW165 · P2 · Marknadsprisets API tappar väntetid och begäran-id från OPS

**Lokalt.** Ett fullständigt OPS-fel med status 429, begäran-id och 120 sekunders väntetid kom ut från webb-API:t som 429 med felkod och text. Svaret saknade både `Retry-After` och begäran-id. Klienten får ingen anvisning om väntetid, och supporten tappar en uppgift som kan koppla ihop svaret med OPS-loggen.

För vidare tillåten väntetid och begäran-id i det gemensamma felformatet. Använd samma kontrakt för lokala och vidarebefordrade 429-svar. [Webbens marknadsprisrutt](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/web/market-price/current/route.ts#L18-L27) · [Hantering av OPS-fel](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/web/market-price/current/route.ts#L49-L62)

<a id="gw166"></a>

### GW166 · P2 · Avbrott i den delade anropsbegränsningen visas som uppnådd kvot

**Lokalt och kodgranskat.** Marknadsprisrutten fick ett simulerat resultat med `source: 'unavailable'` och blockerade anropet med 429 och koden `rate_limited`. Den verkliga Supabase-baserade begränsaren använder detta tillstånd i produktion när konfiguration saknas eller RPC-anropet misslyckas. Då kan kundens första anrop se ut som för många anrop. Synkrutten för Mina sidor visar redan 503 vid samma beroendefel.

Använd 503 för otillgänglig begränsning och 429 när kundens kvot nåtts. Behåll blockeringen i båda fallen. [Begränsarens felhantering](https://github.com/heke99/gridex-web/blob/e4d0718/lib/security/rateLimit.ts#L73-L124) · [Marknadsprisruttens kvotsvar](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/web/market-price/current/route.ts#L18-L27) · [Mina sidors svar](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/web/customer-portal/sync/route.ts#L27-L38)

<a id="gw167"></a>

### GW167 · P2 · Portföljpriser väntar på en ovillkorlig hämtning av hela avtalskatalogen

**Lokalt och kodgranskat.** Två likadana anrop som nådde webbrutten hämtade först katalogen och därefter portföljpriset. Rutten väljer `forceFresh`, som avstår från katalogens ETag. Svaret för portföljpriser kan cachelagras, men varje anrop som når servern betalar för den sekventiella katalogkontrollen.

Använd en validerad villkorlig kataloghämtning eller en riktad kontroll i OPS. Behåll kontrollen av aktuellt erbjudande och elområde. Mät överförda katalogbyte och tid till portföljpris för anrop som når servern. [Portföljprisrutten](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/web/portfolio-prices/route.ts#L37-L65) · [Villkorligt kataloganrop](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/client/website.ts#L874-L918) · [Val av färsk katalog](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/client/website.ts#L1199-L1203)

<a id="gw168"></a>

### GW168 · P2 · Avbruten adresskontroll kan fortsätta från webbservern till OPS

**Kodgranskning.** När adressen ändras kan kalkylatorn avbryta sin begäran. Webbrutten skickar ingen avbrottssignal vidare till OPS-klienten. Transporten har stöd för en anropssignal, men adresskontrollen anropar den utan en sådan. Arbetet kan därför fortsätta trots att webbläsaren redan har lämnat begäran.

Förmedla avbrottssignalen till den separata OPS-begäran och kontrollera signalen före nya steg. Mät hur många ersatta adresskontroller som når OPS och om driftsplattformen förmedlar klientens avbrott. [Kalkylatorns avbrott](https://github.com/heke99/gridex-web/blob/e4d0718/lib/website/energyAreaLookup.ts#L38-L59) · [Webbruttens anrop](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/energy-area/resolve/route.ts#L99-L112) · [OPS-klientens anrop](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/client/website.ts#L182-L187) · [Transportens avbrottssignal](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/transport.ts#L244-L254)

<a id="gw169"></a>

### GW169 · P2 · Godkännandesidan väntar på supportärenden och bearbetar oanvända mätvärden

**Lokalt.** Sidan ”Godkännanden och fullmakt” använder godkännanden och fullmakter. Den anropar den gemensamma översikten som hämtar hela kundpaketet och begär upp till 50 supportärenden. I testet kunde sidan inte renderas förrän supportanropet släpptes, trots att godkännandena redan fanns. Servern bearbetade också 400 syntetiska mätvärden som sidan aldrig renderade.

Hämta godkännanden och fullmakter parallellt med samma verifierade kundidentitet. Återanvänd kundsessionen och profiluppslaget inom sidans begäran. Följ antal lästa sektioner, svarens storlek och tiden tills godkännandena visas. [Sidan](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/approvals/page.tsx#L21-L42) · [Fullmaktslistan](https://github.com/heke99/gridex-web/blob/e4d0718/app/dashboard/approvals/page.tsx#L65-L91) · [Hämtning av kundpaket och supportärenden](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L750-L763) · [Bearbetning av mätvärden](https://github.com/heke99/gridex-web/blob/e4d0718/lib/customerPortal/service.ts#L793-L808)

<a id="gw170"></a>

### GW170 · P2 · En saknad avtalsreferens väntar på ett databasanrop innan juridik-API:t ger 400

**Lokalt.** Juridikrutten inväntade anropsbegränsningen innan den kontrollerade att erbjudandereferensen fanns. Testets begäran saknade referens och fick 400 efter 92 ms när begränsaren fördröjdes med 85 ms. Den delade begränsaren gör normalt ett Supabase-RPC-anrop.

Kontrollera obligatoriska och längdbegränsade frågeparametrar före den delade databasbegränsaren där det fungerar med skyddet för rutten. Behåll begränsningen före OPS-anropet. [Valideringens ordning](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/checkout/legal-bundle/route.ts#L9-L35) · [Databasanrop för kvoten](https://github.com/heke99/gridex-web/blob/e4d0718/lib/security/rateLimit.ts#L90-L108)

<a id="gw171"></a>

### GW171 · P2 · Beredskapskontrollen hämtar integrationskontext och avtalskatalog två gånger

**Lokalt.** En enda kontroll av webbens OPS-beredskap anropade integrationskontexten två gånger med tvingad omhämtning. Den anropade den ovillkorliga hämtningen av hela avtalskatalogen två gånger. En kataloghämtning kontrollerar katalogen. Den andra tar fram det första erbjudandets referens för juridikkontrollen. Den senare kontrollen kan återanvända katalogresultatet från samma körning.

Dela resultatet från en färsk kontexthämtning och en kataloghämtning inom körningen. Behåll resultat per kontroll så att ett katalogfel också framgår som uteblivet underlag för juridikkontrollen. [Kontrollernas definitioner](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/readiness.ts#L188-L222) · [Första kontexthämtningen](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/readiness.ts#L296-L314) · [Tvingad omhämtning](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/client/core.ts#L1543-L1569)

<a id="gw172"></a>

### GW172 · P2 · Kundportalens beredskapskontroll väntar i onödan mellan två grupper av OPS-anrop

**Lokalt.** Alla supportkontroller avslutades innan första kontrollen av kundportalen startade. Kundportalens kontroller använder inga resultat från supportkontrollerna. Med simulerade fördröjningar på 55 ms för kontexten, 110 ms för supportgruppen och 90 ms för kundportalgruppen tog kontrollen 263 ms.

Låt grupperna överlappa inom en gemensam gräns för samtidiga OPS-anrop. Följ både total körtid och antal 429-svar för att säkerställa att kortare väntan inte ökar överbelastningen. [Kontext och kontroller](https://github.com/heke99/gridex-web/blob/e4d0718/lib/ops/portalReadiness.ts#L136-L175)

<a id="gw173"></a>

### GW173 · P2 · Avtalsexporten kan ge en ofullständig CSV med HTTP 200

**Lokalt.** Med 5 001 syntetiska avtal gav API:t 200 och en CSV med 5 000 avtal. Svaret saknade fortsättning och uppgift om att fler rader fanns. Sorteringen använder enbart skapelsetid, vilket också skulle göra en framtida sidindelning instabil för rader med samma tidsstämpel utan ytterligare sorteringsfält.

Gör exportgränsen synlig eller hämta hela det valda intervallet i avgränsade sidor med stabil sortering på skapelsetid och id. Verifiera gränsfallet med fler rader än en sida och flera rader med samma tidsstämpel. [Databasfråga och CSV-svar](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/admin/agreements/export/route.ts#L40-L68) · [Exportlänken](https://github.com/heke99/gridex-web/blob/e4d0718/app/admin/agreements/page.tsx#L126-L140)

<a id="gw174"></a>

### GW174 · P2 · Avtalsexporten överför alla databasfält och byter kolumner när resultatet är tomt

**Lokalt.** Exporten använde `select('*')` och skapade CSV-rubriken från första raden. När resultatet var tomt använde den en fast rubrik med fem kolumner. I testet följde en syntetisk intern kolumn på 1 000 tecken per avtal automatiskt med. För 5 000 syntetiska rader blev CSV:n 5 227 868 byte. Samma rader begränsade till de fem kolumnerna i det tomma svaret blev 212 842 byte.

Definiera ett uttryckligt exportkontrakt med de kolumner användarna behöver och hämta endast dessa från databasen. Använd samma rubrik även utan rader. Mät storleken med representativa rader i en testmiljö. [CSV-kolumner och serialisering](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/admin/agreements/export/route.ts#L9-L36) · [Databasens kolumnval](https://github.com/heke99/gridex-web/blob/e4d0718/app/api/admin/agreements/export/route.ts#L46-L50)

## Kompletterande fynd från bilagan

Bilagan granskade Gridex Web på `e4d0718` och OPS på `565ceb9` där OPS ingick i verifieringen. F140–F169 behåller bilagans fynd-ID, prioritet, observationer och åtgärdsordning. Hänvisningar i bilagan till F3, F9 och F29 avser tidigare avsnitt som inte ingick i utdraget.

### Mätvärden och förbruknings-API

För F135–F139 finns åtgärdsförslagen i utdraget. Underliggande fyndtexter och mätresultat saknas för dessa fem ID.

| ID | Åtgärd från utdraget |
| --- | --- |
| <a id="f135"></a>F135 | För vidare inkommande avbrott till Webs OPS-anrop och kontrollera signalen före varje ny sida. Behåll tidsgränser och åtkomstkontroller. |
| <a id="f136"></a>F136 | För vidare OPS-signalen till databastransporten där den stöds. Starta inga nya frågor för en begäran som redan har avbrutits. |
| <a id="f137"></a>F137 | Återanvänd nyligen verifierade resultat för samma kund, anläggning och period. Definiera hur färskhet och mätvärdesrevisioner styr återanvändningen. |
| <a id="f138"></a>F138 | Ge diagrammet ett kompakt svar med dagssummor. Bevara svensk dygnsgräns, leveransrätt och information om fullständighet. |
| <a id="f139"></a>F139 | Tolka periodgränserna en gång och varje intervallgräns en gång per rad. Behåll kontroller för ogiltiga intervall, mätserier och överlappande revisioner. |

### Mobilens profiländringar och notiser

Gridex Webs lokala träd motsvarade `origin/main` på `e4d071805240fb5fa4c2e517cd17d33c4a1b7dea`. OPS granskades på `565ceb9fe05897fa03dcbe865f9f0d4be87ad395`. Proven körde den verkliga OPS-rutten för notiser, OPS mekanism för idempotenta skrivningar och mobilens kontohook. Databas, Auth- och nätverkssvar simulerades. Profilkonflikten injicerades vid skrivningen. Den verkliga profilrutten granskades för motsvarande felkod. **89 befintliga tester och sex riktade prov passerade.** Produktionslatens och databasens frågeplan mättes ej.

| ID | Prioritet | Verifiering | Resultat och konsekvens |
| --- | --- | --- | --- |
| <a id="f140"></a>F140 | Medel för stora notishistoriker | Verklig OPS-rutt med 5 500 syntetiska notiser | För att hitta en notis sist i sorteringsordningen läste OPS **sex databassidor och 5 500 rad-ID:n**. Den räknar om de publika referenserna i koden och jämför dem med de begärda referenserna. Detta sker före skrivningen och är skilt från Webs efterföljande kontrolläsning i F9. [OPS uppslag av publika notisreferenser](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/app/api/v1/customer/notifications/read/route.ts#L54) |
| <a id="f141"></a>F141 | Medel för korrekta lästider | Verklig OPS-rutt med två olika försök för samma notis | Ett upprepat anrop med samma försöksnyckel återgav föregående resultat. Med en ny nyckel skrev OPS över `read_at` och `updated_at` på den redan lästa notisen. Det gav två verksamhetsskrivningar utan ytterligare statusändring och ersatte den första lästiden. Det kan uppstå när två klienter agerar utifrån samma äldre, olästa vy. [OPS uppdatering av lästid](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/app/api/v1/customer/notifications/read/route.ts#L110) |
| <a id="f142"></a>F142 | Medel för profilvyn efter sparning | Verklig mobilhook med bekräftad sparning och separat läsning | Appen bekräftade sparningen men behöll det gamla telefonnumret i profilraden. Det nya numret syntes i raden först efter en manuell omläsning, som gav ytterligare ett profil-GET. Telefonfältet visar samtidigt kundens inskrivna värde. [Ändringens returvärde](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/apps/mobile/src/useCustomerAccount.ts#L222) · [Bekräftelsen i telefonfältet](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/apps/mobile/src/PhoneEditor.tsx#L13) · [Profilradens fält](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/apps/mobile/src/CustomerExtraPanel.tsx#L6) |
| <a id="f143"></a>F143 | Medel vid osäker skrivning | Verklig mobilhook med simulerat 503 på support och lyckad telefonändring | Efter ett osäkert supportsvar sparade appen försökets nyckel. En telefonändring däremellan ersatte den. Identiskt innehåll i supportens återförsök skickades därmed med **en ny nyckel i samma appsession**. Om det första ärendet redan sparats kan det skapa en dubblett. Provet verifierade nyckelbytet. F3 gäller nyckelförlust vid omstart. [Mobilens gemensamma försöksnyckel](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/apps/mobile/src/useCustomerAccount.ts#L203) |
| <a id="f144"></a>F144 | Medel för profiländringar vid samtidighet | Verklig OPS-mekanism med simulerad versionskonflikt och separat prov av den verkliga mobilhooken | OPS registrerade första försöket som misslyckat efter `profile_version_conflict`. När konflikten var borta fick samma nyckel fortsatt 409 med `idempotency_previous_attempt_failed`. Mobilen använde samma nyckel efter att kunden följt uppmaningen att läsa om profilen och försökt spara samma nummer igen. [OPS profilkonflikt](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/app/api/v1/customer/profile-update/route.ts#L125) · [OPS svar för tidigare misslyckat försök](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/lib/api/strictRequest.ts#L174) · [Mobilens hantering av 409](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/apps/mobile/src/useCustomerAccount.ts#L211) |

#### Åtgärder i prioriterad ordning

1. **F143–F144.** Förvara pågående försöksnycklar per kund och åtgärd. Skilj ett säkert avvisat försök före skrivning från oklar lagringsstatus. När en versionskonflikt har konstaterats behöver kunden kunna hämta den senaste profilen och starta ett nytt försök.
2. **F140–F141.** Ge publika notisreferenser ett indexerat, kund- och bolagsbundet uppslag. Låt en ny begäran för en redan läst notis bevara befintlig lästid. Kontrollera samtidiga anrop och blandade listor av lästa och olästa notiser.
3. **F142.** Uppdatera profilraden från ett verifierat skrivsvar som innehåller det sparade värdet, eller hämta den aktuella raden automatiskt om svaret saknar värdet.

### Supportens ärendelista, tråd och skrivkvitton

Gridex Webs lokala träd motsvarade `origin/main` på `e4d071805240fb5fa4c2e517cd17d33c4a1b7dea`. OPS granskades på `565ceb9fe05897fa03dcbe865f9f0d4be87ad395`. Proven körde verkliga OPS-rutter och Webs mobilrutter med simulerad kundbindning och databas. Mobilens kontohook kördes separat med simulerade HTTP-svar. **39 befintliga tester och sex riktade prov passerade.** Produktionslatens, verklig historikstorlek och andelen äldre ärenden utan sparad referens mättes ej.

| ID | Prioritet | Verifiering | Resultat och konsekvens |
| --- | --- | --- | --- |
| <a id="f145"></a>F145 | Medel till hög vid långa supporttrådar | Verklig mobilrutt och separat körning av båda verkliga OPS-rutterna | Mobilens öppning anropar både ärendedetaljen och meddelanderutten. Båda OPS-svaren innehöll **samma 500 meddelanden** i provet. OPS gjorde två ärendeläsningar och två meddelandeläsningar. Det extra svaret gav 92 493 byte rå JSON. Detta är dubbelarbete för den första sidan. Problemet med fortsättningsmarkören är dokumenterat som F29. [Mobilruttens två parallella läsningar](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/mobile/customerRuntime.ts#L50) · [OPS levererar meddelanden i båda vägarna](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/lib/customer-service/supportApiHandlers.ts#L102) |
| <a id="f146"></a>F146 | Medel efter att ett ärende eller svar skickats | Verkliga mobilskrivrutter och separat prov av kontohooken | OPS skickar tillbaka det skapade ärendet eller meddelandet. Webs mobilrutt svarade i båda fallen enbart med `accepted: true`. Varken det skapade ärendet eller det nya svaret syntes i den öppna vyn efter bekräftelsen. Vardera krävde **ett manuellt omläsningsanrop** i provet. [OPS skrivkvitton](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/lib/customer-service/supportApiHandlers.ts#L82) · [Mobilrutten utelämnar kvittot](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/mobile/supportWriteRuntime.ts#L7) · [Mobilens hantering efter inskick](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/apps/mobile/src/useCustomerAccount.ts#L221) |
| <a id="f147"></a>F147 | Hög för berörda äldre ärenden | Verklig OPS-lista och detaljrutt med 501 syntetiska äldre ärenden | Kunden kunde bläddra fram det äldsta ärendet och se dess publika referens. Det gick ändå inte att öppna. För äldre ärenden utan lagrad publik referens söker detaljen bara bland de **500 senast skapade**. Det äldsta syntetiska ärendet gav därför 404 trots att det gick att lista med samma verifierade kund. [Publik referens beräknas vid listning](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/lib/customer-service/supportConversation.ts#L117) · [Begränsat uppslag av äldre ärenden](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/lib/customer-service/supportConversation.ts#L186) |
| <a id="f148"></a>F148 | Medel för kunder med fler än en sida ärenden | Verklig OPS-lista med 51 syntetiska ärenden och kodspårning av mobilens sortering | Mobilen visar ”Senast uppdaterade först” och sorterar de redan hämtade raderna efter uppdateringstid. OPS delar sidor efter skapandetid. Ett gammalt ärende som hade uppdaterats senast i provet syntes först på sida två. Ett nytt svar i ett äldre ärende kan därför missas när kunden öppnar listan. [OPS sortering och sidmarkör](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/lib/customer-service/supportConversation.ts#L155) · [Mobilens sorteringsbesked](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/apps/mobile/src/CustomerList.tsx#L22) · [Mobilens sortering av hämtade rader](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/apps/mobile/src/listTools.ts#L24) |
| <a id="f149"></a>F149 | Låg | Verklig OPS-detaljrutt efter syntetisk ärendeskapning, mobilrutt och vykod | Öppningstexten förekom både i ärendebeskrivningen och i första meddelandet. Mobilen skickade vidare båda kopiorna och vyn visar båda. För ett nyöppnat ärende kan samma text alltså visas två gånger. Händelsen behöver finnas kvar i trådhistoriken. [OPS sparar öppningstexten i tråden](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/supabase/migrations/20261020160633_customer_support_quota_atomic.sql#L116) · [Mobilens två visningsställen](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/apps/mobile/src/CustomerDetailPanels.tsx#L41) |

#### Åtgärder i prioriterad ordning

1. **F147–F148.** Kontrollera äldre supportärenden som den befintliga migreringen inte omfattade och fyll i saknade publika referenser för listade ärenden. Återanvänd det befintliga referensindexet. Låt sidindelningen motsvara ordningen kunden ser, med stabil sorteringsnyckel vid lika uppdateringstid och kundbundna sidmarkörer.
2. **F145–F146.** Läs första trådsidan via en enda kundbunden OPS-väg. För vidare en verifierad, avgränsad ärende- eller meddelandepost efter skrivning och uppdatera rätt vy från den. Behåll skydden mot dubbletter och återanvändning av data över sessionsgränser.
3. **F149.** Visa öppningstexten en gång i tråden när API:t kan identifiera öppningshändelsen. Behåll beskrivningen för ärenden där den behövs som separat sammanhang.

### Dokumentlistor och fullmakts-PDF

Gridex Webs lokala träd motsvarade `origin/main` på `e4d071805240fb5fa4c2e517cd17d33c4a1b7dea`. OPS granskades på `565ceb9fe05897fa03dcbe865f9f0d4be87ad395`. Databasprovet körde den faktiska migreringens dokumentfunktion i PGlite och tog fram frågeplanen för samma SQL med syntetiska dokument och index. Övriga prov körde Webs sidfunktion, Webs PDF-rutt och transport samt OPS arkivrutter med lokala testdata. **59 befintliga tester och fem riktade prov passerade.** Produktionslatens, verkliga kundvolymer och serverplattformens beteende vid fysisk frånkoppling mättes ej.

| ID | Prioritet | Verifiering | Resultat och konsekvens |
| --- | --- | --- | --- |
| <a id="f150"></a>F150 | Medel till hög för stora dokumentarkiv | Migreringens verkliga SQL i lokal PostgreSQL-miljö | Funktionen samlar och rangordnar dokumenten från båda tabellerna innan sidmarkören tillämpas. Första och andra sidan läste vardera **8 000 rader till rangordningen för 21 returnerade rader**, inklusive raden som används för att avgöra om en fortsättning finns. Kostnaden upprepas vid bläddring trots att kundavgränsningen använder indexerade kolumner. [Rangordning och efterföljande sidfilter](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/supabase/migrations/20260809180628_gridex_ops_external_api_performance_foundation.sql#L135) |
| <a id="f151"></a>F151 | Medel vid bläddring bland fullmakter | Verklig Web-sidfunktion och portaltjänst med simulerade OPS-svar | Första sidan och två arkivfortsättningar hämtade listan över vanliga dokument **tre gånger**. Bara fullmakternas sidmarkör ändrades. Dessutom väntar sidfunktionen på den vanliga listan innan den returnerar sidan med arkivsektionen. [Sidans båda läsvägar](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/app/dashboard/documents/page.tsx#L31) |
| <a id="f152"></a>F152 | Medel för berörda arkivposter | Verkliga OPS-rutter med syntetisk arkivpost utan verifierad ägarhistorik | Listan erbjöd en PDF-länk trots att detaljrutten behövde avvisa länken med 409. Detaljrutten kontrollerade arkivets ägarhistorik innan den försökte hämta filen. Ingen lagringshämtning gjordes i provet. [Listans bedömning av nedladdningslänken](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/lib/customer-portal/poaArchiveRead.ts#L75) · [Detaljens ägarkontroll före hämtning](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/lib/customer-portal/poaArchiveRead.ts#L122) |
| <a id="f153"></a>F153 | Medel vid avbruten nedladdning | Verklig Web-rutt och transport med syntetisk PDF-ström | Det inkommande anropet avbröts när första delen av PDF-filen kom. Webs OPS-signal förblev aktiv och Web läste och verifierade ändå hela filen innan det skapade ett 200-svar. Detta gäller avbrottssignalen som rutten tar emot. [Webs PDF-rutt](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/poaArchiveRoute.ts#L29) · [OPS-anropet från Web](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/ops/client/poaArchive.ts#L54) |
| <a id="f154"></a>F154 | Medel vid stora samtidiga PDF-nedladdningar | Verklig begränsad läsare i Node med en lokal ström på 15 MiB | Web sparar inkommande delar och kopierar dem till en sammanhängande buffert före verifiering. Vid allokeringen fanns ungefär **30 MiB extra ArrayBuffer-minne** i provet för en ström på 15 MiB. Mätningen omfattar den här läsaren, före övrigt arbete i Web och OPS. [Delbuffertar och sammanfogning](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/ops/httpSafety.ts#L32) · [Digestkontroll i transporten](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/ops/transport.ts#L305) |

#### Åtgärder i prioriterad ordning

1. **F150–F151.** Utvärdera en representation där valet av kanoniskt dokument kan indexeras före sidindelningen. Bevara nuvarande deduplicering och ordning över arkivsidor. Ge arkivets fortsättning en egen läsväg så att vanlig dokumentlista kan ligga kvar under bläddringen.
2. **F152.** Låt listans nedladdningsbesked använda tillräcklig information om arkivets verifierade ägarhistorik. Behåll den aktuella kontrollen vid öppning.
3. **F153–F154.** Koppla inkommande avbrott till OPS-transporten. Minska de tillfälliga kopiorna i den begränsade PDF-läsaren med bibehållen kontroll av storlek, dokumentreferens och exakt digest före utlämning.

### Flyttanmälans datum, återförsök och omladdning

Gridex Webs lokala träd motsvarade `origin/main` på `e4d071805240fb5fa4c2e517cd17d33c4a1b7dea`. OPS granskades på `565ceb9fe05897fa03dcbe865f9f0d4be87ad395`. Webprovet körde den verkliga formulärkomponenten och Web-rutten med syntetiska uppgifter och en simulerad OPS-adapter. Databasprovet körde migreringens verkliga PL/pgSQL-funktion i PGlite med ett avgränsat syntetiskt schema. Dygnsbytet simulerades med två databastidszoner. **39 befintliga tester passerade.** Produktionslatens, databasens produktionstidszon och antal förekomster mättes ej.

| ID | Prioritet | Verifiering | Resultat och konsekvens |
| --- | --- | --- | --- |
| <a id="f155"></a>F155 | Medel för felaktiga framtidsdatum | Verklig Web-komponent och Web-rutt, jämförda med körd OPS-funktion | Formuläret har ett minsta datum, men saknar övre datumgräns. Ett datum mer än 730 dagar framåt gick genom Web till OPS-adaptern. I databasprovet accepterade funktionen dag 730 och avvisade dag 731. Kunden kan få ett sent avslag efter ett anrop som går att undvika. [Formulärets datumfält](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/components/customer/CustomerPortalSelfService.tsx#L200) · [OPS datumregel](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/supabase/migrations/20260730153000_customer_portal_api_production_completion.sql#L164) |
| <a id="f156"></a>F156 | Medel för formulär vid uteblivet svar | Verklig komponent med avsiktligt väntande HTTP-svar | Skickaknappen var låst medan anropet väntade. Anropet fick ingen avbrottssignal och formulärets gemensamma skrivhjälp har ingen egen tidsgräns. När det simulerade svaret släpptes återgick knappen. Vid ett fortsatt uteblivet svar måste användaren vänta på att nätverkslagret eller servern avslutar anropet. [Formulärets HTTP-anrop](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/components/customer/CustomerPortalSelfService.tsx#L31) · [Knappens vänteläge](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/components/customer/CustomerPortalSelfService.tsx#L209) |
| <a id="f157"></a>F157 | Medel vid identiska anmälningar från olika försök | Verklig OPS-funktion med samma kund, anläggning, datum och innehåll | Återförsök med samma nyckel återgav tidigare kvitto. Två olika nycklar för samma innehåll gav **två flyttanmälningar, två handläggningsärenden, två händelser och två köposter** i databasen, plus en revisionslogg per anmälan. Web skapar en ny nyckel efter ett bekräftat försök och den lokala nyckeln delas inte mellan oberoende sessioner. [OPS kvittouppslag per försöksnyckel](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/supabase/migrations/20260730153000_customer_portal_api_production_completion.sql#L191) · [Webs nyckelhantering](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/components/customer/CustomerPortalSelfService.tsx#L59) |
| <a id="f158"></a>F158 | Medel för svarstiden i översikten | Verklig formulärkomponent med räknad omladdning, följd genom sidans aktuella läsväg | Vid bekräftad flyttanmälan anropade formuläret `router.refresh()` för hela översikten. Översikten hämtar det ordinarie OPS-portalpaketet och supportlistan. Formuläret använde bara mottagningsbeskedet och tömde datumfältet. Omladdningen återanvänder inte flyttkvittot som OPS redan gav. [Formulärets omladdning](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/components/customer/CustomerPortalSelfService.tsx#L65) · [Översiktens läsning](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/app/dashboard/page.tsx#L54) · [OPS-paket och support](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/service.ts#L750) |
| <a id="f159"></a>F159 | Medel vid återhämtning efter dygnsgräns | Verklig OPS-funktion och simulerat dygnsbyte i lokal databas | Ett försök för dagens datum sparades. När databasdagen hade gått vidare avvisades samma nyckel och datum av datumregeln, innan funktionen läste det redan sparade kvittot. Det gäller återhämtning via själva skrivfunktionen när den yttre HTTP-mekanismen saknar ett färdigt kvitto att återge. [Datumkontrollen före kvittouppslaget](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/supabase/migrations/20260730153000_customer_portal_api_production_completion.sql#L164) · [Det yttre HTTP-kvittot](https://github.com/heke99/gridex-ops-platform/blob/565ceb9fe05897fa03dcbe865f9f0d4be87ad395/lib/api/strictRequest.ts#L308) |

#### Åtgärder i prioriterad ordning

1. **F157 och F159.** Låt ett redan sparat, matchande kvitto överleva förändringar i datumregeln. Besluta hur en ny begäran för samma anläggning och datum ska hanteras när det redan finns en pågående anmälan. Behåll separationen mellan avsiktliga ändringar och identiska återförsök.
2. **F155–F156.** Använd samma datumgränser i formuläret och på servern. Sätt en avgränsad klientväntan och bevara försöksnyckeln om resultatet är osäkert.
3. **F158.** Visa kvittot direkt och uppdatera den del av översikten som påverkas. Mät OPS-anrop vid inskick och eventuell statusuppföljning.

### Inloggning och aktiveringsstatus på Mina sidor

Gridex Webs lokala träd motsvarade `origin/main` på `e4d071805240fb5fa4c2e517cd17d33c4a1b7dea`. Proven körde den verkliga lösenordsåtgärden, uppslaget av aktiveringsjobb, kökontrollerna och serverkomponenten för Mina sidor. Supabase Auth, kundöversikten och databasanropens svar simulerades. En lokal PostgreSQL-plan i PGlite jämförde exakt räkning med ett existensuppslag. **37 befintliga tester passerade.** Produktionslatens och verkliga köstorlekar mättes ej.

| ID | Prioritet | Verifiering | Resultat och konsekvens |
| --- | --- | --- | --- |
| <a id="f160"></a>F160 | Medel för vanlig lösenordsinloggning | Verklig inloggningsåtgärd med räknade databasfrågor | På väg direkt till `/mina-sidor` väntade Web ändå på både en behörighets-RPC och en fråga mot `user_roles`. Resultaten styr adminåtkomst och omdirigering från `/dashboard`, men de påverkar inte destinationen `/mina-sidor`. Med 70 respektive 50 ms simulerad väntan fördröjde den längre frågan nästa steg. [Behörighetsuppslagen](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/app/login/actions.ts#L59) · [Destinationerna som använder resultatet](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/app/login/actions.ts#L120) |
| <a id="f161"></a>F161 | Medel för tiden innan kunden når Mina sidor | Verklig login och verklig kandidatsökning med syntetiskt tom kö | Efter behörighetsfrågorna väntade login först på loggskrivningen och sedan på uppslag av aktiveringsjobb. Även provet utan kandidater passerade båda stegen i följd. Med simulerad kritisk väg på 70 + 80 + 90 ms tog omdirigeringen cirka **262 ms** lokalt. [Loggskrivning och aktiveringsförsök](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/app/login/actions.ts#L98) · [Kandidatsökningen](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/onboardingResume.ts#L68) |
| <a id="f162"></a>F162 | Medel för rätt kundbesked vid driftfel | Verkliga kökontroller och serverkomponent med syntetiskt databasfel | Ett läsfel i kökontrollen returnerar samma booleska värde som en pågående aktivering. När databassvaren simulerades som otillgängliga visade Mina sidor att kopplingen fortfarande slutförs och att systemet försöker igen automatiskt. Kontrollprovet med tom kö visade inget sådant besked. [Köstatus vid fel](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/onboarding.ts#L677) · [Profilköns felväg](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/authProfileSync.ts#L186) · [Sidans kundbesked](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/app/mina-sidor/page.tsx#L108) |
| <a id="f163"></a>F163 | Låg för normal köstorlek, större vid många historiska jobb | Räknade frågor från de verkliga hjälparna och jämförd lokal databasplan | Båda kökontrollerna begär en exakt räkning inför samma sidvisning och använder bara om resultatet är större än noll. Med 5 000 syntetiska matchande aktiveringsjobb läste en lokal modell av räkningen samtliga 5 000. Ett existensuppslag läste en rad för samma besked. [Aktiveringsköns räkning](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/onboarding.ts#L681) · [Profilköns räkning](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/authProfileSync.ts#L190) |
| <a id="f164"></a>F164 | Medel vid tillfälligt Auth-fel efter godkänt lösenord | Verklig inloggningsåtgärd med simulerat 503 från sessionsverifieringen | När lösenordsinloggningen lyckades men efterföljande `getUser()` fick 503 försökte Web logga ut kunden och skickade tillbaka till login utan ursprunglig destination. I provet försvann `/dashboard/documents`. [Sessionsverifiering och felomdirigering](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/app/login/actions.ts#L49) |

#### Åtgärder i prioriterad ordning

1. **F160–F161.** Kör privilegieuppslag där destinationen kräver dem. Mät logg och aktivering separat och flytta oberoende arbete från omdirigeringens kritiska väg med bibehållen hållbar loggning och kundverifiering.
2. **F162–F164.** Visa ett eget besked när köstatus eller sessionsverifiering tillfälligt är otillgänglig. Behåll den säkra, validerade destinationen för nytt försök. Skydda kunddata tills sessionen har verifierats.
3. **F163.** Fråga efter existens i kökontrollerna och behåll index-, kund- och statusavgränsningen.

### Köarbetaren för kundaktivering

Gridex Webs lokala träd motsvarade `origin/main` på `e4d071805240fb5fa4c2e517cd17d33c4a1b7dea`. Proven körde den verkliga köarbetaren och återupptagningen vid inloggning med syntetiska jobb och simulerade databas- och Auth-svar. Det schemalagda anropet följdes i Webs konfiguration och ruttkod. **33 befintliga tester och fem riktade prov passerade.** Verklig kövolym, driftens körhistorik och leverantörernas svarstider mättes ej.

| ID | Prioritet | Verifiering | Resultat och konsekvens |
| --- | --- | --- | --- |
| <a id="f165"></a>F165 | Medel vid långsamma leverantörsanrop | Verklig arbetare med två körklara jobb och väntande Auth-svar | Det första jobbet väntade på Auth. Det andra låg kvar som väntande med noll försök tills det första släpptes. Arbetaren hämtar en grupp jobb men handlägger dem ett i taget, så ett långsamt jobb kan fördröja resten. [Arbetarens seriekörning](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/onboarding.ts#L592) |
| <a id="f166"></a>F166 | Medel vid databasstörning | Verklig arbetare med simulerat databasfel vid markering av första jobbet | Ett databasfel när det första jobbet skulle reserveras avbröt hela arbetaren. Inget av de två redan lästa jobben gick vidare. Felet inträffade före felhanteringen i `processJob` och arbetaren har ingen separat felhantering för varje jobb. [Försök att reservera jobb](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/onboarding.ts#L314) · [Anrop före felhanteringen](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/onboarding.ts#L424) |
| <a id="f167"></a>F167 | Medel till hög vid upprepade inloggningar under en störning | Verklig arbetare och verklig säker återupptagning med ett syntetiskt kundbundet jobb | Det schemalagda urvalet hoppade över ett jobb med åtta tidigare försök och ett återförsök en timme framåt. Inloggning tog upp jobbet direkt och nollställde försöksräknaren före nästa körning. Efter två inloggningar hade Auth anropats två gånger, men jobbets räknare stod på **ett** efter båda felen. Det gäller redan verifierade kandidater och kan kringgå den planerade väntetiden och försöksgränsen. [Schemalagt urval](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/onboarding.ts#L600) · [Återställning vid bekräftad inloggning](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/onboarding.ts#L641) |
| <a id="f168"></a>F168 | Medel för schemalagd upphämtning | Webs versionerade cron-konfiguration, rutt och arbetarens parametrar | Den schemalagda körningen startar en gång i timmen och arbetarens standardurval är högst 25 jobb per körning. Ett återförsök som blir körklart fem minuter efter en misslyckad schemakörning kan därför vänta **ytterligare 55 minuter** på nästa schemalagda start. Andra ingångar till arbetaren kan påverka väntan för enskilda jobb. [Schemat](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/vercel.json#L24) · [Ruttens anrop](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/app/api/internal/customer-portal/onboarding/process/route.ts#L26) · [Återförsökstid](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/onboarding.ts#L333) |
| <a id="f169"></a>F169 | Medel för extra arbete i teckningens väg till kvitto | Verklig köingång med ett slutfört jobb och ett separat avbrutet jobb | Aktiveringsvägen gjorde en global återställning av gamla lås innan den läste den aktuella teckningens jobb. Provet ändrade ett orelaterat jobbs status till återförsök även när den aktuella aktiveringen redan var slutförd. Den schemalagda arbetaren gör samma återställning. [Global återställning av lås](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/onboarding.ts#L390) · [Aktiveringsvägen efter teckning](https://github.com/heke99/gridex-web/blob/e4d071805240fb5fa4c2e517cd17d33c4a1b7dea/lib/customerPortal/onboarding.ts#L574) |

#### Åtgärder i prioriterad ordning

1. **F167–F168.** Bevara tidigare försöksantal och väntetid vid tekniska fel. Hantera ett uttryckligt kundinitiativ separat när det förändrar jobbets förutsättningar. Stäm av körfrekvens och satsstorlek mot köålder och leverantörernas anropsgränser.
2. **F165–F166.** Isolera fel per jobb och mät en begränsad parallellitet för jobb utan gemensam kundbindning. Behåll exklusiv reservation, kontrollerad belastning och rättvis ordning för körklara jobb.
3. **F169.** Låt schemakörningen sköta global låsåterställning. Begränsa eventuell direkt återställning i teckningsflödet till jobb som hör till det aktuella försöket.

## Prestandamätningar den 18 november

Tre anonyma HTML-anrop per sida från samma granskningsmiljö, utan cachebrytande parametrar. TTFB är tiden till första byte. Stickprovet beskriver svaren vid mättillfället. Det ger ingen skattning av cacheträffgrad, användarnas laddningstid eller produktions-API:ernas svarstid efter inloggning.

| Sida | TTFB, median och intervall | CDN-status | Överförd svarskropp |
| --- | --- | --- | --- |
| `/` | 0,74 s (0,72–1,71 s) | `STALE` vid tre anrop | 16,69 kB |
| `/elavtal` | 1,37 s (0,68–2,33 s) | `MISS` vid tre anrop | 11,81–11,85 kB |
| `/elpriser/elpris-idag` | 0,91 s (0,52–2,59 s) | `MISS` vid tre anrop | 10,48–10,49 kB |
| `/teckna-avtal` | 0,85 s (0,67–2,88 s) | `MISS` vid tre anrop | 20,71–20,77 kB |

Börja med att beställa färre OPS-sektioner per kundvy och ta bort väntan på support för Mina avtal. Det påverkar varje sådan sidladdning. Gör därefter avtalslistan cachebar och minska kalkylatorns data till webbläsaren. Genomför en separat ändring för elprishistoriken enligt GW04 och GW63. Följ upp med TTFB för cachade och ocachade svar, svarsstorlek samt antal Auth- och OPS-anrop för samma testscenarier.

För teckningsflödet ger GW94 och GW97 kortare väntan vid varsin övergång. Mät tid från **Hämta pris** till synligt pris, tid till fungerande teckningslänk och tid till första byte för öppning från länken. Följ även antalet offertanrop per försök och andelen överlämningar som misslyckas efter en godkänd offert.

På serversidan är GW99 och GW100 tidiga åtgärder som kan minska katalogtrafiken. Följ antalet kataloganrop, andelen `304` och antal skrivningar per teckningsförsök. Mät databasanrop fram till att ansökan skickas till OPS för att bedöma GW102.

För spotpriserna kan GW105 minska antalet anrop från en öppen mobilvy, GW104 och GW108 minska arbetet per återkommande begäran och GW106 minska kostnaden för att tolka svaret. Följ antal prisbegäranden per minut med vyn öppen, CDN-träffar för publicerade dagar och parserns körtid på mobil. Under fel hos priskällan kan den fortsatta trafiken följas separat enligt GW107.

För mobilens Mina sidor kan GW110 ta bort onödiga anrop och missvisande fel från förbrukningsvyn. GW112 kan minska arbetet vid varje rendering av diagrammet. Mät antal kundanrop från inloggning till visade mätvärden och renderingstid för sju och 30 dagar på en mobil.

För publika sidor kan GW118 och GW119 minska antalet begäranden och överförd data vid första besöket. Följ sessionsanrop per anonym sidladdning och typsnittsdata med kall webbläsarcache.

För kunddokument kan GW120 och GW121 minska väntan innan fakturadetaljen visas. Följ antal databasfrågor och svarstid med olika antal bilagor. Mät sedan överförd OPS-data vid öppning av en enskild bilaga enligt GW122.

För kundservice kan GW125 minska antalet profilläsningar vid varje laddning och GW126 korta tiden tills kunden kan skapa ett ärende. Följ också hur många OPS-anrop som görs vid ett enskilt sidbyte i Support123 enligt GW127.

För kvittot kan GW131 och GW132 minska arbetet per statuskontroll. Mät därefter svarstid före och efter revisionsskrivningen enligt GW133 samt tid från återgång till synlig flik tills statusen uppdateras enligt GW135.

För importerna kan GW138 ge kortare körtid vid kall cache och GW142 minska antalet skrivningar vid omsändning. Följ källanrop, högsta samtidighet och tid att importera fyra områden. Mät också vilka databasskrivningar som återstår vid en bekräftat identisk fakturaomsändning.

För bakgrundsjobben ger GW143 ett mått för databasbelastningen per notisbatch. GW145 och GW146 påverkar leveranstiden. Följ åldern på äldsta väntande kvittens och tid från en kundskrivnings försökstid till att den faktiskt körs.

För avtalsvalet kan GW152 minska serverns formatering och GW154 minska datan till webbläsaren. Följ antal byggda visningsunderlag per sidladdning och storleken på den serialiserade avtalslistan.

För inloggning och lösenordsåterställning ger GW155 färre anrop på vanliga kundvägar. GW156 och GW159 kan korta tiden till omdirigering. Följ antal behörighetsanrop per mål samt median och 95:e percentilen för tiden från inloggningsförsök eller öppnad återställningslänk till omdirigering. Tiderna i de tre fynden bygger på simulerade fördröjningar.

För API:t ger GW167 en konkret möjlighet att minska överföringen mellan webbservern och OPS. Följ OPS-anrop och byte per portföljpris vid cachemiss. Mät också tid till felsvar för GW163–GW164 och hur många avbrutna adresskontroller som slutförs i OPS enligt GW168.

För fortsatt API-effektivisering, börja med att minska datan för godkännandesidan (GW169), dela beredskapskontrollens hämtningar (GW171) och begränsa avtalsexportens kolumner (GW174). Följ antal OPS-anrop, svarsstorlek och 95:e percentilen per flöde. För exporten behöver även radantalet kontrolleras enligt GW173. Tid och byte från den här omgången mättes med syntetiska tjänster och rader.

## Verifieringsutfall

| Område | Resultat |
| --- | --- |
| GitHubs `main` | Lint, typkontroller, webb- och supportbygge samt testsviter för webb och support passerade på Node 22. |
| API och databasmigrationer | Lokalt migrationsmanifest för 50 filer, API-kompatibilitet och kontraktstester passerade. Livekontrollen visade samma publicerade OpenAPI för website, customer portal och staff, version `2026-11-10.1`. |
| Publik produktion | Startsida, avtal, elpris, teckning, kundservice och inloggningssidor laddade i Chromium på desktop och mobil. Startsidan gav `HIT` och `STALE`. Teckningssidan och sessions-API:t gav `no-store`. Avtals-API:t levererade revision 82 för privat och företag. |
| Isolerade webbläsartester | 20 kundscenarier, 22 priskalkylator- och områdesscenarier samt 28 supportkontroller passerade. Auth-isolering, navigering och riktade kvitto- och statuskontroller passerade med syntetiska tjänster. |
| Femte omgången den 18 november | Sex riktade testfall med appens verkliga kodvägar och syntetiska tjänster återskapade GW22–GW27. `npm run test:portal` och `npm run test:poa-archive` passerade på Node 22. |
| Sjätte omgången den 18 november | Fem riktade testfall återskapade GW28–GW32 med syntetiska Auth-, OPS- och databassvar. `npm run test:customer-writes` passerade på Node 22. |
| Sjunde omgången den 18 november | Fem riktade testfall återskapade GW33–GW37 med syntetiska köer och leverantörssvar. Regressionstesterna för kontoaktivering, kvittenser och återförsök passerade. Resends instruktion för det tillfälliga 409-svaret kontrollerades mot API-dokumentationen. |
| Åttonde omgången den 18 november | Fem riktade testfall återskapade GW38–GW42 på Node 22 med applikationens egen signering, validering och kalkylatorlogik samt simulerade tjänster och lagringsfel. De befintliga testsviterna för offertens referenser, offertens giltighetstid och idempotens för prissnapshot och områdeslogg passerade. |
| Nionde omgången den 18 november | Fem riktade kontroller återskapade GW43–GW47 på Node 22 med OPS kod för kvittostatus, webbens komponenter och statusroute samt simulerade tjänstesvar och databasoperationer. Befintliga tester för beständig hantering efter teckning, reservläget för kvittolänkar och teckningsflödets validering passerade. |
| Tionde omgången den 18 november | Fem riktade kontroller återskapade GW48–GW52 i Chromium med webbens riktiga formulär och syntetiska dokument. De två avvisningarna verifierades också mot serveråtgärdens kod i ett isolerat test på Node 22. Fyra befintliga regressionstester för avtalskontraktet, teckningsadaptern och teckningsvalideringen passerade. |
| Elfte omgången den 18 november | Fem riktade kontroller återskapade GW53–GW57 på Node 22 med simulerad tid, syntetiska tjänstesvar, webbens verkliga routes och vyer samt OPS kod för leverantörsbytets start och avtalsprojektion. Fem befintliga regressionstester för prisval, elområdespriser, offertvalidering och kundportalens API passerade. |
| Tolfte omgången den 18 november | Sex riktade kontroller återskapade GW58–GW63 på Node 22 med syntetiska prisserier, webbens API-rutter och elprissida samt mobilappens prisparser. Fyra befintliga sviter passerade för priskällan, mobilens prisdata och prisvy samt webbens regressionskontroller. |
| Trettonde omgången den 18 november | Fyra riktade kontroller återskapade GW64–GW67 på Node 22 med fakturasidan, webbens och mobilens fakturarutter, mobilens detaljkomponent och syntetiska OPS- och autentiseringssvar. Nio befintliga regressionstester för mobilens fakturakontrakt, listvisningens hjälpfunktioner och kundportalens API passerade. |
| Fjortonde omgången den 18 november | Fem riktade kontroller återskapade GW68–GW72 på Node 22 med syntetiska mätvärden, webbens API-rutter, mobilens förbrukningsvy och OPS leveransberäkning från `63111f0`. 28 befintliga tester passerade för förbrukningskontrakt, leveransgränser, mätvärdeshämtning och mobilens förbrukningsvy. Den sammansatta förbrukningskedjan i produktion återstår att verifiera. |
| Femtonde omgången den 18 november | Fem riktade kontroller återskapade GW73–GW77 på Node 22 med OPS faktiska kolumnurval och avtalsmappning från `63111f0`, syntetiska avtalsrader och serverrendering av Mina avtal. 15 befintliga tester för kundresan, kundportalens API och mobilens listfunktioner passerade. |
| Sextonde omgången den 18 november | Fem riktade kontroller återskapade GW78–GW82 på Node 22. Testerna använde OPS dokument- och fullmaktsmappning från `63111f0`, syntetiska kundposter och riktiga webbkomponenter. De granskade OPS-filerna var identiska i den senare huvudrevisionen `eafb425`. 32 befintliga tester för fullmaktsarkivet och kundresan passerade. |
| Sjuttonde omgången den 18 november | Fem riktade kontroller återskapade GW83–GW87 på Node 22 med webbens profilåtgärder och bekräftelseroute, mobilens profilroute, OPS validering och syntetisk lagring. Sex befintliga tester för mobila kontoändringar och telefonformuläret passerade. Ingen verklig e-poständring eller leverans testades. |
| Artonde omgången den 18 november | Sex prestandafynd dokumenterades med tolv publika HTTP-mätningar, inspektion av startsidans serialiserade avtalsdata och riktade serverkontroller på Node 22 med syntetiska svar. 18 befintliga tester för kundresan och avtalscachen passerade. |
| Nittonde omgången den 18 november | Fem riktade kontroller återskapade GW94–GW98 med kalkylatorns händelsehanterare, överlämningsrutten, lagringskoden och sidans datahämtning på Node 22. Svar och fördröjningar var simulerade. Fyra befintliga tester för offertvalidering och teckningsintegritet passerade. |
| Tjugonde omgången den 18 november | Fem riktade kontroller återskapade GW99–GW103 med katalogklienten, teckningens serveråtgärd, offertrutten och lagringskoden på Node 22. Tjänstesvar och fördröjningar var simulerade. 34 befintliga tester för katalogrevalidering, adress- och prissnapshotar samt teckningsflödet passerade. |
| Tjugoförsta omgången den 18 november | Sex fynd dokumenterades genom tre publika dagsprisbegäranden, kontroll av de publika priskortens länkar och fyra riktade lokala tester av mobilvyn, prisparsern, månads-API:t och sessionsklienten. Nio mobiltester och två webbtestsviter för prisdata och regressionskontroller passerade. |
| Tjugoandra omgången den 18 november | Fem fynd verifierades lokalt med mobilens verkliga kundvy och förbrukningsdiagram, simulerade appövergångar, Auth-svar och kunddata på Node 22. 76 befintliga tester för kundsessioner, förbrukning och kundlistor passerade. |
| Tjugotredje omgången den 18 november | Fem fynd verifierades med Chromium på publika sidor och ett lokalt mättest med syntetisk teckningsreferens. Tredjepartsanrop blockerades i webbläsartesterna. 13 befintliga tester för snapshotlagring och API-prestanda samt webbläsarsviten för sessionsisolering och navigering passerade. |
| Tjugofjärde omgången den 18 november | Fem fynd verifierades på Node 22 med webbens och mobilens riktiga kodvägar, OPS fakturarutt och simulerade databas- och tjänstesvar. De berörda OPS-filerna var identiska i `63111f0` och den granskade huvudrevisionen `eafb425`. 27 befintliga tester för fakturakontrakt, kundportalens API och fullmaktsarkivet passerade. |
| Tjugofemte omgången den 18 november | Fem fynd verifierades lokalt på Node 22 med kundportalens och Support123:s serverkomponenter och syntetiska svar. Innehållet i OPS ärendedetalj kontrollerades i koden vid `eafb425`. 94 befintliga tester för kundservice, personal-API, bilagor och supportåtgärder passerade. |
| Tjugosjätte omgången den 18 november | Sex fynd verifierades lokalt på Node 22 med OPS statusläsare, webbens statusrutter, statuskortens effekter och syntetiska svar. De berörda OPS-filerna var identiska i testrevisionen `63111f0` och huvudrevisionen `6bcfdd5`. 20 befintliga tester för kvittolänkar, teckningsintegritet och återförsök passerade. |
| Tjugosjunde omgången den 18 november | Sju fynd verifierades lokalt med webbens importer, syntetiska källsvar och kundposter samt en PGlite-databas med verkligt tabellschema och publiceringsfunktion för spotpriser. Sex befintliga fakturavalideringstester och två prisrelaterade testsviter passerade. |
| Tjugoåttonde omgången den 18 november | Sex fynd verifierades lokalt med schemarutterna, notismatchningen och kundskrivningskön på Node 22. Tester använde simulerad tid, data och tjänstesvar. Sju befintliga kötester och tre sviter för SQL, runtime och kundwebbens driftsberedskap passerade. |
| Tjugonionde omgången den 18 november | Sex fynd verifierades lokalt med avtalsinläsaren, katalogen, teckningssidans serverkomponent och kalkylatorns startlogik på Node 22. Testerna använde en syntetisk katalog och två aktiveringslägen. Fem befintliga sviter för avtalskontrakt, prisvisning och teckning passerade. |
| Trettionde omgången den 18 november | Sex fynd kontrollerades lokalt på Node 22 med webbens lösenordsinloggning, Auth-bekräftelserutt och inloggningssida. Auth-svar och tjänstefördröjningar simulerades. De sista stegen i returvägen efter lösenordsbyte kodgranskades. 91 befintliga tester för Auth, portalkoppling, kundskrivningar och säkra omdirigeringar passerade. |
| Trettioförsta omgången den 18 november | Sju riktade lokala kontroller och en kodgranskning gav åtta API-fynd. 21 befintliga tester passerade. Lokala OpenAPI-specifikationer, manifest och genererade typer stämde för Website, Customer Portal och Staff. Den publika kontrollen visade ingen skillnad i de tre publicerade OpenAPI-kontrakten på dokumentationsversion `2026-11-10.1`. |
| Trettioandra omgången den 18 november | Sex fynd verifierades lokalt på Node 22 med godkännandesidan, kundportalens översikt, juridikrutten, två OPS-beredskapskontroller och CSV-exporten. OPS-svar, exportdata och fördröjningar var syntetiska. 20 befintliga tester för API-prestanda, tillförlitlighet, kundportal, beredskap och webbkontrakt passerade. |
| Supabase i produktion | Projektet `gridex-prod` rapporterade god hälsa. Den lästa avtalscachen innehöll en färsk snapshot på revision 82. Den senare aggregerade kontrollen av tecknings-, kundskrivnings-, webhook- och notisköerna returnerade inga rader vid mättillfället. Det räcker inte för att verifiera schemakörningar. |
| Databasrådgivare | Supabase rapporterade bland annat sex möjliga dubblettindex och nio körbara `SECURITY DEFINER`-funktioner för autentiserade roller. Rådgivarens träffar är underlag för granskning av åtkomst och frågeplaner. De är inga verifierade åtkomstfel. |
| Beroenden | Fullständig audit fallerade enligt GW05. Produktionsberoenden passerade med noll fynd. |

**Releasebedömning – röd.** Den fullständiga beroendekontrollen fallerar. Full produktionsverifiering återstår för en inloggad kundresa, genomförd teckning, faktura- och prisimport, schemakörning med verklig konfiguration och faktisk e-postleverans. Lokala feltester använde syntetiska tjänster och data. Produktionskontrollerna bestod av publika läsningar och aggregerade databasläsningar. Inga applikationsändringar eller driftsättningar gjordes.

Tidigare oktobergranskningar finns i projektets historik. Registrerade rättningar där behöver bedömas mot respektive revision. [Projektgranskning den 6 oktober](../2026-10-06-project-review/RAPPORT.md) · [Granskning av oberoende webbflöden den 7 oktober](../2026-10-07-web-independent/GRANSKNING.md)
