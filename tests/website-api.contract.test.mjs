import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOpsCustomerApplicationPayload } from '../lib/ops/client.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const contract = read('lib/ops/contract.ts')
const ops = read('lib/ops/client.ts')
const readiness = read('lib/ops/readiness.ts')
const portalReadiness = read('lib/ops/portalReadiness.ts')
const area = read('app/api/checkout/energy-area/resolve/route.ts')
const quote = read('app/api/checkout/quote/route.ts')
const validation = read('lib/website/canonicalQuoteValidation.ts')
const signup = read('app/(public)/teckna-avtal/page.tsx')
const energyToken = read('lib/website/energyAreaToken.ts')
const onboarding = read('lib/customerPortal/onboarding.ts')
const websiteOpenApi = JSON.parse(read('docs/openapi/website-integration-v1.json'))
const customerPortalOpenApi = JSON.parse(read('docs/openapi/customer-portal-v1.json'))
const releaseManifest = JSON.parse(read('docs/openapi/release-manifest.json'))
const contractVersion = releaseManifest.release_version
const applicationSchema = websiteOpenApi.components.schemas.CustomerApplicationRequest
const energySchema = websiteOpenApi.components.schemas.WebsiteEnergyAreaResolution
const quoteSchema = websiteOpenApi.components.schemas.WebsiteQuoteRequest

assert.equal(typeof contractVersion, 'string')
assert.ok(contract.includes(`GRIDEX_API_CONTRACT_VERSION = '${contractVersion}'`))
assert.ok(contract.includes("GRIDEX_CANONICAL_OPS_API_URL = 'https://app.gridex.se/api/v1'"))
assert.ok(ops.includes('observeRuntimeSchemaValidation'))
assert.ok(ops.includes('logContractVersionDrift'))
assert.ok(!ops.includes("throw new OpsError('OPS returnerade fel kontraktsversion"))
assert.ok(!ops.includes('GRIDEX_EXPECTED_TENANT_REFERENCE'))
assert.ok(!ops.includes('GRIDEX_WEBSITE_API_KEY'))
assert.ok(!ops.includes('GRIDEX_OPS_API_KEY'))

for (const scope of [
  'website_energy_area.resolve',
  'website_quotes.write',
  'website_quotes.validate',
  'website_applications.write',
]) assert.ok(contract.includes(scope), `canonical scope missing: ${scope}`)

assert.ok(area.includes('resolution.capabilities.pricing_ready !== true'))
assert.ok(area.includes("code: 'resolution_pricing_not_ready'"))
assert.ok(area.includes('resolution.blockers.pricing'))
assert.ok(!area.includes('automation_allowed'))
assert.ok(!ops.includes('automation_allowed'))
assert.ok(ops.includes("pricing_ready: row.capabilities.pricing_ready"))
assert.ok(ops.includes("quote_ready: row.capabilities.quote_ready"))
assert.ok(ops.includes('switch_dispatch_ready'))
assert.ok(energyToken.includes("const TOKEN_VERSION = 'ea5'"))
assert.ok(energyToken.includes('version: 2'))
assert.ok(energyToken.includes('pricing_ready: true'))
assert.ok(energyToken.includes('quote_ready: input.resolution.capabilities.quote_ready'))
assert.ok(!energyToken.includes('automation_allowed'))

assert.ok(quote.includes('fetchOpsWebsiteQuote'))
assert.ok(!quote.includes('fetchOpsCurrentMarketPrice'))
assert.ok(!quote.includes('currentMarketPrice.is_stale'))
assert.ok(!quote.includes('current_market_price:'))
assert.ok(quote.includes('verifiedArea.payload.quote_ready !== true'))
assert.ok(quote.includes("code: 'resolution_quote_not_ready'"))
assert.ok(validation.includes('price_area: area.payload.price_area_code'))
assert.ok(validation.includes('grid_area_code: area.payload.grid_area_code'))
assert.ok(validation.includes('postal_code: input.location.postalCode'))
assert.ok(!quoteSchema.required.includes('requested_start_mode'))
assert.equal(quoteSchema.properties.requested_start_mode, undefined)
assert.deepEqual(
  applicationSchema.properties.contract.properties.requested_start_mode.enum,
  ['earliest_possible', 'specific_date'],
)
assert.ok(websiteOpenApi.components.schemas.WebsiteQuoteData.required.includes('valid_until'))
assert.equal(websiteOpenApi.components.schemas.WebsiteQuoteData.properties.valid_until.format, 'date-time')
assert.ok(validation.includes("reason: 'quote_valid_until_changed'"))
assert.ok(validation.includes("reason: 'quote_expired'"))
assert.ok(ops.includes('requested_start_mode: input.requested_start_mode'))
assert.ok(ops.includes('value.application_number !== normalized'))
assert.ok(!ops.includes('value.application_id !== normalized'))

