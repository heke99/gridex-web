# GRIDEX area-price-reference hotfix — 2026-07-31

## Grundorsak

`OpsWebsitePricingPreview` krävde `area_price_reference`, men `WebsitePricingPreview` och den signerade `WebsitePricingQuote` saknade fältet. `quoteToWebsitePricingPreview()` returnerade därför en typ som inte kunde skickas till `validatePricingPreviewSnapshot()`. Samtidigt tappades den canonicala områdesprisreferensen ur den signerade checkoutkedjan.

## Korrigering

- `WebsitePricingPreview` innehåller nu `area_price_reference: string | null`.
- Signerad `WebsitePricingQuote` bevarar `area_price_reference`.
- Offertsignering blockeras om OPS inte returnerar en canonical områdesprisreferens.
- `quoteToWebsitePricingPreview()` återställer referensen från den signerade offerten.
- Snapshotvalideringen använder den faktiska webbtypen och jämför både prisalternativs- och områdesprisreferens.
- Canonical quote validation jämför signerade referenser med OPS quote validation.
- Regressionstester verifierar att referensen finns i den signerade tokenkedjan.

## Verifiering

- TypeScript-syntaxtranspilering: godkänd för samtliga ändrade TypeScript-filer.
- `tests/signup-pricing-regression.test.mjs`: godkänd.
- Full `npm run typecheck` kunde inte köras i leveransmiljön eftersom den tidigare avbrutna `npm ci` lämnade tomma `@types/*`-kataloger. Kör full kontroll efter en ren lokal `npm ci`.
