import assert from 'node:assert/strict'
import {
  classifyOpenApiIssue,
  requiresPublishedAreaPrices,
} from '../lib/website/publicContractPolicy.ts'

assert.equal(requiresPublishedAreaPrices({ price_type: 'fixed', contract_type: 'fixed' }), true)
for (const type of ['variable_monthly', 'variable_hourly', 'variable_quarterly', 'portfolio', 'mixed']) {
  assert.equal(requiresPublishedAreaPrices({ price_type: type, contract_type: type }), false, type)
}

const root = {
  offer_reference: 'offer_policy',
  price_options: [{ is_default: true, markup: 1 }],
}
const additive = classifyOpenApiIssue({
  root,
  basePath: 'data[0]',
  issue: {
    instancePath: '/price_options/0',
    keyword: 'additionalProperties',
    message: 'must NOT have additional properties',
    params: { additionalProperty: 'new_optional_metadata' },
  },
})
assert.equal(additive.severity, 'compatibility')
assert.equal(additive.code, 'openapi_additionalProperties')

const internal = classifyOpenApiIssue({
  root,
  basePath: 'data[0]',
  issue: {
    instancePath: '',
    keyword: 'additionalProperties',
    message: 'must NOT have additional properties',
    params: { additionalProperty: 'company_id' },
  },
})
assert.equal(internal.severity, 'fatal')

const missingAlias = classifyOpenApiIssue({
  root,
  basePath: 'data[0]',
  issue: {
    instancePath: '/price_options/0',
    keyword: 'required',
    message: "must have required property 'default'",
    params: { missingProperty: 'default' },
  },
})
assert.equal(missingAlias.severity, 'compatibility')

const badCommercialAmount = classifyOpenApiIssue({
  root,
  basePath: 'data[0]',
  issue: {
    instancePath: '/price_options/0/markup',
    keyword: 'type',
    message: 'must be number',
    params: { type: 'number' },
  },
})
assert.equal(badCommercialAmount.severity, 'blocking')

const missingIdentity = classifyOpenApiIssue({
  root,
  basePath: 'data[0]',
  issue: {
    instancePath: '',
    keyword: 'required',
    message: "must have required property 'offer_reference'",
    params: { missingProperty: 'offer_reference' },
  },
})
assert.equal(missingIdentity.severity, 'blocking')

console.log('public-contract issue policy tests passed')
