import assert from 'node:assert/strict'
import {
  OpsError,
  mapOpsCustomerApplicationResult,
  validateOpsWebsiteQuote,
} from '../lib/ops/client.ts'
import { normalizePublicContractApiPayload } from '../lib/website/publicContractContract.ts'
import { buildPublicContractDisplay } from '../lib/website/publicContractDisplay.ts'

const CONTRACT_VERSION = '2026-07-27.1'
const BASE_URL = 'https://app.gridex.se/api/v1'
const TENANT_REFERENCE = 'tenant_runtime_test'

const validContext = {
  tenant_reference: TENANT_REFERENCE,
  api_client_reference: 'api_client_runtime_test',
  api_version: 'v1',
  authoritative_identity: 'api_key',
  contract_version: CONTRACT_VERSION,
  active_scopes: [
    'integration_context.read',
    'website_quotes.validate',
  ],
  configuration: {
    required_environment_variables: ['GRIDEX_API_KEY'],
    api_base_url: BASE_URL,
    authentication: {
      header: 'Authorization',
      scheme: 'Bearer',
      server_side_only: true,
    },
    openapi_url: `${BASE_URL}/openapi/website-integration-v1.json`,
    customer_portal_openapi_url: `${BASE_URL}/openapi/customer-portal-v1.json`,
    application_reference_location: 'top_level',
    tenant_id_environment_required: false,
    company_id_environment_required: false,
  },
  capabilities: {
    website_checkout_ready: true,
    customer_portal_ready: false,
    complete_tenant_website_ready: false,
    missing_website_scopes: [],
    missing_customer_portal_scopes: ['customer_profile.read'],
    missing_recommended_scopes: ['website_market_prices.read'],
  },
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'X-Gridex-Contract-Version': CONTRACT_VERSION,
      ...headers,
    },
  })
}

function quoteValidationInput() {
  return {
    quote_reference: 'quote_runtime_test',
    offer_reference: 'offer_runtime_test',
    customer_type: 'private',
    resolution_id: 'f8249704-7ce8-4885-93cb-fbb9922ed77d',
    annual_consumption_kwh: 5000,
    start_date: '2026-09-01',
    price_area: 'SE3',
    grid_area_code: 'GRID-SE3',
    postal_code: '582 22',
  }
}

process.env.GRIDEX_API_KEY = 'gridex_runtime_test_secret_value'
process.env.GRIDEX_API_BASE_URL = BASE_URL

const requests = []
const queuedResponses = [
  // GET integration context is safely retried once.
  jsonResponse({ error: { code: 'temporary_unavailable', message: 'temporary' } }, 503, { 'Retry-After': '0' }),
  jsonResponse({ data: validContext }),
  jsonResponse({
    data: {
      valid: true,
      quote_reference: 'quote_runtime_test',
      offer_reference: 'offer_runtime_test',
      status: 'active',
      valid_until: '2026-09-01T12:00:00Z',
    },
    request_id: '11111111-1111-4111-8111-111111111111',
  }),
  jsonResponse({
    data: {
      valid: true,
      quote_reference: 'quote_runtime_test',
      offer_reference: 'offer_other',
    },
    request_id: '22222222-2222-4222-8222-222222222222',
  }),
  jsonResponse({
    data: {
      valid: true,
      quote_reference: 'quote_runtime_test',
    },
    request_id: '33333333-3333-4333-8333-333333333333',
  }),
]

globalThis.fetch = async (url, init = {}) => {
  requests.push({ url: String(url), init })
  const response = queuedResponses.shift()
  assert.ok(response, `unexpected fetch: ${url}`)
  return response
}

const validated = await validateOpsWebsiteQuote(quoteValidationInput())
assert.equal(validated.valid, true)
assert.equal(validated.quote_reference, 'quote_runtime_test')
assert.equal(validated.offer_reference, 'offer_runtime_test')
assert.equal(requests.filter((request) => request.url.endsWith('/integration/context')).length, 2)
const validationRequest = requests.find((request) => request.url.endsWith('/website/quote/validate'))
assert.ok(validationRequest)
assert.equal(validationRequest.init.method, 'POST')
assert.equal(validationRequest.init.headers.get('Authorization'), 'Bearer gridex_runtime_test_secret_value')
assert.equal(validationRequest.init.headers.get('X-Gridex-Accept-Contract-Version'), CONTRACT_VERSION)
assert.deepEqual(JSON.parse(validationRequest.init.body), {
  quote_reference: 'quote_runtime_test',
  offer_reference: 'offer_runtime_test',
  customer_type: 'private',
  resolution_id: 'f8249704-7ce8-4885-93cb-fbb9922ed77d',
  annual_consumption_kwh: 5000,
  start_date: '2026-09-01',
  price_area: 'SE3',
  grid_area_code: 'GRID-SE3',
  postal_code: '58222',
})

