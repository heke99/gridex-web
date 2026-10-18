# Gridex Web: signering, PDF och fullmaktsbevis

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
Den kompletterande läskontrollen redovisas i JSON-beviset när den är färdig.

BankID är valfritt. Webben använder elektroniskt godkännande och påstår ingen
BankID-verifiering eller inbäddad kryptografisk PDF-signatur. Kund-, avtals-
och ansökningsnummer ersätter inte ett separat fullmaktsverifikationsnummer.
