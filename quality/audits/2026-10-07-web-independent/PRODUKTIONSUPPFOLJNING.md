# Gridex Web – produktionsuppföljning 7 oktober 2026

Omfattning: Webs profilsynk efter Auth-bekräftelse, Webs egna publika supportärenden och kvittens. OPS interna utskick eller avtalsmejl ingår inte.

## Åtgärdat i produktion

Databas: Supabase `ayiuxjlfazkjmmtlvhsl` (gridex-prod), anslutning ”gridex web”. Befintliga tabeller och kolumner kontrollerades före ändring. Två befintliga migreringar tillämpades genom Supabase apply_migration:

- `20261006204008_customer_portal_audit_hardening.sql`: sessionsbundna behörighets-/inloggningsfunktioner, serverägda kundprojektioner och beständig Auth-profilsynk.
- `20261006205027_public_support_durable_receipts.sql`: atomiskt supportintag, idempotens, kvittenskö, service-behörigheter och RLS.

Verifierade effekter:

- Alla sju berörda RPC-funktioner finns.
- Sessionsfunktionerna får anropas av authenticated men avvisar saknad Auth-session.
- Intag, kvittensclaim och profilsynk får endast köras av service_role, inte anon/authenticated.
- anon/authenticated saknar tabell- och kolumnskrivrättigheter på customer_profiles, customer_delivery_points, customer_notifications och customer_contracts.
- public_support_receipts har RLS och är tom efter test.
- Syntetiskt service_role-test inuti en transaktion verifierade ärende, meddelande, kvittens, återanvänt åtgärds-ID och konflikt vid ändrad payload. Transaktionen rullades tillbaka; inga beständiga kundposter eller mejl skapades.

Vercel produktion har nu `GRIDEX_SUPPORT_RECEIPT_RESEND_KEY` som Sensitive och `GRIDEX_SUPPORT_RECEIPT_FROM` = `Gridex Kundservice <support@gridex.se>`. En separat Resend-nyckel skapades med sending_access begränsad till den verifierade domänen gridex.se. Befintliga nycklar, Auth och OPS-konfiguration ändrades inte. Inga nyckelvärden lagras i rapporten eller Git.

Konfigurationen aktiverades med en ombyggnad av den redan driftsatta versionen:

- deployment: `dpl_AZs3yWMSDsKv3FqrVs4Ce5K9Rj6E`
- target/status: production / READY
- SHA: `d7b5cd510e8b99213ffbde1f59b1538b9e69ceee`
- produktionsalias: https://gridex.se
- separat deploymentadress: https://gridex-gbu4jn724-div3rsa.vercel.app

De tolv kodrättningarna i `c819bd3` är fortfarande separata från denna produktionsversion.

Efter aktivering gav `/`, `/login`, `/kundservice` och `/api/web/contracts` HTTP 200. `/api/web/customer/contracts` gav korrekt 401 utan inloggning. Fel-/fatal-loggar för nya deploymenten var tomma vid avläsning omkring 09:44 UTC. Ett kort tomt loggfönster är inte långsiktig driftverifiering.

## Kvarstår och är inte godkänt som verifierad leverans

