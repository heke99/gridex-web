# Gridex Web: efterkontroll av signering, PDF och fullmaktsbevis

Slutsats: den publika teckningens kontrollerade kodväg följer OPS kontrakt för
elektroniskt godkännande, men hela projektet är inte färdigverifierat. Den separata
kundsynken har bekräftade fel. Ett verkligt slutprov av PDF, verifikationsnummer
och extern leverans återstår. Gröna kontraktstester ersätter inte dessa kontroller.

Källa: https://app.gridex.se/developers/customer-portal-api och dess publicerade
release-manifest. Dokumentation 2026-10-12.1, runtime 2026-10-09.1. Granskningen
utgår från webbbranchens `3148745` och aktuell produktionskälla `1f60c9f`.
Vid kontrollen pekade gridex.se på READY `dpl_HqSDrDHQUa9xGaX1mTuXg6pmiUks`
med exakt den produktionskällan. Fyndens hjälpfunktion och fem kundroutes är
oförändrade mellan produktionskällan och den granskade branchen.

## Vad som kontrollerats

| Del | Underlag och resultat |
| --- | --- |
| Adress, elområde och geolokalisering | Befintlig granskning och kontraktstester: OPS upplösnings-ID, entydigt område och `pricing_ready` krävs. GPS används inte som bevis för anläggningens område. |
| Priser och offert | OPS offert och validering binds till samma adress, produkt, komponenter, förbrukning, startdatum och juridik. Avräkningsmodell skiljs från indikativ prisvisning. |
| Juridiska dokument | Checkout binder kundens godkännande till exakt paket, referenser, versioner och dokumenthashar. Fullmaktens textVersionId kommer från det accepterade erbjudandets juridiska underlag. |
| Ursprunglig kund-IP | Servern läser inkommande headers och sparar IP, user agent och tid i en oföränderlig submission. Beteendeprov med syntetiskt datalager bekräftar att ett omförsök med annan IP/user agent behåller första beviset. |
| Payload till OPS | Anrop av den faktiska payloadbyggaren bekräftar att original-IP, tid, user agent, metod och textVersionId bevaras. Inget produktionsanrop görs av provet. |
| Avtalets signering | `assertAcceptedApplication` kräver bland annat signerat avtal, giltig signed_at, SHA-256-bevis, rätt checkout-status och kanoniskt committat arbetsflöde. |
| Signeringsmetod | Publik teckning skickar `website_acceptance`. BankID-routes svarar 404; någon aktiverad BankID-tjänst påstås inte. BankID är valfritt i OPS guide. |
| Publika nummer | Kund-, avtals- och ansökningsnummer läses från OPS. Fullmaktens verifikationsnummer är en egen OPS-uppgift och genereras inte av webben. |
| PDF | OPS guide anger privat arkiv av accepterad text, scopes och bevis, med stabilt verifikationsnummer på varje sida. Tenantpersonal hämtar fullmakts-PDF i OPS under Fullmakter. Detta har inte kvalificerats med ett verkligt dokument i denna granskning. |
| Mina dokument | Webben visar OPS-returnerad HTTPS `secure_url`. Det är inte bevis för att varje arkiverad fullmakts-PDF exponeras i Customer API. Mina sidor har ingen separat visning av fullmaktens verifikationsnummer. |
| Transport och webhooks | Befintliga läsdeadlines, svarsgränser, Retry-After och stabila skrivnycklar kvarstår. Generella OPS-händelser tas emot på `/webhooks/gridex`; publiceringshändelser på `/webhooks/contracts.publication.changed`. Den gamla `/api/ops/webhooks` svarar 410. |

## Bekräftade fynd

### W1: kundsynken tappar fullmaktens signeringsbevis — medel, öppet

`lib/customerPortal/writeValidation.ts:147` returnerar en whitelist som saknar
`signer_name`, `signer_identity_number`, `method`, `ip_address` och `user_agent`.
`app/api/web/customer/sync/route.ts:26` använder resultatet som fullmakt i
`submitOpsCustomerSync`. Ett direkt anrop av den verkliga normaliseraren med alla
fem fälten bekräftar att samtliga försvinner.

OPS dokumenterar att signerande namn, identitet och metod behövs för signerad,
externt sändbar fullmakt. Saknade bevis kan därför lämna denna synkvägs fullmakt
ofullständig och hålla extern e-post eller leverantörsbyte. Detta är en separat
väg från den publika Website-checkouten. Ingen skarp fullmakt skapades för att
bekräfta serverns sidoeffekter.

