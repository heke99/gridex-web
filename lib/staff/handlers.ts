import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { OpsError } from '@/lib/ops/errors'
import { privateJsonResponse } from '@/lib/api/webBoundary'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'
import { STAFF_CONTRACT_VERSION } from './config'
import { assertStaffProtocolReady, assertStaffRequest } from './contract'
import { assertStaffHost, requireStaffMutation, requireStaffProof, readStaffBody, readStaffJson, staffIdempotencyKey } from './boundary'
import { anonymousStaffSession, readStaffCookie, sealStaffSession, STAFF_COOKIE_NAME, staffCookieOptions, type StaffCookieSession } from './session'
import { freshStaffSession, publicStaffSession, refreshStaffSession, sessionFromReceipt } from './auth'
import { staffAttachmentRequest, staffJsonRequest, type StaffEnvelope } from './transport'

type Row = Record<string, unknown>
const REFERENCE = /^[A-Za-z0-9_-]{1,160}$/
const AUTH_OPERATIONS = ['login', 'refresh', 'logout', 'password', 'recovery', 'recovery/verify', 'mfa/challenge', 'mfa/verify'] as const
type AuthOperation = typeof AUTH_OPERATIONS[number]

function invalid(message = 'Begäran innehåller ogiltiga uppgifter.'): never {
  throw new OpsError(message, 400, { code: 'staff_request_invalid', retryable: false })
}
function bodyObject(value: unknown, allowed: string[], required: string[] = []): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  const row = value as Row
  if (Object.keys(row).some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(row, key))) invalid()
  return row
}
function clearCookie(response: NextResponse) {
  response.cookies.set(STAFF_COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
}
function sessionResponse(body: StaffEnvelope, session: StaffCookieSession, status = 200) {
  const response = privateJsonResponse(body, { status })
  response.cookies.set(STAFF_COOKIE_NAME, sealStaffSession(session), staffCookieOptions(session))
  return response
}
function errorResponse(error: unknown, clear = false, clearUnauthorized = true): NextResponse {
  const canonical = error instanceof OpsError ? error : new OpsError('Personalportalen kunde inte slutföra åtgärden.', 503, {
    code: 'staff_operation_unavailable', retryable: true,
  })
  const details = canonical.details && typeof canonical.details === 'object' ? canonical.details as Row : {}
  const headers = new Headers()
  const retryAfter = typeof details.retry_after === 'string' ? details.retry_after : null
  if (retryAfter && retryAfter.length <= 100 && !/[\r\n]/.test(retryAfter)) headers.set('Retry-After', retryAfter)
  const requestId = canonical.requestId ?? crypto.randomUUID()
  headers.set('X-Request-ID', requestId)
  headers.set('X-Gridex-Contract-Version', STAFF_CONTRACT_VERSION)
  const response = privateJsonResponse({ error: { code: canonical.code ?? 'staff_operation_failed', message: canonical.message,
    retryable: canonical.retryable, field: typeof details.field === 'string' ? details.field : null,
    blockers: Array.isArray(details.blockers) ? details.blockers : [] },
    request_id: requestId, correlation_id: canonical.correlationId, contract_schema_version: STAFF_CONTRACT_VERSION,
  }, { status: canonical.status, headers })
  if (clear || (clearUnauthorized && canonical.status === 401)) clearCookie(response)
  return response
}

export async function staffSessionGET(request: Request) {
  try {
    assertStaffHost(request)
    await assertStaffProtocolReady()
    const stored = readStaffCookie(request)
    let session = stored?.kind === 'staff' ? await freshStaffSession(stored) : anonymousStaffSession()
    let context
    try { context = await publicStaffSession(session) }
    catch (error) {
      if (session.kind !== 'staff' || !(error instanceof OpsError) || error.status !== 401) throw error
      session = await refreshStaffSession(session)
      context = await publicStaffSession(session)
    }
    return sessionResponse(context, session)
  } catch (error) { return errorResponse(error) }
}

async function authRateLimit(request: Request, email: unknown) {
  if (typeof email !== 'string' || email.length > 254) invalid()
  const ip = createHash('sha256').update(clientIpFromHeaders(request.headers)).digest('hex')
  const account = createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
  for (const [key, limit] of [[`staff-login-ip:${ip}`, 30], [`staff-login-account:${ip}:${account}`, 5]] as const) {
    const result = await checkRateLimit(key, { limit, windowMs: 15 * 60 * 1000 })
    if (!result.allowed) throw new OpsError('För många försök. Försök igen om en stund.', 429, {
      code: 'staff_login_rate_limited', retryable: true, retry_after: String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
    })
  }
}

export async function staffAuthPOST(request: Request, operation: string) {
  let authorizedLogout = false
  let protectedOperation = false
  try {
    if (!AUTH_OPERATIONS.includes(operation as AuthOperation)) invalid()
    const previous = requireStaffMutation(request)
    authorizedLogout = operation === 'logout'
    const raw = await readStaffJson(request)
    await assertStaffProtocolReady()
    if (operation === 'login' || operation === 'recovery' || operation === 'recovery/verify') {
      if (previous.kind !== 'anonymous') throw new OpsError('Logga ut innan du byter personalinloggning.', 409, { code: 'staff_session_already_active', retryable: false })
      const body = bodyObject(raw, operation === 'login' ? ['email', 'password'] : operation === 'recovery' ? ['email'] : ['token_hash'],
        operation === 'login' ? ['email', 'password'] : operation === 'recovery' ? ['email'] : ['token_hash'])
      if (operation !== 'recovery/verify') await authRateLimit(request, body.email)
      const path = operation === 'login' ? '/staff/sessions' : `/staff/sessions/${operation}`
      const envelope = await staffJsonRequest(path, { method: 'POST', body })
      if (operation === 'recovery') return privateJsonResponse(envelope, { status: 202 })
      const session = sessionFromReceipt(envelope)
      return sessionResponse(await publicStaffSession(session, envelope), session)
    }
    const stored = requireStaffProof(request, false)
    protectedOperation = true
    if (operation === 'refresh') {
      bodyObject(raw, [])
      const session = await refreshStaffSession(stored)
      return sessionResponse(await publicStaffSession(session), session)
    }
    if (operation === 'logout') {
      bodyObject(raw, [])
      const envelope = await staffJsonRequest('/staff/sessions/logout', { method: 'POST', proof: stored.receipt.staff_access_token,
        body: { refresh_token: stored.receipt.refresh_token }, idempotencyKey: staffIdempotencyKey(request) })
      const response = privateJsonResponse(envelope)
      clearCookie(response)
      return response
    }
    const session = await freshStaffSession(stored)
    if (operation.startsWith('mfa/') && session.receipt.status !== 'mfa_required') invalid('Den här personalsessionen väntar inte på tvåstegsverifiering.')
    if (operation === 'password' && session.receipt.status !== 'password_change_required') invalid('Den här personalsessionen väntar inte på ett lösenordsbyte.')
    const body = operation === 'mfa/challenge' ? bodyObject(raw, ['factor_reference'], ['factor_reference']) :
      operation === 'mfa/verify' ? bodyObject(raw, ['challenge_reference', 'code'], ['challenge_reference', 'code']) : bodyObject(raw, ['password'], ['password'])
    const envelope = await staffJsonRequest(`/staff/sessions/${operation}`, { method: 'POST', proof: session.receipt.staff_access_token,
      body, ...(operation === 'mfa/challenge' ? {} : { idempotencyKey: staffIdempotencyKey(request) }) })
    if (operation === 'mfa/challenge') return sessionResponse(envelope, session)
    const updated = sessionFromReceipt(envelope, session)
    return sessionResponse(await publicStaffSession(updated, envelope), updated)
  } catch (error) { return errorResponse(error, authorizedLogout, protectedOperation) }
}

type ResourceOperation = { path: string; method: 'GET' | 'POST'; status: number; attachment: boolean }
function resourceOperation(segments: string[], method: string, query: string): ResourceOperation {
  if (!['GET', 'POST'].includes(method) || segments.some((segment) => !REFERENCE.test(segment))) invalid()
  let valid = false
  let attachment = false
  let status = 200
  if (segments[0] === 'customers') {
    valid = method === 'GET' && (segments.length === 1 || segments.length === 2 ||
      (segments.length === 3 && ['contacts', 'addresses', 'facilities'].includes(segments[2]!)))
  } else if (segments[0] === 'support' && segments[1] === 'assignees') {
    valid = method === 'GET' && segments.length === 2
  } else if (segments[0] === 'support' && segments[1] === 'cases') {
    valid = segments.length === 2 || (method === 'GET' && segments.length === 3)
    if (segments.length === 4) {
      valid = method === 'GET' ? ['entries', 'attachments'].includes(segments[3]!) :
        ['replies', 'internal-notes', 'status', 'assignment', 'attachments'].includes(segments[3]!)
    }
    if (segments.length === 5) valid = method === 'GET' && segments[3] === 'attachments'
    attachment = segments[3] === 'attachments' && (method === 'POST' || segments.length === 5)
    if (method === 'POST' && (segments.length === 2 || ['replies', 'internal-notes', 'attachments'].includes(segments[3]!))) status = 201
  }
  if (!valid || (method === 'POST' && query)) invalid()
  return { path: `/staff/${segments.join('/')}${query ? `?${query}` : ''}`, method: method as 'GET' | 'POST', status, attachment }
}

async function multipart(request: Request): Promise<{ bytes: Uint8Array; type: string }> {
  const type = request.headers.get('content-type') ?? ''
  if (!/^multipart\/form-data;\s*boundary=/i.test(type) || type.length > 200) throw new OpsError('Bilagan måste skickas som ett formulär.', 415, { code: 'unsupported_media_type', retryable: false })
  const bytes = await readStaffBody(request, 4 * 1024 * 1024 + 64 * 1024)
  let data: FormData
  try { data = await new Response(bytes as BodyInit, { headers: { 'Content-Type': type } }).formData() } catch { invalid() }
  const keys = [...data!.keys()]
  if (keys.some((key) => !['file', 'visibility'].includes(key)) || data!.getAll('file').length !== 1 || data!.getAll('visibility').length > 1) invalid()
  const file = data!.get('file')
  const visibility = data!.get('visibility')
  if (!(file instanceof File) || file.size === 0 || file.size > 4 * 1024 * 1024 || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) ||
    (visibility !== null && !['internal', 'customer'].includes(String(visibility)))) invalid()
  return { bytes, type }
}

