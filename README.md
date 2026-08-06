# Gridex Web OpenAPI sync contract version fix

Ändrar endast `tests/openapi-sync-contract.test.mjs`.

Testet är nu versionsoberoende och verifierar:
- release-formatet `YYYY-MM-DD.N`
- att minimum-versionen matchar aktuell release
- att båda specifikationernas contract_version matchar aktuell release
- att release-manifestets SHA-256 matchar de synkade OpenAPI-filerna

Detta förhindrar att testet ligger kvar på en gammal version när `api:sync` har synkat en ny giltig OPS-release.
