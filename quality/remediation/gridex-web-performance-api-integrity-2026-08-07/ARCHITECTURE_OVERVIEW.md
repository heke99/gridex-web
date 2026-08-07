# ARCHITECTURE_OVERVIEW

## Runtimegränser

`Browser -> Next.js App Router/BFF -> OPS API -> Supabase/Postgres`

Gridex Web håller OPS API credentials server-side. Browsern arbetar mot webbens egna route handlers samt signerade/validerade tokens och snapshots.

## OPS-klient efter remediation

Den tidigare 5 287-radersmonoliten är ersatt av:

- `lib/ops/client.ts` – tunn publik facade.
- `lib/ops/client/types.ts` – DTO- och domäntyper.
- `lib/ops/client/core.ts` – gemensam OPS-/schema-/public-contract-kärna.
- `lib/ops/client/website.ts` – website-, energy-area-, quote- och feedflöden.
- `lib/ops/client/application.ts` – customer application payload/resultat och accepted invariants.
- `lib/ops/client/portal.ts` – customer portal reads/writes/events.

CI verifierar att ingen icke-genererad produktionskällfil överskrider 2 000 rader.

## Source of truth

1. Aktuell live OPS release-manifest/OpenAPI.
2. Incheckade snapshots och deras exakta SHA-256.
3. Genererade TypeScript-typer.
4. Runtime OpenAPI validators/compatibility guards.
5. Migrationsmanifest + migrationsfiler för lokalt Supabase-schema.

Aktuell verifierad release: `2026-08-05.2`.
Website hash: `e8ddc6b8a35d14f561caf4e3ef13917affb1b1af58ae759cb1a8a0332f59a701`.

## Upstream immutability

OPS ändrade website-specens hash inom samma `.2`-versionsnummer. Därför räcker inte längre endast versionsjämförelse som skydd; `main` kör nu `api:preflight` mot live på varje push och blockerar även same-version hash/semantic drift.

## Cache och tenant isolation

OPS transport är `no-store` som default. Public contracts använder explicit ETag/304 + verifierad last-known-good snapshot där kontraktet tillåter det. Cache-/snapshotbindning verifierar tenant/customer type och får inte bli en andra source of truth.

## CI

`main` har två read-only gates:

- `Gridex Web quality gate`: local OpenAPI, migrations, compatibility, file-size, regression, lint, typecheck, full test och build.
- `OpenAPI compatibility`: live `api:preflight` vid varje main-push, PR, manuellt och schemalagt.
