import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractEmbeddedAreaPricing } from '../lib/website/embeddedAreaPricing.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const fixed = extractEmbeddedAreaPricing(
  {
    pricing: {
      area_prices: {
        SE3: {
          price_per_kwh_ore: 91.5,
          monthly_fee_sek: 39,
          variable_fee_ore: 1.2,
          elcert_ore: 0.8,
        },
      },
    },
  },
  'SE3',
  'fixed',
)
assert.equal(fixed.fixedPriceOrePerKwh, 91.5)
assert.equal(fixed.monthlyFeeSek, 39)
assert.equal(fixed.variableFeeOrePerKwh, 1.2)

const portfolio = extractEmbeddedAreaPricing(
  {
    area_pricing: [
      { price_area_code: 'SE2', price_per_kwh_ore: 82 },
      {
        price_area_code: 'SE4',
        price_per_kwh_ore: 104.25,
        markup_ore: 1,
        monthly_fee_sek: 49,
      },
    ],
  },
  'SE4',
  'portfolio',
)
assert.equal(portfolio.portfolioPriceOrePerKwh, 104.25)
assert.equal(portfolio.markupOrePerKwh, 1)
assert.equal(portfolio.monthlyFeeSek, 49)

const mix = extractEmbeddedAreaPricing(
  {
    pricing_by_area: [
      {
        price_area: 'SE1',
        components: [
          { type: 'portfolio_price', amount: 77.5 },
          { type: 'markup', amount: 1.5 },
          { type: 'monthly_fee', amount: 45 },
          { type: 'invoice_fee', amount: 0 },
          { type: 'spot_share', amount: 60 },
          { type: 'portfolio_share', amount: 40 },
        ],
      },
    ],
  },
  'SE1',
  'mix',
)
assert.equal(mix.portfolioPriceOrePerKwh, 77.5)
assert.equal(mix.markupOrePerKwh, 1.5)
assert.equal(mix.invoiceFeeSek, 0)
assert.equal(mix.spotShare, 60)
assert.equal(mix.portfolioShare, 40)

const display = read('lib/website/publicContractDisplay.ts')
assert.ok(
  display.includes("'Visas efter adress och elområde'"),
  'fixed, portfolio and mix cards must defer area-specific base prices until an area is selected',
)
assert.ok(
  !display.includes("blockedReasons.push(`${label} saknas`)"),
  'contract cards must not reject an OPS-published contract only because an area price is not top-level',
)

const pricingRoute = read('app/api/v1/website/pricing/preview/route.ts')
assert.ok(pricingRoute.includes('fetchOpsWebsiteQuote'))
assert.ok(pricingRoute.includes('verifyWebsiteEnergyAreaToken'))
assert.ok(!pricingRoute.includes('resolveWebsiteAreaPricing'))
assert.ok(pricingRoute.includes('annual_consumption_kwh: annualKwh'))

const signup = read('app/(public)/teckna-avtal/page.tsx')
assert.ok(
  !signup.includes('loadVerifiedWebsitePricingPreview') && signup.includes('livePreview: signedPreview'),
  'final signup must bind the exact signed OPS quote instead of recalculating it',
)

const ops = read('lib/ops/client.ts')
assert.ok(
  ops.includes('components.portfolio_price_ore_per_kwh'),
  'documented public contracts must be enriched from component pricing when available',
)
assert.ok(
  !ops.includes('price_plan_id: pickString(offerRow') &&
    !ops.includes('price_plan_version_id: pickString(offerRow'),
  'internal OPS price-plan identifiers must not be copied into a tenant quote',
)

console.log('area pricing product tests passed')
