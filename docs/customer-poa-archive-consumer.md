# Fullmaktsarkiv i Mina sidor

Webben använder det oberoende OPS-kontraktet `poa-archive-v1.json`, version
`2026-10-19.1`. Den incheckade filen är byteidentisk med den granskade OPS-källan
och har SHA-256
`ec70eafa96d77563771af0b20eaa71ef2134eff96f75abfd4bb1942c94295d37`.
Den förberedda oföränderliga dokumentvägen är
`https://app.gridex.se/api/v1/openapi/2026-10-19.1/poa-archive-v1.json`.
Denna separata kontraktsversion ersätter inte de tre befintliga API-paketen eller
deras gemensamma release-manifest. Slutlig liveparitet kontrolleras efter OPS-release.

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
API-nycklar lämnas till webbläsaren. Installation av OPS arkiv-/databasberoenden,
publicering av båda sidorna och det tidigare godkända verkliga kundprovet krävs
innan hela flödet kan godkännas i drift.
