# Gridex Web – ytterligare fynd, 7 oktober 2026

Granskad revision: main, d7b5cd510e8b99213ffbde1f59b1538b9e69ceee. Omfattning: Gridex Web som oberoende applikation, dess kundservice, lösenordsåterställning och kundvyer. OPS interna utskick och avtalsmejl ingår inte. Tidigare blandade tenant-/OPS-fynd ska inte räknas som Web-fel.

Status efter korrigering: W01–W11 och det ytterligare fyndet W12 är rättade på grenen `fix/web-independent-audit`. Ändringarna är verifierade lokalt. Inga produktionsändringar, riktiga mejl eller databasändringar utfördes.

Beskrivningarna nedan återger felen före korrigering. De ursprungliga reproduktionsskripten och deras JSON-resultat är historiskt underlag för den granskade main-revisionen; deras felassertioner ska inte längre passera på den rättade koden. Aktuell verifiering körs med `npm run test:web-independent` och `npm run test:audit:browser`.

| Fynd | Genomförd korrigering |
| --- | --- |
| W01 | Felkod/status styr neutral kontohantering; leverans- och kapacitetsfel visas. |
| W02 | API avvisar för långa värden; formulärets längdgränser motsvarar serverns. |
| W03 | Hash av indata och åtgärds-ID behålls i sessionStorage till bekräftat mottagningsbesked. Ingen meddelandetext lagras där. |
| W04 | Gemensam svarskontroll kräver uttryckligt resultat. Trasigt svar behåller återförsöks-ID. Kundservice validerar sitt mottagningsbesked. |
| W05 | Null-session gör återställningsvyn ogiltig. Kastade Auth-fel visas också. |
| W06 | Bekräftat läskvitto tar bort oläst-rutan; kunddata hämtas om. |
| W07 | Lösenord skickas oförändrat. Profilen visar hela lösenordspolicyn. |
| W08 | Opak fakturareferens URI-avkodas inte ytterligare. |
| W09 | Gemensam datumvisning använder Europe/Stockholm och bevarar rena kalenderdatum. |
| W10 | Ogiltiga datum får reservvärde. Ogiltig valutakod kraschar inte fakturavyn. |
| W11 | Beacon-fel använder fetch-reservvägen och stör inte navigeringen. |
| W12 | Reparationsvyn validerar svaret och visar väntande behandling utan framgång eller reset. |

## W01 – Återställningsmejl kan redovisas som skickat efter leveransfel (P2)

Källa: `app/login/forgot-password/page.tsx`, `shouldHideAccountExistence` och `handleReset`.

Kontroll av orden `user`/`account` i felmeddelandet sker före klassificering av felkod och HTTP-status. Därför behandlas även ett 500-fel med texten ”Error sending recovery email to user” och ett 429-fel med texten ”Email rate limit exceeded for this user” som neutral framgång. Formuläret försvinner och kunden får beskedet att en återställningslänk har skickats om adressen är registrerad.

Reproducerat: båda injicerade felen sätter `sent=true`, `error=null`. Detta visar beteendet för dessa feltexter; det är inte bevis för att leverantören använder exakt dessa texter i produktion.

Åtgärd: prioritera status/felkoder för kapacitets- och leveransfel. Dölj endast specifika fel som avslöjar kontots existens. Behåll en neutral formulering även vid driftfel, men låt kunden förstå att utskicket inte kunde genomföras och när ett nytt försök är möjligt.

## W02 – Kundservice kastar bort delar av kundens text (P2)

Källa: `app/api/support/public/route.ts`, `asText`; `app/(public)/kundservice/KundserviceClient.tsx`, `Field` och meddelandefältet.

API:t kapar meddelanden vid 4 000 tecken och ämnesrader vid 180 tecken innan validering och lagring. Formuläret har inga motsvarande längdgränser eller varningar. Kunden kan därför skicka ett långt ärende, få framgångsbesked och förlora slutet av texten. Databasfunktionens längdvalidering hjälper inte eftersom texten redan kapats.

Reproducerat: ett meddelande med 4 000 tecken följt av ”VIKTIG KOMPLETTERING” gav HTTP 200 och ett RPC-anrop utan kompletteringen. Databasanropet var simulerat.

Åtgärd: avvisa för långa indata med ett tydligt 400-fel före trunkering. Lägg samma gränser och teckenräknare i formuläret. Granska även namn, telefon och e-post, som använder samma tysta kapning.

