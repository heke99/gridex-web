# Kundkoppling: bevara OPS-svarets omslag

## Fel och rättning

Kundaktiveringen i den publicerade Web-versionen `211bce286ef25ed90d0d53c51028b542875511fc`
nekade lyckade kundsynkar med det lokala felet `customer_link_sync_unconfirmed`.
Produktionsloggarna den 19 oktober 2026 visar felet vid 14:24:59 och 14:29:58 UTC.
Motsvarande OPS-idempotensposter är slutförda med HTTP 200 och `data.status = synced`.

`responseObject()` anropade `extractObject()`, som redan packar upp `data`.
Skrivklienterna försökte sedan läsa `row.data` en gång till. Resultatet blev tomma
status-/identitetsfält och förlorade request-/korrelationsreferenser trots ett
validerat lyckat OPS-svar. Samma hjälpfunktion används av portalsynk, övriga
kundskrivningar och kundhändelser.

Hjälpfunktionen behåller nu hela svarsobjektet. Varje klient läser därefter sitt
befintliga `data` och sina diagnostikfält. Befintliga schema-, sessions-,
kundidentitets-, ägarrolls-, läsåterkopplings- och CAS-kontroller finns kvar.
Inga databas-, behörighets-, samtyckes- eller produktionskonfigurationsändringar
ingår i rättningen.

## Verifiering

`tests/portal-write-response-runtime.test.mjs` kör verklig klient, transport,
OpenAPI-validering och tjänsten för förstakoppling. HTTP, lokal profillagring
och testets lokala intygssignerare är isolerade testgränser.

- Före kodrättningen: 5 av 10 fall misslyckades, inklusive exakt produktionsfel.
- Efter kodrättningen: 10 av 10 fall passerar.
- Hela förstakopplingen kör kundsynk, portalsynk, `/customer/me` och profilsparande.
- Återförsök bevarar ursprunglig request och operationsnycklar.
- Nekad/väntande åtkomst, fel roll/identitet och felaktigt svar kan inte skapa
  en lyckad lokal koppling.
- Ordinarie `npm test`, `npm run test:customer-writes`, `npm run test:poa-archive`,
  TypeScript, riktad ESLint, `npm run verify:delivery` och filstorlekskontroll passerar.

Det nya testet ingår i `test:portal-first-link` och därmed i den befintliga
kundskrivningssviten. Ett verkligt inloggat produktionsprov av förstakopplingen
återstår efter publicering; isolerade tester ersätter inte den kundsessionen.

## Fullmaktens separata leverans

Den kontrollerade testfullmakten har redan ursprunglig godkännandetid och IP i
OPS. Kontrollen 14:40 UTC visar att dokumenthash, PDF-sökväg och arkivmetadata
ännu saknas. Ingen ny tid/IP eller nytt samtycke skapas för att fylla dessa fält.
Den pågående OPS-leveransen i PR 828 äger arkivering och originalprov. Denna
webbrättning startar ingen parallell OPS-publicering eller originalreplay.