assert.ok(signup.includes('quote_reference: verifiedQuote.value.quote.ops_quote_reference'))
assert.ok(signup.includes('resolution_id: verifiedQuote.value.area.resolutionId'))
assert.ok(signup.includes('price_area_code: verifiedQuote.value.area.priceAreaCode'))
assert.ok(signup.includes('grid_area_code: verifiedQuote.value.area.gridAreaCode'))
assert.ok(!signup.includes('source: "gridex_web"'))
assert.ok(signup.includes('customer_portal_user_id: linkedAuthUserId'))
assert.ok(signup.includes('auth_user_id: linkedAuthUserId'))
assert.ok(!signup.includes('current_supplier_id: currentSupplierId'))

assert.equal(websiteOpenApi.info.version, contractVersion)
assert.deepEqual(websiteOpenApi.components.schemas.EnergyDirection.enum, ['consumption', 'production'])
assert.deepEqual(websiteOpenApi.components.schemas.ProductionPricing.required, [
  'enabled', 'compensation_model', 'resolution', 'settlement_mode', 'billing_direction', 'metering_point_role',
])
assert.ok(websiteOpenApi.components.schemas.PublicContract.required.includes('energy_direction'))
assert.ok(websiteOpenApi.components.schemas.PublicContract.properties.contract_type.enum.includes('variable_quarterly'))
assert.ok(ops.includes("type OpsWebsiteQuoteRequestDto = WebsiteApiComponents['schemas']['WebsiteQuoteRequest']"))
assert.ok(ops.includes("type OpsCustomerApplicationRequestDto = WebsiteApiComponents['schemas']['CustomerApplicationRequest']"))
assert.ok(ops.includes("response.quote_reference === submittedQuoteReference") || ops.includes('quoteReference !== input.quote_reference'))
assert.ok(ops.includes("offerReference !== input.offer_reference"))
assert.ok(ops.includes('mapWebsiteSupplierSwitchState(row.supplier_switch)'))
assert.ok(ops.includes('mapApplicationPowerOfAttorney(row.power_of_attorney)'))
assert.ok(!ops.includes('Boolean(power_of_attorney_id)'))
assert.ok(!ops.includes('.map(String)') || ops.includes("const blockers = Array.isArray(row.blockers) ? row.blockers.map(String) : null"))
assert.ok(ops.includes('production_pricing: PublicProductionPricing | null;'))
assert.ok(!ops.includes('type GridexFetchRequestInit'))
assert.ok(!onboarding.includes('input.application.portal_identity_id'))
assert.ok(!onboarding.includes('input.application.contract_price_snapshot_id'))
assert.ok(onboarding.includes('quote_reference: input.application.quote_reference'))

