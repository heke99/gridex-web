import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import websiteOpenApi from '@/docs/openapi/website-integration-v1.json'
import customerPortalOpenApi from '@/docs/openapi/customer-portal-v1.json'
import { OpsSchemaError } from '@/lib/ops/errors'

type ContractName = 'website' | 'customer-portal'
type Stage = 'request' | 'response'

const websiteAjv = new Ajv({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
  validateFormats: true,
})
const customerPortalAjv = new Ajv({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
  validateFormats: true,
})
addFormats(websiteAjv)
addFormats(customerPortalAjv)
websiteAjv.addSchema(websiteOpenApi, 'gridex-website-openapi')
customerPortalAjv.addSchema(customerPortalOpenApi, 'gridex-customer-portal-openapi')

const cache = new Map<string, ValidateFunction>()

function validator(contract: ContractName, schema: string): ValidateFunction {
  const key = `${contract}:${schema}`
  const cached = cache.get(key)
  if (cached) return cached
  const ajv = contract === 'website' ? websiteAjv : customerPortalAjv
  const root = contract === 'website'
    ? 'gridex-website-openapi'
    : 'gridex-customer-portal-openapi'
  const compiled = ajv.getSchema(`${root}#/components/schemas/${schema}`)
  if (!compiled) {
    throw new Error(`OpenAPI schema is not registered: ${key}`)
  }
  cache.set(key, compiled)
  return compiled
}

function safeErrors(errors: ErrorObject[] | null | undefined) {
  return (errors ?? []).map((error) => ({
    instancePath: error.instancePath,
    keyword: error.keyword,
    message: error.message ?? null,
  }))
}

export function assertOpenApiSchema(
  contract: ContractName,
  schema: string,
  value: unknown,
  input: { stage: Stage; endpoint?: string | null },
): void {
  const validate = validator(contract, schema)
  if (validate(value)) return
  throw new OpsSchemaError({
    schema: `${contract}:${schema}`,
    stage: input.stage,
    endpoint: input.endpoint ?? null,
    errors: safeErrors(validate.errors),
  })
}

export function assertWebsiteRequest(
  schema: string,
  value: unknown,
  endpoint?: string,
): void {
  assertOpenApiSchema('website', schema, value, { stage: 'request', endpoint })
}

export function assertWebsiteResponse(
  schema: string,
  value: unknown,
  endpoint?: string,
): void {
  assertOpenApiSchema('website', schema, value, { stage: 'response', endpoint })
}

export function assertCustomerPortalResponse(
  schema: string,
  value: unknown,
  endpoint?: string,
): void {
  assertOpenApiSchema('customer-portal', schema, value, { stage: 'response', endpoint })
}

