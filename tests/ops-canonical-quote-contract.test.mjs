import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const ops = read('lib/ops/client.ts')
const preview = read('lib/website/pricingPreview.ts')
const route = read('app/api/v1/website/pricing/preview/route.ts')

assert.ok(ops.includes('price_area: input.price_area_code'))
assert.ok(ops.includes('annual_consumption_kwh: input.estimated_monthly_kwh * 12'))
assert.ok(ops.includes('start_date: startDate'))
assert.ok(ops.includes('input.customer_type === "company"'))
assert.ok(ops.includes('recordValue(row.offer)'))
assert.ok(ops.includes('recordValue(row.input)'))
assert.ok(ops.includes('recordValue(row.estimate)'))
assert.ok(ops.includes('monthly_inc_vat'))
assert.ok(ops.includes('annual_inc_vat'))
assert.ok(ops.includes('invoiceFeeIncludedInMonthlyEstimate: hasInvoiceFeeLine'))
assert.ok(preview.includes('OPS /website/quote is the only canonical calculation path'))
assert.ok(!preview.includes('canUsePublishedPricingFallback'))
assert.ok(route.includes('customer_type: customerType'))

console.log('OPS canonical quote contract checks passed')