Rättning behöver bevara verifierade originalbevis från betrodd serverkälla,
med oförändrad tid/IP vid omförsök. Klientens fritt angivna IP eller BankID-sträng
får inte upphöjas till verifierat signeringsbevis.

### W2: samma normaliserare antar godkännande — medel, öppet

Vid `writeValidation.ts:168` avvisas bara `accepted === false`; frånvarande
`accepted` ger ändå `accepted: true` på rad 173. Ett beteendeprov utan flaggan
bekräftar resultatet. Det betyder att utgående payload kan ange uttryckligt
godkännande utan att inkommande data innehöll det. Ingen lyckad extern signering
eller leverans har demonstrerats utifrån detta.

Rättning behöver kräva uttryckligt godkännande och avvisa ogiltigt underlag utan
att tyst göra om det till en annan juridisk handling.

### W3: fem kundskrivningar använder obegränsad JSON-läsning — medel, öppet

Följande routes använder direkt `req.json()` eller `request.json()` i stället för
projektets `readWebJson`: `customer/sync`, `customer-portal/sync`,
`customer/profile-update`, `customer/move-out`, `customer/notifications/read`
under `app/api/web`. Autentisering finns, men den gemensamma läsbudgeten,
bytegränsen, MIME-kontrollen och origin-kontrollen saknas i dessa routes.
Den publika `app/api/web/market-price/current/route.ts` använder också direkt
JSON-läsning, men har egen rate limit. Root-proxyn tillför inte dessa kontroller.

Detta är en bekräftad kontrollucka i koden, inte ett demonstrerat CSRF-intrång
eller obegränsad storlek hos Vercels underliggande plattform. Rättning behöver
använda samma begränsade läsare och behålla befintlig identitetskontroll och
idempotens.

### W4: sparade kontrakt hade ändrats under samma versionsnummer — rättat i kod

Live-manifesten innehöll nya SHA-256 för Website och Customer API. Skillnaden
gäller beskrivningar av metod/IP i `PowerOfAttorneyInput` och
`CustomerSyncRequest`; endpointar, obligatoriska fält och affärsvalidering är
oförändrade. Staff-specifikationen är oförändrad.

Officiell synk har uppdaterat snapshots, manifest, genererade typer och
hashkonstanter. Efterföljande livekontroll godkänner alla tre exakta specifikationer.
Denna efterkontroll publicerar ingen ny produktionskod. De beskrivande
kontraktsuppdateringarna och rapporten finns i PR #53; W1–W3 är fortfarande öppna.

## Avgränsningar och avfärdade antaganden

- Vercels dokumentation anger att `x-forwarded-for` normalt skrivs över för att
  motverka IP-spoofing. Skillnaden mot projektets andra IP-helper räcker därför
  inte för att hävda en bekräftad sårbarhet i Vercel-checkouten. En extern proxy
  före Vercel skulle kräva egen verifiering av kedjan.
- Den äldre `lib/contracts/pdf.ts` skapar ett lokalt avtalsunderlag. Sökning i
  app/lib/tests hittar inget anrop av generatorn; den är inte bevis på att
  Website-checkouten skapar OPS fullmaktsarkiv. Admins äldre PDF-route läser ett
  annat lokalt arkiv.
- Webbsidans kund-, avtals- eller ärendenummer ska inte användas som påhittat
  verifikationsnummer. Det publicerade API-kontraktet kräver ingen lokalt skapad
  sådan uppgift.
- En PDF med elektroniskt godkännandebevis innebär inget verifierat påstående
  om BankID eller inbäddad kryptografisk PDF-signatur.
- Inget verkligt kundkonto, fullmakts-PDF, kund-IP eller personnummer hämtades.
  Inga avtal, mejl, databasposter eller behörigheter skapades av dessa prov.

## Verifiering och kvarvarande slutprov

Godkänt efter synk: `npm run api:check:live`, `npm run api:compatibility`,
`npm run api:contract`, `npm run test:portal`, `npm run typecheck` och
`git diff --check`. Syntetiska beteendeprov bekräftar bevarat Website-bevis och
reproducerar W1/W2. Bevis: `quality/api-compatibility/signing-review-20261018.json`.

Fullständigt driftgodkännande kräver därefter ett kontrollerat slutprov som
följer en verklig godkännandetransaktion till OPS arkiv: rätt tenant/person,
exakt accepterad text och scopes, originaltid och kund-IP, PDF på alla sidor,
samma stabila verifikationsnummer vid omförsök, korrekt åtkomst samt faktisk
signerings- och leveransstatus. Databaslast, query-planer och fullständig live-RLS
ingår inte i dessa kod-/kontraktsprov.
