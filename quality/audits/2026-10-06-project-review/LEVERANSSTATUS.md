# Leveransstatus – uppdaterad 2026-10-07

PR: https://github.com/heke99/gridex-web/pull/49

Implementationscommit: `f1c2eba0fa4b91ae0d87795612f584873ed214e8`.
Källträd: `fdfe3f636db648687899d8659293b7e6f6d1927b`, exakt samma som lokalt testade trädet.
Källhash (utan quality): `4dff3164f3d75d16d0c59aec10e1984afc94242e565039bd127717ba7205ef95`.
API: `2026-10-04.1`. Migrationsmanifest: 45 filer.

Den 2026-10-07 instruerade användaren att merga de verifierade kodrättningarna till main och ta återstående produktionspunkter senare. De skarpa punkterna nedan är därför villkor för produktionsaktivering, inte för denna kodmerge. Aktuell mergestatus och SHA verifieras i PR #49.

## Utförda kontroller

Ren npm-ci, Web- och supporttester, standardbyggen, TypeScript, lint, API-preflight och migrationskontroll passerar. Full npm-audit: noll sårbarheter. Kund/pris/status i Chromium: fem regressioner passerar. Support i Chromium: 23 kontroller, noll fel. RLS-dubblettuttryck: 665 syntetiska utfall bevaras.

GitHubs tre Actions-workflows är skapade men stod fortfarande queued vid avläsningen. Detta är inte ett godkänt CI-resultat. CodeRabbit och Vercel-preview har status success. Ingen produktionsrelease har genomförts.

## Återstående produktionspunkter

1. Supabase security advisor bekräftar avstängt skydd mot läckta lösenord. Den anslutna Supabase-verktygsuppsättningen har ingen hantering av Auth/SMTP eller dess inställningar. Kräver en åtkomstväg till Auth-konfigurationen i rätt projekt; ändra inte SQL för att försöka kringgå GoTrues inställningar.
2. Befintliga Vercel-värden är sensitive och går inte att dekryptera via anslutningen. Rätt OPS-tenant, assertionkonfiguration och servernycklar kan därför inte verifieras med autentiserade skarpa tester här. Gissa inte issuer/audience/tenant eller ersätt befintliga nycklar.
3. Testadress som användaren kontrollerar och tillåter testutskick till saknas fortfarande. Kontobekräftelse, recovery och supportkvittens måste provas mot den adressen; använd inga riktiga kunders adresser.
4. Sex nya migreringar och separat verifierad staff-delivery-prerequisite ska appliceras som en samordnad release. Staff-prerequisiten installerades separat i gridex-prod 2026-10-06 och dess privata ACL samt tre server-only RPC:er verifierades; ingen historisk migrationsreplay eller återöppning av osäkra kundgrants.
5. Skarp tvåkundsisolering och komplett OPS-checkout/E2E samt kvarvarande belastningsmätning saknar bevis. Databasrådgivarvarningar är inte ensamma en grund för breda policyändringar.

Kodleverans: kontrollera aktuell PR-head och kvalitetskontroller, markera PR:n ready och merga till main enligt användarens instruktion. Därefter återstår Auth-/SMTP-/OPS-konfiguration, godkänd testinkorg och samordnad schema/release mot rätt mål. Main-deployment är fortsatt avstängd tills produktionsaktiveringen är verifierad.
