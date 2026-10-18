# Gridex Web: genomgång av API-dokumentationen 2026-10-18

Källa: https://app.gridex.se/developers/customer-portal-api. Dokumentationsrelease
2026-10-12.1, svarsschema 2026-10-09.1, separat personalintroduktion 2026-10-05.2.
Website-, Customer- och Staff-specifikationerna synkroniseras och kontrolleras
mot den publicerade SHA-256-manifesten. En dokumentationsrevision förväxlas
inte med affärssvarets schema. Äldre uttryckligen stödda svar följer fortfarande
slutna affärsscheman.

## Dokumentationen punkt för punkt

| Punkt | Projektets implementation och kontroll |
| --- | --- |
| 1. Ansvar | OPS äger offerter, juridik, kund, anläggning, avtal och signering. Webben lagrar presentationsunderlag och oföränderliga kvittenser. `lib/ops/client/application.ts`, `lib/website/submissionStore.ts`. |
| 2. Autentisering | API-nycklar och privata signeringsnycklar används på servern. Kundidentiteten härleds från verifierad tenant-session. Personal har separat nyckel, provider, hostbunden kaka och aktuell lokal–central bindning. Ingen behörighet baseras på lika e-postadresser eller användarmetadata. |
| 3. Webbcheckout | Publicerade erbjudanden → adress/elområde → offert → offertvalidering → exakt juridiskt paket → uttryckliga godkännanden/fullmakt → idempotent ansökan. `lib/ops/client/website.ts`, `application.ts`, `components/ElectricityCalculator.tsx`, `app/(public)/teckna-avtal/page.tsx`. |
| 4. Livscykel | Ansökningsnumret och API-kvittensen sparas. Omedelbart resultat använder `checkout`; färdig signering visas bara med `thank_you_ready`. Avtalets signering och bekräftelsemejlets leverans behandlas separat. Status hämtas via API efter senare besök. |
| 5. Kundportal | Granulära läsningar och dokumenterade skrivningar med parvisa verifierade identitetsheaders. Supportärenden och meddelanden ligger i samma kanoniska modell som personalens. Bilagor kompletterade med uppladdning, lista och verifierad nedladdning. |
| 6. Partner API | Separat serverintegration för partnerägda kund-/anläggnings-/avtalsskrivningar. Gridex Web använder dokumentationens Website checkout och Customer API. Partnerkontrakt anropas inte parallellt för samma teckning, eftersom det skulle skapa en andra affärsskrivning. |
| 7. Webhooks | Rå kropp, HMAC-SHA256, tidskontroll och deduplicerade leveranser. Befintlig uthållig fel-/omkörningshantering bevaras. `lib/webhooks/opsWebhook.ts`, `app/api/ops/webhooks/route.ts`, `lib/webhooks/retry.ts`. |
| 8. Tillförlitlighet | Stabil nyckel per oförändrad skrivning, inga automatiska skrivomförsök, ETag för erbjudanden och organisations-/kundtypsbunden cache. Läsomförsök respekterar full `Retry-After`, även HTTP-datum, inom en gemensam tidsbudget. |
| 9. Fel | Strukturerade felkoder, status, korrelations-/request-id och retryability används. Proxy-HTML, autentiseringsfel och interna feltexter skickas inte vidare som kundinformation. |
| 10. Endpointreferens | Följande resurser är genomgångna mot de incheckade specifikationerna. Historiska OpenAPI-URL:er är dokumentationsarkiv, inte extra affärsflöden att implementera. |

## Adress, geolokalisering och priser

`POST /website/energy-area/resolve` anropas servervägen med adress/postnummer/ort
eller stark anläggningsidentifierare. Webben tar inte fram elområde från en
egen postnummerheuristik. Svaret måste ha ett entydigt elområde och API:ets
`pricing_ready`. Platsen binds till en signerad upplösningsreferens innan offert.
Ändrad adress kräver motsvarande verifiering; ett webbläsarfält får inte byta
elområde eller pris. Webbläsarens GPS-position används inte som bevis på en
anläggnings adress eller elområde.

`GET /website/public-contracts`, `GET /website/portfolio-prices`,
`POST /website/market-price/current`, `POST /website/quote` och
`POST /website/quote/validate` har befintliga typade adapterflöden och
kontraktstester. Priskomponenter, moms, förbrukning, leveranssätt, startdatum,
offer-/prisalternativ och elområde kontrolleras tillsammans. Kundpriser
förfaller inte enbart för att `valid_until` passerar. En upplösningstokens
begränsade säkerhetslivslängd är separat från offertens giltighet.

Marknads-, portfölj- och blandavtal presenterar accepterad prismodell och
indikativt offertunderlag. De blir inte lokalt omtolkade som låst energipris.
Slutlig avräkning och fakturering hör till OPS.

## Avtal, juridik och signering

`GET /website/legal-bundle`, `POST /website/customer-applications`,
`GET /website/customer-applications/{application_number}` och
`GET /website/switch-status` används av befintlig checkout/status.
Dokumentreferens, version, hash, godkännandetid och obligatoriska krav kommer
från exakt publicerat paket. Fullmaktens `textVersionId` är enligt aktuellt
schema obligatorisk och måste avse dokumentversionen kunden såg; det är inte
API-revisionen. API:et avgör signering, fryst signeringshash och eventuell
ångerfrist. Inget nytt skarpt elavtal har skapats som test.

## Kundportalens endpointgrupper