export async function staffResource(request: Request, segments: string[]) {
  try {
    const operation = resourceOperation(segments, request.method, new URL(request.url).search.slice(1))
    if (operation.method === 'POST') requireStaffMutation(request)
    const stored = requireStaffProof(request)
    let session = await freshStaffSession(stored)
    if (session.receipt.status !== 'authenticated') throw new OpsError('Slutför personalinloggningen först.', 403, { code: 'staff_auth_stage_required', retryable: false })
    const key = operation.method === 'POST' ? staffIdempotencyKey(request) : undefined
    const upload = operation.attachment && operation.method === 'POST' ? await multipart(request) : null
    const body = operation.method === 'POST' && !upload ? await readStaffJson(request) : undefined
    assertStaffRequest(operation.path, operation.method, body)
    const dispatch = () => operation.attachment ? staffAttachmentRequest(operation.path, {
      method: operation.method, proof: session.receipt.staff_access_token, ...(upload ? { body: upload.bytes, contentType: upload.type } : {}), idempotencyKey: key,
    }) : staffJsonRequest(operation.path, { method: operation.method, proof: session.receipt.staff_access_token, body, idempotencyKey: key })
    let result
    try { result = await dispatch() }
    catch (error) {
      if (!(error instanceof OpsError) || error.status !== 401) throw error
      session = await refreshStaffSession(session)
      if (session.receipt.status !== 'authenticated') throw new OpsError('Slutför personalinloggningen först.', 403, { code: 'staff_auth_stage_required', retryable: false })
      result = await dispatch()
    }
    if ('bytes' in result) {
      const response = new NextResponse(result.bytes as BodyInit, { headers: result.headers })
      if (session !== stored) response.cookies.set(STAFF_COOKIE_NAME, sealStaffSession(session), staffCookieOptions(session))
      return response
    }
    const response = privateJsonResponse(result, { status: operation.status })
    if (session !== stored) response.cookies.set(STAFF_COOKIE_NAME, sealStaffSession(session), staffCookieOptions(session))
    return response
  } catch (error) { return errorResponse(error) }
}
