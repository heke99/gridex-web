# Gridex Web: signering, PDF och fullmaktsbevis

Kundsynkens bekräftade kodfel är rättade. Webbens hela testsvit och de nya
beteendeproven verifierar samtycke, signerare, betrodd IP, återförsök och
requestgränser. Det verkliga avtalsprovet och avtals-PDF-leveransen är godkända; OPS fullmakts-PDF
och verifikationsnummer saknas fortfarande. Det har inte ersatts med en lokalt skapad
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

Användaren godkände uttryckligen en riktig testansökan och möjliga externa
OPS-processer efter den inledande automatiska avvisningen. Provet har nu körts.
Kund- och ansökningsreferenser utelämnas ur Git-artifakter. OPS skapade en egen
kanonisk testkund i ansökningsflödet; både den och den första förberedande
fixturekunden är testmarkerade. Ingen verklig elanläggning användes.

Det verkliga Website-flödet klarade konfiguration, publicerat erbjudande,
adress/elområde, kanonisk offert, offertvalidering, exakt juridikpaket och
ansökan. Avtal och fullmakt är signerade med `website_acceptance`; arbetsflödet
är `canonical_data_committed`. Samma ansöknings-/avtalsreferenser och samma
signeringshash återkom vid identiskt omförsök. Original-IP:s SHA-256 från
betrodd ingång matchar den IP som sparats på fullmakten. Signerad omfattning
är exakt `supplier_switch`; ingen leverantörsbytesbegäran skapades.

Tre mejlhändelser är `delivered` i OPS. Leverantören bekräftar rätt mottagare
och leverans. Avtalsbekräftelsen innehåller en PDF på två A4-sidor, 4437 byte.
Den hämtade leverantörsbilagan är byteidentisk med originalbilagan i kön och
kan textutvinnas. Avtalets privata signeringsbevis är uttryckligen separat.

Slutprovet bekräftar också ett kvarstående OPS-fel: fullmaktens
`customer_authorization_documents`-arkiv är ett `.json`-underlag, utan
PDF-mimetyp, dokumentchecksumma eller stabilt verifikationsnummer.
`customer_documents` exponerar ingen separat fullmakts-PDF för provet. Detta
är inte ett komplett godkänt fullmaktsarkiv och åtgärdas inte genom att webben
hittar på ett eget verifieringsnummer.

En verklig förhandskontroll upptäckte dessutom W6: identisk offert gav först
200 och sedan503 på ett duplicerat prissnapshot. Persistensen accepterar nu
endast verifierat likvärdiga omförsök, bevarar första audit-raden och avvisar
kollisioner. 18 nya beteendeprov skyddar normala och samtidiga omförsök,
ändrade transport-ID:n, innehållskonflikter samt skriv-/läsfel i databasen.
Totalt omfattar den nya regressionssviten 80 beteendeprov.

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
