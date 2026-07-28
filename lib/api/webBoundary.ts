import { NextResponse } from 'next/server'

export type WebApiErrorInput = {
  code: string
  message: string
  field?: string | null
  stage?: string | null
  hint?: string | null
  action?: string | null
  retryable?: boolean
  requestId?: string | null
  correlationId?: string | null
  upstreamStatus?: number | null
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
} as const

export function webErrorResponse(input: WebApiErrorInput, status: number, headers?: HeadersInit) {
  const requestId = input.requestId || crypto.randomUUID()
  return NextResponse.json(
    {
      error: {
        code: input.code,
        message: input.message,
        field: input.field ?? null,
        stage: input.stage ?? null,
        hint: input.hint ?? null,
        action: input.action ?? null,
        retryable: input.retryable ?? (status === 429 || status >= 500),
        request_id: requestId,
        correlation_id: input.correlationId ?? null,
        upstream_status: input.upstreamStatus ?? null,
      },
    },
    {
      status,
      headers: {
        ...NO_STORE_HEADERS,
        'X-Request-Id': requestId,
        ...Object.fromEntries(new Headers(headers)),
      },
    },
  )
}

export async function readWebJson<T>(
  request: Request,
  options: { maxBytes?: number; requireSameOrigin?: boolean } = {},
): Promise<{ ok: true; value: T } | { ok: false; response: NextResponse }> {
  const maxBytes = options.maxBytes ?? 64 * 1024
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.startsWith('application/json')) {
    return {
      ok: false,
      response: webErrorResponse(
        { code: 'unsupported_media_type', message: 'Content-Type måste vara application/json.', retryable: false },
        415,
      ),
    }
  }
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return {
      ok: false,
      response: webErrorResponse(
        { code: 'request_too_large', message: 'Request-body är för stor.', retryable: false },
        413,
      ),
    }
  }
  if (options.requireSameOrigin !== false) {
    const origin = request.headers.get('origin')
    const fetchSite = request.headers.get('sec-fetch-site')
    if (
      (origin && new URL(origin).origin !== new URL(request.url).origin) ||
      fetchSite === 'cross-site'
    ) {
      return {
        ok: false,
        response: webErrorResponse(
          { code: 'cross_site_request_blocked', message: 'Begäran kommer från en otillåten origin.', retryable: false },
          403,
        ),
      }
    }
  }
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    return {
      ok: false,
      response: webErrorResponse(
        { code: 'request_too_large', message: 'Request-body är för stor.', retryable: false },
        413,
      ),
    }
  }
  try {
    return { ok: true, value: JSON.parse(raw) as T }
  } catch {
    return {
      ok: false,
      response: webErrorResponse(
        { code: 'invalid_json', message: 'Request-body innehåller ogiltig JSON.', retryable: false },
        400,
      ),
    }
  }
}
