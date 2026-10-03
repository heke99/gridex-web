import { createHash } from 'node:crypto'
import { OpsError } from '@/lib/ops/errors'
import { safeErrorDetails } from '@/lib/ops/transport'
import { STAFF_CONTRACT_VERSION, staffApiConfig } from './config'
import { readStaffBody } from './boundary'
import { assertStaffProtocolReady, assertStaffRequest, assertStaffResponse } from './contract'

export type StaffEnvelope<T = unknown> = {
  data: T
  page?: { limit: number; returned: number; has_more: boolean; next_cursor: string | null }
  request_id: string
  correlation_id: string | null
  contract_schema_version: string
}

const AUTH_PATHS = new Set([
  '/staff/sessions', '/staff/sessions/refresh', '/staff/sessions/logout',
  '/staff/sessions/password', '/staff/sessions/recovery', '/staff/sessions/recovery/verify',
  '/staff/sessions/mfa/challenge', '/staff/sessions/mfa/verify',
])
const REFERENCE = '[A-Za-z0-9_-]{1,160}'
const CUSTOMER_PATH = new RegExp(`^/staff/customers(?:/${REFERENCE}(?:/(?:contacts|addresses|facilities))?)?$`)
const CASE_PATH = new RegExp(`^/staff/support/cases(?:/${REFERENCE}(?:/(?:entries|replies|internal-notes|status|assignment|attachments)(?:/${REFERENCE})?)?)?$`)

function assertInternalPath(path: string, method: string): void {
  const url = new URL(path, 'https://staff.invalid')
  if (url.origin !== 'https://staff.invalid' || url.hash || url.pathname !== path.split('?')[0] || /%|\\/.test(url.pathname) ||
    !(AUTH_PATHS.has(url.pathname) || url.pathname === '/staff/me' || url.pathname === '/staff/support/assignees' ||
      CUSTOMER_PATH.test(url.pathname) || CASE_PATH.test(url.pathname)) || !['GET', 'POST'].includes(method)) {
    throw new OpsError('Personalportalen begärde en otillåten API-operation.', 400, { code: 'staff_operation_invalid', retryable: false })
  }
  if (AUTH_PATHS.has(url.pathname) && (method !== 'POST' || url.search)) {
    throw new OpsError('Personalportalen begärde en otillåten API-operation.', 400, { code: 'staff_operation_invalid', retryable: false })
  }
}

function invalidResponse(response?: Response): never {
  throw new OpsError('Personalportalen kunde inte verifiera API-svaret.', 502, {
    code: 'staff_response_invalid', retryable: false,
    request_id: response?.headers.get('x-request-id') ?? null,
    correlation_id: response?.headers.get('x-correlation-id') ?? null,
  })
}

async function send(path: string, input: { method?: 'GET' | 'POST'; proof?: string; body?: BodyInit; contentType?: string; idempotencyKey?: string; signal: AbortSignal }): Promise<Response> {
  const method = input.method ?? 'GET'
  assertInternalPath(path, method)
  await assertStaffProtocolReady()
  const { base, apiKey } = staffApiConfig()
  const headers = new Headers({ Accept: 'application/json', Authorization: `Bearer ${apiKey}` })
  if (input.proof) headers.set('X-Gridex-Staff-Authorization', `Bearer ${input.proof}`)
  if (input.idempotencyKey) headers.set('Idempotency-Key', input.idempotencyKey)
  if (input.contentType) headers.set('Content-Type', input.contentType)
  const url = new URL(`${base.pathname}${path}`, base.origin)
  return fetch(url, { method, headers, body: input.body, signal: input.signal, redirect: 'manual', cache: 'no-store' })
}

async function payload(response: Response, signal: AbortSignal): Promise<unknown> {
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') invalidResponse(response)
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readStaffBody(response, 512 * 1024, signal))) }
  catch (error) {
    if (error instanceof OpsError && error.code === 'payload_too_large') invalidResponse(response)
    if (error instanceof OpsError) throw error
    invalidResponse(response)
  }
}

