import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pricingPreview = readFileSync(new URL('../lib/website/pricingPreview.ts', import.meta.url), 'utf8')
const localPricing = readFileSync(new URL('../lib/website/localPricingPreview.ts', import.meta.url), 'utf8')
const areaPricing = readFileSync(new URL('../lib/website/areaPricingResolver.ts', import.meta.url), 'utf8')

assert.match(
  pricingPreview,
  /usesElprisetJustNu\(model\) \|\| model === 'mix'/,
  'market-linked products must route through the website market-price calculation',
)
assert.match(
  pricingPreview,
  /return buildLocalWebsitePricingPreview\(/,
  'market-linked products must combine OPS contract terms with Elprisetjustnu locally',
)
assert.match(
  pricingPreview,
  /return fetchOpsWebsiteQuote\(input\)/,
  'fixed and portfolio products may continue to use the canonical OPS quote route',
)
assert.match(
  localPricing,
  /allowDatabase: model === 'portfolio'/,
  'public fixed, spot and mix products must not be overridden by local database pricing',
)
assert.match(
  localPricing,
  /fetchMonthlySpotAverageFromElprisetJustNu\(/,
  'monthly market pricing must read Elprisetjustnu',
)
assert.match(
  localPricing,
  /reportingIntervalMinutes: params\.pricingModel === 'hourly' \? 60 : undefined/,
  'hourly pricing must aggregate the API intervals to an hourly reference',
)
assert.match(
  localPricing,
  /params\.pricingModel === 'quarterly'.*apiAverage\.sourceIntervalMinutes.*> 15/s,
  'quarterly pricing must fail closed unless quarter-hour data is present',
)
assert.match(
  areaPricing,
  /params\.allowDatabase === false\s*\? null/s,
  'area pricing resolver must honor the no-database source policy',
)
assert.doesNotMatch(
  localPricing,
  /gridex_monthly_spot_prices|gridex_spot_monthly_avg/,
  'public market pricing must not silently use stale spot-price tables',
)

console.log('market pricing routing tests passed')
