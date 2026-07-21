import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const pricingPreview = read('lib/website/pricingPreview.ts')
assert.ok(
  pricingPreview.includes("usesElprisetJustNu(model) || model === 'mix'"),
  'market-linked pricing must use Elprisetjustnu with the selected OPS contract',
)
assert.ok(
  !pricingPreview.includes('canUsePublishedPricingFallback'),
  'pricing must not silently fall back to an unverified local calculation',
)
assert.ok(
  pricingPreview.includes('buildLocalWebsitePricingPreview'),
  'market-linked estimates must combine published OPS components with Elprisetjustnu',
)
assert.ok(
  pricingPreview.includes('loadRawPricingPreview(input, contract)'),
  'preview and final submission must share the same canonical pricing loader',
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
