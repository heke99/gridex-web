# Gridex Web: signering, PDF och fullmaktsbevis

Kundsynkens bekräftade kodfel är rättade. Webbens hela testsvit och de nya
beteendeproven verifierar samtycke, signerare, betrodd IP, återförsök och
requestgränser. Ett verkligt slutprov av OPS PDF, verifikationsnummer och
leverans är fortfarande inte godkänt. Det har inte ersatts med en lokalt skapad
PDF eller ett påhittat verifikationsnummer.

Källa: https://app.gridex.se/developers/customer-portal-api. Dokumentation
2026-10-12.1 och runtime 2026-10-09.1. Endpointmatrisen i
`gridex-web-endpoints-20261018.md` omfattar alla 142 operationer i de tre
publicerade specifikationerna och skiljer aktiva integrationer från alternativa
ytor och dokumentationsarkiv.

## Rättningar

| Fynd | Status och beteende |
| --- | --- |
| W1: förlorade signeringsbevis | Rättat. Kundsynken bevarar signerare, identitet, faktisk metod och exakt omfattning. Browserflödet kräver `website_acceptance`; fritt angiven BankID-status godtas inte. Första betrodda IP, serverns godkännandetid och hela inkommande user-agent sparas i en privat, hashbunden kvittens innan OPS skrivs. Omförsök använder ursprunglig kropp, identitet och nyckel. |
| W2: antaget samtycke | Rättat. Endast `accepted === true` godtas. Saknad/otillräcklig signerare, otillåten omfattning och avkortade identitetsfält avvisas; felaktig fullmakt göms inte bakom en samtidig profiluppdatering. |
| W3: obegränsad requestläsning | Rättat för fem kundskrivningar och publik marknadsprisläsning. Gemensam JSON-läsare begränsar MIME, origin, byteantal och lästid, inklusive strömmar utan Content-Length. Kundens session kontrolleras före kroppsläsning. |
| W4: dokumentationsdrift | Återsynkroniserat och livekontrollerat mot manifest. OPS har under granskningen bytt tillbaka beskrivningar under samma versionsnummer. Endpoints, obligatoriska fält och valideringsregler är oförändrade. Ny kontrollsumma och genererad proveniens följer den senast kontrollerade driftsättningen. |
| W5: för tidigt köomförsök | Rättat. Bakgrundskön väntar minst hela OPS Retry-After och minst ordinarie backoff. Två timmars väntan kan inte bli två minuter; om väntetiden inte kan lagras krävs manuell hantering i dead letter. |
| Felhantering | OPS-fel går nu genom rätt serializer. Request-id, korrelations-id, retryability och hela numeriska Retry-After bevaras. |

Kvittensen använder befintlig `customer_portal_write_outbox`; ingen ny
migrering behövs. Tabellen har verifierad unik idempotensnyckel, behövda
kolumner, RLS och service_role-policy. Saknad/otillgänglig lagring stoppar
OPS-skrivningen. Samtidiga första försök konvergerar på samma kvittens.
Avbrutna skrivningar kan återupptas av den befintliga outbox-arbetaren med
samma ursprungliga bevis och API-nyckel. Den autentiserade cron-körningen finns
på Vercel en gång per timme.

## Övriga kontroller

- Adress/elområde kommer från OPS upplösnings-ID och `pricing_ready`.
  Webbläsarens GPS-position används inte som bevis för elanläggningen.
- Pris, produkt, komponenter, moms, förbrukning, start och leveranssätt binds
  till samma kanoniska offert och validering. Indikativa marknadspriser är
  skilda från slutlig avräkning.
- Juridiska referenser, versioner och hashar kommer från exakt publicerat
  erbjudande. Fullmaktens `textVersionId` är det accepterade juridiska dokumentet.
- Website-checkout har separat oföränderlig kvittens. Faktiska payloadbyggaren
  och submission-lagringen har provats med syntetiskt datalager: första tid/IP
  och metod bevaras.
- Avtalets signerade status, signed_at, signeringshash, kanoniska commit och
  dokumenterade checkout-status krävs innan webben visar en färdig teckning.
- Website-klienten har alla använda scopes, inklusive de uttryckligen godkända
  supportscopes. Den är aktiv, har 120 anrop/minut och är organisationsbunden.
  Personal har egen klient och sina sex personalrättigheter.
- Vercels produktionsinställningar och befintliga databasfält/policyer är
  kontrollerade utan att läsa existerande hemligheters värden.

## Verkligt kundprov

Efter användarens godkännande skapades testkunden **K00100065** i Gridex El AB,
med `is_test_data=true`, status `draft` och extern referens
`gridex-web-api-e2e-20261018`. Ingen verklig anläggning eller annan kund användes.
Den av användaren valda mottagaren gäller endast det planerade provutskicket.

En tidsbegränsad, tokenkontrollerad förhandsfunktion använde den befintliga
verifierade webbklienten utan att hämta ut dess hemlighet. Autentiserade anrop
till integration/context, website/public-contracts och website/legal-bundle
svarade 200. Fullmaktsprovet via customer/sync svarade
**409 LEGAL_BUNDLE_NOT_READY**: den nya testkunden har ännu inget aktivt juridiskt
paket. Detta är ett korrekt stopp och inget lyckat signeringsprov.

Efterkontroll i databasen visar noll kundavtal, Website-ansökningar, fullmakter
och dokument för testkunden. Inget PDF-utskick eller verifierad leverans påstås.
En separat temporär testklient accepterades inte av OPS integrationspolicy och
återkallades. Förhandsfunktionens delningsåtkomst är återkallad och funktionen
har även en fast tidsgräns. Vercels befintliga besökarskydd är kvar.

Nästa planerade prov använder den ordinarie Website-ansökan för att skapa det
juridiska sammanhanget. **Automatisk godkännandegranskning avvisade åtgärden**
eftersom en kundansökan kan starta verkliga leverantörs-/nätägarprocesser även
med en fiktiv anläggning. Godkännandet för testkund och PDF-leverans bedömdes
inte täcka dessa sidoeffekter. Åtgärden har inte körts via någon annan väg.
Det kräver uttryckligt godkännande eller en isolerad OPS-miljö innan provet kan
slutföras.

## PDF och signeringens gräns

OPS äger det privata fullmaktsarkivet och eventuellt stabilt verifikationsnummer.
Den tidigare observerade dokumentationstexten beskrev accepterad text, scopes,
originaltid och kund-IP i PDF, med numret på varje sida. Just denna beskrivning
har ändrats fram och tillbaka under samma versionsnummer under granskningen.
Ett verkligt dokument måste därför inspekteras i den avsedda OPS-versionen;
enbart ett schemasvar eller en kund-/avtalsreferens bevisar inte detta.

BankID är valfritt. Webben använder elektroniskt godkännande och påstår varken
verifierad BankID eller inbäddad kryptografisk PDF-signatur. Kund-, avtals- och
ansökningsnummer ersätter inte fullmaktens eget verifikationsnummer. Kundportalens
HTTPS-dokumentlänkar bevisar inte att alla interna fullmakts-PDF:er exponeras av
Customer API.

Fullständigt slutprov ska följa exakt accepterad text och scopes, ursprunglig
kund-IP och tid, privat PDF på samtliga sidor, stabilt verifikationsnummer vid
omförsök, rätt åtkomst samt faktisk leveransstatus. Full databaslast och alla
query-planer är inte kvalificerade genom dessa tester.