| Resurser | Implementation |
| --- | --- |
| `me`, `contracts`, `sites`, `invoices`, `invoices/{id}`, `metering-values`, `events`, `documents`, `legal-acceptances`, `powers-of-attorney`, `notifications` | `lib/ops/client/portal.ts` och `lib/customerPortal/service.ts`, verifierad kundägare och slutna API-svar. |
| `portal-bundle` | Befintlig kombinerad adapter. Granulära vyer använder sina egna resurser för att undvika onödiga krav på alla scopes samtidigt. |
| `customer-portal/sync`, `customer/sync`, `profile-update`, `move-out`, `notifications/read` | Befintliga idempotenta serverflöden. Sync ger inte en obunden eller främmande identitet åtkomst. |
| `support/cases`, ärendedetalj, `messages` | Kanoniska API-flöden för lista, skapa och svara; kund kan inte ange staff-aktör eller intern synlighet. |
| Ärendets `attachments` och `attachments/{attachmentReference}` | Nya råa uppladdningar och verifierade nedladdningar. Endast släppta kundsynliga filer listas av Customer API. |
| `website/customer-events`, `events` | Befintliga serveradaptrar för kundhändelser och domänhändelser; alternativ POST-alias används inte för en andra leverans av samma händelse. |

## Personalens endpointgrupper

`lib/staff-api/client.ts` och `apps/support` täcker users/invite/role/disable/enable,
roles, customer search/detail/contact/identity-change samt cases/create/detail,
messages, notes, phone-interactions, status, assignee, events och attachments.
Bilageuppladdning är nu tillagd, med uttrycklig intern/kundsynlig flagga och
intern synlighet som förval. Rolltak, aktuell bindning, aktivt medlemskap,
sista administratör och optimistisk kontaktversion förblir API-kontrollerade.
Separat identity/resolve och invitations/accept använder sin egen version.

## Gränser och testbevis

- Inkommande checkout-JSON stoppas under läsning, normalt vid 64 KiB, och har
  tolv sekunders läsbudget. Felaktig origin blir ett kontrollerat 403-svar.
- Uppladdningar tillåter PDF/PNG/JPEG och högst 4 MiB. De läses först efter
  verifierad session, kräver samma origin och stabil idempotensnyckel, och
  har åtta sekunders läsbudget. API:ets innehållskontroll får avvisa med 422.
- Website/Customer JSON: 8 MiB; Staff JSON: 2 MiB; identity/onboarding: 16 KiB;
  bilagenedladdning: 4 MiB, tillåten MIME och verifierad SHA-256.
- `npm test`, `npm run test:support`, båda typkontroller och produktionsbyggen,
  `npm run verify:delivery`, `npm run api:check:live` och ändringsbegränsad ESLint.
- Webbläsarkontrollen använder syntetisk Auth/API och kontrollerar 25 flöden,
  inklusive mobil inloggning, nekad åtkomst, ärendesvar, intern anteckning,
  bilageuppladdning, kundkontakt, roller och utloggning. Det är inte ett skarpt
  konto-/avtalstest.

## Skarpa åtgärder och återstående verifiering

Separat Vercel-projekt `gridex-support` är skapat med Node 22 och rot
`apps/support`. Dedikerad staff-nyckel, publik provider och uttrycklig bindning
för det valda befintliga kontot `hekmat.h@div3rsa.com` är registrerade.
Befintligt OPS-medlemskap har bevarats. Ingen inbjudan eller annat mejl har
skickats. Den inbyggda bindningskontrollen i avsedd OPS-databas godkänner
aktör/bindning/version. Detta ersätter inte en riktig lösenordsinloggning.

Efter användarens uttryckliga godkännande har webbklienten fått exakt
`customer_support.read` och `customer_support.write`, med revisionslogg och
oförändrade övriga rättigheter. En tidigare automatisk granskning stoppade
ändringen tills det specifika godkännandet kom.

Driftresultat, källa och kvarvarande begränsningar dokumenteras i
`quality/support123/verification-20261018.json`. Tenantens servernyckel och
leveransbryggans publika inställningar är nu aktiva i personalappen. OPS har
fått den uttryckligen godkända separata signeringsnyckeln och driftsatts om med
oförändrad befintlig kod. Den inbyggda onboardingkontrollen godkänner registreringen.
Callbacken till personalappen är tillåten i Supabase och verifierad med en
ogiltig token utan att skapa session eller skicka mejl. Osignerade anrop till
bryggan nekas. Inloggningssidan är förenklad till själva inloggningen enligt
användarens instruktion och verifierad i både lokal och skarp webbläsare.

Den gamla projektdomänkopplingen har tagits bort av användaren och domänen är
tillagd och verifierad på rätt supportprojekt efter den nya TXT-verifieringen
hos Strato. Både den sparade projektdomänen och det aktiva aliaset pekar på
`gridex-support`. Publik HTTPS ger 200 med rätt driftsättnings-ID och den enkla
inloggningssidan. Upprepade webbläsarkontroller godkänner dator, mobil och
inloggningskrav på fyra skyddade sidor utan applikationsfel. Driftstatus finns i
`quality/support123/domain-reassociation-20261018.json` och de nya
webbläsarkvittona i `quality/support123/live-evidence-20261018-domain-final`.
Ett skarpt signerat kundavtal, verklig
personalinloggning, inbjudningsmejl och fullständig last-/databasprestandakvalificering
har inte påståtts utifrån enbart lokala tester.
