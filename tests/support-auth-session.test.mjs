import assert from 'node:assert/strict'
import test from 'node:test'
import { generateKeyPairSync } from 'node:crypto'
import { readSupportAuthConfig, SUPPORT_AUTH_COOKIE_NAME } from '../apps/support/lib/auth-config.ts'
import { createSupportAuthClient, resolveSupportSession, writeSupportAuthCookies, SupportAuthError } from '../apps/support/lib/session.ts'
import { createStaffApiClient, StaffApiError } from '../lib/staff-api/client.ts'

const userId = '55555555-5555-4555-8555-555555555555'
const actorId = '11111111-1111-4111-8111-111111111111'
const accessToken = 'synthetic-transport-token-only-123456'
const binding = { actorUserId: actorId, bindingId: '88888888-8888-4888-8888-888888888888', bindingVersion: 1, localAuthSubject: userId, localAuthIssuer: 'https://ayiuxjlfazkjmmtlvhsl.supabase.co/auth/v1' }
const company = 'b3ad1bf6-fa45-41a6-8054-2e0862e82aca'
const publicAnon = ['e30', Buffer.from(JSON.stringify({ role: 'anon', ref: 'ayiuxjlfazkjmmtlvhsl' })).toString('base64url'), 'syntheticSignature'].join('.')
const authEnv = { GRIDEX_SUPPORT_SUPABASE_URL: 'https://ayiuxjlfazkjmmtlvhsl.supabase.co', GRIDEX_SUPPORT_SUPABASE_ANON_KEY: publicAnon, NODE_ENV: 'production' }
const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const apiConfig = { opsProjectRef: 'piidsfebjqjmnepdpnas', apiKey: 'synthetic-staff-full-api-key-123456', companyId: company, issuer: 'https://support123.gridex.se', audience: 'gridex-staff', keyId: 'test-key', privateKey, timeoutMs: 1000 }
const redirect = path => { throw new Error('REDIRECT ' + path) }
function boundary(overrides = {}) {
  const calls = []
  return { calls, deps: {
    authClient: async () => ({ auth: { getUser: async () => { calls.push('verified_getUser'); return { data: { user: { id: userId, email: 'test@example.invalid', user_metadata: {} } }, error: null } }, getSession: async () => { calls.push('bearer_transport'); return { data: { session: { access_token: accessToken } }, error: null } } } }),
    resolveIdentity: async (subject, token) => { calls.push(['resolve_identity', subject, token]); return binding },
    apiClient: (subject, resolvedBinding) => { calls.push(['api_subject', subject]); return createStaffApiClient(subject, { config: apiConfig, binding: resolvedBinding, fetchImpl: async (url, init) => {
      const proof = JSON.parse(Buffer.from(new Headers(init.headers).get('x-gridex-staff-assertion').split('.')[1], 'base64url'))
      calls.push(['network', url, proof.sub, proof.company_id])
      return new Response(JSON.stringify({ data: [], page: { limit: 1, offset: 0, returned: 0, has_more: false, next_cursor: null }, request_id: 'request-1', contract_schema_version: '2026-10-04.1' }), { headers: { 'content-type': 'application/json', 'x-gridex-project-ref': 'piidsfebjqjmnepdpnas' } })
    } }) }, redirect, ...overrides,
  } }
}

test('dedicated auth config rejects website fallback, other projects, service-role and secret keys', () => {
  assert.equal(readSupportAuthConfig(authEnv).url, authEnv.GRIDEX_SUPPORT_SUPABASE_URL)
  for (const env of [
    { NEXT_PUBLIC_SUPABASE_URL: authEnv.GRIDEX_SUPPORT_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: publicAnon },
    { ...authEnv, GRIDEX_SUPPORT_SUPABASE_URL: 'https://foreign.supabase.co' },
    { ...authEnv, GRIDEX_SUPPORT_SUPABASE_URL: 'https://piidsfebjqjmnepdpnas.supabase.co' },
    { ...authEnv, GRIDEX_SUPPORT_SUPABASE_ANON_KEY: ['e30', Buffer.from(JSON.stringify({ role: 'anon', ref: 'piidsfebjqjmnepdpnas' })).toString('base64url'), 'signature'].join('.') },
    { ...authEnv, GRIDEX_SUPPORT_SUPABASE_URL: 'https://ayiuxjlfazkjmmtlvhsl.supabase.co/path' },
    { ...authEnv, GRIDEX_SUPPORT_SUPABASE_ANON_KEY: 'sb_secret_not-public' },
    { ...authEnv, GRIDEX_SUPPORT_SUPABASE_ANON_KEY: ['e30', Buffer.from(JSON.stringify({ role: 'service_role', ref: 'ayiuxjlfazkjmmtlvhsl' })).toString('base64url'), 'signature'].join('.') },
  ]) assert.throws(() => readSupportAuthConfig(env), SupportAuthError)
  assert.equal(readSupportAuthConfig({ ...authEnv, GRIDEX_SUPPORT_SUPABASE_ANON_KEY: 'sb_publishable_synthetic_public_key_123456' }).cookieSecure, true)
})

