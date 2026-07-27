import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  fetchOpsCurrentMarketPrice,
  fetchOpsCustomerPortalBundle,
  fetchOpsIntegrationContext,
  fetchOpsPublicContractsFresh,
  fetchOpsWebsiteApplicationStatus,
  fetchOpsWebsiteEnergyArea,
  fetchOpsWebsiteQuote,
  submitOpsCustomerApplication,
  validateOpsWebsiteQuote,
} from '../lib/ops/client.ts'

const fixturePath = process.env.GRIDEX_STAGING_E2E_FIXTURE?.trim()
if (!process.env.GRIDEX_API_KEY?.trim()) {
  throw new Error('GRIDEX_API_KEY krävs för staging-E2E.')
}
if (!fixturePath) {
  throw new Error('GRIDEX_STAGING_E2E_FIXTURE måste peka på en lokal JSON-fixture med testkund.')
}

const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const requiredText = (key) => {
  const value = typeof fixture[key] === 'string' ? fixture[key].trim() : ''
  if (!value) throw new Error(`Staging-fixturen saknar ${key}.`)
  return value
}
const annualConsumptionKwh = Number(fixture.annual_consumption_kwh)
assert.ok(Number.isFinite(annualConsumptionKwh) && annualConsumptionKwh > 0)

const context = await fetchOpsIntegrationContext(true)
assert.equal(context.contract_version, '2026-07-27.1')
assert.equal(context.configuration.application_reference_location, 'top_level')
assert.equal(context.capabilities.website_checkout_ready, true)
assert.deepEqual(context.capabilities.missing_website_checkout_scopes, [])

const contracts = await fetchOpsPublicContractsFresh(fixture.customer_type ?? 'private')
assert.ok(contracts.length > 0, 'OPS måste returnera minst ett website-publicerat avtal.')
const offerReference = fixture.offer_reference ?? contracts[0]?.offer_reference
assert.ok(contracts.some((item) => item.offer_reference === offerReference), 'Fixturens offer_reference är inte publicerad.')

const resolution = await fetchOpsWebsiteEnergyArea({
  postal_code: requiredText('postal_code'),
  city: requiredText('city'),
  street: requiredText('street'),
})
assert.ok(resolution.resolution_id, 'OPS resolver måste returnera resolution_id.')
assert.ok(resolution.price_area_code, 'OPS resolver måste returnera price area.')

const marketPrice = await fetchOpsCurrentMarketPrice(resolution.resolution_id)
assert.equal(marketPrice.resolution_id, resolution.resolution_id)
assert.equal(marketPrice.price_area, resolution.price_area_code)
assert.equal(marketPrice.is_stale, false)

const quote = await fetchOpsWebsiteQuote({
  resolution_id: resolution.resolution_id,
  offer_reference: offerReference,
  annual_consumption_kwh: annualConsumptionKwh,
  customer_type: fixture.customer_type ?? 'private',
  start_date: requiredText('start_date'),
})
assert.ok(quote.ops_quote_reference, 'OPS quote måste returnera quote_reference.')
assert.equal(quote.resolution_id, resolution.resolution_id)
assert.equal(quote.contract.offer_reference, offerReference)

const validation = await validateOpsWebsiteQuote({
  quote_reference: quote.ops_quote_reference,
  offer_reference: offerReference,
  resolution_id: resolution.resolution_id,
  annual_consumption_kwh: annualConsumptionKwh,
  customer_type: fixture.customer_type ?? 'private',
  start_date: requiredText('start_date'),
})
assert.equal(validation.valid, true)
assert.equal(validation.quote_reference, quote.ops_quote_reference)

const idempotencyKey = requiredText('idempotency_key')
const applicationInput = {
  external_customer_id: requiredText('external_customer_id'),
  offer_reference: offerReference,
  quote_reference: quote.ops_quote_reference,
  resolution_id: resolution.resolution_id,
  annual_consumption_kwh: annualConsumptionKwh,
  start_date: requiredText('start_date'),
  customer: fixture.customer,
  site: {
    ...fixture.site,
    street: requiredText('street'),
    postal_code: requiredText('postal_code'),
    city: requiredText('city'),
  },
  contract: fixture.contract ?? {
    requested_start_mode: 'specific_date',
    requested_start_date: requiredText('start_date'),
  },
  consents: fixture.legal_acceptances ?? fixture.consents,
  powerOfAttorney: fixture.powerOfAttorney ?? null,
  idempotency_key: idempotencyKey,
}
assert.ok(applicationInput.customer && applicationInput.consents)

const first = await submitOpsCustomerApplication(applicationInput)
const second = await submitOpsCustomerApplication(applicationInput)
assert.ok(first.application_id, 'OPS application måste returnera application_id.')
assert.equal(second.application_id, first.application_id)
assert.equal(second.customer_id, first.customer_id)
assert.equal(second.contract_id, first.contract_id)
assert.equal(second.workflow_id, first.workflow_id)

const status = await fetchOpsWebsiteApplicationStatus(first.application_id)
assert.equal(status.application_id, first.application_id)

let portal = null
if (fixture.portal_user_id) {
  portal = await fetchOpsCustomerPortalBundle({
    userId: fixture.portal_user_id,
    email: fixture.customer?.email ?? null,
    customerNumber: first.customer_number ?? null,
    externalCustomerId: applicationInput.external_customer_id,
  })
  assert.ok(portal && typeof portal === 'object')
}

console.log(JSON.stringify({
  tenant_reference: context.tenant_reference,
  offer_reference: offerReference,
  resolution_id: resolution.resolution_id,
  quote_reference: quote.ops_quote_reference,
  application_id: first.application_id,
  application_number: first.application_number ?? null,
  customer_id: first.customer_id ?? null,
  customer_number: first.customer_number ?? null,
  site_id: first.site_id ?? null,
  metering_point_id: first.metering_point_id ?? null,
  contract_id: first.contract_id ?? null,
  workflow_id: first.workflow_id ?? null,
  status: status.status,
  portal_bundle_checked: Boolean(portal),
}, null, 2))
