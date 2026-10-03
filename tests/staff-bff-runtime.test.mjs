import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rawSpec = readFileSync(resolve(root, 'docs/openapi/staff-support-v1.json'), 'utf8')
const pin = JSON.parse(readFileSync(resolve(root, 'docs/openapi/staff-release-manifest.json'), 'utf8'))
assert.equal(createHash('sha256').update(rawSpec).digest('hex'), pin.specification.sha256)
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const rate = fixture(`export const checkRateLimit=async()=>({allowed:true,resetAt:Date.now()+1000});export const clientIpFromHeaders=()=> 'synthetic';`)
const forbidden = fixture(`throw new Error('Staff surface attempted direct Web customer/Auth access');`)
function existing(candidate) {
  return (extname(candidate) ? [candidate] : [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}.js`]).find(path => existsSync(path) && statSync(path).isFile())
}
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/security/rateLimit') return { url: rate, shortCircuit: true }
    if (specifier.startsWith('@/lib/supabase/') || specifier.startsWith('@/lib/customerPortal/') || specifier === '@/lib/admin/guards') return { url: forbidden, shortCircuit: true }
    if (specifier.startsWith('@/')) { const path = existing(resolve(root, specifier.slice(2))); if (path) return { url: pathToFileURL(path).href, shortCircuit: true } }
    if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith('file:')) { const path = existing(resolve(dirname(fileURLToPath(context.parentURL)), specifier)); if (path) return { url: pathToFileURL(path).href, shortCircuit: true } }
    if (specifier === 'next/server') return nextResolve('next/server.js', context)
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith(pathToFileURL(resolve(root, 'docs/openapi')).href) && url.endsWith('.json')) return { format: 'module', source: `export default ${readFileSync(fileURLToPath(url), 'utf8')}`, shortCircuit: true }
    return nextLoad(url, context)
  },
})
const realFetch = globalThis.fetch
const version = '2026-10-03.1'
const capabilities = ['staff.sessions', 'staff.context', 'staff.customers.read', 'staff.support.read', 'staff.support.write', 'staff.support.attachments']
process.env.GRIDEX_STAFF_SESSION_COOKIE_SECRET = randomBytes(32).toString('base64')
process.env.GRIDEX_STAFF_API_KEY = 'synthetic-separate-staff-machine-key'
process.env.GRIDEX_STAFF_OPS_API_URL = 'https://draft.staff.test/api/v1'
const calls = []
let mode = 'missing-capabilities'
let override = null
const envelope = (data, page) => ({ data, ...(page ? { page } : {}), request_id: 'trace-staff', correlation_id: 'correlation-staff', contract_schema_version: version })
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'X-Gridex-Contract-Version': version, 'X-Request-ID': 'trace-staff', ...headers } })
const failure = (code, status, retryable = false, headers = {}) => json({ error: { code, message: 'Native provider detail must not reach browser', retryable, field: null, blockers: [] }, request_id: 'trace-staff', correlation_id: 'correlation-staff', contract_schema_version: version }, status, headers)
function receipt(status = 'authenticated', extra = {}) {
  return { status, staff_access_token: 'synthetic-personal-access-proof', refresh_token: 'r'.repeat(43), token_type: 'Bearer', expires_in: 300,
    expires_at: new Date(Date.now() + 300000).toISOString(), refresh_expires_at: new Date(Date.now() + 8 * 3600000 - 1000).toISOString(),
    session_reference: 'staff_session_test', staff_reference: 'staff_test', organization_reference: 'org_test', factors: [], ...extra }
}
const me = { staff_reference: 'staff_test', display_name: null, organization_reference: 'org_test', is_platform_admin: false, permissions: ['customers.read', 'cases.read', 'cases.write'], capabilities: capabilities.filter(name => name !== 'staff.sessions') }
const customerRef = `customer_${'a'.repeat(24)}`
const caseRef = `support_case_${'b'.repeat(24)}`
const attachmentRef = `support_attachment_${'c'.repeat(24)}`
const timestamp = '2026-10-03T21:00:00.000Z'
const customer = { customer_reference: customerRef, customer_number: 'DX-TEST', customer_type: 'private', status: 'active', email: null, phone: null, display_name: null, created_at: timestamp }
const emptyPage = { limit: 50, returned: 0, has_more: false, next_cursor: null }
const attachment = { case_reference: caseRef, attachment_reference: attachmentRef, file_name: 'test.pdf', mime_type: 'application/pdf', byte_size: 13, sha256: 'a'.repeat(64), visibility: 'internal', uploaded_by: 'staff', scan_status: 'rejected', scan_reason: 'pdf_active_content', created_at: timestamp }
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input))
  const headers = new Headers(init.headers)
  if (url.pathname.includes('/openapi/')) {
    assert.equal(headers.has('Authorization'), false, 'Public contract verification never sends integration credentials')
    if (url.pathname.endsWith('staff-release-manifest.json')) return json({ ...pin, build_commit: 'a'.repeat(40), capabilities: mode === 'missing-capabilities' ? [] : capabilities,
      specification: { ...pin.specification, url: `${url.origin}/api/v1/openapi/staff-support-v1.json`, immutable_url: `${url.origin}/api/v1/openapi/${version}/staff-support-v1.json` } })
    return new Response(mode === 'immutable-drift' && url.pathname.includes(version) ? `${rawSpec} ` : rawSpec, { headers: { 'Content-Type': 'application/json' } })
  }
  assert.equal(init.cache, 'no-store')
  assert.equal(init.redirect, 'manual')
  assert.equal(headers.get('Authorization'), `Bearer ${process.env.GRIDEX_STAFF_API_KEY}`)
  assert.equal(headers.has('Cookie'), false)
  assert.equal(headers.has('Origin'), false)
  const call = { path: url.pathname, query: url.search, method: init.method, headers, body: init.body }
  calls.push(call)
  if (override) { const response = await override(call); if (response) return response }
  if (url.pathname.endsWith('/sessions')) return json(envelope(receipt()))
  if (url.pathname.endsWith('/sessions/refresh')) return json(envelope(receipt('authenticated', { staff_access_token: 'new-personal-proof', refresh_token: 'n'.repeat(43) })))
  if (url.pathname.endsWith('/me')) return json(envelope(me))
  if (url.pathname.endsWith('/sessions/logout')) return json(envelope({ logged_out: true }))
  if (url.pathname.endsWith('/sessions/recovery')) return json(envelope({ accepted: true }), 202)
  if (url.pathname.endsWith('/sessions/mfa/challenge')) return json(envelope({ challenge_reference: `mch_${'e'.repeat(32)}`, method: 'totp', expires_at: new Date(Date.now() + 300000).toISOString() }))
  if (url.pathname.endsWith('/sessions/mfa/verify') || url.pathname.endsWith('/sessions/password')) return json(envelope(receipt()))
  if (url.pathname.endsWith(`/customers/${customerRef}`)) return json(envelope({ ...customer, first_name: null, last_name: null, company_name: null, apartment_number: null, preferred_language: null, updated_at: null, moved_out_at: null, lifecycle_closed_at: null, org_number: null, masked_personal_number: null }))
  if (url.pathname.endsWith('/customers')) return json(envelope([customer], { limit: 1, returned: 1, has_more: true, next_cursor: 'opaque-page-token' }))
  if (init.method === 'POST' && url.pathname.endsWith('/attachments')) return json(envelope(attachment), 201)
  return json(envelope([], emptyPage))
}
try {
  const { staffSessionGET, staffAuthPOST, staffResource } = await import('../lib/staff/handlers.ts')
  const { staffJsonRequest, staffAttachmentRequest } = await import('../lib/staff/transport.ts')
  const session = await import('../lib/staff/session.ts')
  const { refreshStaffSession } = await import('../lib/staff/auth.ts')
  const get = (path = '/api/staff/session', cookie) => new Request(`https://support123.gridex.se${path}`, { headers: cookie ? { cookie } : {} })
  const cookieOf = response => response.headers.get('set-cookie')?.split(';')[0]
  const storedCookie = value => `${session.STAFF_COOKIE_NAME}=${session.sealStaffSession(value)}`
  function post(operation, body, state, options = {}) {
    return new Request(`https://support123.gridex.se/api/staff/${operation}`, { method: 'POST', headers: {
      Origin: 'https://support123.gridex.se', 'Content-Type': 'application/json', Cookie: state.cookie, 'X-Gridex-Staff-CSRF': state.csrf,
      'Idempotency-Key': 'stable-operation-key-123456', ...options.headers,
    }, body: JSON.stringify(body) })
  }
  assert.equal((await staffSessionGET(get())).status, 503, 'Draft/absent capability manifest fails closed before login')
  assert.equal(calls.length, 0)
  mode = 'immutable-drift'
  process.env.GRIDEX_STAFF_OPS_API_URL = 'https://drift.staff.test/api/v1'
  assert.equal((await staffSessionGET(get())).status, 503, 'Both exact immutable and mutable raw hashes are required')
  assert.equal(calls.length, 0)
  mode = 'ready'
  process.env.GRIDEX_STAFF_OPS_API_URL = 'https://ready.staff.test/api/v1'
  const bootstrap = await staffSessionGET(get())
  assert.equal(bootstrap.status, 200)
  let state = { cookie: cookieOf(bootstrap), csrf: (await bootstrap.json()).data.csrf_token }
  assert.match(bootstrap.headers.get('set-cookie'), /Secure/)
  assert.match(bootstrap.headers.get('set-cookie'), /HttpOnly/)
  assert.equal(bootstrap.headers.get('set-cookie').includes('Domain='), false)
  override = call => call.path.endsWith('/sessions') ? failure('staff_credentials_invalid', 401) : null
  const wrongPassword = await staffAuthPOST(post('session/login', { email: 'staff@example.test', password: 'wrong-password' }, state), 'login')
  assert.equal(wrongPassword.status, 401)
  assert.equal(wrongPassword.headers.has('set-cookie'), false, 'Anonymous login rejection preserves existing CSRF cookie for the next attempt')
  assert.equal((await wrongPassword.text()).includes('Native provider detail'), false)
  override = null
  const login = await staffAuthPOST(post('session/login', { email: 'staff@example.test', password: 'valid-password' }, state), 'login')
  assert.equal(login.status, 200)
  const publicLogin = await login.json()
  const serialized = JSON.stringify(publicLogin)
  assert.equal(serialized.includes('personal-access-proof'), false)
  assert.equal(serialized.includes('rotating-refresh-proof'), false)
  assert.equal(serialized.includes('staff_access_token'), false)
  assert.equal(publicLogin.data.staff.display_name, null)
  assert.notEqual(publicLogin.data.csrf_token, state.csrf)
  state = { cookie: cookieOf(login), csrf: publicLogin.data.csrf_token }
  const active = session.readStaffCookie(get('/api/staff/session', state.cookie))
  assert.equal(active.kind, 'staff')
  const anon = session.anonymousStaffSession()
  const anonymousState = { cookie: storedCookie(anon), csrf: anon.csrf }
  const factor = { factor_reference: `mfa_${'d'.repeat(32)}`, method: 'totp', friendly_name: null }
  override = call => call.path.endsWith('/sessions') ? json(envelope(receipt('mfa_required', { factors: [factor] }))) : null
  const mfaLogin = await staffAuthPOST(post('session/login', { email: 'staff@example.test', password: 'valid-password' }, anonymousState), 'login')
  const mfaContext = (await mfaLogin.json()).data
  assert.equal(mfaContext.status, 'mfa_required')
  assert.equal(mfaContext.staff, null)
  const mfaState = { cookie: cookieOf(mfaLogin), csrf: mfaContext.csrf_token }
  override = null
  const challenge = await staffAuthPOST(post('session/mfa/challenge', { factor_reference: factor.factor_reference }, mfaState), 'mfa/challenge')
  assert.equal(challenge.status, 200)
  assert.equal(calls.at(-1).headers.has('Idempotency-Key'), false, 'MFA challenge uses its documented non-idempotent operation')
  override = call => call.path.endsWith('/sessions/mfa/verify') ? failure('staff_mfa_code_invalid', 422) : null
  const wrongOtp = await staffAuthPOST(post('session/mfa/verify', { challenge_reference: `mch_${'e'.repeat(32)}`, code: '123456' }, mfaState), 'mfa/verify')
  assert.equal(wrongOtp.status, 422)
  assert.equal(wrongOtp.headers.has('set-cookie'), false, 'Wrong OTP retains restricted cookie and current CSRF')
  override = call => call.path.endsWith('/sessions/mfa/verify') ? json(envelope(receipt('password_change_required'))) : null
  const verified = await staffAuthPOST(post('session/mfa/verify', { challenge_reference: `mch_${'e'.repeat(32)}`, code: '654321' }, mfaState, { headers: { 'Idempotency-Key': 'new-code-operation-123456' } }), 'mfa/verify')
  const passwordContext = (await verified.json()).data
  assert.equal(passwordContext.status, 'password_change_required')
  assert.equal(passwordContext.staff, null)
  assert.equal(passwordContext.csrf_token, mfaContext.csrf_token)
  override = null
  const passwordChanged = await staffAuthPOST(post('session/password', { password: 'valid-new-password-long' }, { cookie: cookieOf(verified), csrf: passwordContext.csrf_token }), 'password')
  assert.equal(passwordChanged.status, 200)
  assert.equal((await passwordChanged.json()).data.status, 'authenticated')
  let protectedCalls = calls.length
  assert.equal((await staffAuthPOST(post('session/password', { password: 'valid-new-password-long' }, state), 'password')).status, 400)
  assert.equal(calls.length, protectedCalls, 'General authenticated password changes cannot bypass the restricted API stage')
  const acceptedRecovery = await staffAuthPOST(post('session/recovery', { email: 'nobody@example.test' }, anonymousState), 'recovery')
  assert.equal(acceptedRecovery.status, 202)
  assert.deepEqual((await acceptedRecovery.json()).data, { accepted: true })
  assert.equal(acceptedRecovery.headers.has('set-cookie'), false, 'Neutral recovery retains bootstrap CSRF')
  let count = calls.length
  for (const origin of [undefined, 'null', 'https://gridex.se', 'https://support123.gridex.se.evil.test']) {
    const request = post('session/refresh', {}, state)
    if (origin === undefined) request.headers.delete('Origin'); else request.headers.set('Origin', origin)
    assert.equal((await staffAuthPOST(request, 'refresh')).status, 403)
  }
  assert.equal(calls.length, count, 'Origin/CSRF checks precede all upstream actions')
  for (const stage of ['mfa_required', 'password_change_required']) {
    const restricted = session.authenticatedStaffSession(receipt(stage), active)
    assert.equal((await staffResource(get('/api/staff/customers', storedCookie(restricted)), ['customers'])).status, 403)
  }
  assert.equal(calls.length, count, 'Restricted receipts cannot reach customer/case reads')
  for (const path of ['/api/staff/customers?company_id=attacker', '/api/staff/customers?limit=101', '/api/staff/customers?limit=1&limit=2']) {
    assert.equal((await staffResource(get(path, state.cookie), ['customers'])).status, 400)
  }
  assert.equal((await staffResource(get('/api/staff/arbitrary', state.cookie), ['arbitrary'])).status, 400)
  assert.equal(calls.length, count, 'Unknown route/filter/duplicate parameters never reach OPS')
  const paged = await staffResource(get('/api/staff/customers?limit=1&cursor=opaque-page-token', state.cookie), ['customers'])
  assert.equal(paged.status, 200)
  assert.deepEqual((await paged.json()).page, { limit: 1, returned: 1, has_more: true, next_cursor: 'opaque-page-token' })
  assert.equal(calls.at(-1).query, '?limit=1&cursor=opaque-page-token')
  assert.equal(calls.at(-1).headers.get('X-Gridex-Staff-Authorization'), `Bearer ${active.receipt.staff_access_token}`)
  override = call => call.path.endsWith('/customers') ? json(envelope([customer], { limit: 1, returned: 0, has_more: false, next_cursor: null })) : null
  assert.equal((await staffResource(get('/api/staff/customers', state.cookie), ['customers'])).status, 502, 'Cross-field page counts are validated')
  override = call => call.path.endsWith('/customers') ? json(envelope([{ ...customer, native_user_id: 'must-not-leak' }], { limit: 1, returned: 1, has_more: false, next_cursor: null })) : null
  const extraDto = await staffResource(get('/api/staff/customers', state.cookie), ['customers'])
  assert.equal(extraDto.status, 502)
  assert.equal((await extraDto.text()).includes('must-not-leak'), false, 'Undocumented upstream fields are never returned')
  const attempts = new Map()
  override = call => {
    if (call.method !== 'GET') return null
    const key = call.path; const attempt = (attempts.get(key) ?? 0) + 1; attempts.set(key, attempt)
    return attempt === 1 ? failure('staff_session_busy', 409, true, { 'Retry-After': '0' }) : null
  }
  const parallel = await Promise.all([
    staffSessionGET(get('/api/staff/session', state.cookie)),
    ...['contacts', 'addresses', 'facilities'].map(part => staffResource(get(`/api/staff/customers/${customerRef}/${part}`, state.cookie), ['customers', customerRef, part])),
  ])
  assert.deepEqual(parallel.map(response => response.status), [200, 200, 200, 200], 'Mounted customer parallel reads and /me survive canonical native validation contention')
  assert.equal([...attempts.values()].every(value => value === 2), true)
  override = call => call.path.endsWith('/status') ? failure('staff_session_busy', 409, true, { 'Retry-After': '1' }) : null
  count = calls.length
  const busyWrite = await staffResource(post(`support/cases/${caseRef}/status`, { status: 'open', expected_updated_at: timestamp }, state), ['support', 'cases', caseRef, 'status'])
  assert.equal(busyWrite.status, 409)
  assert.equal(calls.length, count + 1, 'Mutation contention is not automatically replayed')
  assert.equal(busyWrite.headers.get('retry-after'), '1')
  assert.equal(busyWrite.headers.has('set-cookie'), false, 'Busy response preserves a good session')
  assert.equal((await busyWrite.json()).request_id, 'trace-staff')
  override = null
  const nearExpiry = session.authenticatedStaffSession(receipt('authenticated', { expires_at: new Date(Date.now() + 1000).toISOString() }), active)
  count = calls.filter(call => call.path.endsWith('/sessions/refresh')).length
  const refreshed = await Promise.all([refreshStaffSession(nearExpiry), refreshStaffSession(nearExpiry), refreshStaffSession(nearExpiry)])
  assert.equal(calls.filter(call => call.path.endsWith('/sessions/refresh')).length, count + 1, 'One local concurrent refresh operation')
  assert.equal(refreshed.every(value => value.receipt.refresh_token === 'n'.repeat(43)), true)
  const firstRefresh = calls.filter(call => call.path.endsWith('/sessions/refresh')).at(-1)
  await refreshStaffSession(nearExpiry)
  const replayRefresh = calls.filter(call => call.path.endsWith('/sessions/refresh')).at(-1)
  assert.equal(replayRefresh.body, firstRefresh.body)
  assert.equal(replayRefresh.headers.get('Idempotency-Key'), firstRefresh.headers.get('Idempotency-Key'), 'Lost-response refresh repeats exact original body/key')
  const bytes = new TextEncoder().encode('%PDF-1.7 test')
  const binaryPath = `/staff/support/cases/${caseRef}/attachments/${attachmentRef}`
  let downloads = 0
  override = call => {
    if (!call.path.endsWith(attachmentRef)) return null
    downloads++
    if (downloads === 1) return failure('staff_session_busy', 409, true, { 'Retry-After': '0' })
    return new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="test.pdf"', 'Content-Length': String(bytes.length), 'X-Gridex-Sha256': createHash('sha256').update(bytes).digest('hex'), 'X-Gridex-Contract-Version': version, 'X-Request-ID': 'binary-trace' } })
  }
  const downloaded = await staffAttachmentRequest(binaryPath, { method: 'GET', proof: active.receipt.staff_access_token })
  assert.equal(downloads, 2)
  assert.deepEqual(downloaded.bytes, bytes)
  assert.equal(downloaded.headers.get('Content-Security-Policy'), "default-src 'none'; sandbox")
  override = call => call.path.endsWith(attachmentRef) ? new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="test.pdf"', 'Content-Length': String(bytes.length), 'X-Gridex-Sha256': 'f'.repeat(64), 'X-Gridex-Contract-Version': version, 'X-Request-ID': 'binary-trace' } }) : null
  await assert.rejects(staffAttachmentRequest(binaryPath, { method: 'GET', proof: active.receipt.staff_access_token }), error => error.code === 'staff_response_invalid')
  override = call => call.path.endsWith(attachmentRef) ? new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="test.pdf"', 'Content-Length': String(10 * 1024 * 1024 + 1), 'X-Gridex-Sha256': createHash('sha256').update(bytes).digest('hex'), 'X-Gridex-Contract-Version': version, 'X-Request-ID': 'binary-trace' } }) : null
  await assert.rejects(staffAttachmentRequest(binaryPath, { method: 'GET', proof: active.receipt.staff_access_token }), error => error.code === 'staff_response_invalid' && error.status === 502, 'Oversized upstream response is rejected before buffering')
  override = null
  const form = new FormData(); form.set('file', new File([bytes], 'test.pdf', { type: 'application/pdf' })); form.set('visibility', 'internal')
  const upload = new Request(`https://support123.gridex.se/api/staff/support/cases/${caseRef}/attachments`, { method: 'POST', headers: { Origin: 'https://support123.gridex.se', Cookie: state.cookie, 'X-Gridex-Staff-CSRF': state.csrf, 'Idempotency-Key': 'upload-stable-key-123456' }, body: form })
  const uploaded = await staffResource(upload, ['support', 'cases', caseRef, 'attachments'])
  assert.equal(uploaded.status, 201)
  assert.equal((await uploaded.json()).data.scan_status, 'rejected', 'Scanning rejection is a receipt, never a ready download')
  override = call => call.path.endsWith('/sessions/logout') ? failure('staff_session_busy', 409, true, { 'Retry-After': '1' }) : null
  const logout = await staffAuthPOST(post('session/logout', {}, state), 'logout')
  assert.equal(logout.status, 409)
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/, 'Authorized logout always deletes browser staff cookie even if OPS is unavailable/busy')
  override = call => call.path.endsWith('/customers') ? failure('staff_permission_denied', 403) : null
  count = calls.length
  assert.equal((await staffResource(get('/api/staff/customers', state.cookie), ['customers'])).status, 403)
  assert.equal(calls.length, count + 1, 'Permission denials cannot retry or acquire alternate authorization')
  await assert.rejects(staffJsonRequest('/staff/customers?company_id=attacker', { proof: active.receipt.staff_access_token }), error => error.status === 400)
  console.log('Actual staff BFF/schema/transport: release gate, safe receipts, repeated login, exact CSRF, paging, concurrent read/refresh, mutation contention, private uploads/downloads and logout regressions passed')
} finally { globalThis.fetch = realFetch; hooks.deregister() }
