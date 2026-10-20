# Mätning av API-prestanda och cache

Mätningen använder befintliga serverloggar. Den lägger inte till någon
exporttjänst, browser-beacon, databaslagring eller nytt externt anrop.

Varje mätpost börjar med `[gridex-api-performance]` och har schema
`gridex.api-performance.v1`. Endast fasta operations-/routenamn, HTTP-metod,
status, utfall, tidsvärden och räknare ingår. Querysträngar, adress, IP, e-post,
kundreferenser, API-nycklar, cookies, tokens, underlag och svarsinnehåll ingår inte.

## Vad som mäts

| Nivå | Värden och betydelse |
|---|---|
| Webboperation | Serverns tid för avtalskatalog, adress/elområde, prisberäkning, quote-validering och aktuellt marknadspris; fel omfattar både kastade fel och HTTP 4xx/5xx. Avtalsfeed från sidrendering mäts också. |
| OPS-anrop | Logiska anrop, antal faktiska `fetch`-försök, omförsök, observerade 429-svar, senaste HTTP-status och total anropstid inklusive väntan/omförsök. Transporten använder `no-store`; ingen ny återförsökspolicy införs. |
| Organisationscache | `hit`, `miss`, `join` för delat pågående anrop och `bypass` för uttrycklig färsk kontroll. |
| Avtalssnapshot | `hit` enbart när en databaspost klarar identitets-, ålders- och innehållskontrollerna; annars `miss` eller `error`. |
| Next avtalscache | `lookup` och faktisk `fill`-körning redovisas separat. De räknas inte om till en påstådd exakt träffgrad, eftersom Next kan återvalidera i bakgrunden och dela arbete. |
| Bakgrundsuppdatering | Schemalagda och delade feed-uppdateringar samt deras separata OPS-anrop. |

HTTP-operationens mätpost samlar dess OPS-anrop och cachebeslut i en loggrad.
Nästlade mätningar dubbelräknas inte. Parallella besök hålls isär med
`AsyncLocalStorage`. OPS-anrop utanför en mätt operation får en egen post;
bakgrundsarbete efter svaret följer samma regel. Högst 32 OPS-observationer ryms
i en operationspost; ytterligare observationer anges som trunkerade.
Fel i loggningen får inte ändra affärsresultat eller orsaka omförsök.

## Ta fram en rapport

1. Välj Web-projektet och rätt produktionsdeployment i Vercels runtime-loggar.
   Filtrera på `gridex-api-performance` och välj ett tydligt tidsintervall.
   Exportera de filtrerade posterna som JSON/JSONL till en privat fil.
   Connectorn `get_runtime_logs` kan användas med deployment, samma sökord och
   tidsintervall; dess resultatformat stöds också.
2. Kör exempelvis:

   ```sh
   npm run perf:api:report -- /tmp/gridex-runtime-logs.json --output /tmp/gridex-api-report.json
   ```

3. Kontrollera antal poster, urval och eventuell trunkering innan resultatet
   används som beslutsunderlag. Loggtjänstens gränser och retention kan göra en
   export ofullständig. Verktyget sammanställer endast de tillförda posterna och
   extrapolerar inte till dygnstrafik eller kostnad.

Rapporten visar p50/p95 med närmaste rang och antal prover per operation och
OPS-route. Privata kund-/personalrutter grupperas; dynamiska identifierare
ersätts med fasta etiketter. Importerade loggar filtreras igen före rapportering.

Träffgrader anges i procent. Direkt träffgrad beräknas som `hit / (hit + miss + join)`; undvikna läsningar som
`(hit + join) / (hit + miss + join)`. Uttrycklig bypass och fel redovisas separat.
Snapshotcachen har ingen join-gren, så dess kvot jämför bara faktiska träffar och
missar när databasen konsulteras.

## Tolka resultatet

- Högt antal missar med låg träffgrad: undersök instansernas livslängd, nycklar
  och behörig TTL innan en ny gemensam cache införs.
- Många feed-uppdateringar jämfört med läsningar: granska återvalidering och
  webhookflöde innan giltighetstiden ändras.
- 429 eller många läsomförsök: granska anropsmönstret och OPS-gränserna.
  Skrivningar fortsätter att skickas en gång med sitt ursprungliga underlag.
- Högt p95 med få prover: samla ett större representativt urval. Browserns TTFB,
  rendering och slutanvändarens nätverk behöver mätas separat.

Räknarna avser Web → OPS. De mäter inte OPS → Papilite/andra geografileverantörer,
deras träffgrad eller deras debitering. Browserns lokala återanvändning ger inget
serveranrop och kan därför inte räknas direkt i serverloggen. Teckningsflöde,
slutlig avtalsvalidering, signeringsbevis och kundbehörigheter ändras inte.

## Kontrollerade samtidighetsprov och anropsbudget

OPS-kvoten räknas med vikt per anrop, inte bara antal HTTP-förfrågningar.
Den aktuella OPS-registreringen använder `read=1`, `write=3` och `expensive=10`;
en ny website-quote kostar10. Läs den aktiva klientens minutgräns före ett prov.
Räkna också organisationskontroll, katalogrevalidering, marknadspris och legal-
läsningar som Web gör bakom en enda browserförfrågan. Webbens egna gränser per
IP/endpoint gäller parallellt och ersätter inte OPS gemensamma klientkvot.

Ett prov ska ha en fast övre gräns för samtidighet och viktad trafik per minut,
avbryta ny schemaläggning vid första429/5xx och aldrig spela om en skrivning.
Fördela större prov över separata kvotfönster med marginal för bakgrundsarbete.
Ett429-svar är inte ett lyckat kapacitetsprov; spara även den avbrutna körningen.
Slutsatser om högsta kapacitet kräver ett separat representativt underlag.

Prisberäkning och prisvalidering vidarebefordrar nu OPS validerade `Retry-After`
till browsern, genom samma hjälpfunktion som kundportalens felhantering.
Väntetiden avrundas uppåt och ogiltiga värden avvisas. Lokal begränsning av
prisvalideringen returnerar sitt eget återställningsintervall. Detta skapar
inga automatiska omförsök av quote-/avtalsanrop och ändrar inga kvoter.
