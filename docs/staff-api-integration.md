# Separat personalyta genom OPS API

`support123.gridex.se` tillhör Web-projektet och visar endast personalens
arbetsyta. Det finns ingen reservväg till OPS interna konsol. Kundens
`/support-center` och `/dashboard/support` finns på huvuddomänen.

Kontraktet är fristående `staff-support-v1`, version `2026-10-03.1`; det
ändrar inte Website/Customer Portal `2026-10-02.4`. Den godkända lokala
specifikationens råbyteshash är
`cf524f691b2ebd37ef8dfcc4b898c55fc74a99c930a59089235adbfda2752d71`.
Lokala filer, genererade typer och tester bevisar lokal integration. Publicerad
OPS-release, verklig API-nyckel, personliga behörigheter, e-postleverans,
värdbundna cookies och domän/TLS måste verifieras separat innan driftklarhet.

## Konfiguration och identitet

Webs server kräver `GRIDEX_STAFF_OPS_API_URL=https://app.gridex.se/api/v1`,
en separat `GRIDEX_STAFF_API_KEY` och `GRIDEX_STAFF_SESSION_COOKIE_SECRET`
(kanonisk base64 av exakt 32 slumpbyte). Inga kundnycklar eller Auth-SDK:er
används som reserv. Maskinnyckeln väljer OPS-organisation och scopes:
`staff_sessions.write`, `staff_context.read`, `staff_customers.read`,
`staff_support.read`, `staff_support.write`. Den personliga OPS-sessionen
måste samtidigt ge rätt native behörighet. Protokollkapabiliteter i en
release är inte en personals rättigheter.

Kundläsning kräver `customers.read`, ärendeläsning `cases.read`, ändring
`cases.write`. Plattformspersonal kan endast läsa maskinnyckelns organisation.
Web kontrollerar aktuella capabilities och permissions för navigation; OPS
kontrollerar verklig native identitet, roll, medlemskap och bolag för varje
operation. MFA- och lösenordssteg får aldrig läsa kunduppgifter.

OPS utfärdar femminuters personligt åtkomstbevis och en roterande
förnyelsecredential med högst åtta timmars absolut session. Web lagrar endast
den dokumenterade receiptens fält i AES-256-GCM-krypterad
`__Host-gridex_staff_session`: Secure, HttpOnly, SameSite=Lax, Path=/, ingen
Domain. Browsern får status, aktuellt CSRF-värde, MFA-faktorreferenser och
säkra identitets-/behörighetsfält; aldrig tokenreceipt eller maskinnyckel.

## Komplett operationsmatris

Prefix i tabellen: OPS `/api/v1/staff`, Web BFF `/api/staff`. Web använder
endast fasta dokumenterade paths, validerar request och response mot den
fristående specifikationen och avvisar okända filter/fält/headers.

| OPS operation | Web BFF/UI | Beteende |
| --- | --- | --- |
| POST `/sessions` | POST `/session/login`; StaffAuth | E-post/lösenord till OPS servervägen; säker publik sessioncontext. |
| POST `/sessions/refresh` | POST `/session/refresh`; serverns automatförnyelse | Samma ursprungliga credential/body och deterministiska sessionsbundna idempotensnyckel efter osäkert svar eller samtidighet. |
| POST `/sessions/logout` | POST `/session/logout` | Raderar alltid browserns cookie efter auktoriserad logout, även vid upstreamfel; ny anonym bootstrap. |
| POST `/sessions/mfa/challenge` | POST `/session/mfa/challenge` | Dokumenterad TOTP-faktor; endast begränsad MFA-session. |
| POST `/sessions/mfa/verify` | POST `/session/mfa/verify` | Sex siffror; stabil nyckel för samma kod/operation, ny kod får ny nyckel. |
| POST `/sessions/password` | POST `/session/password` | Endast obligatoriskt/recovery-lösenordssteg; slutförs före kundåtkomst. |
| POST `/sessions/recovery` | POST `/session/recovery` | Neutral 202 accepted; inget kontoläckage eller leveranspåstående. |
| POST `/sessions/recovery/verify` | POST `/session/recovery/verify` | Explicit verifieringsknapp; proof från minnet till OPS; begränsad session. |
| GET `/me` | GET `/session`; StaffPortal | Färsk OPS-identitet och verkliga permissions/capabilities. |
| GET `/customers` | GET `/customers`; StaffCustomers | q/status/customer_type, dokumenterade limit/cursor. |
| GET `/customers/{customerReference}` | Samma path; StaffCustomerCard | Maskerat personnummer och explicit offentligt DTO. |
| GET kundens `/contacts` | Samma path; kundkort | Egen fullständig cursorlista. |
| GET kundens `/addresses` | Samma path; kundkort | Egen fullständig cursorlista. |
| GET kundens `/facilities` | Samma path; kundkort | Egen fullständig cursorlista. |
| GET `/support/cases` | Samma path; StaffCases | q/status/priority/customer_reference/assignee_reference och paging. |
| POST `/support/cases` | Samma path; ny ärendeform | OPS kund/facilityreferenser; intern beskrivning; idempotens. |
| GET `/support/cases/{caseReference}` | Samma path; StaffCaseDetail | Uppdateringstid som underlag för samtidighetskontroll. |
| GET ärendets `/entries` | Samma path; ärendet | Sidindelade kundmeddelanden, personalsvar och interna anteckningar. |
| POST ärendets `/replies` | Samma path; svarform | Kundsynligt meddelande/phone_summary; explicit idempotent receipt. |
| POST ärendets `/internal-notes` | Samma path; anteckningsform | Separat intern operation; ingen kundsynlig låtsasstatus. |
| POST ärendets `/status` | Samma path; statusform | Förväntad updated_at; konflikt kräver ny läsning. |
| POST ärendets `/assignment` | Samma path; tilldelningsform | Staffreferens/null plus förväntad updated_at. |
| GET `/support/assignees` | Samma path; tilldelningsform | Bolagsavgränsade handläggare, egen cursorlista. |
| GET ärendets `/attachments` | Samma path; ärendet | Visar faktiskt scan_status; paging och kund/intern synlighet. |
| POST ärendets `/attachments` | Samma path; bilageform | Multipart PDF/PNG/JPEG högst 4 MiB, en fil; receipt kan vara avvisad. |
| GET ärendets `/attachments/{attachmentReference}` | Samma path; skyddad nedladdning | Verifierat privat binärsvar högst 10 MiB, SHA-256, längd, sandbox/nosniff; ingen offentlig URL. |

