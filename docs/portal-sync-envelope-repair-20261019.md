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
kundskrivningssviten.

## Verifierat driftläge den 20 oktober 2026

Efter användarens uttryckliga publiceringsgodkännande publicerades kodversion
`7c3cbb477c6ce86b6e4dba59d669e52e3f7ec2b9` på `gridex.se` i deployment
`dpl_97HJJ4SbZjN86HvqNMFvjWL4Z29v`. Samma version och READY-status lästes
tillbaka den 20 oktober cirka 07:50 UTC.

Användaren genomförde det verkliga inloggade kundkopplingsprovet den 19 oktober
och bekräftade att Mina sidor öppnades. Oberoende Web-läsning 14:53:20 UTC
bekräftade rätt kundnummer, sparad externreferens och `onboarding_state = verified`.
Motsvarande OPS-synk slutfördes med HTTP 200 och `synced` 14:52:45 UTC.
Kundkopplingen är därmed verifierad i den verkliga kundsessionen.

## Fullmaktens separata leverans

OPS-versionen från PR 828, `6db93e76da9337b4bfa36e091fe7d0a1d2d9b008`,
publicerades den 19 oktober i deployment `dpl_DfYURUHz2f5M1iJKSnfFRTnvJ2DS`.
Ägarens releasekvitto bekräftar fyra installerade migrationer och godkänd
katalogkontroll. Ordinarie migrationstest och certifiering har terminal SUCCESS.
Den publicerade arkivspecifikationen kontrollerades separat den 20 oktober;
HTTP 200 och faktisk SHA-256 matchar Webs incheckade kontrakt byte för byte.

Den kontrollerade testfullmakten har ursprunglig godkännandetid och sparad IP.
Databasläsningen den 20 oktober 07:50 UTC visar fortfarande att PDF-sökväg,
arkivmetadata, arkivhash och verifikationsreferens saknas. IP-värdet i evidensen
matchar sparad IP, men `ip_address_source` saknas. Det är inte en slutverifierad
IP-källa. Kontrollsumman för det oföränderliga ursprungsunderlaget är identisk
med föregående kontroll; inget nytt samtycke, IP eller klockslag har lagts till.

Ägaren för originalklientens skyddade runtime behöver slutföra det redan
godkända anropet med exakt ursprungligt underlag och idempotensnyckel. Därefter
återstår verklig arkiv-/PDF-läsning i behörig kundsession, jämförelse av faktiska
PDF-bytes med SHA-256 och verifikationsreferens samt kontroll av ursprunglig
IP/tid och deras källor. Denna webbrättning utför ingen parallell originalreplay.
Hela fullmaktsflödet är ännu inte godkänt i drift.
