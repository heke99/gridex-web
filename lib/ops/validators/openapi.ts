import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import websiteOpenApi from '@/docs/openapi/website-integration-v1.json'
import customerPortalOpenApi from '@/docs/openapi/customer-portal-v1.json'
import { OpsError, OpsSchemaError } from '@/lib/ops/errors'

type ContractName = 'website' | 'customer-portal'
type Stage = 'request' | 'response'
type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'
type JsonRecord = Record<string, unknown>

type OpenApiDocument = {
  paths?: Record<string, Record<string, unknown>>
  components?: {
    schemas?: Record<string, unknown>
    parameters?: Record<string, unknown>
  }
}

const documents: Record<ContractName, OpenApiDocument> = {
  website: websiteOpenApi as OpenApiDocument,
  'customer-portal': customerPortalOpenApi as OpenApiDocument,
}

const roots: Record<ContractName, string> = {
  website: 'gridex-website-openapi',
  'customer-portal': 'gridex-customer-portal-openapi',
}

function createAjv() {
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
    validateFormats: true,
  })
  addFormats(ajv)
  return ajv
}

const websiteAjv = createAjv()
const customerPortalAjv = createAjv()
websiteAjv.addSchema(websiteOpenApi, roots.website)
customerPortalAjv.addSchema(customerPortalOpenApi, roots['customer-portal'])

const ajvs: Record<ContractName, Ajv> = {
  website: websiteAjv,
  'customer-portal': customerPortalAjv,
}

const cache = new Map<string, ValidateFunction>()

function safeErrors(errors: ErrorObject[] | null | undefined) {
  return (errors ?? []).map((error) => ({
    instancePath: error.instancePath,
    keyword: error.keyword,
    message: error.message ?? null,
  }))
}

function namedValidator(contract: ContractName, schema: string): ValidateFunction {
  const key = `${contract}:schema:${schema}`
  const cached = cache.get(key)
  if (cached) return cached
  const compiled = ajvs[contract].getSchema(`${roots[contract]}#/components/schemas/${schema}`)
  if (!compiled) throw new Error(`OpenAPI schema is not registered: ${key}`)
  cache.set(key, compiled)
  return compiled
}

function normalizedPath(path: string): string {
  const raw = path.split('?', 1)[0].replace(/\/+$/, '') || '/'
  return raw.startsWith('/api/v1/') || raw === '/api/v1'
    ? raw
    : `/api/v1${raw.startsWith('/') ? raw : `/${raw}`}`
}

function matchOperationPath(contract: ContractName, path: string): string | null {
  const requested = normalizedPath(path)
  const paths = documents[contract].paths ?? {}
  if (Object.hasOwn(paths, requested)) return requested
  const requestedParts = requested.split('/').filter(Boolean)
  for (const candidate of Object.keys(paths)) {
    const candidateParts = candidate.split('/').filter(Boolean)
    if (candidateParts.length !== requestedParts.length) continue
    const matches = candidateParts.every((part, index) => (
      /^\{[^}]+\}$/.test(part) || part === requestedParts[index]
    ))
    if (matches) return candidate
  }
  return null
}

