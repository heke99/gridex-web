import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { randomBytes } from 'node:crypto'

const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context)
  if (specifier.startsWith('./') && context.parentURL?.includes('/lib/staff/')) return nextResolve(`${specifier}.ts`, context)
  return nextResolve(specifier, context)
} })
try {
  process.env.GRIDEX_STAFF_SESSION_COOKIE_SECRET = randomBytes(32).toString('base64')
  const session = await import('../lib/staff/session.ts')
  const boundary = await import('../lib/staff/boundary.ts')
  const config = await import('../lib/staff/config.ts')
  process.env.GRIDEX_API_KEY = 'customer-key-must-not-be-inherited'
  assert.throws(() => config.staffApiConfig(), (error) => error.code === 'staff_not_configured')
  process.env.GRIDEX_STAFF_API_KEY = 'synthetic-staff-machine-key'
  process.env.GRIDEX_STAFF_OPS_API_URL = 'https://app.gridex.se/api/v1'
  assert.equal(config.staffApiConfig().apiKey, 'synthetic-staff-machine-key')
  for (const url of ['http://app.gridex.se/api/v1', 'https://secret@app.gridex.se/api/v1', 'https://app.gridex.se/api/v1?token=x', 'https://app.gridex.se/api/v1/staff']) {
    process.env.GRIDEX_STAFF_OPS_API_URL = url
    assert.throws(() => config.staffApiConfig(), (error) => error.code === 'staff_not_configured')
  }
  process.env.GRIDEX_STAFF_OPS_API_URL = 'https://app.gridex.se/api/v1'
  const now = Date.now()
  const receipt = session.staffReceipt({ status: 'authenticated', staff_access_token: 'personal-proof-secret', refresh_token: 'rotating-proof-secret', token_type: 'Bearer', expires_in: 300,
    expires_at: new Date(now + 300000).toISOString(), refresh_expires_at: new Date(now + 28800000).toISOString(),
    session_reference: 'staff_session_test', staff_reference: 'staff_test', organization_reference: 'org_test', factors: [], unexpected_secret: 'must-not-retain' })
  assert.ok(receipt)
  assert.equal('unexpected_secret' in receipt, false)
  assert.equal(session.staffReceipt({ ...receipt, token_type: 'Basic' }), null)
  const anonymous = session.anonymousStaffSession(now)
  const authenticated = session.authenticatedStaffSession(receipt, anonymous)
  assert.notEqual(authenticated.csrf, anonymous.csrf, 'Login rotates the pre-authentication CSRF token')
  const cookie = session.sealStaffSession(authenticated)
  assert.equal(cookie.includes(receipt.staff_access_token), false)
  assert.equal(cookie.includes(receipt.refresh_token), false)
  assert.deepEqual(session.openStaffSession(cookie), authenticated)
  assert.notEqual(session.sealStaffSession(authenticated), cookie, 'AES-GCM always uses a new IV')
  const corrupted = `${cookie.slice(0, -3)}${cookie.endsWith('AAA') ? 'BBB' : 'AAA'}`
  assert.equal(session.openStaffSession(corrupted), null)
  assert.equal(session.openStaffSession(cookie, now + 28800001), null)
  assert.equal(session.openStaffSession(session.sealStaffSession(anonymous), now + 900001), null)
  const attrs = session.staffCookieOptions(authenticated)
  assert.deepEqual({ httpOnly: attrs.httpOnly, secure: attrs.secure, sameSite: attrs.sameSite, path: attrs.path }, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
  assert.equal('domain' in attrs, false)
  assert.equal(session.STAFF_COOKIE_NAME.startsWith('__Host-'), true)
  assert.equal(session.staffRefreshOperationKey(authenticated), session.staffRefreshOperationKey({ ...authenticated, csrf: anonymous.csrf }), 'Lost response/concurrent refresh retain one operation key')
  assert.notEqual(session.staffRefreshOperationKey(authenticated), session.staffRefreshOperationKey({ ...authenticated, receipt: { ...receipt, refresh_token: 'new-proof-secret' } }))

  function request(headers = {}, path = '/api/staff/session/login') {
    return new Request(`https://support123.gridex.se${path}`, { method: 'POST', headers: { cookie: `${session.STAFF_COOKIE_NAME}=${cookie}`, 'x-gridex-staff-csrf': authenticated.csrf, ...headers }, body: '{}' })
  }
  assert.throws(() => boundary.requireStaffMutation(request()), (error) => error.code === 'staff_origin_invalid')
  for (const origin of ['null', 'https://gridex.se', 'https://support123.gridex.se/path', 'https://support123.gridex.se:444', 'https://user@support123.gridex.se', 'https://support123.gridex.se.evil.example']) {
    assert.throws(() => boundary.requireStaffMutation(request({ origin })), (error) => error.code === 'staff_origin_invalid')
  }
  assert.equal(boundary.requireStaffMutation(request({ origin: 'https://support123.gridex.se' })).kind, 'staff')
  assert.throws(() => boundary.requireStaffMutation(request({ origin: 'https://support123.gridex.se', 'x-gridex-staff-csrf': anonymous.csrf })), (error) => error.code === 'staff_csrf_invalid')
  assert.throws(() => boundary.requireStaffMutation(request({ origin: 'https://support123.gridex.se', cookie: `${session.STAFF_COOKIE_NAME}=${cookie}; ${session.STAFF_COOKIE_NAME}=${cookie}` })), (error) => error.code === 'staff_csrf_invalid')
  assert.throws(() => boundary.requireStaffProof(new Request('https://gridex.se/api/staff/customers')), (error) => error.code === 'staff_host_required')
  assert.throws(() => boundary.requireStaffProof(request({ cookie: 'customer_session=synthetic' })), (error) => error.code === 'staff_session_required')
  for (const status of ['mfa_required', 'password_change_required']) {
    const restricted = session.sealStaffSession(session.authenticatedStaffSession({ ...receipt, status }))
    assert.throws(() => boundary.requireStaffProof(request({ cookie: `${session.STAFF_COOKIE_NAME}=${restricted}` })), (error) => error.code === 'staff_auth_stage_required')
  }
  let cancelled = false
  let reads = 0
  const stream = new ReadableStream({ pull(controller) { reads++; controller.enqueue(new Uint8Array(8)) }, cancel() { cancelled = true } }, { highWaterMark: 0 })
  await assert.rejects(boundary.readStaffBody(new Request('https://support123.gridex.se/api/staff/upload', { method: 'POST', body: stream, duplex: 'half' }), 10), (error) => error.code === 'payload_too_large')
  assert.equal(cancelled, true)
  assert.equal(reads, 2, 'Bounded reader cancels unbounded chunked bodies at the limit')
  let abortedReader = false
  const stalled = new ReadableStream({ pull() { return new Promise(() => {}) }, cancel() { abortedReader = true } })
  const controller = new AbortController()
  const pendingRead = boundary.readStaffBody(new Response(stalled), 10, controller.signal)
  controller.abort(new Error('Operation deadline'))
  await assert.rejects(pendingRead, /Operation deadline/)
  assert.equal(abortedReader, true, 'Deadline also cancels stalled response body reads')
  console.log('Actual staff encrypted cookie, isolated config, login/recovery CSRF, auth-stage and bounded-body regressions passed')
} finally { hooks.deregister() }