## W03 – Kundservice tappar återförsöksidentiteten vid omladdning (P2)

Källa: `app/(public)/kundservice/KundserviceClient.tsx`, `intent` och `submitSupportTicket`.

Åtgärds-ID:t finns endast i en React-ref. Om servern sparar ärendet men svaret försvinner, kan ett återförsök i samma monterade formulär återanvända ID:t. Efter omladdning/ny montering får samma indata ett nytt ID. Serverns idempotensskydd kan då inte koppla ihop försöken, vilket kan skapa ytterligare ett ärende och en ytterligare kvittens.

Reproducerat: simulerat förlorat svar och två monteringar med identiska indata gav olika `client_operation_id`. Dubbla databasrader skapades inte i testet; följden bygger på serverns dokumenterade idempotens per ID.

Åtgärd: behåll ID och ett fingeravtryck av indata under flikens livstid, exempelvis i `sessionStorage`, utan att lagra själva meddelandet. Rensa först när ett validerat mottagningsbesked kommit tillbaka. Återanvänd samma ID vid osäkert utfall och identiska indata.

## W04 – Ofullständiga svar kan ge falsk framgång och förlorat återförsöks-ID (P2)

Källa: `components/customer/CustomerPortalSelfService.tsx`, `postJson`, `pendingResult` och `submitIntent`. Motsvarande svaga svarskontroll finns i kundserviceformuläret.

`response.json()`-fel omvandlas till `{}`. Vid en HTTP-status som räknas som lyckad betraktas detta sedan som ett slutfört resultat. Exempelvis kan en felaktig 200 HTML-sida ge ”Kopplingen till Mina sidor är uppdaterad.” Det beständiga åtgärds-ID:t tas samtidigt bort. Kundserviceformuläret accepterar också ett lyckat HTTP-svar utan att kontrollera att svaret faktiskt bekräftar mottagning.

Reproducerat: 2xx med JSON-tolkningsfel gav `syncState.kind=success` och tömde det lagrade återförsöks-ID:t. Det var ett injicerat svar, inte en observerad produktionsrespons.

Åtgärd: validera varje endpoints svarskontrakt. Skilj ett bekräftat slutresultat från mottaget/köat och från okänt utfall. Behåll ID vid trasigt eller ofullständigt svar. Visa återförsök med samma ID i stället för framgång.

## W05 – Lösenordsformuläret fortsätter vara aktivt efter utloggning (P3)

Källa: `app/login/reset-password/page.tsx`, `onAuthStateChange`.

Auth-lyssnaren hanterar en befintlig session men gör inget när sessionen blir null. En tidigare godkänd återställningsvy fortsätter därför visa formuläret när användaren loggas ut eller sessionen försvinner. Kunden upptäcker problemet först vid nästa försök att ändra lösenord.

Reproducerat: efter en giltig initial session och `SIGNED_OUT` med null-session låg `recoveryStatus` kvar på `ready`.

Åtgärd: uppdatera status även när sessionen upphör och visa länken för att begära en ny återställning. Detta är ett tillstånds-/användbarhetsfel; testet visar ingen kringgång av Supabase-behörigheter.

## W06 – Läst meddelande visas fortfarande som oläst (P3)

Källa: `components/customer/CustomerPortalSelfService.tsx`, `markLatestRead` och notisrutan.

Efter ett bekräftat läskvitto uppdateras endast resultattexten. Notisrutan styrs fortfarande av oförändrad `latestUnreadNotificationId`, och komponenten varken uppdaterar lästillståndet lokalt eller begär nya serverdata. Kunden får därför både framgångsbesked och texten ”Senaste meddelandet är oläst.” Knappen för att markera som läst finns kvar.

Reproducerat: efter ett svar med `ok=true`, `opsSynced=true`, `localSynced=true`, `queued=false` låg oläst-texten kvar vid ny render.

Åtgärd: uppdatera lokalt lästillstånd efter bekräftad framgång och hämta om aktuella kunddata. Hantera eventuella framtida väntande svar utan att markera meddelandet som färdigbehandlat.

## Verifiering och rekommenderad ordning

Kör från projektroten:

```sh
node quality/audits/2026-10-07-web-independent/reproduce.mjs
```

Skriptet transpilerar och kör befintliga TS/TSX-komponenters händelsehanterare och supportens API-route. React-hooks, ramverksgränser, Auth, HTTP och databasanrop är simulerade. Det är riktade reproduktioner, inte en fullständig webbläsar- eller leveranstestsvit. Resultaten finns i `reproduction-results.json`.

