import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseWebsiteCustomerType } from '../lib/website/customerType.ts'
import { parseRequestedStartSelection } from '../lib/website/requestedStart.ts'
import {
  issueWebsitePricingQuote,
  verifyWebsitePricingQuote,
} from '../lib/website/pricingQuote.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

process.env.GRIDEX_WEBSITE_STATE_SIGNING_SECRET = 'non-expiring-quote-test-secret-with-more-than-32-bytes'
process.env.GRIDEX_WEBSITE_STATE_SIGNING_KID = 'non-expiring-test-key'

assert.equal(parseWebsiteCustomerType(undefined), null)
assert.equal(parseWebsiteCustomerType('invalid'), null)
assert.equal(parseWebsiteCustomerType('private'), 'private')
assert.equal(parseWebsiteCustomerType('business'), 'business')
assert.equal(parseWebsiteCustomerType('company'), 'business')

assert.deepEqual(
  parseRequestedStartSelection({ mode: 'earliest_possible', requestedDate: null }),
  { ok: true, value: { mode: 'earliest_possible', requestedDate: null } },
)
assert.equal(parseRequestedStartSelection({ mode: 'unknown', requestedDate: null }).ok, false)
assert.equal(parseRequestedStartSelection({ mode: 'specific_date', requestedDate: null }).ok, false)
assert.equal(parseRequestedStartSelection({ mode: 'specific_date', requestedDate: '2026-02-30' }).ok, false)
assert.deepEqual(
  parseRequestedStartSelection({ mode: 'specific_date', requestedDate: '2026-09-01' }),
  { ok: true, value: { mode: 'specific_date', requestedDate: '2026-09-01' } },
)

const contract = {
  offer_reference: 'offer_non_expiring_test',
  product_code: 'GRIDEX-TEST',
  name: 'Gridex testavtal',
  contract_type: 'variable_monthly',
  type: 'variable_monthly',
  energy_direction: 'consumption',
}

const basePreview = {
  resolution_id: 'resolution_non_expiring_test',
  energy_direction: 'consumption',
  production_pricing: null,
  start_date: '2026-09-01',
  requested_start_mode: 'specific_date',
  customer_type: 'private',
  contract: {
    slug: contract.offer_reference,
    offer_reference: contract.offer_reference,
    contract_reference: 'contract_non_expiring_test',
    product_code: contract.product_code,
    name: contract.name,
    contractType: 'spot_monthly',
  },
  priceArea: 'SE3',
  price_area_code: 'SE3',
  kwh: 500,
  annual_consumption_kwh: 6000,
  pricePerKwhOre: 99,
  totalMonthlyCostSek: 544,
  totalMonthlyCostInclVatSek: 680,
  totalYearlyCostSek: 8160,
  pricing_snapshot_reference: 'wps_non_expiring_test',
  ops_quote_reference: 'quote_non_expiring_test',
  pricing_interval: 'month',
  estimate_method: 'ops_canonical_quote',
  source_period: '2026-07',
  source_window: null,
  market_data_timestamp: '2026-07-31T12:00:00.000Z',
  is_binding: true,
  assumptions: [],
  market_sources: [],
  market_reference: null,
  pricing_snapshot_schema_version: '2026-08-01.1',
  price_option_reference: 'price_option_non_expiring_test',
  area_price_reference: 'area_price_non_expiring_test',
  invoice_delivery_method: 'email',
  selected_component_references: [],
  mandatory_component_references: [],
  conditional_component_references: [],
  site_count: 1,
}

function issue(preview, attemptId) {
  const result = issueWebsitePricingQuote({
    preview,
    contract,
    customerType: 'private',
    requestedStartMode: 'specific_date',
    quoteAttemptId: attemptId,
    location: { postalCode: '58222', city: 'Linköping', address: 'Storgatan 1' },
    now: new Date('2026-07-31T12:00:00.000Z'),
  })
  assert.ok(result)
  return result
}

const withoutExpiry = issue(basePreview, '11111111-1111-4111-8111-111111111111')
assert.equal(withoutExpiry.quote.expires_at, null)
assert.equal(withoutExpiry.quote.valid_until, null)
assert.equal(verifyWebsitePricingQuote(withoutExpiry.token, new Date('2036-07-31T12:00:00.000Z')).ok, true)

const legacyPastExpiry = issue(
  {
    ...basePreview,
    pricing_snapshot_reference: 'wps_legacy_expiry_test',
    ops_quote_reference: 'quote_legacy_expiry_test',
    valid_until: '2020-01-01T00:00:00.000Z',
    pricing_expires_at: '2020-01-01T00:00:00.000Z',
  },
  '22222222-2222-4222-8222-222222222222',
)
assert.equal(verifyWebsitePricingQuote(legacyPastExpiry.token, new Date('2036-07-31T12:00:00.000Z')).ok, true)

const quoteSource = read('lib/website/pricingQuote.ts')
assert.ok(quoteSource.includes('Gridex quotes are not time-limited'))
assert.ok(quoteSource.includes('no Date.now()/expires_at/valid_until rejection'))
assert.equal(quoteSource.includes('Date.parse(quote.expires_at)'), false)
assert.equal(quoteSource.includes('Date.parse(quote.valid_until)'), false)

const calculator = read('components/ElectricityCalculator.tsx')
const resultCard = read('components/PriceResultCard.tsx')
const applicationForm = read('components/signup/CustomerApplicationForm.tsx')
assert.equal(calculator.includes('pricing_expires_at'), false)
assert.equal(calculator.includes('valid_until'), false)
assert.equal(resultCard.includes('Giltig till'), false)
assert.equal(applicationForm.includes('Offert giltig till'), false)
assert.ok(calculator.includes('crypto.randomUUID()'))
assert.ok(calculator.includes('requested_start_mode: requestedStartMode'))
assert.ok(calculator.includes('stockholmCalendarDate()'))
assert.ok(calculator.indexOf('setResult(verifiedPreview)') < calculator.indexOf('onQuoteContextChange?.(nextQuoteContext)'))

const checkoutRoute = read('app/api/checkout/context/route.ts')
assert.ok(checkoutRoute.includes('quote_attempt_mismatch'))
assert.ok(checkoutRoute.includes('verified.value.quote.quote_attempt_id !== quoteAttemptId'))

const opsClient = read('lib/ops/client.ts')
assert.ok(opsClient.includes("['website-quote', input.quote_attempt_id, canonicalSha256(requestBody)].join(':')"))
assert.equal(opsClient.includes('!validUntil || !priceOptionReference'), false)

const checkoutStore = read('lib/website/checkoutContextStore.ts')
assert.ok(checkoutStore.includes('technical handoff'))
assert.equal(checkoutStore.includes('pricing_expires_at'), false)

const migration = read('supabase/migrations/20260731184500_non_expiring_canonical_quotes.sql')
assert.ok(migration.includes('alter column valid_until drop not null'))
assert.ok(migration.includes('p_dry_run boolean default true'))
assert.ok(migration.includes('rows_scanned'))
assert.ok(migration.includes('rows_changed'))
assert.ok(migration.includes('rows_skipped'))
assert.ok(migration.includes('errors jsonb'))

console.log('Non-expiring canonical quote tests passed')
