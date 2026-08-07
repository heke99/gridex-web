# CHANGES_IMPLEMENTED

## Kontrakt

- Synkade Gridex Web till aktuell live OPS release `2026-08-05.2`.
- Synkade därefter om samma `.2` när OPS ändrade website-specens hash utan versionsbump.
- Aktuell website SHA-256 är `e8ddc6b8a35d14f561caf4e3ef13917affb1b1af58ae759cb1a8a0332f59a701`.
- Breddade runtime contract-version observation över website/customer/OpenAPI-surfaces.
- Lade regressionstest för version-observation.
- Lade live `api:preflight` på varje push till `main` för att fånga även same-version hashdrift.

## Arkitektur

- Delade `lib/ops/client.ts` från 5 287 rader till `types`, `core`, `website`, `application`, `portal` + tunn facade.
- Korrigerade cross-module TypeScript imports till `import type` när symbolen inte finns i runtime.
- Behöll publika imports via `lib/ops/client.ts` kompatibla.

## Kvalitet

- Fixade Next.js lintfelet kring lokal variabel `module` genom semantiskt neutralt namnbyte.
- Lade `scripts/check-file-size.mjs` med 2 000-radersgräns för icke-genererade produktionsfiler.
- Lade read-only quality gate för OpenAPI local drift, migrations, API compatibility, file-size, regression, lint, typecheck, full test och build.

## Tester

- Lade `tests/ops-client-source.mjs` så source-text regressioner granskar hela splittrade implementationen.
- Uppdaterade föråldrade monolit-antaganden utan att ändra runtime API-surface.
- Harmoniserade quote validation till immutable canonical tuple-regeln.

## Databas

- 0 nya migrationer.
- 0 befintliga migrationer ändrade.
- 0 spekulativa index.
- Distributed rate-limit RPC/tabell/RLS/index verifierades mot migrationskedjan.

## Verifiering

På `main` kod-head `e70ed0ca6f8c16870a0aa97b8fb102095da10d7c`:

- Live OpenAPI run `31190726958`: PASS.
- Quality run `31190727274`: PASS inklusive full test och production build.