Prioritera W02 (informationsförlust), W01 och W04 (missvisande besked), därefter W03 och de två vyfelen. Regressionstester bör inkludera förlorat svar efter serverlagring, nytt försök efter omladdning, felaktigt 2xx-svar och Auth-session som upphör.

Tidigare kända Web-frågor om saknade produktionsmigreringar och konfiguration för Webs egen supportkvittens kvarstår separat från dessa nya fynd. Ingen ny produktionskontroll gjordes här och verklig mejlleverans är inte verifierad av dessa tester.

## Fortsatt granskning: fem ytterligare fynd

Nedanstående fynd granskades separat från W01–W06. Totalt innehåller dokumentet nu elva nya Web-fynd. Samma revision och begränsningar gäller. Korrigeringarna är genomförda enligt statustabellen ovan.

### W07 – Profilens lösenordsändring ändrar det inmatade lösenordet (P2)

Källa: `app/dashboard/profile/actions.ts`, `pick` och `updateCustomerPasswordAction`.

Profilens server action använder den generella textfunktionen `pick`, som kör `.trim()`, även för lösenord. Blanksteg i början och slutet tas därför bort innan policykontroll och Auth-anrop. Registrering, vanlig inloggning och återställningsformuläret behåller däremot lösenordet. En kund som väljer ` Abcdef12! ` får ett annat lösenord sparat och kan inte logga in med det hen skrev. Ett annat lösenord som bara uppfyller specialteckenkravet genom ett blanksteg kan i stället avvisas inkonsekvent.

Reproducerat: den faktiska server actionen skickade `Abcdef12!` till simulerad Auth trots indata med omgivande blanksteg.

Åtgärd: läs lösenord som en oförändrad sträng och använd samma policy överallt. Om blanksteg ska förbjudas måste det vara en uttrycklig och konsekvent validering, aldrig en tyst ändring. Visa dessutom hela lösenordspolicyn på profilsidan, som i dag endast anger minst åtta tecken.

### W08 – Fakturans detaljroute ändrar opaka referenser och kan krascha (P2)

Källa: `app/api/web/customer/invoices/[id]/route.ts`, `text` och `GET`.

Next.js tillhandahåller avkodade dynamiska route-parametrar. Routen kör ändå `decodeURIComponent` igen. En referens med en bokstavlig `%2F` ändras till `/`. En bokstavlig procentsekvens som inte är en giltig URI-kodning orsakar `URIError` före routefunktionens felhantering. Referenser ska behandlas som opaka värden, inte avkodas flera gånger.

Reproducerat: parametern `invoice%2Fpart` skickades vidare som `invoice/part`; `invoice%reference` kastade `URI malformed`. Parametrarna injicerades direkt som Next.js route-context; detta var inte ett produktionsanrop med en befintlig fakturareferens.

Åtgärd: använd parametern som levererats av ramverket utan ytterligare URI-avkodning. Validera tomma/otillåtna värden och säkerställ att fel returneras genom den vanliga JSON-felgränsen. Testa referenser med procenttecken och korrekt URL-kodade specialtecken via en faktisk route också.

### W09 – Kundvyer visar serverns kalenderdag i stället för svensk kalenderdag (P2)

Källa: datumformatering i `app/dashboard/documents/page.tsx`, `invoices/page.tsx`, `approvals/page.tsx`, `contracts/page.tsx` och `page.tsx`.

`Intl.DateTimeFormat('sv-SE', ...)` anger språk men ingen tidszon. I en UTC-servermiljö visas därför UTC-datum för tidsstämplar, även om svensk tid redan gått över till nästa dag. Ett dokument skapat `2026-10-07T22:30:00Z` visas som 7 oktober; svensk kalenderdag är 8 oktober. Liknande formatering används för skapande, godkännanden och andra datum i kundvyerna.

Reproducerat: faktisk dokumentrendering under `TZ=UTC` visade `2026-10-07`; uttrycklig `Europe/Stockholm` gav `2026-10-08`. Produktionsserverns tidszon kontrollerades inte här.

Åtgärd: centralisera datumvisningen och använd `Europe/Stockholm` för tidsstämplar. Hantera rena affärsdatum som `YYYY-MM-DD` som kalenderdatum utan tidszonskonvertering. Testa både sommar-/vintertid och timmar runt midnatt.