function operation(contract: ContractName, path: string, method: string): JsonRecord | null {
  const operationPath = matchOperationPath(contract, path)
  if (!operationPath) return null
  const item = documents[contract].paths?.[operationPath]
  const value = item?.[method.toLowerCase()]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function resolveParameter(contract: ContractName, value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as JsonRecord
  if (typeof row.$ref !== 'string') return row
  const match = row.$ref.match(/^#\/components\/parameters\/([^/]+)$/)
  if (!match) return null
  const resolved = documents[contract].components?.parameters?.[match[1]]
  return resolved && typeof resolved === 'object' && !Array.isArray(resolved)
    ? resolved as JsonRecord
    : null
}

function operationParameters(contract: ContractName, path: string, method: string): JsonRecord[] {
  const operationPath = matchOperationPath(contract, path)
  if (!operationPath) return []
  const item = documents[contract].paths?.[operationPath]
  const operationValue = operation(contract, path, method)
  const values = [
    ...(Array.isArray(item?.parameters) ? item.parameters : []),
    ...(Array.isArray(operationValue?.parameters) ? operationValue.parameters : []),
  ]
  return values
    .map((value) => resolveParameter(contract, value))
    .filter((value): value is JsonRecord => value !== null)
}

function queryValue(rawValues: string[], schema: JsonRecord): unknown {
  const convert = (raw: string): unknown => {
    if (schema.type === 'integer') {
      if (!/^-?\d+$/.test(raw)) return raw
      return Number(raw)
    }
    if (schema.type === 'number') {
      const value = Number(raw)
      return Number.isFinite(value) ? value : raw
    }
    if (schema.type === 'boolean') {
      if (raw === 'true') return true
      if (raw === 'false') return false
    }
    return raw
  }
  if (schema.type === 'array') {
    const itemSchema = schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)
      ? schema.items as JsonRecord
      : {}
    return rawValues.flatMap((raw) => raw.split(',')).map((raw) => queryValue([raw], itemSchema))
  }
  return convert(rawValues[rawValues.length - 1] ?? '')
}

function assertParameterSchema(args: {
  contract: ContractName
  path: string
  method: string
  location: 'query' | 'header' | 'path'
  name: string
  schema: JsonRecord
  value: unknown
}): void {
  const validate = ajvs[args.contract].compile(qualifyRefs(args.schema, roots[args.contract]))
  if (validate(args.value)) return
  throw new OpsSchemaError({
    schema: `${args.contract}:${args.method.toUpperCase()} ${normalizedPath(args.path)} ${args.location}.${args.name}`,
    stage: 'request',
    endpoint: normalizedPath(args.path),
    errors: safeErrors(validate.errors),
  })
}

function assertOperationHeaders(
  contract: ContractName,
  path: string,
  method: string,
  headers?: Headers,
): void {
  const parameters = operationParameters(contract, path, method)
    .filter((parameter) => parameter.in === 'header' && typeof parameter.name === 'string')
  if (parameters.length === 0) return
  const requestHeaders = headers ?? new Headers()
  for (const parameter of parameters) {
    const name = parameter.name as string
    const raw = requestHeaders.get(name)
    if (parameter.required === true && (!raw || !raw.trim())) {
      throw new OpsError('API-begäran saknar en obligatorisk header.', 400, {
        code: 'openapi_header_required',
        contract,
        endpoint: normalizedPath(path),
        method: method.toUpperCase(),
        field: name,
        retryable: false,
      })
    }
    if (raw === null) continue
    const schema = parameter.schema && typeof parameter.schema === 'object' && !Array.isArray(parameter.schema)
      ? parameter.schema as JsonRecord
      : null
    if (schema) {
      assertParameterSchema({ contract, path, method, location: 'header', name, schema, value: raw })
    }
  }
}

function assertOperationPathParameters(contract: ContractName, path: string, method: string): void {
  const template = matchOperationPath(contract, path)
  if (!template) return
  const actualParts = normalizedPath(path).split('/').filter(Boolean)
  const templateParts = template.split('/').filter(Boolean)
  const parameters = operationParameters(contract, path, method)
    .filter((parameter) => parameter.in === 'path' && typeof parameter.name === 'string')
  for (const parameter of parameters) {
    const name = parameter.name as string
    const index = templateParts.findIndex((part) => part === `{${name}}`)
    const raw = index >= 0 ? actualParts[index] : undefined
    if (parameter.required === true && (!raw || !raw.trim())) {
      throw new OpsError('API-begäran saknar en obligatorisk path-parameter.', 400, {
        code: 'openapi_path_parameter_required',
        contract,
        endpoint: normalizedPath(path),
        method: method.toUpperCase(),
        field: name,
        retryable: false,
      })
    }
    if (!raw) continue
    let decoded: string
    try {
      decoded = decodeURIComponent(raw)
    } catch {
      throw new OpsError('API-begäran innehåller en ogiltigt kodad path-parameter.', 400, {
        code: 'openapi_path_parameter_invalid_encoding',
        contract,
        endpoint: normalizedPath(path),
        method: method.toUpperCase(),
        field: name,
        retryable: false,
      })
    }
    const schema = parameter.schema && typeof parameter.schema === 'object' && !Array.isArray(parameter.schema)
      ? parameter.schema as JsonRecord
      : null
    if (schema) {
      assertParameterSchema({ contract, path, method, location: 'path', name, schema, value: decoded })
    }
  }
}

function assertOperationQuery(contract: ContractName, path: string, method: string): void {
  const queryParameters = operationParameters(contract, path, method)
    .filter((parameter) => parameter.in === 'query' && typeof parameter.name === 'string')
  const rawPath = path.startsWith('/api/v1/') || path.startsWith('/api/v1?') || path === '/api/v1'
    ? path
    : `/api/v1${path.startsWith('/') ? path : `/${path}`}`
  const parsed = new URL(rawPath, 'https://gridex.invalid')
  if (queryParameters.length === 0) {
    if ([...parsed.searchParams.keys()].length > 0) {
      throw new OpsError('API-begäran innehåller odokumenterade query-parametrar.', 400, {
        code: 'openapi_query_parameter_unknown',
        contract,
        endpoint: parsed.pathname,
        method: method.toUpperCase(),
        parameters: [...new Set(parsed.searchParams.keys())],
        retryable: false,
      })
    }
    return
  }
  const allowed = new Set(queryParameters.map((parameter) => parameter.name as string))
  const unknown = [...new Set(parsed.searchParams.keys())].filter((name) => !allowed.has(name))
  if (unknown.length > 0) {
    throw new OpsError('API-begäran innehåller odokumenterade query-parametrar.', 400, {
      code: 'openapi_query_parameter_unknown',
      contract,
      endpoint: parsed.pathname,
      method: method.toUpperCase(),
      parameters: unknown,
      retryable: false,
    })
  }
  for (const parameter of queryParameters) {
    const name = parameter.name as string
    const rawValues = parsed.searchParams.getAll(name)
    if (parameter.required === true && rawValues.length === 0) {
      throw new OpsError('API-begäran saknar en obligatorisk query-parameter.', 400, {
        code: 'openapi_query_parameter_required',
        contract,
        endpoint: parsed.pathname,
        method: method.toUpperCase(),
        field: name,
        retryable: false,
      })
    }
    if (rawValues.length === 0) continue
    const schema = parameter.schema && typeof parameter.schema === 'object' && !Array.isArray(parameter.schema)
      ? parameter.schema as JsonRecord
      : null
    if (!schema) continue
    const value = queryValue(rawValues, schema)
    assertParameterSchema({ contract, path, method, location: 'query', name, schema, value })
  }
}

type AjvCompileSchema = Parameters<Ajv['compile']>[0]

function qualifyRefValues(value: unknown, root: string): unknown {
  if (Array.isArray(value)) return value.map((item) => qualifyRefValues(item, root))
  if (!value || typeof value !== 'object') return value
  const row = value as JsonRecord
  const qualified: JsonRecord = {}
  for (const [key, item] of Object.entries(row)) {
    if (key === '$ref' && typeof item === 'string' && item.startsWith('#/')) {
      qualified[key] = `${root}${item}`
    } else {
      qualified[key] = qualifyRefValues(item, root)
    }
  }
  return qualified
}

function qualifyRefs(value: unknown, root: string): AjvCompileSchema {
  const qualified = qualifyRefValues(value, root)
  if (typeof qualified === 'boolean') return qualified
  if (!qualified || typeof qualified !== 'object' || Array.isArray(qualified)) {
    throw new Error('OpenAPI schema must be an object or boolean before AJV compilation.')
  }
  return qualified as AjvCompileSchema
}

function requestBodySchema(operationValue: JsonRecord): unknown | null {
  const requestBody = operationValue.requestBody
  if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) return null
  const content = (requestBody as JsonRecord).content
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null
  const media = (content as JsonRecord)['application/json']
  if (!media || typeof media !== 'object' || Array.isArray(media)) return null
  return (media as JsonRecord).schema ?? null
}

