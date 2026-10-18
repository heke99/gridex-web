# Gridex Web: signering, PDF och fullmaktsbevis

Senaste fullständiga efterkontroll: [API- och databasgenomgång](gridex-web-full-reaudit-20261018.md). Den redovisar senare publicerad kod och verkligt autentiserat Mina sidor-prov.

Källa: https://app.gridex.se/developers/customer-portal-api. Dokumentation
2026-10-12.1 och runtime 2026-10-09.1. Samtliga 142 operationer i Website-,
Customer- och Staff-specifikationerna är klassificerade i endpointmatrisen.
Det betyder inte att 142 skarpa mutationer har körts.

## Rättningar och verifiering

| Fynd | Resultat |
| --- | --- |
| W1: förlorade signeringsbevis | Kundsynken bevarar signerare, identitet, metod och exakt scope. Första betrodda ingress-IP, serverns tid och hela user-agent fryses i en privat, hashbunden kvittens före OPS-anropet. Samma kvittens används vid återförsök och köåterhämtning. |
| W2: implicit samtycke | `accepted === true` och kompletta signeringsuppgifter krävs. Webbläsaren får inte ange en påhittad BankID-signering. |
| W3: obegränsad requestläsning | Sex kund-/prisskrivvägar använder gemensam JSON-/origin-kontroll, 64 KiB-gräns och tolv sekunders läsbudget. |
| W4: dokumentationsdrift | Alla tre specifikationer synkroniserade mot live-manifestets SHA-256. Beskrivande signeringstext har ändrats fram och tillbaka under samma version; valideringsreglerna har inte ändrats. |
| W5: förkortad Retry-After | Den beständiga kön respekterar hela OPS-väntetiden. Oplanerbar väntetid stoppas för hantering. Sex beteendeprov verifierar faktiska workerbeslut. |
| W6: offertomförsök gav 503 | Dubblett kräver verifierat samma offert, erbjudande, kundtyp, beräkningshash och belopp. Första kontrollposten bevaras. 18 beteendeprov täcker återförsök, samtidighet, innehållskollision och databasfel. |
| W7: adressomförsök gav 503 | PostgreSQLs tidsformat och nya transport-ID:n får inte ändra identiteten hos samma kanoniska OPS-upplösning. Adress, elområde, giltighet och assurance måste fortfarande matcha. Första råsvarshash och kontrolltid bevaras. 13 beteendeprov täcker detta. |

Hela webbtestsviten, personaltester, båda typkontrollerna, produktionsbygget,
leveranskontrollen, manifestkontrollen och ändringsbegränsad ESLint har körts.
De nya beteendeproven omfattar 93 fall. Databaskontrollen verifierar befintliga
outboxkolumner, unik nyckel, RLS och service-rollens åtkomst; ingen migration
behövdes. Detta är inte ett fullständigt last- eller query-planprov.

## Verkligt godkänt avtalsprov

Användaren godkände uttryckligen ett riktigt OPS-avtalsprov, möjliga externa
processer och leverans till vald mottagare. Provet kördes därefter genom
Website-flödet: aktuell offert, adressupplösning, offertvalidering, exakt juridiskt
paket, en märkt testansökan och ett identiskt återförsök. Interna testreferenser
och signeringsfingeravtryck publiceras inte i Git.

OPS skapade ett signerat testavtal och en signerad fullmakt med exakt scope
`supplier_switch`. Ansökan, avtal, kund, signeringstid och signeringshash är
oförändrade vid återförsök. Ursprunglig kund-IP matchar det lagrade beviset.
Ingen verklig elanläggning användes och ingen leverantörsbytesbegäran skapades.

Tre mejlhändelser är `delivered` i OPS. E-postleverantören bekräftar rätt
mottagare och leverans. Avtalsbekräftelsen innehåller en giltig PDF på två
A4-sidor, 4437 byte. Den hämtade leverantörsbilagan är byteidentisk med
originalbilagan i kön och kan textutvinnas. PDF:en innehåller avtalsnummer och
anger uttryckligen att det privata signeringsbeviset lagras separat.

## Fullmakts-PDF och verifikationsnummer

Den aktuella guiden har lästs igen. Customer API dokumenterar läsning av
fullmaktsstatus; Partner API har separat uppladdning/hämtning av en partners
PDF. Webben använder Website-checkout och ska inte skapa ett andra avtal
eller ladda upp ett påhittat signeringsbevis via Partner API.

Den nuvarande guiden lovar inte automatisk fullmakts-PDF med separat
verifikationsnummer i Website-flödet. Tidigare observerad beskrivande text
innehöll sådana påståenden, men har ändrats under samma versionsnummer.
Önskemålet om PDF, IP-bevis och ett stabilt verifikationsnummer kvarstår ändå
som användarkrav och måste verifieras i ett faktiskt dokument.

Det lagrade provets fullmaktsunderlag är JSON; PDF-sökväg, PDF-checksumma och
separat verifikationsnummer saknas i de kontrollerade posterna. Detta bevisar
inte ensamt om en dokumenterad läsväg kan generera en PDF vid hämtning.
Partner API:s dokumenterade GET har nu också körts mot exakt provkund och
anläggning med denna API-ytas egna referenser. Svaret är 200 med
`file_base64: null` och `file_extension: null`. Ingen PDF genererades vid denna
hämtning. Separat fullmakts-PDF/verifikationsnummer kvarstår som ett OPS-behov.

BankID är valfritt. Webben använder elektroniskt godkännande och påstår ingen
BankID-verifiering eller inbäddad kryptografisk PDF-signatur. Kund-, avtals-
och ansökningsnummer ersätter inte ett separat fullmaktsverifikationsnummer.

## Publicering och slutlig livekontroll

Webbrättningarna är publicerade från `ffa37ac4d34f320d2fe98110961a82bf3fc69403`
i produktion `dpl_DKN6bDQLZC2N9fNgfhRRSXgkSTnC`. Båda marknadsdomänerna
pekar på den färdiga versionen. Supportdomänen pekar fortsatt på separat
personalprojekt. Vercel-skyddet är oförändrat och skickar vanliga besökare till
Vercels inloggning, enligt användarens uttryckliga val.

Samma källa gav 200 för erbjudanden, adress, offert, identiskt offertåterförsök,
validering, juridiskt paket och marknadspris i byggd förhandsversion. Identisk
offert behöll samma OPS-referens. Anonym kundsynk gav 401 och främmande origin
403. Bevis finns i `quality/api-compatibility/live-web-verification-20261018.json`.
Samtliga tillfälliga testlänkar för detta slutprov har återkallats.

En inloggad produktionskontroll via Vercel-connectorn stoppades av automatisk
godkännandegranskning eftersom verktyget kan skapa eller återanvända en länk
förbi skyddet. Ingen alternativ väg förbi spärren användes. Produktionens
källversion, READY-status, domänkopplingar och anonyma skydd verifierades;
funktionsprovet gäller förhandsversionen med samma kod.