test('verified production Auth user is bound to fresh staff assertion, configured Gridex company and limit1 authorization probe', async () => {
  const { calls, deps } = boundary()
  const session = await resolveSupportSession(deps)
  assert.equal(session.userId, actorId); assert.equal(session.localAuthUserId, userId); assert.equal(session.email, 'test@example.invalid'); assert.equal(typeof session.api.reply, 'function')
  assert.deepEqual(calls.slice(0, 4), ['verified_getUser', 'bearer_transport', ['resolve_identity', userId, accessToken], ['api_subject', actorId]])
  assert.deepEqual(calls[4], ['network', 'https://app.gridex.se/api/v1/staff/cases?limit=1', actorId, company])
})

test('missing or malformed verified subject redirects before assertion/API creation', async () => {
  for (const user of [null, { id: 'browser-invented' }]) {
    const { calls, deps } = boundary({ authClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) })
    await assert.rejects(() => resolveSupportSession(deps), /REDIRECT \/login$/)
    assert.deepEqual(calls, [])
  }
})

test('temporary-password flag refuses protected session before signing or authorization requests', async () => {
  const { calls, deps } = boundary({ authClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: userId, user_metadata: { must_change_password: true } } }, error: null }) } }) })
  await assert.rejects(() => resolveSupportSession(deps), /REDIRECT \/login\/update-password$/)
  assert.deepEqual(calls, [])
})

test('denied membership/scopes and revoked credential redirect to explicit access_denied without a retry', async () => {
  for (const status of [401, 403]) {
    let attempts = 0
    const { deps } = boundary({ apiClient: () => ({ listCases: async () => { attempts++; throw new StaffApiError(status, 'staff_membership_inactive') } }) })
    await assert.rejects(() => resolveSupportSession(deps), /REDIRECT \/login\?reason=access_denied$/)
    assert.equal(attempts, 1)
  }
})

test('unbound or revoked identity denies access before a Staff client is created, without an identity retry', async () => {
  for (const status of [401, 403]) {
    let attempts = 0; let clients = 0
    const { deps } = boundary({ resolveIdentity: async () => { attempts++; throw new StaffApiError(status, 'staff_identity_unbound') }, apiClient: () => { clients++; throw new Error('unexpected client') } })
    await assert.rejects(() => resolveSupportSession(deps), /REDIRECT \/login\?reason=access_denied$/)
    assert.equal(attempts, 1); assert.equal(clients, 0)
  }
  let clients = 0
  const unavailable = new StaffApiError(503, 'staff_api_unavailable')
  const { deps } = boundary({ resolveIdentity: async () => { throw unavailable }, apiClient: () => { clients++; throw new Error('unexpected client') } })
  await assert.rejects(() => resolveSupportSession(deps), error => error === unavailable)
  assert.equal(clients, 0)
})

test('resolver binding must match verified local identity; user_metadata cannot select a central actor or company', async () => {
  let clients = 0
  const { deps } = boundary({ resolveIdentity: async () => ({ ...binding, localAuthSubject: actorId }), apiClient: () => { clients++; throw new Error('unexpected client') } })
  await assert.rejects(() => resolveSupportSession(deps), /REDIRECT \/login\?reason=access_denied$/)
  assert.equal(clients, 0)
})

test('missing bearer never reaches resolver; transport failure stays unavailable instead of becoming signed out', async () => {
  for (const response of [{ data: { session: null }, error: null }, { data: { session: null }, error: { status: 503 } }]) {
    let resolutions = 0
    const { deps } = boundary({ authClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }), getSession: async () => response } }), resolveIdentity: async () => { resolutions++; return binding } })
    await assert.rejects(() => resolveSupportSession(deps), response.error ? SupportAuthError : /REDIRECT \/login$/)
    assert.equal(resolutions, 0)
  }
})

test('Auth and Staff API network/configuration failures propagate instead of masquerading as signed-out users', async () => {
  const { deps } = boundary({ authClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: { name: 'AuthRetryableFetchError', status: 503, message: 'private backend details' } }) } }) })
  await assert.rejects(() => resolveSupportSession(deps), e => e instanceof SupportAuthError && e.code === 'support_auth_unavailable' && !e.message.includes('private backend'))
  const { deps: network } = boundary({ authClient: async () => ({ auth: { getUser: async () => { throw new TypeError('private network') } } }) })
  await assert.rejects(() => resolveSupportSession(network), SupportAuthError)
  const apiFailure = new StaffApiError(503, 'staff_api_not_configured')
  const { deps: failed } = boundary({ apiClient: () => { throw apiFailure } })
  await assert.rejects(() => resolveSupportSession(failed), e => e === apiFailure)
})

