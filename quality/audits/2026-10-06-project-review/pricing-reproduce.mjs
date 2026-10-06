import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const root = new URL('../../../', import.meta.url)
const { mapOpsWebsiteQuote } = await import(new URL('lib/ops/client/core.ts', root))
const { assertWebsiteResponse, validateOpenApiSchema } = await import(new URL('lib/ops/validators/openapi.ts', root))
const { issueWebsitePricingQuote, verifyWebsitePricingQuote, validateWebsitePricingQuote } = await import(new URL('lib/website/pricingQuote.ts', root))
const { buildPublicContractDisplay } = await import(new URL('lib/website/publicContractDisplay.ts', root))
const { default: PriceResultCard } = await import(new URL('components/PriceResultCard.tsx', root))
const input = { resolution_id: 'resolution_audit_price', offer_reference: 'offer_audit_price',
  annual_consumption_kwh: 1200, start_date: '2026-10-06', price_option_reference: 'option_audit_price',
  invoice_delivery_method: 'e_invoice', selected_component_references: [], site_count: 1,
  requested_start_mode: 'specific_date', customer_type: 'private' }
const payload = { request_id: 'offline-pricing-audit', contract_schema_version: '2026-10-04.1', data: {
  quote_reference: 'quote_audit_price', offer_reference: input.offer_reference, valid_until: '2030-01-01T00:00:00Z',
  input: { ...input, price_area: 'SE3', estimated_monthly_consumption_kwh: 100 },
  offer: { name: 'Syntetiskt fastpris', contract_type: 'fixed' }, energy_direction: 'consumption', production_pricing: null,
  price_option_reference: input.price_option_reference, area_price_reference: 'area_price_audit',
  invoice_delivery_method: input.invoice_delivery_method, selected_component_references: [],
  mandatory_component_references: ['component_monthly_audit'], conditional_component_references: [], site_count: 1,
  pricing: { price_per_kwh_ore: 100 },
  selected_area_price: { price_area: 'SE3', energy_price_ore_per_kwh: 100, unit: 'ore_per_kwh' },
  estimate: { monthly_ex_vat: 149, monthly_vat: 37.25, monthly_inc_vat: 186.25,
    annual_ex_vat: 1788, annual_vat: 447, annual_inc_vat: 2235 },
  lines: [{ component_code: 'monthly_fee', name: 'Månadsavgift', quantity: 1, unit: 'sek_per_month',
    unit_price_ex_vat: 49, amount_ex_vat: 49, vat_rate: 0.25, vat_amount: 12.25, amount_inc_vat: 61.25 }],
  resolved_price_components: [{ component_code: 'monthly_fee', name: 'Månadsavgift', amount: 49,
    unit: 'sek_per_month', calculation_inclusion: 'included', website_visibility: 'visible' }],
  settlement: { model: 'fixed_price', customer_accepts: 'fixed_energy_price', energy_price_locked_at_signup: true,
    uses_actual_metered_consumption: true, market_data_role: 'not_applicable', settlement_resolution: 'fixed' },
  is_binding: true, pricing_interval: 'monthly', estimate_method: 'canonical_monthly_preview',
  pricing_snapshot_schema_version: '2026-10-04.1', assumptions: [], market_sources: [],
} }
assertWebsiteResponse('WebsiteQuoteResponse', payload, '/api/v1/website/quote')
const preview = mapOpsWebsiteQuote(payload, input)
assert.equal(preview.totalMonthlyCostInclVatSek, 186.25)
assert.equal(preview.specification.fees.monthlyFeeSek, undefined)
assert.equal(preview.totalYearlyCostSek, undefined)
const html = renderToStaticMarkup(createElement(PriceResultCard, { data: preview }))
assert.equal(html.includes('Månadsavgift'), false)
console.log('CONFIRMED F17: valid canonical quote retains monthly total 186.25 but loses visible monthly-fee line 49 and annual_inc_vat 2235')

const component = { component_code: 'monthly_fee', name: 'Månadsavgift', amount: 49, unit: 'sek_per_month',
  calculation_inclusion: 'included', website_visibility: 'visible', vat_included: false, vat_rate: 0.25 }
const display = buildPublicContractDisplay({ type: 'variable_monthly', name: 'Syntetiskt avtal',
  offer_reference: input.offer_reference, energy_direction: 'consumption', display_components: [component],
  pricing_components: [component], legal_requirements: [], vat_rate: 0.25 })
const fee = display.rows.find(x => x.key === 'monthly_fee')
assert.equal(fee.formatted, '49 kr/mån')
assert.equal('vat_included' in fee, false)
console.log('CONFIRMED F18: ex-VAT component renders as 49 kr/mån with VAT semantics discarded; gross counterpart is 61.25')

