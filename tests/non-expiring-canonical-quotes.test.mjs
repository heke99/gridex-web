import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseWebsiteCustomerType } from '../lib/website/customerType.ts'
import { parseRequestedStartSelection } from '../lib/website/requestedStart.ts'
import {
  issueWebsitePricingQuote,
  verifyWebsitePricingQuote,
} from '../lib/website/pricingQuote.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

process.env.GRIDEX_WEBSITE_STATE_SIGNING_SECRET = 'canonical-expiring-quote-test-secret-with-more-than-32-bytes'
process.env.GRIDEX_WEBSITE_STATE_SIGNING_KID = 'canonical-expiry-test-key'

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
  offer_reference: 'offer_expiring_test',
  product_code: 'GRIDEX-TEST',
  name: 'Gridex testavtal',
  contract_type: 'variable_monthly',
  type: 'variable_monthly',
  energy_direction: 'consumption',
}

const basePreview = {
  resolution_id: 'resolution_expiring_test',
  energy_direction: 'consumption',
  production_pricing: null,
  start_date: '2026-09-01',
  requested_start_mode: 'specific_date',
  customer_type: 'private',
  contract: {
    slug: contract.offer_reference,
    offer_reference: contract.offer_reference,
    contract_reference: 'contract_expiring_test',
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
  pricing_snapshot_reference: 'wps_expiring_test',
  ops_quote_reference: 'quote_expiring_test',
  pricing_interval: 'month',
  estimate_method: 'ops_canonical_quote',
  source_period: '2026-07',
  source_window: null,
  market_data_timestamp: '2026-07-31T12:00:00.000Z',
  is_binding: true,
  assumptions: [],
  market_sources: [],
  market_reference: null,
  pricing_snapshot_schema_version: '2026-08-02.1',
  valid_until: '2026-08-02T12:30:00.000Z',
  price_option_reference: 'price_option_expiring_test',
  area_price_reference: 'area_price_expiring_test',
  invoice_delivery_method: 'email',
  selected_component_references: [],
  mandatory_component_references: [],
  conditional_component_references: [],
  site_count: 1,
}

function issue(preview, attemptId) {
  return issueWebsitePricingQuote({
    preview,
    contract,
    customerType: 'private',
    requestedStartMode: 'specific_date',
    quoteAttemptId: attemptId,
    location: { postalCode: '58222', city: 'Linköping', address: 'Storgatan 1' },
    now: new Date('2026-08-02T12:00:00.000Z'),
  })
}

assert.equal(
  issue({ ...basePreview, valid_until: null }, '11111111-1111-4111-8111-111111111111'),
  null,
  'a canonical quote without valid_until must not be signed',
)
assert.equal(
  issue({ ...basePreview, valid_until: '2026-08-02T11:59:59.000Z' }, '22222222-2222-4222-8222-222222222222'),
  null,
  'an already expired OPS quote must not be signed',
)

const issued = issue(basePreview, '33333333-3333-4333-8333-333333333333')
assert.ok(issued)
assert.equal(issued.quote.version, 6)
assert.equal(issued.quote.valid_until, basePreview.valid_until)
assert.equal(verifyWebsitePricingQuote(issued.token, new Date('2026-08-02T12:29:59.000Z')).ok, true)
assert.deepEqual(
  verifyWebsitePricingQuote(issued.token, new Date('2026-08-02T12:30:00.000Z')),
  { ok: false, reason: 'expired' },
)
assert.equal(
  verifyWebsitePricingQuote(
    issued.token,
    new Date('2026-08-02T12:30:00.000Z'),
    { allowExpired: true },
  ).ok,
  true,
  'an expired signed quote must remain readable for automatic server-side renewal',
)

const quoteSource = read('lib/website/pricingQuote.ts')
assert.ok(quoteSource.includes('const CURRENT_TOKEN_VERSION = "v7"'))
assert.ok(quoteSource.includes('Date.parse(parsed.valid_until) <= now.getTime()'))
assert.ok(quoteSource.includes('validUntilTimestamp > now.getTime()'))
assert.equal(quoteSource.includes('Gridex quotes are not time-limited'), false)

const canonicalValidation = read('lib/website/canonicalQuoteValidation.ts')
assert.ok(canonicalValidation.includes('allowExpired: true'))
assert.ok(canonicalValidation.includes('refreshCanonicalArea'))
assert.ok(canonicalValidation.includes('refreshCanonicalQuote'))
assert.ok(canonicalValidation.includes("reason: 'quote_valid_until_changed'"))
assert.ok(canonicalValidation.includes("reason: 'quote_expired'"))

const snapshotStore = read('lib/website/pricingSnapshotStore.ts')
assert.ok(snapshotStore.includes('requires a future canonical valid_until'))
assert.ok(snapshotStore.includes('ops_quote_valid_until: validUntil'))

const restoreMigration = read('supabase/migrations/20260802224500_restore_canonical_quote_expiry.sql')
assert.ok(restoreMigration.includes('website_pricing_snapshots_valid_until_required_chk'))
assert.ok(restoreMigration.includes('check (valid_until > issued_at) not valid'))
assert.ok(restoreMigration.includes('drop function if exists public.run_non_expiring_quote_backfill'))

console.log('Canonical quote renewal tests passed')