function checkVersion(response: Response, body: unknown): void {
  const row = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null
  if (response.headers.get('x-gridex-contract-version') !== STAFF_CONTRACT_VERSION || row?.contract_schema_version !== STAFF_CONTRACT_VERSION) invalidResponse(response)
}

function upstreamError(response: Response, body: unknown, path: string): never {
  const details = safeErrorDetails(body, response, path)
  // Error projection deliberately excludes provider details, raw receipts and headers.
  const messages: Record<string, string> = {
    staff_credentials_invalid: 'E-postadressen eller lösenordet är fel.',
    staff_mfa_code_invalid: 'Verifieringskoden är fel. Ange en ny kod och försök igen.',
    staff_mfa_challenge_invalid: 'Verifieringen har löpt ut. Begär en ny kodverifiering.',
    staff_password_rejected: 'Lösenordet uppfyller inte kraven. Välj ett annat lösenord.',
    staff_session_busy: 'En annan sessionsåtgärd pågår. Försök igen om en stund.',
    staff_session_changed: 'Personalsessionen har ändrats. Ladda om portalen.',
    staff_authentication_incomplete: 'Slutför personalinloggningen först.',
    staff_permission_denied: 'Du saknar behörighet för den här åtgärden.',
    staff_tenant_write_required: 'Den här personalsessionen har endast läsbehörighet.',
    support_case_changed: 'Ärendet har ändrats. Ladda om innan du försöker igen.',
    attachment_unavailable: 'Bilagan kan inte behandlas säkert just nu.',
  }
  const message = (details.code && messages[details.code]) || (response.status === 401 ? 'Personalsessionen behöver förnyas. Logga in igen.' :
    response.status === 403 ? 'Du saknar behörighet för den här åtgärden.' : response.status === 429 ? 'För många försök. Försök igen senare.' :
    response.status === 404 ? 'Uppgiften kunde inte hittas.' : response.status === 409 ? 'Uppgiften har ändrats eller behandlas redan. Ladda om och försök igen.' :
    response.status === 400 || response.status === 422 ? 'Kontrollera uppgifterna och försök igen.' : 'Personalportalen kunde inte slutföra åtgärden just nu.')
  throw new OpsError(message, response.status, {
    code: details.code, request_id: details.request_id, correlation_id: details.correlation_id,
    field: details.field, stage: details.stage, action: details.action, hint: details.hint,
    blockers: details.blockers, retryable: details.retryable, retry_after: details.retry_after,
  })
}

function retryAfterMilliseconds(error: OpsError): number | null {
  const details = error.details && typeof error.details === 'object' ? error.details as Record<string, unknown> : {}
  const value = typeof details.retry_after === 'string' ? details.retry_after.trim() : ''
  if (/^\d+$/.test(value)) return Number(value) * 1000
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null
}
async function waitForStaffLease(delay: number, signal: AbortSignal) {
  if (signal.aborted) throw signal.reason
  await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, delay)
    signal.addEventListener('abort', abort, { once: true })
  })
}
async function retryStaffRead(error: unknown, method: string, attempt: number, deadline: number, signal: AbortSignal): Promise<void> {
  // OPS serializes consuming native-token validation. Only this declared
  // transient read denial can retry; mutations keep the original caller's
  // explicit idempotent operation rather than being automatically replayed.
  if (method !== 'GET' || !(error instanceof OpsError) || error.status !== 409 ||
    error.code !== 'staff_session_busy' || !error.retryable || attempt >= 7) throw error
  const delay = retryAfterMilliseconds(error)
  if (delay === null || !Number.isFinite(delay) || delay + 80 >= deadline - Date.now()) throw error
  await waitForStaffLease(delay + Math.floor(Math.random() * 80), signal)
}

