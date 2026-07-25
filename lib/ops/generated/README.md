# Genererade API-typer

Filerna genereras från de versionslåsta OpenAPI-kopiorna i `docs/openapi` utan ett externt kodgenereringspaket:

```bash
npm run api:generate
```

För en fullständig uppdatering från de publika Gridex-specifikationerna:

```bash
npm run api:refresh
```

`api:sync` hämtar specifikationerna, `api:generate` skapar typerna och `api:check` jämför de incheckade filerna mot live-specifikationerna. OpenAPI hämtas aldrig i applikationens runtime.
