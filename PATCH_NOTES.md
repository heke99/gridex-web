# Gridex Web – production signup hotfix

This patch removes the short-lived quote/snapshot blockers from the public electricity signup flow and cleans up customer-facing copy.

## What changed

- Signup no longer blocks customers because a website `pricing_quote_token` expired or changed.
- Server submit no longer calls `validateWebsitePricingQuote` or `validatePricingPreviewSnapshot` before sending the customer application.
- Website price preview may still attach a non-blocking audit token when configured, but missing/expired quote tokens do not block signup.
- Price preview snapshot is sent to OPS as audit data; the binding commercial reference remains `offer_reference` from OPS public contracts.
- Contract display snapshot validation remains limited to public offer/legal identifiers, not brittle full-object equality.
- Public customer copy no longer exposes internal words such as OPS-publication, public-contracts, legal publication field, or price signing.
- The customer form no longer posts `pricing_quote_token` / `pricing_quote_source` hidden fields.
- Local portal onboarding remains non-blocking after a successful OPS application.
- Legacy price routes now point customers to `/elavtal` without mentioning internal API names.
- Regression tests now lock the desired behavior: no expiring quote blocker, no brittle price snapshot blocker, and customer-safe copy.

## Verification run

- `npm run test:launch` passed.
- `npm run lint` passed with 0 errors and 9 existing warnings outside this patch.
- `npm run build` compiled successfully and TypeScript passed. The sandbox timed out during static page generation at 120/160 pages, after compile and TS were complete.
