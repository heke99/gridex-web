import { isOpsError } from '@/lib/ops/client'
import { CustomerPortalAccessError } from '@/lib/customerPortal/service'
import { webErrorResponse } from '@/lib/api/webBoundary'

type ErrorDetails = {
  code: string | null
  stage: string | null
  field: string | null
  hint: string | null
  action: string | null
  requestId: string | null
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(row: Record<string, unknown> | null, keys: string[]): string | null {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

export function opsErrorDetails(error: unknown): ErrorDetails {
  if (!isOpsError(error)) {
    return { code: null, stage: null, field: null, hint: null, action: null, requestId: null }
  }
  const root = record(error.details)
  const nested = record(root?.error)
  const details = record(root?.details)
  return {
    code: text(root, ['code', 'error_code']) ?? text(nested, ['code', 'error_code']),
    stage: text(root, ['stage', 'error_stage']) ?? text(nested, ['stage', 'error_stage']),
    field: text(root, ['field']) ?? text(nested, ['field']),
    hint: text(root, ['hint']) ?? text(nested, ['hint']),
    action: text(root, ['action']) ?? text(nested, ['action']) ?? text(details, ['action']),
    requestId:
      text(root, ['request_id', 'requestId']) ?? text(nested, ['request_id', 'requestId']),
  }
}

export function customerApiErrorResponse(
  error: unknown,
  options: { logLabel: string; fallbackMessage: string },
) {
  if (error instanceof CustomerPortalAccessError) {
    return webErrorResponse(
      { code: error.code, message: error.message, retryable: false },
      error.status,
    )
  }

  if (
    error instanceof Error &&
    'status' in error &&
    'code' in error &&
    typeof (error as { status?: unknown }).status === 'number' &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    const status = (error as { status: number }).status
    const code = (error as { code: string }).code
    return webErrorResponse(
      { code, message: error.message || options.fallbackMessage, retryable: false },
      status,
    )
  }

  if (isOpsError(error)) {
    const details = opsErrorDetails(error)
    console.error(`[customer portal] ${options.logLabel} OPS error`, {
      status: error.status,
      message: error.message,
      ...details,
    })
    return webErrorResponse(
      {
        code: details.code ?? 'ops_request_failed',
        message: error.message || options.fallbackMessage,
        stage: details.stage,
        field: details.field,
        hint: details.hint,
        action: details.action,
        requestId: details.requestId,
        correlationId: error.correlationId,
        upstreamStatus: error.status,
        retryable: error.retryable,
      },
      error.status || 502,
    )
  }

  console.error(`[customer portal] ${options.logLabel} failed`, error)
  return webErrorResponse(
    { code: 'customer_portal_unavailable', message: options.fallbackMessage, retryable: true },
    503,
  )
}

export function validationError(message: string, field?: string) {
  return webErrorResponse(
    { code: 'validation_error', message, field: field ?? null, retryable: false },
    400,
  )
}
