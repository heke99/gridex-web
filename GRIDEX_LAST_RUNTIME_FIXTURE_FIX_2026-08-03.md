# Gridex – sista runtime-fixturekorrigeringen 2026-08-03

## Orsak

`tests/public-contract-runtime-compatibility.test.mjs` förväntade att fixturefilen
`public-contracts.ops-verified-variable.json` skulle ge ett giltigt publicerat avtal.
Fixturefilen saknade dock det numera obligatoriska fältet
`legal.power_of_attorney_version_id`.

Både den semantiska valideringen och OpenAPI-schemat behandlar ett saknat fält som
blockerande. Därför returnerade `parseOpsPublicContractsPayload()` noll godkända
avtal och ett blockerat avtal.

## Ändring

- Lägger till `legal.power_of_attorney_version_id: null`.
- Uppdaterar fixturemetadata från kontraktsversion `2026-08-01.1` till
  `2026-08-02.1`.

`null` är korrekt för ett publicerat avtal där ingen immutable fullmaktsversion
är kopplad. Egenskapen måste fortfarande finnas uttryckligen.

## Påverkan

Endast testdata ändras. Ingen runtimekod, OpenAPI-specifikation, miljövariabel,
databas eller migration ändras.

## Verifiering

Kör:

```bash
npm run test:launch
npm run api:preflight
npm run typecheck
npm run build
```
