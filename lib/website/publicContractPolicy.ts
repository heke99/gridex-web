export const CONTRACT_PARSER_VERSION = '2026-08-01.1' as const

export type ContractIssueSeverity =
  | 'fatal'
  | 'blocking'
  | 'warning'
  | 'compatibility'

export type ContractIssueSource = 'structural' | 'semantic' | 'normalization' | 'website_readiness'

export type ContractValidationIssue = {
  code: string
  path: string
  severity: ContractIssueSeverity
  source: ContractIssueSource
  keyword?: string | null
  message?: string | null
  detail?: string | null
}

type PriceOptionKind = {
  price_type?: unknown
  contract_type?: unknown
}

function normalizedType(value: unknown): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : null
}

/**
 * Only pricing models with a published, directly selectable SE-area price need
 * area_prices. Variable, spot, portfolio and production pricing is resolved by
 * the OPS quote flow and therefore legitimately publishes an empty array.
 */
export function requiresPublishedAreaPrices(option: PriceOptionKind): boolean {
  const priceType = normalizedType(option.price_type)
  const contractType = normalizedType(option.contract_type)
  return priceType === 'fixed' || contractType === 'fixed'
}

export function isBlockingContractIssue(issue: Pick<ContractValidationIssue, 'severity'>): boolean {
  return issue.severity === 'fatal' || issue.severity === 'blocking'
}

export function contractIssue(input: {
  code: string
  path: string
  severity?: ContractIssueSeverity
  source?: ContractIssueSource
  keyword?: string | null
  message?: string | null
  detail?: string | null
}): ContractValidationIssue {
  return {
    code: input.code,
    path: input.path,
    severity: input.severity ?? 'blocking',
    source: input.source ?? 'semantic',
    keyword: input.keyword ?? null,
    message: input.message ?? null,
    detail: input.detail ?? null,
  }
}

type OpenApiIssue = {
  instancePath: string
  keyword: string
  message: string | null
  params?: Record<string, unknown>
}

function decodeJsonPointerToken(token: string): string {
  return token.replaceAll('~1', '/').replaceAll('~0', '~')
}

function valueAtPointer(root: unknown, pointer: string): unknown {
  if (!pointer) return root
  let current: unknown = root
  for (const token of pointer.split('/').slice(1).map(decodeJsonPointerToken)) {
    if (Array.isArray(current)) {
      const index = Number(token)
      if (!Number.isInteger(index)) return undefined
      current = current[index]
      continue
    }
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[token]
  }
  return current
}

function dotPath(basePath: string, pointer: string, property?: string | null): string {
  const tokens = pointer
    .split('/')
    .slice(1)
    .map(decodeJsonPointerToken)
  if (property) tokens.push(property)
  return tokens.reduce(
    (result, token) => (/^\d+$/.test(token) ? `${result}[${token}]` : `${result}.${token}`),
    basePath,
  )
}

const forbiddenAdditionalProperties = new Set([
  'company_id',
  'tenant_id',
  'price_plan_id',
  'price_plan_version_id',
  'legal_bundle_id',
])

function criticalContractPath(path: string): boolean {
  return (
    /\.(offer_reference|name|contract_type|energy_direction|customer_type|channel|price_options|pricing|legal)(\.|\[|$)/.test(path) ||
    /\.price_options\[\d+\]\.(price_option_reference|contract_type|price_type|customer_type|resolution|currency|unit|fixed_price|markup|monthly_fee|selection_required|area_prices|is_default|default)(\.|\[|$)/.test(path) ||
    /\.price_options\[\d+\]\.area_prices\[\d+\]\.(area_price_reference|price_area|energy_price_ore_per_kwh|unit|valid_from|valid_to)(\.|\[|$)/.test(path) ||
    /\.legal\.(legal_bundle_reference|legal_bundle_version_id|immutable|module_versions)(\.|\[|$)/.test(path) ||
    /\.legal\.module_versions\[\d+\]\.(id|legal_bundle_version_id|document_reference|module_key|version|title)(\.|\[|$)/.test(path)
  )
}

function compatibilityAliasSatisfied(root: unknown, issue: OpenApiIssue): boolean {
  if (issue.keyword !== 'required') return false
  const missingProperty = typeof issue.params?.missingProperty === 'string'
    ? issue.params.missingProperty
    : null
  // `is_default` is canonical and may never be reconstructed from the
  // deprecated alias. Only a missing legacy `default` field is compatible.
  if (missingProperty !== 'default') return false
  const object = valueAtPointer(root, issue.instancePath)
  if (!object || typeof object !== 'object' || Array.isArray(object)) return false
  const row = object as Record<string, unknown>
  return typeof row.is_default === 'boolean'
}

export function classifyOpenApiIssue(input: {
  issue: OpenApiIssue
  root: unknown
  basePath: string
}): ContractValidationIssue {
  const { issue } = input
  const missingProperty = typeof issue.params?.missingProperty === 'string'
    ? issue.params.missingProperty
    : null
  const additionalProperty = typeof issue.params?.additionalProperty === 'string'
    ? issue.params.additionalProperty
    : null
  const property = missingProperty ?? additionalProperty
  const path = dotPath(input.basePath, issue.instancePath, property)

  if (issue.keyword === 'additionalProperties') {
    const forbidden = additionalProperty !== null && forbiddenAdditionalProperties.has(additionalProperty)
    return contractIssue({
      code: forbidden ? 'openapi_forbidden_internal_property' : 'openapi_additionalProperties',
      path,
      severity: forbidden ? 'fatal' : 'compatibility',
      source: 'structural',
      keyword: issue.keyword,
      message: issue.message,
      detail: additionalProperty,
    })
  }

  if (compatibilityAliasSatisfied(input.root, issue)) {
    return contractIssue({
      code: 'openapi_required_compatibility_alias',
      path,
      severity: 'compatibility',
      source: 'structural',
      keyword: issue.keyword,
      message: issue.message,
      detail: missingProperty,
    })
  }

  if (issue.keyword === 'required') {
    return contractIssue({
      code: 'openapi_required',
      path,
      severity: criticalContractPath(path) ? 'blocking' : 'warning',
      source: 'structural',
      keyword: issue.keyword,
      message: issue.message,
      detail: missingProperty,
    })
  }

  if (
    issue.keyword === 'type' ||
    issue.keyword === 'enum' ||
    issue.keyword === 'const' ||
    issue.keyword === 'format' ||
    issue.keyword === 'minItems'
  ) {
    return contractIssue({
      code: `openapi_${issue.keyword}`,
      path,
      severity: criticalContractPath(path) ? 'blocking' : 'warning',
      source: 'structural',
      keyword: issue.keyword,
      message: issue.message,
    })
  }

  return contractIssue({
    code: `openapi_${issue.keyword}`,
    path,
    severity: 'warning',
    source: 'structural',
    keyword: issue.keyword,
    message: issue.message,
  })
}
