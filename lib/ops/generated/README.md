# Genererade OPS-typer

Filerna i denna katalog genereras från de versionslåsta OpenAPI-kopiorna i `docs/openapi`.

```bash
npx openapi-typescript docs/openapi/website-integration-v1.json -o lib/ops/generated/website-api.d.ts
npx openapi-typescript docs/openapi/customer-portal-v1.json -o lib/ops/generated/customer-portal-api.d.ts
```

OpenAPI hämtas aldrig i runtime. CI hämtar live-specifikationerna, genererar till en temporär katalog och stoppar releasen om den semantiska kontraktsversionen eller de genererade typerna avviker.
