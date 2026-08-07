# CHANGES_IMPLEMENTED

## Kontrakt

- Återställde OPS/OpenAPI runtime/snapshots/generated types från felaktig lokal `2026-08-05.2` till verifierad kanonisk `2026-08-05.1`.
- Breddade runtime contract-version observation till website/customer/OpenAPI-surfaces.
- Lade regressionstest för version-observation.

## Arkitektur

- Delade `lib/ops/client.ts` (5 287 rader) i:
  - `client/types.ts`
  - `client/core.ts`
  - `client/website.ts`
  - `client/application.ts`
  - `client/portal.ts`
- Behöll `lib/ops/client.ts` som tunn kompatibilitetsfacade.
- Korrigerade cross-module TypeScript imports till `import type` där symbolen inte finns i runtime.

## Kvalitet

- Fixade Next.js lintfelet `@next/next/no-assign-module-variable` genom semantiskt neutralt namnbyte.
- Lade `scripts/check-file-size.mjs` med max 2 000 rader för icke-genererade produktionsfiler.
- Lade read-only GitHub Actions quality gate för OpenAPI, migrations, API compatibility, file-size, contract regression, lint, typecheck, full test och build.

## Tester

- Lade `tests/ops-client-source.mjs` så källtextbaserade regressionstester granskar hela den splittrade implementationen.
- Uppdaterade gamla monolit-antaganden i regressionstester utan att ändra runtime imports.
- Harmoniserade quote validation-kontraktstester till immutable canonical tuple-regeln.

## Databas

- Ingen ny migration.
- Ingen befintlig migration ändrad.
- Ingen spekulativ indexering.

## Städning

Engångs-codemods som användes för den verifierade splitten togs bort efter att resultatet committats. CI på slutlig branch är icke-muterande.

## Verifiering

Read-only quality gate `31188663234` på persistent branch: samtliga steg PASS.
