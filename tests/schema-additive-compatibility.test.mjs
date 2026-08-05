import assert from 'node:assert/strict'
import { OpsSchemaError } from '../lib/ops/errors.ts'
import { isCompatibleAdditiveResponseSchemaError } from '../lib/ops/schemaCompatibility.ts'

function schemaError(errors) {
  return new OpsSchemaError({
    schema: 'website:WebsiteQuoteResponse',
    stage: 'response',
    endpoint: '/api/v1/website/quote',
    errors,
  })
}

assert.equal(isCompatibleAdditiveResponseSchemaError(schemaError([
  {
    instancePath: '/data/selected_area_price',
    keyword: 'additionalProperties',
    message: 'must NOT have additional properties',
    params: { additionalProperty: 'price_option_reference' },
  },
  {
    instancePath: '/data/selected_area_price',
    keyword: 'type',
    message: 'must be null',
    params: { type: 'null' },
  },
  {
    instancePath: '/data/selected_area_price',
    keyword: 'oneOf',
    message: 'must match exactly one schema in oneOf',
    params: { passingSchemas: null },
  },
])), true)

assert.equal(isCompatibleAdditiveResponseSchemaError(schemaError([
  {
    instancePath: '/data/selected_area_price',
    keyword: 'additionalProperties',
    message: 'must NOT have additional properties',
    params: { additionalProperty: 'price_option_reference' },
  },
  {
    instancePath: '/data/selected_area_price/unit',
    keyword: 'const',
    message: 'must be equal to constant',
    params: { allowedValue: 'ore_per_kwh' },
  },
  {
    instancePath: '/data/selected_area_price',
    keyword: 'oneOf',
    message: 'must match exactly one schema in oneOf',
    params: { passingSchemas: null },
  },
])), false)

assert.equal(isCompatibleAdditiveResponseSchemaError(schemaError([
  {
    instancePath: '/data',
    keyword: 'required',
    message: "must have required property 'area_price_reference'",
    params: { missingProperty: 'area_price_reference' },
  },
])), false)

console.log('schema additive compatibility tests passed')