1. Verklig supportkvittens ska provas med en kontrollerad testadress och tillstånd till ett testutskick. Adress/tillstånd efterfrågades; inget testmejl skickades i denna uppföljning. Kö och avsändare är installerade men slutlig leverans är ännu inte bevisad.
2. Supabase Auths aktiva SMTP/hook, mejlmallar och verification/recovery-leverans är inte inspekterade genom nuvarande verktyg. Resends verifierade domän bevisar inte Auths konfiguration.
3. Supabase-advisorn rapporterar fortfarande avstängt skydd mot läckta lösenord. Detta är inte aktiverat här. Inställningen måste kontrolleras och ändras i Auth-konfigurationen, därefter verifieras. [Supabase vägledning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
4. Äldre onboardingjobb med identitetskonflikt är inte tvångskopplade eller återspelade. De kräver kontrollerad identitetsutredning, inte matchning enbart efter mejladress.
5. Full releasepreflight är fortfarande blockerad. Saknade release-SHA-/E2E-evidensvariabler fylldes inte med påhittade godkännanden. Prismigreringen och den breda readiness-funktionen nedan är inte installerade. Index-/policyoptimeringarna från den bredare revisionen tillämpades inte i denna avgränsade mejluppföljning.

## Automatisk godkännandegranskning

Två åtgärder avvisades av auto-review och försöktes inte igen via andra vägar:

- `20261006205014_legacy_pricing_atomic_writes.sql`: produktionsschema och privilegierade create/update/publish-funktioner för priser bedömdes ligga utanför support-/profilsynkarbetet och kunna påverka livepriser. Migreringen skapar funktioner och kolumner; den anropar inte publicering eller ändrar prisrader vid installation. Godkännande behövs före tillämpning.
- `20261006210639_audited_release_preflight.sql`: den breda SECURITY DEFINER-readiness-funktionen omfattar även personal-/invitation-deliveryfunktioner, som review bedömde ligga utanför aktuell omfattning. Kunddelarnas readiness verifierades i stället direkt med katalogfrågor och rollback-test, utan att installera den avvisade funktionen.

## Migrationer och framtida release

Supabase-verktyget registrerar tillämpningar med sin egen ledger-version. Stäm därför av ledgerns namn, version och faktisk SQL-effekt mot källfilerna före en senare CLI-release. Återspela inte oktoberhistoriken eller kör db push blint. Denna uppföljning ändrar inte äldre ledgerposter.

Säkerhetsadvisorn visar förväntade varningar för authenticated SECURITY DEFINER-sessionwrappers; dessa funktioner binder anropet till auth.uid och avvisar saknad session. Befintliga service-tabeller med RLS utan klientpolicy ska inte få breda klientpolicyer enbart för att ta bort en advisory. [Advisorns vägledning](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Slutförande av Web-delarna efter avgränsningen

Uppföljt efter användarens uttryckliga instruktion att enbart arbeta med Gridex Web. Prismigreringen och den tidigare breda readiness-migreringen ska inte tillämpas inom detta arbete. De är inte längre efterfrågade godkännanden eller blockerare för Webs egna kundmejl.

Genomfört:

- Ny `gridex_web_customer_readiness_v1()` är installerad med SECURITY INVOKER och endast service_role-exekvering. Den granskar Webs sex kund-/kötabeller, RLS, tabell-/kolumnskrivrättigheter och sju Auth/support-RPC:er. Den läser inga kundposter och har inga beroenden till prisadministration, personalutskick eller upstreamscheman.
- Produktion gav `ready=true`, `missing=[]`, `schema_revision=2026-10-07-web-customer-1`.
- `scripts/check-audit-release.mjs` använder den nya kontrollen. Personalapplikationens databasvariabler och dess supportkrav ingår inte längre. Evidenskraven avser Webs egna checkout/support/Auth-flöden. Obestyrkt Auth-/inkorgsleverans sätts fortfarande inte till godkänd.
- `WEBSITE_RESULT_TOKEN_SECRET` har konfigurerats som en separat Sensitive-variabel i Webs produktionsprojekt. Dess värde visas eller lagras inte i Git. Den aktiveras i nästföljande deployment.

Verifiering av supportens faktiska sändväg:

1. Ett tekniskt ärende skickades genom `https://gridex.se/api/support/public` till Resends dokumenterade testadress `delivered+gridex-web-support@resend.dev`.
2. API svarade 200, `ok=true`, `confirmation_status=queued`.
3. Ordinarie schemalagd Web-worker skickade kvittensen på första försöket, utan manuellt anrop till mejl-API:t.
4. Databasposten visar `status=sent`, `attempt_count=1`, `last_error_code=null`, provider-ID `01a115ce-71c3-751d-8ac4-66b97f6e8a26`.
5. Resend returnerade `Status: delivered`, skapad `2026-10-07 10:00:18.868000+00`, korrekt avsändare `Gridex Kundservice <support@gridex.se>` och korrekt kvittenstext.

Detta är Resends simulerade leveranstest och bevis för Web API → databas → schemalagd worker → provider med produktionskonfigurationen. Det är inte ett bevis på placering i en verklig kunds inkorg. [Resends dokumenterade testadresser](https://resend.com/docs/dashboard/emails/send-test-emails).

Supabase Auths publika settings bekräftar aktiverad e-postinloggning och att signup kräver mejlbekräftelse (`mailer_autoconfirm=false`). De publika settings visar inte SMTP-hemligheter, aktiva malltexter eller skyddet mot läckta lösenord. Det tillgängliga Supabase-verktyget har inga operationer för Auth-konfiguration, och CLI har ingen befintlig Management API-inloggning. Därför har SMTP/mallar/läckta-lösenord-inställningen inte ändrats eller påståtts verifierad. Den kvarvarande delen behöver hanteras via behörig åtkomst till Web-projektets Auth-konfiguration.

Regressionstesterna för den nya readiness-funktionen verifierar saknade funktioner, avstängd RLS, kolumnskrivgrants, klientåtkomst till server-RPC och nekad åtkomst till själva kontrollen. Testmiljön innehåller inga pris- eller personalfunktioner.
