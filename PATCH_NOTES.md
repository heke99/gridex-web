# Gridex Web – Customer Portal API 2026-07-27.1

Denna leverans korrigerar verifierade kontraktsbrott i website checkout och Mina sidor-integrationen.

## Viktigaste ändringar

- Kontraktsversion, snapshots, genererade typer och headers är flyttade till `2026-07-27.1`.
- OpenAPI-sync är deterministisk och CI-driftkontrollen är read-only.
- Public contracts kräver explicit `energy_direction`; produktion kräver komplett `production_pricing`.
- `variable_quarterly` får egen etikett och fungerar genom hela presentationen.
- Quote validation kräver matchande `quote_reference` och `offer_reference` i API-svaret.
- Kundansökningsresultatet läser aktuell nästlad supplier-switch-modell.
- Fullmakt bedöms via publik status, inte internt ID.
- Communications förblir strukturerade objekt.
- Portal bundle använder POST primärt och legacy-GET är opt-in.
- Market price är separat information och blockerar inte en giltig quote.
- Endast API-nyckel är obligatorisk tenanthemlighet; bas-URL kan anges för godkänd staging.
- Ingen lokal prismotor används i checkout.

## Verifieringsläge

Lokala kontrakts- och regressionstester passerar. Full installation, typecheck, lint och Next-build kunde inte slutföras i leveransmiljön eftersom dess interna npm-registry svarade 503. Live OpenAPI byte-för-byte-kontroll kunde inte köras från containern eftersom `app.gridex.se` inte kunde DNS-resolveras. Se `VERIFICATION.md` och `DELIVERY_REPORT.md`.
