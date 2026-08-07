# ARCHITECTURE_OVERVIEW

## Runtimegränser

`Browser -> Next.js App Router/BFF -> OPS API -> Supabase/Postgres`

Gridex Web håller OPS API credentials server-side. Browsern arbetar mot webbens egna route handlers och signerade/validerade tokens/snapshots.

## OPS-klient efter remediation

Den tidigare 5 287-radersmonoliten är ersatt av en kompatibilitetsfasad och fem ansvarsmoduler:

- `lib/ops/client.ts` – tunn publik facade.
- `lib/ops/client/types.ts` – DTO- och domäntyper.
- `lib/ops/client/core.ts` – gemensam transport-/schema-/public-contract-kärna.
- `lib/ops/client/website.ts` – energy area, quote, public-contract/feed och websiteflöden.
- `lib/ops/client/application.ts` – customer application payload/resultat och accepted invariants.
- `lib/ops/client/portal.ts` – customer portal reads/writes/events.

Samtliga icke-genererade produktionskällfiler ligger under 2 000 rader enligt CI.

## Source of truth

1. Publicerad OPS OpenAPI/release-manifest.
2. Incheckade OpenAPI snapshots och genererade typer.
3. Runtime schema validators och compatibility guards.
4. Migrationsmanifest och migrationsfiler för Gridex Webs lokala Supabase-schema.

Aktuell verifierad kontraktsrelease: `2026-08-05.1`.

## Cache

Public contracts använder verifierad snapshot/ETag-strategi och fail-closed-regler. OPS-transportens default är `no-store`; caching aktiveras explicit där kontraktet tillåter det. Tenantcache-nycklar härleds från OPS base URL + API-key hash och blandar inte tenantdata.

## Rate limiting

Distributed limiter använder Supabase RPC `consume_distributed_rate_limit`. Schema/RPC/RLS/behörigheter och reset-index är migration-backed. Ingen ny migration krävdes.

## Felgränser

- GET/HEAD kan retryas för definierade temporära fel.
- POST/andra writes auto-retryas inte i transportlagret.
- Redirects blockeras innan credentials kan följas vidare.
- 304 hanteras endast där caller uttryckligen tillåter conditional cache.
- OPS-responses valideras mot OpenAPI och additive compatibility policy.

## CI

`.github/workflows/remediation-quality.yml` är read-only och kör samma quality gate på PR, remediation branch och `main`: OpenAPI, migrations, compatibility, file-size, contract regression, lint, typecheck, full test och build.
