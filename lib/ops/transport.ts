import {
  GRIDEX_CANONICAL_OPS_API_URL,
  GRIDEX_WEBSITE_API_CONTRACT_VERSION,
  GRIDEX_WEBSITE_API_VERSION_HEADER,
} from '@/lib/ops/contract'
import { OpsError } from '@/lib/ops/errors'
import {
  getGridexApiBaseUrl,
  getGridexApiKey,
  getGridexConfigurationStatus,
  getGridexRuntimeSetting,
} from '@/lib/ops/config'
import { logContractVersionDrift } from '@/lib/ops/contractCompatibility'

const DEFAULT_TIMEOUT_MS = 12_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 60_000
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504])
const VERSIONED_RESPONSE_PATHS = new Set([
  '/api/v1/website/public-contracts',
  '/api/v1/openapi/website-integration-v1.json',
  '/api/v1/openapi/customer-portal-v1.json',
])

export type OpsHttpResponse = {
  status: number
  headers: Headers
  payload: unknown
  contractVersion: string | null
}

export type OpsRequestOptions = {
  allowNotModified?: boolean
  cache?: RequestCache
  revalidateSeconds?: number
}

export function env(name: string): string | undefined {
  return getGridexRuntimeSetting(name)
}

export function getOpsApiBaseUrl(): string {
  try {
    return getGridexApiBaseUrl()
  } catch (error) {
    throw new OpsError(error instanceof Error ? error.message : 'GRIDEX_OPS_API_URL är ogiltig.', 503, {
      code: 'ops_api_base_url_invalid',
      retryable: false,
    })
  }
}

export function getOpsApiKey(): { value?: string; invalidReason?: string } {
  return getGridexApiKey()
}

export function getOpsTransportStatus(): {
  configured: boolean
  liveSignupEnabled: boolean
  missing: string[]
  deprecatedVariablesInUse: string[]
} {
  const configuration = getGridexConfigurationStatus()
  const apiKey = getOpsApiKey()
  const missing = [
    ...(!apiKey.value ? [apiKey.invalidReason ?? 'GRIDEX_API_KEY'] : []),
    ...(!configuration.apiBaseUrlValid ? ['GRIDEX_OPS_API_URL'] : []),
  ]
  return {
    configured: missing.length === 0,
    liveSignupEnabled: env('GRIDEX_DISABLE_LIVE_SIGNUP') !== 'true',
    missing,
    deprecatedVariablesInUse: configuration.deprecatedVariablesInUse,
  }
}

function timeoutMs(): number {
  const value = Number(env('GRIDEX_OPS_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS)
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.trunc(value)))
}

function timeoutSignal(parent?: AbortSignal | null) {
  const controller = new AbortController()
  const milliseconds = timeoutMs()
  const timer = setTimeout(
    () => controller.abort(new Error(`OPS request timed out after ${milliseconds} ms.`)),
    milliseconds,
  )
  const forward = () => controller.abort(parent?.reason)
  if (parent) {
    if (parent.aborted) forward()
    else parent.addEventListener('abort', forward, { once: true })
  }
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer)
      parent?.removeEventListener('abort', forward)
    },
  }
}

function relativePath(path: string): string {
  const [pathname, query = ''] = path.split('?', 2)
  const relative = pathname.replace(/^\/api\/v1(?=\/|$)/, '') || '/'
  return `${relative}${query ? `?${query}` : ''}`
}

function pathOnly(path: string): string {
  return path.split('?', 1)[0].replace(/\/+$/, '') || '/'
}

function safeErrorDetails(payload: unknown, response: Response, path: string) {
  const root = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {}
  const nested = root.error && typeof root.error === 'object' && !Array.isArray(root.error)
    ? root.error as Record<string, unknown>
    : {}
  return {
    code: typeof nested.code === 'string'
      ? nested.code
      : typeof root.code === 'string'
        ? root.code
        : null,
    message: typeof nested.message === 'string'
      ? nested.message
      : typeof root.message === 'string'
        ? root.message
        : null,
    request_id: response.headers.get('x-request-id') ??
      (typeof nested.request_id === 'string' ? nested.request_id : null) ??
      (typeof root.request_id === 'string' ? root.request_id : null),
    correlation_id: response.headers.get('x-correlation-id') ??
      (typeof nested.correlation_id === 'string' ? nested.correlation_id : null) ??
      (typeof root.correlation_id === 'string' ? root.correlation_id : null),
    field: typeof nested.field === 'string'
      ? nested.field
      : typeof root.field === 'string'
        ? root.field
        : null,
    stage: typeof nested.stage === 'string'
      ? nested.stage
      : typeof root.stage === 'string'
        ? root.stage
        : null,
    action: typeof root.action === 'string' ? root.action : null,
    hint: typeof root.hint === 'string' ? root.hint : null,
    blockers: Array.isArray(root.blockers) ? root.blockers : [],
    retryable: typeof nested.retryable === 'boolean'
      ? nested.retryable
      : typeof root.retryable === 'boolean'
        ? root.retryable
        : response.status === 429 || response.status >= 500,
    endpoint: path,
  }
}