test('auth cookie adapter is separate, host-only/httpOnly/secure/lax and supports complete chunk rotation', async () => {
  const writes = []; let sdkOptions
  const store = { getAll: () => [{ name: 'website-auth', value: 'foreign' }, { name: 'gridex-support-auth.0', value: 'chunk0' }, { name: 'gridex-support-auth.1', value: 'chunk1' }], set: (name, value, options) => writes.push({ name, value, options }) }
  const result = await createSupportAuthClient({ config: readSupportAuthConfig(authEnv), cookieStore: store, serverClient: (_url, _key, options) => { sdkOptions = options; return { marker: true } } })
  assert.equal(result.marker, true); assert.equal(sdkOptions.cookieOptions.name, SUPPORT_AUTH_COOKIE_NAME)
  assert.deepEqual(sdkOptions.cookies.getAll().map(x => x.name), ['gridex-support-auth.0', 'gridex-support-auth.1'])
  sdkOptions.cookies.setAll([{ name: 'gridex-support-auth.0', value: 'new', options: { maxAge: 3600, domain: '.gridex.se', httpOnly: false, secure: false } }, { name: 'gridex-support-auth.1', value: '', options: { maxAge: 0 } }])
  assert.equal(writes.length, 2)
  for (const row of writes) { assert.equal(row.options.httpOnly, true); assert.equal(row.options.secure, true); assert.equal(row.options.sameSite, 'lax'); assert.equal(row.options.path, '/'); assert.equal('domain' in row.options, false) }
  assert.equal(writes[1].options.maxAge, 0)
})

test('RSC adapter ignores only the known Next read-only cookie mutation error and surfaces all unexpected failures', () => {
  const update = [{ name: 'gridex-support-auth', value: 'new', options: {} }]
  writeSupportAuthCookies({ set: () => { throw new Error('Cookies can only be modified in a Server Action or Route Handler.') } }, update, true)
  assert.throws(() => writeSupportAuthCookies({ set: () => { throw new Error('database unavailable') } }, update, true), /database unavailable/)
  assert.throws(() => writeSupportAuthCookies({ set: () => undefined }, [{ name: 'website-auth', value: 'foreign', options: {} }], true), SupportAuthError)
})

test('installed Supabase SSR verifies getUser over its Auth transport instead of trusting cookie user claims', async () => {
  const { createServerClient } = await import('@supabase/ssr')
  const forgedCookieId = '99999999-9999-4999-8999-999999999999'
  const accessToken = ['e30', Buffer.from(JSON.stringify({ sub: forgedCookieId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'signature'].join('.')
  const sessionCookie = 'base64-' + Buffer.from(JSON.stringify({ access_token: accessToken, refresh_token: 'synthetic-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: forgedCookieId } })).toString('base64url')
  const authCalls = []
  const auth = await createSupportAuthClient({
    config: readSupportAuthConfig(authEnv),
    cookieStore: { getAll: () => [{ name: SUPPORT_AUTH_COOKIE_NAME, value: sessionCookie }], set: () => undefined },
    serverClient: (url, key, options) => createServerClient(url, key, { ...options, global: { fetch: async (url, init) => {
      authCalls.push([String(url), init.method])
      return new Response(JSON.stringify({ id: userId, aud: 'authenticated', role: 'authenticated', email: 'verified@example.invalid', app_metadata: {}, user_metadata: {}, identities: [], created_at: '2026-10-05T09:00:00Z' }), { headers: { 'content-type': 'application/json', 'x-gridex-project-ref': 'piidsfebjqjmnepdpnas' } })
    } } }),
  })
  const { deps, calls } = boundary({ authClient: async () => auth, resolveIdentity: async (subject, token) => { assert.equal(token, accessToken); calls.push(['resolve_identity', subject, token]); return binding } })
  const verified = await resolveSupportSession(deps)
  assert.equal(verified.userId, actorId); assert.equal(verified.localAuthUserId, userId); assert.notEqual(verified.userId, forgedCookieId)
  assert.equal(verified.email, 'verified@example.invalid')
  assert.deepEqual(authCalls, [['https://ayiuxjlfazkjmmtlvhsl.supabase.co/auth/v1/user', 'GET']])
  assert.deepEqual(calls[0], ['resolve_identity', userId, accessToken])
  assert.deepEqual(calls[1], ['api_subject', actorId])
  assert.equal(calls[2][2], actorId)
})