### W10 – Ett trasigt datum kan slå ut en hel kundvy (P2, robusthet)

Källa: samma datumformaterare som W09; `lib/customerPortal/service.ts`, `pickDate`.

`pickDate` returnerar text utan datumvalidering. Kundvyerna skickar sedan `new Date(value)` direkt till `Intl.DateTimeFormat.format`. Ett icke-tomt men ogiltigt datum kastar `RangeError`. Hela sidrenderingen misslyckas i stället för att endast den felaktiga uppgiften markeras som otillgänglig.

Reproducerat: ett dokument med injicerat `created_at='invalid-date'` gjorde att den faktiska sidfunktionen avvisades med `Invalid time value`. Detta är ett test av felaktiga integrationsdata, inte ett påstående om att produktionsdata innehåller detta värde.

Åtgärd: validera datum vid integrationsgränsen och ha en säker presentationsfunktion med reservvärde. Rapportera felaktiga fält för uppföljning utan att låta en rad slå ut övriga kunddata. Granska även valutaformattering, där en ogiltig valutakod kan ge motsvarande formatteringsfel.

### W11 – Dokumenthändelser tappas när webbläsaren nekar beacon (P3)

Källa: `components/customer/EventLink.tsx`, `logEvent`.

Komponenten returnerar direkt efter `navigator.sendBeacon` utan att kontrollera returvärdet. `false` betyder att webbläsaren inte köat anropet. Den befintliga `fetch`-reservvägen används endast när funktionen saknas, inte när den misslyckas. Därmed kan dokument-/fakturaöppningar saknas i händelsehistoriken. Själva dokumentlänken fortsätter fungera.

Reproducerat: `sendBeacon=false` gav inget fetch-anrop medan länkens vanliga klickhanterare fortsatte.

Åtgärd: använd `fetch(..., { keepalive: true })` när beacon returnerar false. Återanvänd samma åtgärds-ID och undvik att låta fel i händelseloggen störa navigeringen. Ett accepterat beacon-anrop bevisar fortfarande inte att servern sparat händelsen; välj mer tillförlitlig leverans om historiken kräver det.

### Verifiering av fortsättningen

```sh
TZ=UTC node quality/audits/2026-10-07-web-independent/reproduce-additional.mjs
```

Fem reproduktioner passerade med befintlig Web-kod och simulerade externa gränser. Resultat: `additional-results.json`. Prioritera W07 och W08, därefter gemensam datumhantering för W09/W10, och sist W11. Inga OPS interna funktioner eller mejlutskick granskades i denna fortsättning.


## W12 – Reparationsvyn behandlade väntande synk som färdig (P2)

Källa: `app/dashboard/error.tsx`, `repairLink`. Vyn kontrollerade endast HTTP-status, visade ”Kopplingen är uppdaterad” och körde `reset()` även när kroppen angav `pending_review` eller när svaret inte kunde JSON-tolkas. Varje återförsök skapade dessutom ett nytt åtgärds-ID.

Korrigering: gemensam resultatvalidering med Mina sidor. Väntande behandling visas som väntande och utlöser ingen reset. Samma ID används under återförsök i den monterade vyn. Regressionstest verifierar väntande svar, utebliven reset och samma ID.

## Slutlig verifiering

- `npm run test:web-independent`: 12 regressionstester passerar.
- `npm run test:audit:browser`: passerar, inklusive felaktigt 2xx-svar, väntande koppling, flyttens återförsök, återställningsbegränsning med ”user” i feltext, läskvitto och supportåterförsök efter omladdning.
- `npm test`: hela projektets testsuite passerar, inklusive de nya regressionstesterna.
- `npm run typecheck`: passerar.
- `npm run build`: produktionsbygget passerar.
- ESLint: ändrad kod och nya granskningsfiler passerar. Full lint inkluderar även det tidigare orelaterade, ospårade tenant-/OPS-reproduktionsskriptet, som har befintliga CommonJS-regelfel. Det undantogs med `--ignore-pattern 'quality/audits/2026-10-07-tenant-email/**'` vid kontrollen; projektets lintkonfiguration försvagades inte.
- `git diff --check`: passerar.

Tidigare noterad produktionskonfiguration och saknade databasmigreringar för Webs egen supportkvittens är inte lösta av denna kodändring. Den uppdaterar inga produktionsmiljövariabler eller databasscheman. Verklig leverans av Auth-/supportmejl måste verifieras separat; de här testerna skickar inga mejl.