function responseSchema(operationValue: JsonRecord, status: number): unknown | null {
  const responses = operationValue.responses
  if (!responses || typeof responses !== 'object' || Array.isArray(responses)) return null
  const response = (responses as JsonRecord)[String(status)] ?? (responses as JsonRecord).default
  if (!response || typeof response !== 'object' || Array.isArray(response)) return null
  const content = (response as JsonRecord).content
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null
  const media = (content as JsonRecord)['application/json']
  if (!media || typeof media !== 'object' || Array.isArray(media)) return null
  return (media as JsonRecord).schema ?? null
}

function operationValidator(
  contract: ContractName,
  path: string,
  method: string,
  stage: Stage,
  status?: number,
): ValidateFunction | null {
  const operationValue = operation(contract, path, method)
  if (!operationValue) return null
  const schema = stage === 'request'
    ? requestBodySchema(operationValue)
    : responseSchema(operationValue, status ?? 200)
  if (!schema) return null
  const matchedPath = matchOperationPath(contract, path) ?? normalizedPath(path)
  const key = `${contract}:operation:${method.toLowerCase()}:${matchedPath}:${stage}:${status ?? ''}`
  const cached = cache.get(key)
  if (cached) return cached
  const compiled = ajvs[contract].compile(qualifyRefs(schema, roots[contract]))
  cache.set(key, compiled)
  return compiled
}

