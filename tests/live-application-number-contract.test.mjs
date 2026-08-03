import assert from 'node:assert/strict'
import fs from 'node:fs'

const spec = JSON.parse(fs.readFileSync('docs/openapi/website-integration-v1.json', 'utf8'))
const source = fs.readFileSync('lib/ops/client.ts', 'utf8')
const route = fs.readFileSync('app/api/checkout/applications/[applicationId]/route.ts', 'utf8')
const quote = spec.components.schemas.WebsiteQuoteRequest
const status = spec.components.schemas.CustomerApplicationStatus
const validation = spec.components.schemas.QuoteValidationRequest
const application = spec.components.schemas.WebsiteCustomerApplicationData

assert.equal(quote.additionalProperties, false)
assert.equal(quote.properties.requested_start_mode, undefined)
assert.ok(!quote.required.includes('requested_start_mode'))
assert.ok(status.required.includes('application_number'))
assert.equal(status.properties.application_id, undefined)
assert.equal(validation.properties.application_id, undefined)
assert.ok(validation.properties.application_number)
assert.equal(application.properties.application_id, undefined)
assert.ok(application.required.includes('application_number'))
assert.ok(spec.paths['/api/v1/website/customer-applications/{application_number}'])
assert.ok(source.includes('value.application_number !== normalized'))
assert.ok(!source.includes('value.application_id !== normalized'))
assert.ok(source.includes('{ application_number: input.application_number }'))
assert.ok(route.includes('opsApplicationNumber: data.application_number'))
console.log('live application-number contract regression passed')