await assert.rejects(
  () => validateOpsWebsiteQuote(quoteValidationInput()),
  (error) => error instanceof OpsError && error.status === 409 && error.code === 'ops_quote_binding_mismatch',
)
await assert.rejects(
  () => validateOpsWebsiteQuote(quoteValidationInput()),
  (error) => error instanceof OpsError && error.status === 502 && error.code === 'ops_quote_validation_contract_invalid',
)

const productionContract = normalizePublicContractApiPayload({
  offer_reference: 'offer_production_runtime',
  name: 'Produktionsersättning',
  contract_type: 'variable_quarterly',
  energy_direction: 'production',
  customer_type: 'both',
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
  production_pricing: {
    enabled: true,
    compensation_model: 'fixed_compensation',
    resolution: 'quarterly',
    fixed_compensation_ore_per_kwh: 65,
    settlement_mode: 'self_billing',
    billing_direction: 'self_billing',
    metering_point_role: 'production',
  },
})
assert.ok(productionContract)
assert.equal(productionContract.energy_direction, 'production')
assert.equal(productionContract.production_pricing?.resolution, 'quarterly')
const productionDisplay = buildPublicContractDisplay(productionContract)
assert.equal(productionDisplay.ready, true)
assert.equal(productionDisplay.typeLabel, 'Kvartspris')
assert.ok(productionDisplay.description.toLowerCase().includes('produktion'))

assert.equal(normalizePublicContractApiPayload({
  offer_reference: 'offer_invalid_production',
  name: 'Saknar produktionspris',
  contract_type: 'variable_hourly',
  energy_direction: 'production',
  customer_type: 'both',
  pricing: {},
}), null)
assert.equal(normalizePublicContractApiPayload({
  offer_reference: 'offer_unknown_enum',
  name: 'Okänd kontraktstyp',
  contract_type: 'future_type',
  energy_direction: 'consumption',
  customer_type: 'private',
  pricing: {},
}), null)

const mappedApplication = mapOpsCustomerApplicationResult({
  data: {
    status: 'accepted',
    application_id: 'app_runtime_1',
    application_number: 'APP-1001',
    customer_id: 'customer_runtime_1',
    customer_number: 'DX-1001',
    contract_id: 'contract_runtime_1',
    contract_number: 'C-1001',
    offer_reference: 'offer_runtime_test',
    quote_reference: 'quote_runtime_test',
    quote_bound: true,
    energy_direction: 'production',
    missing_fields: [],
    blocking_reasons: [],
    grid_owner_verification_issues: [],
    warnings: [],
    supplier_switch: {
      request_id: null,
      status: 'not_created',
      can_create_request: true,
      can_dispatch: false,
      blockers: ['awaiting_grid_owner_data'],
      next_action: 'create_supplier_switch_request',
    },
    power_of_attorney: { status: 'signed' },
    communication: {
      pending: true,
      source_of_truth: 'communication_logs',
      triggered: [{ event_type: 'agreement_confirmation', status: 'queued', occurred_at: '2026-07-27T12:00:00Z' }],
      queued: [{ event_type: 'agreement_confirmation', status: 'queued' }],
      sent: [],
      failed: [{ event_type: 'grid_owner_request', status: 'failed', code: 'provider_unavailable', message: 'Temporärt fel' }],
    },
    next_action: { code: 'await_automatic_processing', message: 'Ansökan behandlas automatiskt.' },
  },
  request_id: '44444444-4444-4444-8444-444444444444',
  correlation_id: '55555555-5555-4555-8555-555555555555',
})
assert.equal(mappedApplication.supplier_switch.status, 'not_created')
assert.equal(mappedApplication.supplier_switch.next_action, 'create_supplier_switch_request')
assert.equal(mappedApplication.power_of_attorney?.status, 'signed')
assert.equal(mappedApplication.energy_direction, 'production')
assert.equal(mappedApplication.communication?.failed[0]?.code, 'provider_unavailable')
assert.equal(typeof mappedApplication.communication?.triggered[0], 'object')
assert.equal(mappedApplication.communication?.triggered[0]?.event_type, 'agreement_confirmation')
assert.equal(mappedApplication.raw?.power_of_attorney_id, undefined)

console.log('Website API runtime contract tests passed')
