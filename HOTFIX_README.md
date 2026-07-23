# Gridex Web API 2026-07-22.2 hotfix 1

Rättar följande fel efter huvudpatchen:

- återställer `OpsWebsiteLegalBundle` och `fetchOpsWebsiteLegalBundle`;
- behåller juridik-endpointen utan att återinföra borttagna OPS quote/energy-area-rutter;
- rättar `websitePricingPreviewSource()`-anropet;
- tar bort oanvänd readiness-import;
- tar bort oanvända legacy-mappers för borttagna OPS-rutter.