assert.equal(customerPortalOpenApi.info.version, contractVersion)
assert.ok(customerPortalOpenApi.paths['/api/v1/customer/portal-bundle'].get)
assert.ok(customerPortalOpenApi.paths['/api/v1/customer/portal-bundle'].post)
assert.ok(customerPortalOpenApi.paths['/api/v1/customer/notifications/read'].post)
assert.ok(customerPortalOpenApi.paths['/api/v1/customer/profile-update'].post)
assert.ok(customerPortalOpenApi.paths['/api/v1/customer-portal/sync'].post)
assert.ok(!customerPortalOpenApi.paths['/customer/portal-bundle'])
assert.equal(customerPortalOpenApi['x-scope-aliases']['customer_portal.read'].status, 'deprecated_legacy_alias')
for (const pathItem of Object.values(customerPortalOpenApi.paths)) {
  for (const operation of Object.values(pathItem)) {
    if (!operation || typeof operation !== 'object') continue
    assert.ok(!(operation['x-required-scopes'] ?? []).includes('customer_portal.read'))
  }
}
assert.deepEqual(
  customerPortalOpenApi.paths['/api/v1/customer/profile-update'].post['x-required-scopes'],
  ['customer_contact.write', 'customer_facility_data.write'],
)
for (const scope of [
  'customer_profile.read',
  'customer_sites.read',
  'customer_contracts.read',
  'customer_invoices.read',
  'customer_metering.read',
  'customer_legal.read',
  'customer_events.read',
  'customer_documents.read',
  'customer_notifications.read',
  'customer_power_of_attorney.read',
]) assert.ok(
  customerPortalOpenApi.paths['/api/v1/customer/portal-bundle'].post['x-required-scopes'].includes(scope),
  `portal OpenAPI bundle scope missing: ${scope}`,
)
assert.ok(energySchema.required.includes('capabilities'))
assert.ok(energySchema.required.includes('blockers'))
assert.ok(energySchema.required.includes('retryable'))
assert.ok(!('automation_allowed' in energySchema.properties))
assert.ok(quoteSchema.required.includes('resolution_id'))
// The live quote-create contract allows OPS to resolve the canonical default price option.
// The field is published and validated when supplied, but it is not required until
// quote validation and the final customer application.
assert.ok(!quoteSchema.required.includes('price_option_reference'))
assert.equal(quoteSchema.properties.price_option_reference.type, 'string')
assert.equal(quoteSchema.properties.price_option_reference.pattern, '^[a-z0-9][a-z0-9_-]{2,99}$')
for (const field of ['invoice_delivery_method', 'selected_component_references', 'site_count']) assert.ok(quoteSchema.required.includes(field), `quote field must be required: ${field}`)
assert.equal(quoteSchema.additionalProperties, false)
const quoteValidationSchema = websiteOpenApi.components.schemas.QuoteValidationRequest
for (const field of ['price_option_reference', 'invoice_delivery_method', 'selected_component_references', 'site_count']) assert.ok(quoteValidationSchema.required.includes(field), `quote validation field must be required: ${field}`)
assert.equal(quoteValidationSchema.additionalProperties, false)
assert.ok(applicationSchema.required.includes('offer_reference'))
assert.ok(applicationSchema.required.includes('quote_reference'))
assert.ok(applicationSchema.required.includes('resolution_id'))
for (const field of ['price_option_reference', 'invoice_delivery_method', 'selected_component_references', 'site_count']) assert.ok(applicationSchema.required.includes(field), `customer application field must be required: ${field}`)
assert.equal(applicationSchema.additionalProperties, false)
assert.ok('metering_point' in applicationSchema.properties)
assert.ok(!('source' in applicationSchema.properties))
assert.ok('customer_portal_user_id' in applicationSchema.properties)
assert.ok('auth_user_id' in applicationSchema.properties)
assert.ok(applicationSchema.required.includes('customer_portal_user_id'))
assert.ok(applicationSchema.required.includes('auth_user_id'))
assert.ok(applicationSchema.required.includes('legal_bundle_version'))
assert.ok(applicationSchema.required.includes('legal_acceptances'))
assert.equal(websiteOpenApi.components.schemas.LegalAcceptances.type, 'array')
assert.ok(!('metering_point_id' in applicationSchema.properties.site.properties))
assert.ok(!('current_supplier_id' in applicationSchema.properties.site.properties))

assert.ok(ops.includes('customer_portal_ready'))
assert.ok(ops.includes('complete_tenant_website_ready'))
assert.ok(ops.includes('missing_recommended_scopes'))
assert.ok(ops.includes('capabilities: {'))
assert.ok(ops.includes('facility_lookup_ready: row.capabilities.facility_lookup_ready'))
assert.ok(readiness.includes('website_quotes.write'))
assert.ok(ops.includes('opsCustomerFetch("/api/v1/customer/portal-bundle", identity, {'))
assert.ok(ops.includes('method: "POST"'))
assert.ok(ops.includes('body: JSON.stringify(portalIdentityPayload(identity))'))
assert.ok(!portalReadiness.includes('customer_portal.read'))
for (const scope of [
  'customer_profile.read',
  'customer_sites.read',
  'customer_contracts.read',
  'customer_invoices.read',
  'customer_metering.read',
  'customer_legal.read',
  'customer_events.read',
  'customer_documents.read',
  'customer_notifications.read',
  'customer_power_of_attorney.read',
]) assert.ok(portalReadiness.includes(scope), `portal bundle scope missing: ${scope}`)

const applicationPayload = buildOpsCustomerApplicationPayload({
  external_customer_id: 'tenant-customer-123',
  offer_reference: 'offer_test',
  quote_reference: 'quote_test',
  price_option_reference: 'price_option_test',
  invoice_delivery_method: 'email',
  selected_component_references: ['component_test'],
  site_count: 1,
  resolution_id: 'f8249704-7ce8-4885-93cb-fbb9922ed77d',
  annual_consumption_kwh: 5000,
  start_date: '2026-09-01',
  customer_portal_user_id: '11111111-1111-4111-8111-111111111111',
  auth_user_id: '11111111-1111-4111-8111-111111111111',
  customer: {
    customer_type: 'private',
    first_name: 'Test',
    last_name: 'Kund',
    personal_number: '199001011234',
    email: 'test@example.se',
    phone: '0700000000',
  },
  site: {
    facility_id: 'facility-1',
    street: 'Testgatan 1',
    postal_code: '582 00',
    city: 'Linköping',
    country: 'SE',
    price_area_code: 'SE3',
    grid_area_code: 'GRID-1',
    grid_owner_id: 'f8249704-7ce8-4885-93cb-fbb9922ed77e',
    move_in_date: '2026-09-01',
  },
  metering_point: { metering_point_id: '735999123456789012' },
  contract: {
    requested_start_mode: 'specific_date',
    requested_start_date: '2026-09-01',
  },
  idempotency_key: 'idem_test',
  legal_bundle_version: 'f8249704-7ce8-4885-93cb-fbb9922ed77f',
  legal_acceptances: [{
    requirement_code: 'general_consumer_terms',
    document_reference: 'f8249704-7ce8-4885-93cb-fbb9922ed780',
    document_version: '1',
    document_hash: 'a'.repeat(64),
    accepted: true,
    accepted_at: '2026-07-30T12:00:00.000Z',
  }],
})

