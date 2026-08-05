export type SafeOpsErrorDetails = {
  code?: string | null
  error_code?: string | null
  message?: string | null
  request_id?: string | null
  correlation_id?: string | null
  retryable?: boolean
  endpoint?: string | null
  field?: string | null
  stage?: string | null
  error_stage?: string | null
  action?: string | null
  hint?: string | null
  blockers?: unknown[]
  [key: string]: unknown
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringValue(
  rows: Array<Record<string, unknown> | null>,
  keys: string[],
): string | null {
  for (const row of rows) {
    if (!row) continue
    for (const key of keys) {
      const value = row[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  return null
}

export class OpsError extends Error {
  readonly status: number
  readonly details?: unknown
  readonly code: string | null
  readonly requestId: string | null
  readonly correlationId: string | null
  readonly retryable: boolean
  readonly endpoint: string | null

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'OpsError'
    this.status = status
    this.details = details
    const root = record(details)
    const nested = record(root?.error)
    this.code = stringValue([nested, root], ['code', 'error_code'])
    this.requestId = stringValue([nested, root], ['request_id'])
    this.correlationId = stringValue([nested, root], ['correlation_id'])
    this.endpoint = stringValue([nested, root], ['endpoint', 'path'])
    const retryable = nested?.retryable ?? root?.retryable
    this.retryable = typeof retryable === 'boolean'
      ? retryable
      : status === 429 || status >= 500
  }
}

export class OpsSchemaError extends OpsError {
  constructor(input: {
    schema: string
    stage: 'request' | 'response'
    errors: Array<{
      instancePath: string
      keyword: string
      message: string | null
      params?: Record<string, unknown>
      schemaPath?: string | null
    }>
    endpoint?: string | null
    request_id?: string | null
    correlation_id?: string | null
    contract_schema_version?: string | null
    response_top_level_keys?: string[]
    response_data_keys?: string[]
  }) {
    super(
      input.stage === 'request'
        ? 'Begäran följer inte det canonicala Gridex API-kontraktet.'
        : 'Gridex API-svaret följer inte det godkända kontraktet.',
      input.stage === 'request' ? 400 : 502,
      {
        code: input.stage === 'request'
          ? 'canonical_request_schema_invalid'
          : 'canonical_response_schema_invalid',
        schema: input.schema,
        stage: input.stage,
        endpoint: input.endpoint ?? null,
        errors: input.errors,
        request_id: input.request_id ?? null,
        correlation_id: input.correlation_id ?? null,
        contract_schema_version: input.contract_schema_version ?? null,
        response_top_level_keys: input.response_top_level_keys ?? [],
        response_data_keys: input.response_data_keys ?? [],
        retryable: false,
      },
    )
    this.name = 'OpsSchemaError'
  }
}

export function isOpsError(value: unknown): value is OpsError {
  return value instanceof OpsError
}