export async function staffJsonRequest(path: string, input: {
  method?: 'GET' | 'POST'; proof?: string; body?: unknown; idempotencyKey?: string;
} = {}): Promise<StaffEnvelope> {
  const timeout = AbortSignal.timeout(15000)
  const deadline = Date.now() + 15000
  try {
    const method = input.method ?? 'GET'
    assertStaffRequest(path, method, input.body)
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await send(path, { method, proof: input.proof, idempotencyKey: input.idempotencyKey, ...(input.body === undefined ? {} : {
          body: JSON.stringify(input.body), contentType: 'application/json',
        }), signal: timeout })
        if (response.status >= 300 && response.status < 400) invalidResponse(response)
        const body = await payload(response, timeout)
        checkVersion(response, body)
        assertStaffResponse(path, method, response.status, body)
        if (!response.ok) upstreamError(response, body, path)
        const row = body as Record<string, unknown>
        if (!Object.hasOwn(row, 'data') || typeof row.request_id !== 'string' ||
          !(row.correlation_id === null || typeof row.correlation_id === 'string')) invalidResponse(response)
        return row as StaffEnvelope
      } catch (error) {
        await retryStaffRead(error, method, attempt, deadline, timeout)
      }
    }
  } catch (error) {
    if (error instanceof OpsError) throw error
    throw new OpsError('Personalportalen kunde inte nå API-tjänsten.', 503, { code: 'staff_upstream_unavailable', retryable: true })
  }
}

export async function staffAttachmentRequest(path: string, input: { method: 'GET' | 'POST'; proof: string; body?: Uint8Array; contentType?: string; idempotencyKey?: string }): Promise<StaffEnvelope | {
  bytes: Uint8Array; headers: Headers;
}> {
  const timeout = AbortSignal.timeout(30000)
  const deadline = Date.now() + 30000
  try {
    assertStaffRequest(path, input.method)
    for (let attempt = 0; ; attempt++) {
      try {
    const response = await send(path, { ...input, body: input.body as BodyInit | undefined, signal: timeout })
    if (response.status >= 300 && response.status < 400) invalidResponse(response)
    if (input.method === 'POST' || !response.ok) {
      const body = await payload(response, timeout)
      checkVersion(response, body)
      assertStaffResponse(path, input.method, response.status, body)
      if (!response.ok) upstreamError(response, body, path)
      return body as StaffEnvelope
    }
    if (response.headers.get('x-gridex-contract-version') !== STAFF_CONTRACT_VERSION) invalidResponse(response)
    const type = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    const disposition = response.headers.get('content-disposition')
    const hash = response.headers.get('x-gridex-sha256')
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(type ?? '') || !disposition?.startsWith('attachment;') ||
      !/^[a-f0-9]{64}$/.test(hash ?? '') || !response.headers.get('x-request-id')) invalidResponse(response)
    let bytes: Uint8Array
    try { bytes = await readStaffBody(response, 10 * 1024 * 1024, timeout) }
    catch (error) { if (error instanceof OpsError && error.code === 'payload_too_large') invalidResponse(response); throw error }
    if (createHash('sha256').update(bytes).digest('hex') !== hash) invalidResponse(response)
    const length = response.headers.get('content-length')
    if (!length || !/^\d+$/.test(length) || Number(length) !== bytes.byteLength) invalidResponse(response)
    const headers = new Headers({ 'Content-Type': type!, 'Content-Disposition': disposition,
      'Content-Length': String(bytes.byteLength), 'X-Gridex-Sha256': hash!,
      'X-Gridex-Contract-Version': STAFF_CONTRACT_VERSION, 'X-Request-ID': response.headers.get('x-request-id')!,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox" })
    return { bytes, headers }
      } catch (error) {
        await retryStaffRead(error, input.method, attempt, deadline, timeout)
      }
    }
  } catch (error) {
    if (error instanceof OpsError) throw error
    throw new OpsError('Bilagan kunde inte hämtas eller skickas.', 503, { code: 'staff_attachment_unavailable', retryable: true })
  }
}
