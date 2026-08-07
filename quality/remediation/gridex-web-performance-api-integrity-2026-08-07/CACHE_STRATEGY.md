# CACHE_STRATEGY

## Principer

Cache får aldrig bli en andra source of truth eller blanda tenants.

## OPS transport

Default är `cache: 'no-store'`. Caching/revalidation aktiveras explicit av caller där endpointens kontrakt tillåter det.

## Public contracts

Public-contract-flödet använder:

- ETag/If-None-Match när OPS stödjer conditional requests.
- Explicit tillåten 304-hantering.
- In-memory cache keyed per tenant-bound OPS context.
- Persistent last-known-good snapshot i Supabase.
- Parser/schema hash och publication revision.
- Fail-closed-regler för all-blocked/overifierad tom feed.
- Durable canonical-empty proof för legitimt tom publiceringstillstånd.

## Tenant isolation

Cachekey bygger på OPS base URL + hash av API credential/context. Persistent snapshot validerar tenant/customer-type binding innan återanvändning.

## Postnummer/energy area

Ingen ny global postnummercache infördes i denna remediation eftersom en sådan cache måste definiera freshness, geodata-version, tenant-oberoende/tenantberoende data och invalidation. Den befintliga signed energy-area resolution/token-modellen behölls.

## Invalidation

Publication events använder durable projection och `revalidateTag` för public-contract cachetag. Cache får inte dölja schema-/tenant-/canonical-integritetsfel.

## Resultat

Den granskade cachingen är konservativ och kontraktsstyrd. Ingen bredare cache lades till utan mätdata.
