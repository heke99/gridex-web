# Fortsatt granskning: priser, beräkningar och återstående flöden

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
