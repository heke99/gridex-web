import assert from 'node:assert/strict'
import { parseOpsPublicContractsPayload } from '../lib/ops/client.ts'

const validContract = (suffix) => ({
  offer_reference: `offer_${suffix}`,
  name: `Avtal ${suffix}`,
  contract_type: 'fixed',
  energy_direction: 'consumption',
  customer_type: 'private',
  channel: 'website',
  price_options: [{
    price_option_reference: `price_option_${suffix}`,
    option_code: 'standard',
    customer_name: 'Standard',
    price_type: 'fixed',
    contract_type: 'fixed',
    customer_type: 'private',
    resolution: 'monthly',
    currency: 'SEK',
    unit: 'ore_per_kwh',
    fixed_price: 100,
    markup: null,
    monthly_fee: 49,
    binding_months: 12,
    notice_months: 1,
    auto_renew_enabled: false,
    renewal_term_months: null,
    is_default: true,
    default: true,
    selection_required: false,
    valid_from: null,
    valid_to: null,
    earliest_start_date: null,
    latest_start_date: null,
    area_prices: [{
      area_price_reference: `area_price_${suffix}_se3`,
      price_area: 'SE3',
      energy_price_ore_per_kwh: 100,
      unit: 'ore_per_kwh',
      valid_from: null,
      valid_to: null,
    }],
  }],
  pricing: {
    visibility: {},
    calculation_components: [],
    display_components: [],
    summary_components: [],
    calculation_contract: {
      includes_all_applicable_components: true,
      hidden_components_must_be_calculated: true,
      market_price_supplied_by_ops: true,
    },
  },
  legal: {
    required_modules: ['general_consumer_terms'],
    module_versions: [{
      id: '00000000-0000-4000-8000-000000000002',
      legal_bundle_version_id: '00000000-0000-4000-8000-000000000001',
      document_reference: `legal_document_${suffix}`,
      module_key: 'general_consumer_terms',
      version: '1',
      title: 'Allmänna villkor',
      published_at: null,
      content_sha256: null,
      origin: 'canonical_bundle_document',
      url: null,
    }],
    immutable: true,
    legal_bundle_reference: `legal_bundle_${suffix}`,
    legal_bundle_version_id: '00000000-0000-4000-8000-000000000001',
    power_of_attorney_version_id: null,
    customer_documents: [{
      requirement_code: 'agreement',
      document_type: 'agreement',
      title: 'Elhandelsavtal och fullständiga villkor',
      description: 'Kundens sammanhållna elhandelsavtal och tillämpliga villkor.',
      required: true,
      acceptance_mode: 'accept',
      document_reference: `legal_customer_document_${suffix}`,
      document_version: `legal_customer_version_${suffix}`,
      document_hash: 'c'.repeat(64),
      document_url: null,
      legal_bundle_version_id: '00000000-0000-4000-8000-000000000001',
      module_keys: ['general_consumer_terms'],
      source_document_ids: ['00000000-0000-4000-8000-000000000002'],
      primary_document_id: '00000000-0000-4000-8000-000000000002',
      sort_order: 10,
    }],
  },
})

const broken = validContract('broken')
delete broken.price_options[0].area_prices[0].area_price_reference
const result = parseOpsPublicContractsPayload({
  data: [validContract('one'), broken, validContract('two')],
})
assert.equal(result.contracts.length, 2)
assert.equal(result.contracts[0].legal.customer_documents.length, 1)
assert.equal(result.blockedContracts.length, 1)
assert.equal(result.blockedContracts[0].offer_reference, 'offer_broken')
assert.ok(result.blockedContracts[0].reasons.includes('area_price_reference_missing'))
assert.ok(result.blockedContracts[0].issues.some((issue) => issue.path === 'data[1].price_options[0].area_prices[0].area_price_reference'))

const apiOnly = parseOpsPublicContractsPayload({ data: [{ ...validContract('api_only'), channel: 'api' }] })
assert.equal(apiOnly.contracts.length, 0)
assert.ok(apiOnly.blockedContracts[0].reasons.includes('channel_not_website'))

console.log('public-contract feed isolation tests passed')