function assertWithValidator(
  validate: ValidateFunction,
  contract: ContractName,
  schema: string,
  value: unknown,
  input: { stage: Stage; endpoint?: string | null },
): void {
  if (validate(value)) return
  throw new OpsSchemaError({
    schema: `${contract}:${schema}`,
    stage: input.stage,
    endpoint: input.endpoint ?? null,
    errors: safeErrors(validate.errors),
  })
}


export type OpenApiValidationIssue = {
  instancePath: string
  keyword: string
  message: string | null
}

export function validateOpenApiSchema(
  contract: ContractName,
  schema: string,
  value: unknown,
): { valid: boolean; errors: OpenApiValidationIssue[] } {
  const validate = namedValidator(contract, schema)
  const valid = Boolean(validate(value))
  return { valid, errors: valid ? [] : safeErrors(validate.errors) }
}

export function assertOpenApiSchema(
  contract: ContractName,
  schema: string,
  value: unknown,
  input: { stage: Stage; endpoint?: string | null },
): void {
  assertWithValidator(namedValidator(contract, schema), contract, schema, value, input)
}

function assertOperation(
  contract: ContractName,
  path: string,
  method: string,
  stage: Stage,
  value: unknown,
  status?: number,
  headers?: Headers,
): void {
  const operationValue = operation(contract, path, method)
  if (!operationValue) {
    throw new OpsError('API-operationen saknas i det valda OpenAPI-kontraktet.', 500, {
      code: 'openapi_operation_missing',
      contract,
      endpoint: normalizedPath(path),
      method: method.toUpperCase(),
      stage,
      retryable: false,
    })
  }
  if (stage === 'request') {
    assertOperationQuery(contract, path, method)
    assertOperationPathParameters(contract, path, method)
    assertOperationHeaders(contract, path, method, headers)
  }
  const validate = operationValidator(contract, path, method, stage, status)
  if (!validate) {
    if (stage === 'request' && value === undefined) return
    if (stage === 'response' && (status === 204 || status === 304)) return
    throw new OpsError('OpenAPI-operationen saknar ett maskinläsbart JSON-schema.', 502, {
      code: 'openapi_operation_schema_missing',
      contract,
      endpoint: normalizedPath(path),
      method: method.toUpperCase(),
      stage,
      status: status ?? null,
      retryable: false,
    })
  }
  const matchedPath = matchOperationPath(contract, path) ?? normalizedPath(path)
  assertWithValidator(
    validate,
    contract,
    `${method.toUpperCase()} ${matchedPath} ${stage}${status ? ` ${status}` : ''}`,
    value,
    { stage, endpoint: normalizedPath(path) },
  )
}

export function hasWebsiteOperation(path: string, method: string): boolean {
  return operation('website', path, method) !== null
}

