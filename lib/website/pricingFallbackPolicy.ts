type OpsFailureLike = {
  status: number
  message: string
  details?: unknown
}

const GENERIC_OPS_FAILURE = /Tjänsten kunde inte slutföra åtgärden just nu|Tjänsten svarade inte i tid|Tjänsten är inte tillgänglig just nu/i

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function isOpsFailureLike(error: unknown): error is OpsFailureLike {
  if (!error || typeof error !== 'object') return false
  const candidate = error as Partial<OpsFailureLike>
  return (
    typeof candidate.status === 'number' &&
    Number.isFinite(candidate.status) &&
    typeof candidate.message === 'string'
  )
}

export function isUnavailableQuoteResponse(error: unknown): boolean {
  if (!isOpsFailureLike(error)) return false

  const details = record(error.details)
  const contentType = typeof details?.content_type === 'string' ? details.content_type : ''
  const code = typeof details?.code === 'string' ? details.code : ''

  return (
    GENERIC_OPS_FAILURE.test(error.message) ||
    details?.redirected === true ||
    /text\/html/i.test(contentType) ||
    code === 'ops_request_timeout'
  )
}

export function canUsePublishedPricingFallback(error: unknown): boolean {
  if (!isOpsFailureLike(error)) return false

  // Authentication and permission failures must never be bypassed.
  if (error.status === 401 || error.status === 403) return false

  // A specific 400/409/422 response is a real business validation. OPS can,
  // however, return its generic transport/server failure with these statuses
  // when the quote route is broken, redirected or returns HTML. In that case
  // the strict published-pricing fallback is safer than treating it as a
  // customer validation error.
  if (error.status === 400 || error.status === 409 || error.status === 422) {
    return isUnavailableQuoteResponse(error)
  }

  return (
    error.status === 404 ||
    error.status === 405 ||
    error.status === 501 ||
    error.status >= 500 ||
    isUnavailableQuoteResponse(error)
  )
}