const production = structuredClone(payload)
production.data.energy_direction = 'production'
production.data.production_pricing = { enabled: true, compensation_model: 'fixed_compensation', resolution: 'monthly',
  fixed_compensation_ore_per_kwh: 100, compensation_ore_per_kwh: 100, vat_rate: 0,
  settlement_mode: 'credit_invoice', billing_direction: 'credit_invoice', metering_point_role: 'production' }
assertWebsiteResponse('WebsiteQuoteResponse', production, '/api/v1/website/quote')
const productionHtml = renderToStaticMarkup(createElement(PriceResultCard, { data: mapOpsWebsiteQuote(production, input) }))
assert.ok(productionHtml.includes('Beräknad månadskostnad inkl. moms'))
assert.ok(productionHtml.includes('Teckna elavtal'))
console.log('CONFIRMED F19: production compensation quote is rendered as monthly cost and uses consumption checkout wording')

const location = { postalCode: '11122', city: 'Teststad', address: 'Testgatan 1' }
const previous = 'synthetic-old-audit-signing-secret-at-least-32-bytes'
process.env.GRIDEX_WEBSITE_STATE_SIGNING_SECRET = previous
process.env.GRIDEX_WEBSITE_STATE_SIGNING_KID = 'audit-old'
const contract = { offer_reference: input.offer_reference, name: 'Syntetiskt avtal', type: 'fixed', energy_direction: 'consumption' }
const issued = issueWebsitePricingQuote({ preview, contract, customerType: 'private', requestedStartMode: 'specific_date',
  quoteAttemptId: '11111111-1111-4111-8111-111111111111', location })
assert.ok(issued)
const validation = () => validateWebsitePricingQuote({ token: issued.token, contract, customerType: 'private',
  priceAreaCode: 'SE3', estimatedMonthlyKwh: 100, annualConsumptionKwh: 1200, location })
assert.equal(validation().ok, true)
process.env.GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_SECRET = previous
process.env.GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_KID = 'audit-old'
process.env.GRIDEX_WEBSITE_STATE_SIGNING_SECRET = 'synthetic-new-audit-signing-secret-at-least-32-bytes'
process.env.GRIDEX_WEBSITE_STATE_SIGNING_KID = 'audit-new'
assert.equal(verifyWebsitePricingQuote(issued.token).ok, true)
assert.equal(validation().reason, 'location_changed')
console.log('CONFIRMED F20: old quote signature verifies through previous key but unchanged address is rejected after key rotation')

const user = { id: 'offline-audit-user', email: 'audit@example.invalid', user_metadata: {} }
const chain = { select(){return this}, eq(){return this}, async maybeSingle(){return {data:{user_id:user.id,customer_number:'DX-AUDIT',external_customer_id:'external-audit'}}} }
globalThis.__pricingAudit = { db: { auth: { async getUser(){return {data:{user}}} }, from(){return chain} }, resource: [] }
const { getCanonicalCustomerResource } = await import(new URL('lib/customerPortal/service.ts', root))
const invoice = { invoice_reference: 'invoice_audit', status: 'draft', amount_inc_vat: null, vat_amount: null, currency: 'SEK' }
// Run the real portal validator, independent from the stubbed transport.
const validationResult = validateOpenApiSchema('customer-portal', 'CustomerInvoice', invoice)
assert.equal(validationResult.valid, true)
globalThis.__pricingAudit.resource = [invoice]
const invoiceResult = await getCanonicalCustomerResource('invoices')
assert.equal(invoiceResult.data[0].total_amount, 0)
assert.equal(invoiceResult.data[0].vat_amount, 0)
console.log('CONFIRMED F24: schema-valid unknown invoice total and VAT become known zero values')
globalThis.__pricingAudit.resource = [{ contract_reference:'contract_audit', status:'active', energy_direction:'consumption',
  monthly_fee_sek:49, fixed_price_ore_per_kwh:100, binding_months:12, notice_months:1,
  auto_renew_enabled:true, withdrawal_deadline_at:'2026-10-20', signature_snapshot_sha256:'a'.repeat(64), created_at:null }]
const contractResult = await getCanonicalCustomerResource('contracts')
assert.deepEqual(contractResult.data[0].pricing_snapshot, {})
assert.equal(contractResult.data[0].monthly_fee_sek, undefined)
assert.equal(contractResult.data[0].binding_months, undefined)
assert.ok(contractResult.data[0].created_at)
console.log('CONFIRMED F25: canonical contract price/binding/renewal fields discarded and unknown creation time replaced with now')
