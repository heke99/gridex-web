# Gridex Web: full API- och databasgenomgång 2026-10-18

Webbrättningarna är publicerade på gridex.se och www.gridex.se från
`7f650231442ac6b745aeb3a625415453d846f241`, READY
`dpl_GHAv3SEErU8VCrJV3i1qSYix8cDG`. Vercel-skyddet är kvar. Samma källa
funktionsprovades i skyddad förhandsversion. Supportdomänen pekar fortsatt på
personalprojektet. Granskningen ger inte stöd för att förklara alla OPS-delar
helt färdiga: fullmakts-PDF/verifikationsnummer saknas fortfarande och ett
separat internt OPS-jobb har ett behörighetsfel.

Källa: https://app.gridex.se/developers/customer-portal-api, release 2026-10-12.1,
runtime 2026-10-09.1. Alla tre live-specifikationer stämmer bytevis med den
manifestkontrollerade koden. Tidigare endpointmatris omfattar 142 operationer;
arkiv/alias/alternativa Partner-ytor behandlas separat från aktiva affärsflöden.

## Genomförda flöden

| Punkt | Kontrollerat resultat |
| --- | --- |
| Adress och elområde | Syntetiska adresser i SE1, SE2, SE3 och SE4 får motsvarande kanoniskt OPS-område. Samma adress kan återanvändas. Oupplösbart postnummer ger 409. |
| Nätägare och anläggning | OPS-fälten och deras capabilities styr flödet; en prisbar postnummerupplösning räknas inte som verifierad nätägare/anläggning eller godkänd fysisk dispatch. Ingen nätägare gissas av webben. |
| Priser och teckning | Båda publicerade typerna, fast och månadsrörligt, ger kanoniska offerter/validering i SE1–SE4. Företagskund provades också för båda typerna. Juridiskt paket och marknadspris svarar 200. Oförändrad offert efter avbrott valideras med samma underlag. Inget nytt elavtal skapades i denna efterkontroll. |
| Mina sidor | Ett separat märkt Auth-testkonto skapades, lösenordsinloggning lyckades och dokumenterad OPS-synk gav linked/access_granted. Elva kundresurser samt Mina sidor och supportsidan svarade 200 i en sammanhängande körning. |
| Kundresurser | Profil, avtal, anläggning, fakturor, dokument, juridiska godkännanden, fullmakt, händelser, mätvärden, notiser och portal-bundle lästes med testkundens faktiska session. Fakturor och mätvärden var korrekta tomma listor för provet. |
| Publika priser | /elpriser, samtliga fyra områdessidor och dagens prissida ger 200. Informativa live-/dag-/månads-API:er ger 200 med dokumenterad extern spotpriskälla; de ersätter inte OPS i checkouten. |
| Avtal, IP och PDF | Det tidigare uttryckligen godkända riktiga avtalsprovet behöll ursprunglig IP/tid och identisk signering vid replay. Avtals-PDF levererades och leverantörens bytes verifierades. Detta är separat från fullmaktsarkivet. |

Testkontot har loggats ut och tagits bort. Dess centrala testidentitet har
avaktiverats och provkundens tillfälliga kontaktändring återställts. Den gamla
Auth-sessionen nekas med 401. Alla tillfälliga förhandslänkar är återkallade.
Ingen annan användares konto eller behörighet har använts för provet.

## Databas och rättningar

138 tabeller har RLS och 48 vyer använder security_invoker. Sju lagringsbuckets
är privata. Kodens 250 statiska SDK-anrop jämfördes mot 48 använda tabeller:
inga saknade obligatoriska tabeller, valda/filterkolumner eller anropade aktiva
RPC:er kvarstår. Buffer.from är inte ett tabellanrop; en uttryckligen valfri
äldre spotpristabell och en oanvänd set_config-hjälpare är separat klassificerade.
Ägarkontroller, privata audit-/outboxpolicys, service-grants, unika referenser,
köindex och en läsfrågas query-plan granskades. Kundberedskapsfunktionen ger
ready=true utan saknade beroenden. Detta ersätter inte ett lastprov.

