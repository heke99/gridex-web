import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pricingPreview = readFileSync(new URL('../lib/website/pricingPreview.ts', import.meta.url), 'utf8')
const localPricing = readFileSync(new URL('../lib/website/localPricingPreview.ts', import.meta.url), 'utf8')
const areaPricing = readFileSync(new URL('../lib/website/areaPricingResolver.ts', import.meta.url), 'utf8')

assert.match(
  pricingPreview,
  /if \(usesDirectPublishedPricing\(model\)\) \{\s*return publishedPricingPreview\(input, contract\)/s,
  'monthly/hourly/quarterly and fixed products must bypass the generic OPS quote route',
)
assert.match(
  localPricing,
  /allowDatabase: model === 'portfolio' \|\| model === 'mix'/,
  'public fixed and spot products must not be overridden by local database pricing',
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
  /params\.pricingModel === 'quarterly'.*apiAverage\.intervalMinutes.*> 15/s,
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
