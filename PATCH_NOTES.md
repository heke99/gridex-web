# Gridex Web – Customer Portal API 2026-07-25.1

## Canonical målbild

Gridex Web använder OPS som enda source of truth för tenantidentitet, publicerade avtal, elområdesresolution, marknadsreferens, quote, avgifter, moms, quote validation, kundansökan och Mina sidor-data.

```text
GRIDEX_API_KEY
→ integration context
→ publicerade avtal
→ tenantbunden energy-area resolution
→ capabilitybaserad pricing/quote readiness
→ canonical OPS quote
→ quote validation
→ idempotent customer application
→ OPS workflow
→ customer portal bundle
```

`market-price/current` är en separat informationsfunktion och är inte ett förkrav för quote.

## Huvudrättningar

- Kontraktsversionen är `2026-07-25.1`.
- `automation_allowed` är borttaget ur produktionsflödet, tokenformatet och readiness.
- Resolution använder `pricing_ready`, `quote_ready` och separata lifecycle blockers.
- Quote-request skickar inte `price_area`; OPS härleder canonical område från `resolution_id`.
- Quote validation skickar endast dokumenterade assertions.
- Fastpris och andra giltiga quotes blockeras inte av stale eller saknat `market-price/current`.
- Kundansökan skickar top-level `offer_reference`, `quote_reference` och `resolution_id` exakt en gång.
- Mätpunkt skickas i separat `metering_point`-objekt.
- Kundtyp är en discriminated union och fullmakt valideras innan requesten lämnar webbservern.
- Mina sidor-readiness använder de faktiska portal-scopes som bundle-routen kräver.
- Notiser markeras lästa med explicita `notification_ids`; `{ all: true }` används inte.
- Endast `GRIDEX_API_KEY` används som tenant-API-nyckel. Inga tenant- eller quote-modevariabler krävs.
- OpenAPI kan synkas och typer regenereras reproducerbart med `npm run api:refresh`.

## Databas

Denna leverans lägger inte till eller ändrar någon Supabase-migration. Befintliga OPS-auditmigrationer lämnas oförändrade eftersom de kan vara applicerade och ingår i projektets migrationshistorik.

## Verifiering

Se `VERIFICATION_2026-07-25.1.md`. Lokala kontrakts- och regressionsviter passerar. Full typecheck, lint, build, live OpenAPI-drift och staging-E2E måste köras efter `npm ci` i en miljö med DNS och en giltig testnyckel.