Tre saknade äldre pris-RPC:er återställdes med befintlig testad migration
`20261006205014_legacy_pricing_atomic_writes.sql`. De kan endast köras med
service_role. Inga befintliga priser eller publiceringar ändrades.

Användaradministrationens verkliga schemafel är rättade: verifierad admin krävs
innan service-only Auth-listningen, profilen använder user_status och globala
roller hanteras mot rätt nycklar utan att skriva om tenantroller. Skapande
kontrollerar profil-/rollfel och städar endast det precis nyskapade Auth-kontot
vid misslyckad initiering. Aktivering uppdaterar Auth och profil med återställning
vid profilfel. Felaktigt mål och självavaktivering stoppas. Samtidiga rollinsert
verifieras mot den faktiska globala raden.

24 nya beteendeprov, hela npm test, TypeScript, produktionsbygge,
leveranskontroll och avgränsad ESLint är godkända. Den gamla källtextkontrollen
av exakt strängen maybeSingle() ersattes med hänvisning till 13 befintliga
beteendeprov, eftersom ett TypeScript-typargument inte ändrar frågans beteende.

Säkerhetsrådgivaren har inga ERROR. Nio avsiktliga sessionsexponerade
SECURITY DEFINER-hjälpare har granskats för egen identitet/företag/behörighet.
Övriga observerade råd gäller äldre dubbla index/policys och otäckta FK-index;
ingen generell borttagning har gjorts. Varningen för
[läckta lösenord](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
kvarstår i Auth-konfigurationen. Råden för
[dubbla index](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index)
och [FK-index](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
är dokumenterade som prestandaråd, inte som bevisade API-fel.

## Kvarstående OPS-frågor

- Fullmakten syns i det autentiserade dokument-API:t men saknar MIME-typ och
  nedladdningslänk. Arkivet är JSON, utan PDF-sökväg, PDF-hash eller separat
  verifikationsnummer. Partner-läsningen har tidigare gett 200 utan fil.
  Aktuell guide lovar inte automatisk Website-fullmakts-PDF; det är ändå ett
  uttryckligt kvarstående användarkrav. Webben har inte fabricerat ett nummer.
- Flera OPS-anrop timeoutade under en avgränsad period. En direkt
  management-DB-anslutning timeoutade också; det bevisar inte ensam orsaken.
  Senare separata kundläsningar gav 200 på 1068/650/592 ms och hela
  kundportalprovet gick igenom. Ett kort 503-avbrott vid validering följdes av
  200 för exakt samma offert. Orsaken är inte fastställd och ingen permanent
  upstream-rättning påstås. Tidsgränser har inte höjts utan underlag.
- OPS-jobbet loggade först permission_execution_actor_unqualified. Efter ett
  uttryckligt användargodkännande aktiverades det befintliga tjänstekontot via
  canonical_change_tenant_user_access: en aktiv profil, ett accepterat medlemskap
  och operations_manager enbart i Gridex El AB, med verifierad revisionshändelse.
  Efter detta loggade supplyMarketDeadlines PGRST202: public.ediel_advance_supply_deadlines_v1
  saknas, liksom dess privata föregångare och normal_activation_sweep_cursors.
  Detta kräver en kvalificerad OPS-schemautrullning. Inga stubbfunktioner eller
  behörighetsgenvägar har lagts till.

Ingen verklig elanläggning, leverantörs-/nätägar-dispatch, fakturabetalning,
produktionslast har kvalificerats av detta ursprungliga prov. Riktig personalinloggning
bekräftades senare av användaren, se driftuppföljningen nedan.
Det syntetiska Auth-kontots administrativt bekräftade e-post bevisar inte kundens
inbjudnings-/SMTP-leverans. Avtalsmejlets tidigare verifierade leverans är separat.

Maskinbevis finns i quality/api-compatibility/full-reaudit-20261018.json,
live-portal-reaudit-20261018.json och live-area-reaudit-20261018.json.

## Driftuppföljning 21:06 UTC

Support123 kör nu lösenordsåterställning från 88ce1b2 på produktion
(dpl_4UXeGK1zQ5jBUTfX5X5wSGcBQP11). Native PKCE, verifierad egen identitet
och befintliga personalbehörigheter används. 19 återställningsprov, hela
personalsviten, TypeScript, bygge, 28 isolerade webbläsarprov samt sju kontroller
vardera på förhandsversionen och support123.gridex.se passerade. Förhandsmiljöns
publika Auth-konfiguration kompletterades; privata nycklar förblev produktionsbundna.
Ingen återställningslänk eller lösenord hämtades och inget återställningsmejl
skickades av testerna. Användaren kan begära länken via Glömt lösenord.

32 publika sidor och samtliga fyra områdens fast-/månadsprisflöden kontrollerades
på nytt. Alla tre dokumentkontrakt matchar fortfarande OPS 2026-10-12.1.
Alla tillfälliga förhandsdelningar är återkallade.
Detaljer: quality/api-compatibility/live-production-followup-20261018.json och
support-password-recovery-20261018.json.

## Driftuppföljning 21:45 UTC

Användaren har bekräftat riktig inloggning på Support123. Det befintliga kontot
och identitetskopplingen fanns; rollen `owner` saknades däremot i Staff API:s
behörighetsprofiler. Den tidigare godkända administratören fick därför den
stödda `company_admin`-rollen genom det kanoniska, loggade tenantkommandot.
Befintliga registrerade behörigheter och bolagets ägarpost bevarades.
Efter rättningen gav identitets-, ärende- och kundläsning 200. Lösenordet
hämtades eller ändrades inte av verktygen.

Support123 kör nu källa `9a7a82e338130a6055ed5ed65aaa99a168cc1798`,
READY `dpl_KMhcV8LdtRcqZLxLRmDPCuKvMUUV`. Nya återställningsmejl använder
en separat publik Auth-klient utan webbläsarbunden PKCE-verifierare.
Callbacken tar bort fragmentet från adressfältet och kräver uttrycklig POST,
native verifiering/rotation och exakt matchande UUID innan lösenordsformuläret
öppnas. Äldre PKCE-länkar behåller sin ursprungliga webbläsarkoppling.

34 återställningsprov, hela personalsviten, typer och lint passerade.
28 isolerade webbläsarkontroller samt åtta kontroller vardera på aktuell
förhandsversion och produktion passerade utan JavaScript-fel. Ett separat
verkligt Auth-prov skapade en uttryckligt märkt syntetisk användare, genererade
en native återställningslänk utan mejlutskick, öppnade den i en ny
webbläsarsession, ändrade lösenordet och verifierade ny lösenordsinloggning.
Den ursprungliga e-postverifieringslänken nekades vid återanvändning. Kontot
saknade personalbindning och nekades personalytan. Det togs sedan bort:
kvarvarande Auth-fixturer är noll och den borttagna sessionen nekas.
Detta kvalificerar inte Auth SMTP-leverans. Alla tillfälliga förhandsdelningar
är återkallade.

PR830:s oförändrade granskade OPS-källa har 18 godkända och 11 villkorligt
överhoppade kontroller, utan väntande/felande kontroller. Två oberoende
granskare har godkänt källans tillämplighet mot nya main `61b29f0c`. GitHubs
rapporterade provmerge använder fortfarande historiska basen `8ccad787`: de
gröna kontrollerna utgör inte provning av det nya sammansatta trädet. Befintlig
seriell leveransägare måste kvalificera den kombinationen före normal merge.
Detta är inte en OPS-release.
Den separata fullmaktsrättningen i PR828 saknar ännu kvalificerad leverans;
dess förberedda bygge avbröts av `BUILD_EXCEEDED_MAXIMUM_TIME`. Saknad
leveransfrist-RPC och dess privata beroenden kvarstår. Projektet är därför
inte kvalificerat som helt färdigt.

Detaljer: `support-staff-role-repair-20261018.json`,
`support-password-recovery-20261018.json`,
`native-support-recovery-20261018.json` och
`live-production-followup-20261018.json` under `quality/api-compatibility/`.
