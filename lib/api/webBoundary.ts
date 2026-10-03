import { NextResponse } from 'next/server'

export type WebApiErrorInput = {
  code: string
  message: string
  field?: string | null
  stage?: string | null
  hint?: string | null
  action?: string | null
  retryable?: boolean
  blockers?: unknown[]
  requestId?: string | null
  correlationId?: string | null
  upstreamStatus?: number | null
}

export const PRIVATE_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
} as const

export function privateJsonResponse<T>(body: T, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...PRIVATE_NO_STORE_HEADERS,
      ...Object.fromEntries(new Headers(init.headers)),
    },
  })
}

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
        blockers: input.blockers ?? [],
        request_id: requestId,
        correlation_id: input.correlationId ?? null,
        upstream_status: input.upstreamStatus ?? null,
      },
    },
    {
      status,
      headers: {
        ...PRIVATE_NO_STORE_HEADERS,
        'X-Request-Id': requestId,
        ...Object.fromEntries(new Headers(headers)),
      },
    },
  )
}

/** Shared by JSON and binary browser writes; malformed origins fail closed. */
export function isSameOriginWebRequest(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    const parsed = new URL(origin)
    return parsed.origin === new URL(request.url).origin && !parsed.username &&
      !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash
  } catch {
    return false
  }
}

export async function readWebJson<T>(
  request: Request,
  options: { maxBytes?: number; requireSameOrigin?: boolean } = {},
): Promise<{ ok: true; value: T } | { ok: false; response: NextResponse }> {
  const maxBytes = options.maxBytes ?? 64 * 1024
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.split(';')[0]?.trim() !== 'application/json') {
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
    if (!isSameOriginWebRequest(request)) {
      return {
        ok: false,
        response: webErrorResponse(
          { code: 'cross_site_request_blocked', message: 'Begäran kommer från en otillåten origin.', retryable: false },
          403,
        ),
      }
    }
  }
  try {
    // Bound the stream while reading, including chunked requests without a
    // Content-Length header. Never allocate the whole untrusted request first.
    const reader = request.body?.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    if (reader) {
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          totalBytes += value.byteLength
          if (totalBytes > maxBytes) {
            void reader.cancel().catch(() => {})
            return {
              ok: false,
              response: webErrorResponse(
                { code: 'request_too_large', message: 'Request-body är för stor.', retryable: false },
                413,
              ),
            }
          }
          chunks.push(value)
        }
      } finally {
        reader.releaseLock()
      }
    }
    const bytes = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
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
