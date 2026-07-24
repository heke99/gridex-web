import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const contract = read('lib/ops/contract.ts')
const ops = read('lib/ops/client.ts')
const readiness = read('lib/ops/readiness.ts')
const area = read('app/api/v1/website/energy/resolve/route.ts')
const quote = read('app/api/v1/website/pricing/preview/route.ts')
const validate = read('lib/website/canonicalQuoteValidation.ts')
const checkout = read('app/api/v1/website/checkout-context/route.ts')
const signup = read('app/(public)/teckna-avtal/page.tsx')
const dto = read('lib/website/publicDtos.ts')
const migration = read('supabase/migrations/20260724120000_ops_website_contract_20260723_1.sql')
const switchStatus = read('app/api/v1/website/switch-status/route.ts')
const portfolioPrices = read('app/api/v1/website/portfolio-prices/route.ts')
const areaToken = read('lib/website/energyAreaToken.ts')
const thanksPage = read('app/(public)/teckna-avtal/tack/SignupThanksPage.tsx')

assert.ok(contract.includes("GRIDEX_WEBSITE_API_CONTRACT_VERSION = '2026-07-23.1'"))
for (const scope of [
  'website_energy_area.resolve',
  'website_quotes.write',
  'website_quotes.validate',
  'website_switch_status.read',
]) assert.ok(contract.includes(scope), `canonical scope missing: ${scope}`)

assert.ok(ops.includes('/api/v1/website/energy-area/resolve'))
assert.ok(ops.includes('/api/v1/website/quote'))
assert.ok(ops.includes('/api/v1/website/quote/validate'))
assert.ok(ops.includes('/api/v1/website/switch-status'))
assert.ok(ops.includes('/api/v1/website/portfolio-prices'))
assert.ok(ops.toLowerCase().includes('retry-after'))
assert.ok(ops.includes('GRIDEX_OPS_APPLICATION_QUOTE_REFERENCE_MODE'))
assert.ok(readiness.includes('GRIDEX_WEBSITE_LEGAL_SCOPE_ALTERNATIVES.some'))

assert.ok(area.includes('fetchOpsWebsiteEnergyArea'))
assert.ok(area.includes('issueWebsiteEnergyAreaToken'))
assert.equal(area.includes('resolveWebsitePriceAreaForPricing'), false)
assert.ok(quote.includes('fetchOpsWebsiteQuote'))
assert.ok(quote.includes('verifyWebsiteEnergyAreaToken'))
assert.ok(quote.includes('validatePricingComponentsForQuote'))
assert.ok(quote.includes('unsupported_pricing_component'))
assert.ok(validate.includes('validateOpsWebsiteQuote'))
assert.ok(checkout.includes('validateCanonicalWebsiteQuote'))
assert.ok(signup.includes('quote_reference: verifiedQuote.value.quote.ops_quote_reference'))
assert.ok(signup.includes('legal_acceptance:'))

assert.ok(dto.includes('invoice_fee: null'))
assert.ok(dto.includes("code !== 'invoice_fee'"))
assert.ok(migration.includes('ops_quote_reference'))
assert.ok(migration.includes('normalized_ops_payload_sha256'))
assert.ok(migration.includes('enable row level security'))

assert.ok(switchStatus.includes("url.searchParams.get('result_token')"))
assert.ok(switchStatus.includes('readWebsiteApplicationResult'))
assert.equal(switchStatus.includes("url.searchParams.get('application_number')"), false)
assert.ok(thanksPage.includes('SwitchStatusCard'))
assert.ok(portfolioPrices.includes('sanitizePortfolioPrice'))
assert.ok(portfolioPrices.includes('fetchOpsPublicContractsFresh'))
assert.ok(portfolioPrices.includes("code: 'rate_limited'"))
assert.ok(areaToken.includes('MAX_TOKEN_TTL_MS'))
assert.ok(ops.includes('ops_rate_limited'))
assert.ok(ops.includes('ops_rate_limiter_unavailable'))
assert.ok(ops.includes('ops_rate_limit_configuration_error'))

console.log('Website API 2026-07-23.1 contract tests passed')