export function hasCustomerPortalOperation(path: string, method: string): boolean {
  return operation('customer-portal', path, method) !== null
}

export function websiteSchemaHasProperty(schema: string, property: string): boolean {
  const value = documents.website.components?.schemas?.[schema]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const properties = (value as JsonRecord).properties
  return Boolean(properties && typeof properties === 'object' && Object.hasOwn(properties, property))
}

function schemaIsClosedObject(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false
  const row = schema as JsonRecord
  return row.type === 'object' && row.additionalProperties === false
}

function schemaIsExplicitlyPermissiveObject(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false
  const row = schema as JsonRecord
  if (row.type !== 'object') return false
  return row.additionalProperties === true || (
    row.additionalProperties !== false &&
    (!row.properties || typeof row.properties !== 'object' || Object.keys(row.properties as JsonRecord).length === 0)
  )
}

function operationHasPermissiveJsonSchema(
  contract: ContractName,
  path: string,
  method: HttpMethod,
  stage: Stage,
  status = 200,
): boolean {
  const value = operation(contract, path, method)
  if (!value) return true
  const schema = stage === 'request' ? requestBodySchema(value) : responseSchema(value, status)
  return schemaIsExplicitlyPermissiveObject(schema)
}

export function gridexOpenApiContractGaps(): string[] {
  const gaps: string[] = []
  if (
    !websiteSchemaHasProperty('CustomerApplicationRequest', 'customer_portal_user_id') ||
    !websiteSchemaHasProperty('CustomerApplicationRequest', 'auth_user_id')
  ) gaps.push('customer_application_portal_identity_missing')

  const legalAcceptances = documents.website.components?.schemas?.LegalAcceptances
  if (schemaIsClosedObject(legalAcceptances)) gaps.push('legal_acceptances_not_dynamic')

  const publicContract = documents.website.components?.schemas?.PublicContract as JsonRecord | undefined
  const publicContractProperties = publicContract?.properties as JsonRecord | undefined
  const pricing = publicContractProperties?.pricing as JsonRecord | undefined
  const pricingProperties = pricing?.properties as JsonRecord | undefined
  if (!publicContractProperties?.price_options && !pricingProperties?.price_options) {
    gaps.push('public_contract_price_options_not_published')
  }

  const portfolio = operation('website', '/api/v1/website/portfolio-prices', 'get')
  if (!portfolio || !schemaIsClosedObject(responseSchema(portfolio, 200))) {
    gaps.push('portfolio_response_schema_not_strict')
  }
  if (operationHasPermissiveJsonSchema('website', '/api/v1/website/quote/validate', 'post', 'response')) {
    gaps.push('website_quote_validation_response_not_strict')
  }
  if (
    operationHasPermissiveJsonSchema('website', '/api/v1/website/customer-events', 'post', 'request') ||
    operationHasPermissiveJsonSchema('website', '/api/v1/website/customer-events', 'post', 'response')
  ) {
    gaps.push('website_customer_events_schema_not_strict')
  }

  const portalSync = operation('customer-portal', '/api/v1/customer-portal/sync', 'post')
  const syncRequest = portalSync ? requestBodySchema(portalSync) : null
  const syncResponse = portalSync ? responseSchema(portalSync, 200) : null
  if (!schemaIsClosedObject(syncRequest)) gaps.push('customer_portal_sync_request_not_strict')
  if (JSON.stringify(syncResponse).includes('CustomerInvoice')) {
    gaps.push('customer_portal_sync_response_is_invoice_list')
  }
  const portalHeaderNames = new Set(
    Object.values(documents['customer-portal'].paths ?? {})
      .flatMap((item) => Object.values(item ?? {}))
      .flatMap((value) => value && typeof value === 'object' && Array.isArray((value as JsonRecord).parameters)
        ? (value as JsonRecord).parameters as unknown[]
        : [])
      .filter((value): value is JsonRecord => Boolean(value && typeof value === 'object' && !Array.isArray(value)))
      .filter((parameter) => parameter.in === 'header' && typeof parameter.name === 'string')
      .map((parameter) => String(parameter.name).toLowerCase()),
  )
  if (!portalHeaderNames.has('x-gridex-customer-portal-user-id') || !portalHeaderNames.has('x-gridex-auth-user-id')) {
    gaps.push('customer_portal_identity_headers_missing')
  }

  const portalResourceOperations: Array<[string, HttpMethod, Stage]> = [
    ['/api/v1/customer/portal-bundle', 'get', 'response'],
    ['/api/v1/customer/portal-bundle', 'post', 'request'],
    ['/api/v1/customer/portal-bundle', 'post', 'response'],
    ['/api/v1/customer/me', 'get', 'response'],
    ['/api/v1/customer/contracts', 'get', 'response'],
    ['/api/v1/customer/sites', 'get', 'response'],
    ['/api/v1/customer/invoices', 'get', 'response'],
    ['/api/v1/customer/invoices/{id}', 'get', 'response'],
    ['/api/v1/customer/metering-values', 'get', 'response'],
    ['/api/v1/customer/events', 'get', 'response'],
    ['/api/v1/customer/documents', 'get', 'response'],
    ['/api/v1/customer/legal-acceptances', 'get', 'response'],
    ['/api/v1/customer/powers-of-attorney', 'get', 'response'],
    ['/api/v1/customer/notifications', 'get', 'response'],
    ['/api/v1/customer/notifications/read', 'post', 'request'],
    ['/api/v1/customer/notifications/read', 'post', 'response'],
    ['/api/v1/customer/profile-update', 'post', 'request'],
    ['/api/v1/customer/profile-update', 'post', 'response'],
    ['/api/v1/customer/move-out', 'post', 'request'],
    ['/api/v1/customer/move-out', 'post', 'response'],
    ['/api/v1/customer/sync', 'post', 'request'],
    ['/api/v1/customer/sync', 'post', 'response'],
    ['/api/v1/events', 'get', 'response'],
    ['/api/v1/events', 'post', 'request'],
    ['/api/v1/events', 'post', 'response'],
  ]
  if (portalResourceOperations.some(([path, method, stage]) => (
    operationHasPermissiveJsonSchema('customer-portal', path, method, stage)
  ))) {
    gaps.push('customer_portal_resource_schemas_not_strict')
  }
  if (
    !schemaIsClosedObject(
      documents.website.components?.schemas?.OpsDomainWebhookEnvelope,
    )
  ) {
    gaps.push('ops_domain_webhook_schema_not_published')
  }
  return [...new Set(gaps)]
}