Alla mutationer, inklusive login/recovery, kräver exakt
`Origin: https://support123.gridex.se`, krypterad host-cookie och aktuellt
`X-Gridex-Staff-CSRF`. Browserns extra identitetsfält kan inte välja en kund,
personal eller organisation. Resursskrivningar och konsumerande authsteg
använder dokumenterad Idempotency-Key. Ändrat innehåll får en ny nyckel.

Proxy-matchern omfattar alla vägar och metoder. Filändelser och saknade filer
kan fortfarande väljas för Next Server Actions; `.js`, `.css`, ikon-, brand-
och frameworkvägar får därför aldrig undantas från skrivspärren. Endast
GET/HEAD för uttryckliga publika tillgångar släpps igenom efter hostkontrollen.
Den native kundinloggningen och de gemensamma native Auth-klientfabrikerna
nekar dessutom personalhosten, även vid intern action-forwarding, före
argumentvalidering, cookieläsning och providerkonstruktion.

OPS verifierar native session under exklusiv lease. Endast säkra GET kan
återförsökas högst åtta gånger när exakt `409 staff_session_busy` är retryable
och har giltig Retry-After, inom en gemensam deadline. Mutationer skickas
inte om automatiskt. Canonical errors behåller kod, retryable, blockers,
request/correlation och Retry-After; personligt providerfel ersätts med säker
svensk text. 409 raderar inte en fungerande cookie.

Återställningsmejl använder fast
`https://support123.gridex.se/login/recovery#token_hash=…`. Fragmentet är
känsligt: klienten raderar det synkront med replaceState innan någon effekt
eller HTTP-förfrågan och håller det endast i minnet. Det renderas aldrig och
verifieras först efter användarens uttryckliga knapptryckning.

## Release- och regressionkontroller

`npm run api:staff:generate`, `api:staff:check:local`, `api:staff:check:live`
och `api:staff:sync` arbetar fristående från kundkontraktet. Sync godtar endast
kvalificerad publicerad manifest och identiska mutable/immutable råbyteshashar.
Runtime kräver rätt version, guide/minversion, verklig 40-hex build_commit,
alla sex protokollfamiljer och exakt lokal SHA innan auth eller data anropas.
Releasecache gäller högst en minut och kan aldrig ersätta personlig
auktorisation. Saknad config, fel hash, draft eller otillgänglig API ger en
stängd personalyta med säker feltext, utan native konsol eller kundfallback.

`test:staff` kör lokal raw-byte/type-kontroll och verkliga session/boundary,
BFF/transport/schema och TSX-komponenter. Testerna verifierar bland annat
Origin/CSRF, tokenprivacy, återförsök efter fel lösenord, begränsade steg,
sidmetadata, samtidiga läsningar/förnyelse, exakt replay, safe errors,
bilagor och logoutfel. Host/proxytestet kör verklig NextRequest/NextResponse;
build och HTTP/browserkontroll måste dessutom visa att personalsidorna
saknar huvudsidans footer, tracking och kundregistrering.
`test:staff:http` använder den byggda serverns verkliga login-action-ID och
React encodeReply med ett tomt formulär: alla extension-/assetvägar ger 403
utan native redirect, medan huvudsidans tomma login ger sin ursprungliga
valideringsredirect och verkliga ikontillgångar fortfarande går att läsa.