assert.equal(applicationPayload.offer_reference, 'offer_test')
assert.equal(applicationPayload.quote_reference, 'quote_test')
assert.equal(applicationPayload.price_option_reference, 'price_option_test')
assert.equal(applicationPayload.invoice_delivery_method, 'email')
assert.deepEqual(applicationPayload.selected_component_references, ['component_test'])
assert.equal(applicationPayload.site_count, 1)
assert.equal(applicationPayload.resolution_id, 'f8249704-7ce8-4885-93cb-fbb9922ed77d')
assert.equal(applicationPayload.site.postal_code, '58200')
assert.equal(applicationPayload.site.price_area_code, 'SE3')
assert.equal(applicationPayload.site.annual_consumption_kwh, 5000)
assert.deepEqual(applicationPayload.metering_point, { metering_point_id: '735999123456789012' })
assert.equal('source' in applicationPayload, false)
assert.equal(applicationPayload.auth_user_id, '11111111-1111-4111-8111-111111111111')
assert.equal(applicationPayload.customer_portal_user_id, '11111111-1111-4111-8111-111111111111')
assert.equal('metering_point_id' in applicationPayload.site, false)
assert.equal('current_supplier_id' in applicationPayload.site, false)
assert.equal('offer_reference' in applicationPayload.contract, false)
assert.equal('quote_reference' in applicationPayload.contract, false)
assert.equal(applicationPayload.legal_bundle_version, 'f8249704-7ce8-4885-93cb-fbb9922ed77f')
assert.deepEqual(applicationPayload.legal_acceptances, [{
  requirement_code: 'general_consumer_terms',
  document_reference: 'f8249704-7ce8-4885-93cb-fbb9922ed780',
  document_version: '1',
  document_hash: 'a'.repeat(64),
  accepted: true,
  accepted_at: '2026-07-30T12:00:00.000Z',
}])

const baseApplicationInput = {
  external_customer_id: 'tenant-customer-identity-test',
  offer_reference: 'offer_test',
  quote_reference: 'quote_test',
  price_option_reference: 'price_option_test',
  invoice_delivery_method: 'email',
  selected_component_references: [],
  site_count: 1,
  resolution_id: 'f8249704-7ce8-4885-93cb-fbb9922ed77d',
  annual_consumption_kwh: 5000,
  start_date: '2026-09-01',
  customer: { customer_type: 'private', personal_number: '199001011234', email: 'test@example.se', phone: '0700000000' },
  site: { street: 'Testgatan 1', postal_code: '58200', city: 'Linköping', country: 'SE', price_area_code: 'SE3', grid_area_code: 'GRID-1' },
  contract: { requested_start_mode: 'specific_date', requested_start_date: '2026-09-01' },
  idempotency_key: 'identity-test',
  legal_bundle_version: 'f8249704-7ce8-4885-93cb-fbb9922ed77f',
  legal_acceptances: [{
    requirement_code: 'general_consumer_terms',
    document_reference: 'f8249704-7ce8-4885-93cb-fbb9922ed780',
    document_version: '1',
    document_hash: 'a'.repeat(64),
    accepted: true,
    accepted_at: '2026-07-30T12:00:00.000Z',
  }],
}
assert.throws(
  () => buildOpsCustomerApplicationPayload({
    ...baseApplicationInput,
    customer_portal_user_id: '',
    auth_user_id: '',
  }),
  (error) => error?.code === 'customer_portal_identity_required',
)
assert.throws(
  () => buildOpsCustomerApplicationPayload({
    ...baseApplicationInput,
    customer_portal_user_id: '11111111-1111-4111-8111-111111111111',
    auth_user_id: '22222222-2222-4222-8222-222222222222',
  }),
  (error) => error?.code === 'customer_portal_identity_mismatch',
)
assert.throws(
  () => buildOpsCustomerApplicationPayload({
    ...baseApplicationInput,
    customer_portal_user_id: 'not-a-uuid',
    auth_user_id: 'not-a-uuid',
  }),
  (error) => error?.code === 'customer_portal_identity_invalid',
)

console.log(`Website API contract tests passed (${contractVersion})`)