export function assertWebsiteRequest(schema: string, value: unknown, endpoint?: string): void {
  assertOpenApiSchema('website', schema, value, { stage: 'request', endpoint })
}

export function assertWebsiteResponse(schema: string, value: unknown, endpoint?: string): void {
  assertOpenApiSchema('website', schema, value, { stage: 'response', endpoint })
}

export function assertCustomerPortalRequest(schema: string, value: unknown, endpoint?: string): void {
  assertOpenApiSchema('customer-portal', schema, value, { stage: 'request', endpoint })
}

export function assertCustomerPortalResponse(schema: string, value: unknown, endpoint?: string): void {
  assertOpenApiSchema('customer-portal', schema, value, { stage: 'response', endpoint })
}

export function assertWebsiteOperationRequest(
  path: string,
  method: HttpMethod,
  value: unknown,
  headers?: Headers,
): void {
  assertOperation('website', path, method, 'request', value, undefined, headers)
}

export function assertWebsiteOperationResponse(
  path: string,
  method: HttpMethod,
  status: number,
  value: unknown,
): void {
  assertOperation('website', path, method, 'response', value, status)
}

export function assertCustomerPortalOperationRequest(
  path: string,
  method: HttpMethod,
  value: unknown,
  headers?: Headers,
): void {
  assertOperation('customer-portal', path, method, 'request', value, undefined, headers)
}

export function assertCustomerPortalOperationResponse(
  path: string,
  method: HttpMethod,
  status: number,
  value: unknown,
): void {
  assertOperation('customer-portal', path, method, 'response', value, status)
}