function customerSafeMessage(details: ReturnType<typeof safeErrorDetails>): string {
  const message = details.message?.trim()
  if (
    !message ||
    /<!doctype|<html|stack|trace|postgres|sql|supabase_service|authorization:/i.test(message)
  ) {
    return 'Tjänsten kunde inte slutföra åtgärden just nu.'
  }
  return message
}

async function waitBeforeRetry(response: Response | null, attempt: number) {
  const retryAfter = response?.headers.get('retry-after') ?? ''
  const seconds = /^\d+$/.test(retryAfter) ? Number(retryAfter) : null
  const exponential = 250 * 2 ** Math.max(0, attempt - 1)
  const wait = seconds === null ? exponential : seconds * 1_000
  await new Promise((resolve) => setTimeout(resolve, Math.min(wait + Math.random() * 125, 10_000)))
}

function observeVersionHeader(path: string, response: Response): string | null {
  if (!VERSIONED_RESPONSE_PATHS.has(pathOnly(path)) || response.status === 304) return null
  const received = response.headers.get(GRIDEX_WEBSITE_API_VERSION_HEADER)
  logContractVersionDrift({
    endpoint: path,
    localVersion: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
    receivedVersion: received,
    requestId: response.headers.get('x-request-id'),
    correlationId: response.headers.get('x-correlation-id'),
  })
  return received
}

export async function opsRequest(
  path: string,
  init?: RequestInit,
  options: OpsRequestOptions = {},
): Promise<OpsHttpResponse> {
  const apiKey = getOpsApiKey()
  const baseUrl = getOpsApiBaseUrl()
  if (!apiKey.value) {
    throw new OpsError('Gridex API är inte konfigurerat.', 503, {
      code: 'ops_not_configured',
      reason: apiKey.invalidReason ?? 'GRIDEX_API_KEY',
      retryable: false,
    })
  }

  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  headers.set('Authorization', `Bearer ${apiKey.value}`)
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const requestUrl = `${baseUrl}${relativePath(path)}`
  const method = (init?.method ?? 'GET').toUpperCase()
  const retryableRequest = method === 'GET' || method === 'HEAD'
  const attempts = retryableRequest ? 3 : 1
  let response: Response | null = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const timeout = timeoutSignal(init?.signal)
    try {
      response = await fetch(requestUrl, {
        ...init,
        headers,
        signal: timeout.signal,
        redirect: 'manual',
        cache: options.cache ?? 'no-store',
        ...(options.revalidateSeconds === undefined
          ? {}
          : { next: { revalidate: options.revalidateSeconds } }),
      })
    } catch (error) {
      const abortedByCaller = init?.signal?.aborted === true
      const retryableNetworkError = !abortedByCaller && (error instanceof TypeError || timeout.signal.aborted)
      timeout.cleanup()
      if (retryableNetworkError && attempt < attempts) {
        await waitBeforeRetry(null, attempt)
        continue
      }
      if (abortedByCaller) throw error
      throw new OpsError(
        timeout.signal.aborted ? 'Gridex API svarade inte i tid.' : 'Gridex API kunde inte nås.',
        timeout.signal.aborted ? 504 : 503,
        {
          code: timeout.signal.aborted ? 'ops_request_timeout' : 'ops_network_error',
          endpoint: path,
          retryable: true,
        },
      )
    }
    timeout.cleanup()

    if (response.status >= 300 && response.status < 400) {
      throw new OpsError('Gridex API returnerade en otillåten redirect.', 502, {
        code: 'ops_redirect_blocked',
        endpoint: path,
        status: response.status,
        retryable: false,
      })
    }
    if (retryableRequest && RETRYABLE_STATUSES.has(response.status) && attempt < attempts) {
      await waitBeforeRetry(response, attempt)
      continue
    }
    break
  }

  if (!response) throw new OpsError('Gridex API gav inget svar.', 503)
  if (options.allowNotModified && response.status === 304) {
    return { status: 304, headers: new Headers(response.headers), payload: null, contractVersion: null }
  }

  const contractVersion = observeVersionHeader(path, response)
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('application/json')) {
    throw new OpsError('Gridex API returnerade ett oväntat innehållsformat.', 502, {
      code: 'ops_response_content_type_invalid',
      endpoint: path,
      content_type: contentType || null,
      retryable: false,
    })
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const details = safeErrorDetails(payload, response, path)
    throw new OpsError(customerSafeMessage(details), response.status, details)
  }
  return { status: response.status, headers: new Headers(response.headers), payload, contractVersion }
}

export async function opsFetch(path: string, init?: RequestInit): Promise<unknown> {
  return (await opsRequest(path, init)).payload
}

