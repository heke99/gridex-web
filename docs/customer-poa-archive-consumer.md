# Fullmaktsarkiv i Mina sidor

Webben använder det oberoende OPS-kontraktet `poa-archive-v1.json`, version
`2026-10-19.1`. Den incheckade filen är byteidentisk med den granskade OPS-källan
och har SHA-256
`ec70eafa96d77563771af0b20eaa71ef2134eff96f75abfd4bb1942c94295d37`.
Den publicerade oföränderliga dokumentvägen är
`https://app.gridex.se/api/v1/openapi/2026-10-19.1/poa-archive-v1.json`.
Denna separata kontraktsversion ersätter inte de tre befintliga API-paketen eller
deras gemensamma release-manifest. Den 20 oktober 2026 cirka 07:51 UTC svarade
den publicerade filen med HTTP 200. Faktiska svarsbytes har samma SHA-256 som
ovan och är identiska med den incheckade filen.

Mina dokument visar arkivets fullmakter med verifikationsnummer, en lokal
inloggningsskyddad nedladdningslänk och sidindelning om 20 poster. Metadata märks
inte som byteverifierad innan filen hämtats. Om arkivet är otillgängligt visas ett
uttryckligt meddelande medan den vanliga dokumentlistan behålls.

De två lokala läsvägarna är:

- `GET /api/web/customer/powers-of-attorney/evidence?limit=20&cursor=...`
- `GET /api/web/customer/powers-of-attorney/evidence/{verificationReference}?format=json|pdf`

Identiteten tas alltid från verifierad serversession. Kunden kan inte välja
användare, företag eller kund via query eller formulär. OPS kontrollerar både
`customer_power_of_attorney.read` och `customer_documents.read`, aktiv
portalkoppling och ett faktiskt verifierat signerat kundintyg. Den befintliga
transporten skapar ett nytt intyg/JTI för varje försök och behåller sin gemensamma
tidsgräns, begränsade återförsök, redirectspärr och Retry-After-hantering.

Begäran valideras mot det frysta kontraktet efter att intyget skapats. JSON-svar
valideras med slutna scheman. PDF-svaret kräver rätt MIME, identisk
verifikationsreferens, dokumentets SHA-256-header och identisk kontrollsumma på
de faktiska bytesen. Läsningen är hårt begränsad till 15 MiB även utan
Content-Length. Efter komplett verifiering strömmas svaret i högst 64 KiB per
chunk med privat no-store, nosniff och ett lokalt säkert filnamn. Befintliga
supportbilagors separata gräns på 4 MiB är oförändrad.

PDF-strukturen kvalificeras av OPS innan ett lyckat PDF-svar returneras.
Webben inför ingen andra syntaxparser som skulle neka ett original som OPS
godkänner, exempelvis PDF med tillåtna inledande eller avslutande bytes.
Både listans och detaljens lokala JSON-svar skriver om dokumentlänken till
den inloggningsskyddade webbproxyn efter validering av OPS originalschema.

JSON-detaljen stöder kontrollsummejämförelse med `sha256`. Ett falskt
`submitted_sha256_matches` behålls uttryckligt. Ursprunglig IP och tid kan saknas;
de ersätts inte med aktuella värden. Referens och kontrollsumma är inte en
kryptografisk PDF-signatur eller bevis om BankID.

Ingen GET skapar fullmakt, samtycke eller PDF, och inga OPS-lagringssökvägar eller
API-nycklar lämnas till webbläsaren.

## Aktuell verifieringsstatus

Web och OPS är publicerade och OPS-ägaren har kvitterat databasinstallationen.
Den verkliga kundkopplingen är verifierad av användaren och av databasläsning.
Publicering av kontraktet är också byteverifierad enligt ovan.

Det redan godkända originalanropet har genomförts en gång av den befintliga
skyddade klienten och svarade HTTP 200. Klientens före-/efterkontroll rapporterar
samma originalansökan och fullmakt, bevarad ursprunglig IP och godkännandetid
samt inga dubbletter.

Oberoende databasläsning den 20 oktober 2026 cirka 08:36 UTC bekräftar att den
avskilda testfullmakten nu har PDF-objekt, arkivmetadata, SHA-256 och
verifikationsreferens med matchande sökväg/bucket/referens. Evidensens IP matchar
sparad IP och `ip_address_source` är `signer_reported`. Den frysta texten och
omfattningen har samma kontrollsumma före/efter anropet.

Originalklientens slutrapport den 20 oktober 2026 08:48:31 UTC godkänner 35 av
35 kontroller. Den hämtade tvåsidiga PDF-filen är läsbar; dess faktiskt beräknade
SHA-256 matchar OPS-arkivet exakt. Verifikationsnumret finns på båda sidorna.
Ursprunglig IP och godkännandetid har också verifierats inne i dokumentet.

Användaren har därefter bekräftat att PDF-filen laddas ned och öppnas från
Mina dokument genom den vanliga kundinloggningen. Originalanrop, arkivering,
faktisk fil/hash/verifikation och kundens nedladdningsväg är därmed godkända i
drift för den kontrollerade testfullmakten. Originalanropet är slutfört och
ska inte upprepas för läskontrollerna.

## Befintliga API-kunder utan webbansökan

`/aktivera-kundkonto` använder den riktiga verifierade webbinloggningen och ett
uttryckligt kundnummer. E-postadressen hämtas från Auth och måste vara bekräftad.
Den befintliga portal-sync-vägen kontrollerar samma origin, en liten request-body
och delade gränser per användare och IP. Inga användar-ID:n eller roller tas från
formuläret. Ett befintligt stabilt kundnummer får inte bytas genom aktiveringen.

Först används OPS ordinarie kundsynk med kundnummer, verifierad mejl och färskt
kundintyg. Därefter används den kanoniska externreferensen i portal-sync; endast
`linked`, `access_granted: true` och ägarrollen godtas. Kundnummer, externreferens
och mejl läses tillbaka från `/customer/me` innan den lokala profilen skrivs med
befintligt skydd mot samtidiga identitetsändringar. Återförsök behåller samma
operationsnycklar och samma ursprungliga request-body även efter lokal skrivning.
Saknad kanonisk externreferens eller motstridigt underlag kräver kundservice.

Flödet skapar ingen Auth-användare/session, webbansökan, fullmakt eller personalroll.
Det gör det möjligt att använda en befintlig OPS-kund utan att fabricera historiska
onboardingjobb. Det tidigare npm-kommandot `backfill:portal-customer` togs bort
eftersom dess skript saknades. Aktiveringen sker genom den verifierade kundsessionen.
