import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const pricingPreview = read('lib/website/pricingPreview.ts')
assert.ok(
  pricingPreview.includes('canUsePublishedPricingFallback'),
  'pricing must classify when the published-pricing fallback is allowed',
)
assert.ok(
  pricingPreview.includes('error.status === 401 || error.status === 403'),
  'pricing fallback must never bypass authentication or permission errors',
)
assert.ok(
  pricingPreview.includes('buildLocalWebsitePricingPreview'),
  'pricing must use the strict server-side published-pricing service when OPS quote is unavailable',
)
assert.ok(
  pricingPreview.includes("ops_quote_fallback: true"),
  'fallback pricing snapshots must be explicitly marked for audit',
)
assert.ok(
  pricingPreview.includes('loadRawPricingPreview(input, contract)'),
  'preview and final submission must share the same resilient pricing loader',
)

const localPricing = read('lib/website/localPricingPreview.ts')
assert.ok(
  localPricing.includes('publishedPortfolioMonthlyPrice'),
  'portfolio fallback must select an exact published monthly portfolio price',
)
assert.ok(
  localPricing.includes("type: 'published_portfolio_month'"),
  'portfolio snapshot must preserve the published month',
)
assert.ok(
  localPricing.includes('price_plan_version_id: monthlyPortfolio.pricePlanVersionId'),
  'portfolio snapshot must preserve the published price-plan version',
)

const resolver = read('lib/website/priceAreaResolver.ts')
assert.ok(
  resolver.includes(".from('website_postal_code_price_areas')"),
  'postal resolver must read the exact postal-code database table',
)
assert.ok(
  resolver.includes("{ allowExpired: true }"),
  'postal resolver must retain an exact stale database mapping as provider-outage fallback',
)
assert.ok(
  resolver.includes("{ onConflict: 'postal_code' }"),
  'postal resolver must upsert by normalized exact postal code',
)
assert.ok(
  resolver.includes('const databaseResult = await readPostalCache'),
  'successful external lookups must be read back from the database before returning',
)
assert.ok(
  resolver.includes('postal cache upsert failed'),
  'postal database failures must be logged instead of silently swallowed',
)

const migration = read('supabase/migrations/20260720143000_website_postal_cache_hardening.sql')
assert.ok(
  migration.includes('create table if not exists public.website_postal_code_price_areas'),
  'migration must repair a missing exact postal-code cache table',
)
assert.ok(
  migration.includes('service_role_manage_website_postal_code_price_areas'),
  'postal cache must remain service-role only',
)

console.log('pricing/postal resilience tests passed')
