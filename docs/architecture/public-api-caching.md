# Cache för publika API-anrop

Granskad 2026-10-20 mot Gridex Web och OPS produktionskälla
`6db93e76da9337b4bfa36e091fe7d0a1d2d9b008`. Detta beskriver kodens cachepolicy;
det är inte en mätning av produktionens träffgrad eller kostnad.

| Uppgift | Befintlig återanvändning | Gräns |
|---|---|---|
| Postnumrets koordinatcentrum i OPS | Databascache i `platform_address_lookup_cache`; Papilite-resultat skrivs med 90 dagars TTL | Ett postnummercentrum är inte en verifierad anläggningsadress. |
| Webbens elområdeskontroll i OPS | `platform_energy_lookup_cache`, högst 15 minuter och aldrig längre än resolutionens giltighet | Nyckeln binder tenant, normaliserade adress-/anläggningsuppgifter och cacheschemaversion. Kundbundna uppslag undantas från denna webb-cache. |
| Adresskontroll i webbens kalkylator | 800 ms debounce, ett delat pågående anrop och ett giltigt svar per monterad kalkylator | Högst 29 minuter, begränsat av OPS/tokenens giltighet. Adress/startändring rensar resultatet. Ingen lagring av adress/token i gemensam browsercache. |
| OPS organisationskontext | 60 sekunders minnescache; samtidiga normala läsningar delar ett pågående anrop | Nyckeln binder API-origin och API-nyckel via hash. `forceFresh` gör ett eget anrop. Fel sparas inte. Delningen gäller en serverinstans. |
| Publika avtalskatalogen | Next-datacache i 15 sekunder, verifierade databassnapshots, ETag och publiceringswebhook | Tenant, kundtyp, kontraktsversion, parser, schemahash och publiceringsrevision kontrolleras. OPS råsvar cachas inte av Next-fetch. |
| Generella spotprissidor | Externa dagsdata återvalideras efter 5 respektive 15 minuter i de befintliga informationsadaptrarna | Informationspriser ersätter aldrig kundens avtalspris eller en OPS-quote. |

## Ändringar i denna granskning

Organisationskontrollen delar nu ett pågående anrop när flera läsningar samtidigt
använder samma API-identitet. Ett kontrollerat test med 20 samtidiga läsningar gav
20 OPS-anrop före ändringen och ett efter ändringen. Det är en syntetisk mätning
av just detta anrop, inte en prognos över hela webbens kostnad.

Den befintliga avtalscachen är nu märkt med
`WEBSITE_PUBLIC_CONTRACTS_CACHE_TAG`, samma tagg som den signerade
publiceringswebhooken återvaliderar efter databasens atomiska eventhantering.
Tidigare saknades taggen på själva `unstable_cache`-posten. Den befintliga
15-sekunderspolicyn och webhookens stale-while-revalidate-beteende behålls.

Bakgrundsuppdateringen använder nu klientens villkorade OPS-hämtning med ETag.
Ett oförändrat innehåll kan då bekräftas med HTTP304 genom OPS billiga
fingeravtrycks-RPC, utan en ny fullständig katalogläsning. Efter bekräftad304
förnyas snapshotens tid genom befintlig atomisk lagrings-RPC. Ett stale-fallbacksvar
eller en avvisad lagring får inte bli en lyckad uppdateringsmarkör. Tenant-,
revisions-, schema- och kundtypskontrollerna behålls. Slutlig pris-/avtalsvalidering
använder fortfarande `forceFresh` utan ETag eller stale-fallback.

En långsam äldre organisationskontroll får inte skriva över en nyare verifiering.
Varken denna optimering eller katalogcachen ersätter den slutliga kanoniska
pris-/avtalskontrollen. Kunddata, signerade underlag och skrivningar delas inte
genom denna cache.

## Nästa optimeringar att prioritera efter mätning

Central servermätning och rapportsammanställning finns nu enligt
[driftguiden för API-prestanda](../operations/api-performance.md). Den visar
organisations-/snapshotcache, faktiska OPS-försök och svarstider. Next-cachefyllningar
redovisas separat från exakta cacheträffar.

1. Följ träffar/missar, antal externa uppslag, 429-svar och p50/p95 per API-route.
   Logga inte fullständiga adresser, personnummer eller signerade tokens.
2. Mät revalidering av avtalskatalogen och rätta onödiga återhämtningar innan
   dess TTL förlängs. Behåll alltid webhook, revisionskontroll och färsk
   slutvalidering.
3. Värm bara välbesökta offentliga geografidata om mätning visar många kalla
   uppslag. Lägg detta centralt i OPS, där postnummercachen redan finns, så att
   Web och personalflöden inte får olika geografiska sanningskällor.
4. Utvärdera längre cache för avslutade historiska prisperioder separat från
   dagens information. Externa prisrättelser behöver fortfarande kunna slå igenom.

Ingen ny cachetjänst, betald infrastruktur eller databasändring behövs för
ändringarna ovan. Besparing i kronor kräver faktisk trafik, träffgrad och
leverantörernas debitering.

Katalogens visnings-/reservbudget är fortsatt normalt15 minuter. Ett kallt
serverexemplar kan läsa en kompatibel, credential-/organisationsbunden snapshot
i högst24 timmar enbart som underlag för ETag-verifiering hos OPS. Den äldre
representationen får användas först efter ett lyckat200/304-svar; vid fel får
endast data inom den kortare reservbudgeten levereras. Slutlig forceFresh
använder varken denna kandidat eller dess ETag. Schemat, parsern, publicerings-
revisionen och den atomiska304-förnyelsen har samma kontroller som tidigare.
Reservbudgeten kontrolleras igen efter nätverks-/databasväntan och vid retur.
Om processens kopia är gammal kontrolleras en möjlig färsk, durabel304-förnyelse
innan reservdata nekas; en misslyckad förnyelse räknas inte som färsk data.
