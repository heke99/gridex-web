import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const pricing = read('lib/website/pricingPreview.ts')
const resolver = read('lib/website/priceAreaResolver.ts')

assert.ok(pricing.includes('return fetchOpsWebsiteQuote(input)'))
assert.ok(!pricing.includes('buildLocalWebsitePricingPreview'))
assert.ok(resolver.includes(".from('website_postal_code_price_areas')"))
assert.ok(resolver.includes('{ allowExpired: true }'))
assert.ok(resolver.includes("{ onConflict: 'postal_code' }"))
assert.ok(resolver.includes('postal cache upsert failed'))
console.log('Pricing and postal resilience checks passed')
