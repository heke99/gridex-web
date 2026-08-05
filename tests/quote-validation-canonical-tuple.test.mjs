import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const canonical = read('lib/website/canonicalQuoteValidation.ts')
const start = canonical.indexOf('const opsValidation = await validateOpsWebsiteQuote({')
const end = canonical.indexOf('\n  })', start)
assert.ok(start >= 0 && end > start, 'canonical quote validation payload was not found')
const validationPayload = canonical.slice(start, end)

for (const field of ['price_area:', 'grid_area_code:', 'postal_code:', 'application_number:']) {
  assert.equal(validationPayload.includes(field), false, `${field} must not be appended to an existing quote reference`)
}
for (const field of [
  'quote_reference: effectiveQuote.ops_quote_reference',
  'offer_reference: input.contract.offer_reference',
  'resolution_id: area.resolution_id',
  'annual_consumption_kwh: input.annualConsumptionKwh',
  'start_date: effectiveQuote.start_date',
  'price_option_reference: effectiveQuote.price_option_reference',
  'invoice_delivery_method: effectiveQuote.invoice_delivery_method',
  'selected_component_references: effectiveQuote.selected_component_references',
  'site_count: effectiveQuote.site_count',
]) {
  assert.ok(validationPayload.includes(field), `missing canonical quote field: ${field}`)
}

const opsClient = read('lib/ops/client.ts')
assert.ok(opsClient.includes('{ application_number: input.application_number }'), 'explicit application-number validation support must remain available')

const signup = read('app/(public)/teckna-avtal/page.tsx')
assert.ok(signup.includes('opsErrorCode(error, "quote validation")'))
assert.ok(signup.includes('quote_reference_(?:invalid|mismatch)'))
assert.ok(signup.includes('requiresQuoteRefresh: priceConflict'))

const route = read('app/api/checkout/quote/validate/route.ts')
assert.ok(route.includes("error: { code }"))
assert.ok(route.includes("'Cache-Control': 'private, no-store'"))

console.log('Canonical quote-validation tuple checks passed')
