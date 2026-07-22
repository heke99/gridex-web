import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const ops = read('lib/ops/client.ts')
const preview = read('lib/website/pricingPreview.ts')
const quote = read('lib/website/pricingQuote.ts')

assert.ok(ops.includes('annual_consumption_kwh: annualConsumptionKwh'))
assert.ok(ops.includes('price_area: input.price_area_code'))
assert.ok(ops.includes('toOpsCustomerType(input.customer_type)'))
assert.ok(ops.includes('assertCanonicalQuoteMetadata(preview)'))
assert.ok(preview.includes('fetchOpsWebsiteQuote(input)'))
assert.ok(!preview.includes('ElprisetJustNu'))
assert.ok(quote.includes('const opsExpiry = Date.parse(validUntil)'))
assert.ok(quote.includes('quote_reference: quoteReference'))
assert.ok(quote.includes('quote_source: "ops"'))
console.log('OPS canonical quote contract checks passed')
