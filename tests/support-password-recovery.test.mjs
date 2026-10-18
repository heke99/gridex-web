import assert from 'node:assert/strict'
import test from 'node:test'
import {
  requestSupportPasswordRecovery,
  acceptSupportPasswordRecovery,
} from '../apps/support/lib/password-recovery.ts'

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'staff@example.invalid', email_confirmed_at: '2026-10-18T12:00:00Z' }
const foreignUser = { id: '22222222-2222-4222-8222-222222222222', email: 'other@example.invalid', email_confirmed_at: '2026-10-18T12:00:00Z' }
const code = 'synthetic-native-pkce-code_123-456'
const accessToken = 'synthetic-fragment-access-token'
const refreshToken = 'synthetic-fragment-refresh-token'
const redirectTo = 'https://support123.gridex.se/auth/invitation?flow=password-recovery'
const privateMessage = 'provider-private-token-123 should never reach the browser'
let previousFetch
let unexpectedNetworkCalls = 0
test.before(() => {
  previousFetch = globalThis.fetch
  globalThis.fetch = async () => {
    unexpectedNetworkCalls += 1
    throw new Error('Unexpected outbound network request in recovery test')
  }
})
test.after(() => {
  globalThis.fetch = previousFetch
  assert.equal(unexpectedNetworkCalls, 0, 'the helper uses only its scoped Auth dependency')
})

function form(values = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}
function recoveryExchange() {
  return {
    data: {
      user: { ...user },
      session: { user: { ...user }, access_token: 'synthetic-access-token', refresh_token: 'synthetic-refresh-token' },
      redirectType: 'PASSWORD_RECOVERY',
    },
    error: null,
  }
}
function recoveryRefresh() {
  return {
    data: {
      user: { ...user },
      session: { user: { ...user }, access_token: 'synthetic-rotated-access-token', refresh_token: 'synthetic-rotated-refresh-token' },
    },
    error: null,
  }
}
function fixture(options = {}) {
  const state = { clients: 0, events: [], resetRequests: [], codes: [], accessChecks: [], refreshes: [], signOuts: [], redirects: [], forbidden: [], sessionLive: false }
  const authMethods = {
    async resetPasswordForEmail(email, settings) {
      state.events.push('reset')
      state.resetRequests.push({ email, settings: structuredClone(settings) })
      if (options.resetThrows) throw new Error(privateMessage)
      return options.resetResult ?? { data: {}, error: null }
    },
    async exchangeCodeForSession(value) {
      state.events.push('exchange')
      state.codes.push(value)
      // A failed SDK exchange can have partially changed local cookie state.
      state.sessionLive = true
      if (options.exchangeThrows) throw new Error(privateMessage)
      return Object.hasOwn(options, 'exchangeResult') ? options.exchangeResult : recoveryExchange()
    },
    async getUser(token) {
      if (token !== undefined) {
        state.events.push('verified-access-user')
        state.accessChecks.push(token)
        if (options.accessUserThrows) throw new Error(privateMessage)
        return options.accessUserResult ?? { data: { user: { ...user } }, error: null }
      }
      state.events.push('verified-user')
      if (options.userThrows) throw new Error(privateMessage)
      return options.userResult ?? { data: { user: { ...user } }, error: null }
    },
    async refreshSession(settings) {
      state.events.push('refresh')
      state.refreshes.push(structuredClone(settings))
      state.sessionLive = true
      if (options.refreshThrows) throw new Error(privateMessage)
      return Object.hasOwn(options, 'refreshResult') ? options.refreshResult : recoveryRefresh()
    },
    async signOut(settings) {
      state.events.push('sign-out')
      state.signOuts.push(structuredClone(settings))
      if (options.signOutThrows) throw new Error(privateMessage)
      state.sessionLive = false
      return { error: null }
    },
  }
  const auth = new Proxy(authMethods, {
    get(target, property) {
      if (Object.hasOwn(target, property)) return target[property]
      state.forbidden.push(String(property))
      throw new Error(`Unexpected password, account or business operation: ${String(property)}`)
    },
  })
  return { state, deps: {
    async authClient() {
      state.clients += 1
      state.events.push('client')
      if (options.clientThrows) throw new Error(privateMessage)
      return { auth }
    },
    redirect(path) {
      state.redirects.push(path)
      throw new Error('REDIRECT ' + path)
    },
  } }
}
function safeError(result) {
  assert.equal(typeof result?.error, 'string')
  assert.ok(result.error.length > 0)
  assert.equal(result.success, undefined)
  assert.equal(JSON.stringify(result).includes('provider-private-token-123'), false)
  assert.equal(JSON.stringify(result).includes('synthetic-access-token'), false)
  assert.equal(JSON.stringify(result).includes('synthetic-refresh-token'), false)
  assert.equal(JSON.stringify(result).includes(accessToken), false)
  assert.equal(JSON.stringify(result).includes(refreshToken), false)
  assert.equal(JSON.stringify(result).includes('synthetic-rotated-'), false)
}
function noBusinessChanges(state) {
  assert.deepEqual(state.forbidden, [])
}

test('password recovery validates email syntax and the 320-character bound before Auth access', async () => {
  for (const email of [undefined, '', '   ', 'not-an-email', 'staff@example.invalid\nInjected: header', 'a'.repeat(309) + '@example.com']) {
    const f = fixture()
    const result = await requestSupportPasswordRecovery(form(email === undefined ? {} : { email }), f.deps)
    safeError(result)
    assert.equal(f.state.clients, 0, `invalid email ${String(email).slice(0, 35)}`)
    assert.deepEqual(f.state.resetRequests, [])
    noBusinessChanges(f.state)
  }
})

test('password recovery normalizes email and always uses the fixed Support123 callback', async () => {
  const f = fixture()
  const result = await requestSupportPasswordRecovery(form({
    email: '  Staff.Name@Example.Invalid  ', redirectTo: 'https://untrusted.example.invalid', next: '//untrusted.example.invalid',
  }), f.deps)
  assert.equal(typeof result.success, 'string')
  assert.equal(result.error, undefined)
  assert.deepEqual(f.state.resetRequests, [{ email: 'staff.name@example.invalid', settings: { redirectTo } }])
  assert.deepEqual(f.state.redirects, [])
  noBusinessChanges(f.state)
})

test('the generic recovery confirmation allows opening the email link in another browser', async () => {
  const f = fixture()
  const result = await requestSupportPasswordRecovery(form({ email: user.email }), f.deps)
  assert.equal(typeof result.success, 'string')
  assert.doesNotMatch(result.success, /samma webbläsare/i)
})

test('an email at the documented 320-character maximum can request recovery', async () => {
  const f = fixture()
  const email = 'a'.repeat(308) + '@example.com'
  assert.equal(email.length, 320)
  assert.equal(typeof (await requestSupportPasswordRecovery(form({ email }), f.deps)).success, 'string')
  assert.equal(f.state.resetRequests[0].email, email)
})

test('account-existence failures return exactly the same generic result as a successful recovery request', async () => {
  const input = form({ email: user.email })
  const successful = fixture()
  const expected = await requestSupportPasswordRecovery(input, successful.deps)
  assert.equal(typeof expected.success, 'string')
  for (const [status, errorCode] of [[400, 'email_not_found'], [403, 'user_banned'], [404, 'user_not_found'], [422, 'email_exists']]) {
    const f = fixture({ resetResult: { data: null, error: { status, code: errorCode, message: privateMessage } } })
    assert.deepEqual(await requestSupportPasswordRecovery(input, f.deps), expected)
    noBusinessChanges(f.state)
  }
})

test('Auth throttling remains a sanitized recovery error instead of a false sent confirmation', async () => {
  const f = fixture({ resetResult: { data: null, error: { status: 429, code: 'over_email_send_rate_limit', message: privateMessage } } })
  safeError(await requestSupportPasswordRecovery(form({ email: user.email }), f.deps))
  assert.equal(f.state.resetRequests.length, 1)
  noBusinessChanges(f.state)
})

test('Auth delivery, network and configuration failures remain sanitized request errors', async () => {
  for (const options of [
    { resetResult: { data: null, error: { status: 500, message: privateMessage } } },
    { resetResult: { data: null, error: { status: 503, message: privateMessage } } },
    { resetThrows: true }, { clientThrows: true },
  ]) {
    const f = fixture(options)
    safeError(await requestSupportPasswordRecovery(form({ email: user.email }), f.deps))
    noBusinessChanges(f.state)
  }
})

test('recovery acceptance rejects missing, blank or oversized PKCE code before creating an Auth client', async () => {
  for (const value of [undefined, '', '   ', 'a'.repeat(16_385)]) {
    const f = fixture()
    const result = await acceptSupportPasswordRecovery(form(value === undefined ? {} : { code: value }), f.deps)
    safeError(result)
    assert.equal(f.state.clients, 0)
    assert.deepEqual(f.state.codes, [])
    assert.deepEqual(f.state.signOuts, [])
    assert.deepEqual(f.state.redirects, [])
  }
})

test('native PKCE recovery verifies the exchanged identity before redirecting only to password update', async () => {
  const f = fixture()
  await assert.rejects(() => acceptSupportPasswordRecovery(form({
    code, type: 'invite', invitation_token: 'untrusted-invitation', password: 'do-not-write-this',
    role: 'admin', next: 'https://untrusted.example.invalid', redirectTo: '/',
  }), f.deps), /REDIRECT \/login\/update-password$/)
  assert.deepEqual(f.state.events, ['client', 'exchange', 'verified-user'])
  assert.deepEqual(f.state.codes, [code])
  assert.deepEqual(f.state.redirects, ['/login/update-password'])
  assert.deepEqual(f.state.signOuts, [])
  assert.equal(f.state.sessionLive, true)
  noBusinessChanges(f.state)
})

for (const purpose of [undefined, '', 'SIGNED_IN', 'INITIAL_SESSION', 'invite', 'recovery']) {
  test(`a PKCE exchange purpose ${JSON.stringify(purpose)} cannot authorize password recovery`, async () => {
    const exchanged = recoveryExchange()
    exchanged.data.redirectType = purpose
    const f = fixture({ exchangeResult: exchanged })
    // A browser-supplied type cannot replace the SDK's PKCE verifier marker.
    const result = await acceptSupportPasswordRecovery(form({ code, type: 'PASSWORD_RECOVERY', flow: 'password-recovery' }), f.deps)
    safeError(result)
    assert.deepEqual(f.state.signOuts, [{ scope: 'local' }])
    assert.deepEqual(f.state.redirects, [])
    assert.equal(f.state.sessionLive, false)
    noBusinessChanges(f.state)
  })
}

test('missing exchanged user or session cannot become a recovery session and clears local state', async () => {
  for (const part of ['user', 'session']) {
    for (const missing of [null, undefined]) {
      const exchanged = recoveryExchange()
      exchanged.data[part] = missing
      const f = fixture({ exchangeResult: exchanged })
      safeError(await acceptSupportPasswordRecovery(form({ code }), f.deps))
      assert.deepEqual(f.state.signOuts, [{ scope: 'local' }])
      assert.deepEqual(f.state.redirects, [])
      assert.equal(f.state.sessionLive, false)
      noBusinessChanges(f.state)
    }
  }
})

test('a native exchange error or throw clears only this local session and returns a sanitized error', async () => {
  for (const options of [
    { exchangeResult: { data: { user: null, session: null }, error: { status: 400, message: privateMessage } } },
    { exchangeThrows: true },
  ]) {
    const f = fixture(options)
    safeError(await acceptSupportPasswordRecovery(form({ code }), f.deps))
    assert.deepEqual(f.state.signOuts, [{ scope: 'local' }])
    assert.deepEqual(f.state.redirects, [])
    assert.equal(f.state.sessionLive, false)
    noBusinessChanges(f.state)
  }
})

test('foreign, missing or unverifiable recovered identities are rejected and signed out locally', async () => {
  for (const options of [
    { userResult: { data: { user: foreignUser }, error: null } },
    { userResult: { data: { user: null }, error: null } },
    { userResult: { data: { user }, error: { status: 401, message: privateMessage } } },
    { userResult: { data: { user: null }, error: { status: 503, message: privateMessage } } },
    { userThrows: true },
  ]) {
    const f = fixture(options)
    safeError(await acceptSupportPasswordRecovery(form({ code }), f.deps))
    assert.deepEqual(f.state.signOuts, [{ scope: 'local' }])
    assert.deepEqual(f.state.redirects, [])
    assert.equal(f.state.sessionLive, false)
    noBusinessChanges(f.state)
  }
})

test('an Auth client failure cannot redirect into password update or leak configuration details', async () => {
  const f = fixture({ clientThrows: true })
  safeError(await acceptSupportPasswordRecovery(form({ code }), f.deps))
  assert.deepEqual(f.state.codes, [])
  assert.deepEqual(f.state.signOuts, [])
  assert.deepEqual(f.state.redirects, [])
})

test('an unsuccessful local cleanup never turns a rejected recovery into success', async () => {
  const exchanged = recoveryExchange()
  exchanged.data.redirectType = 'SIGNED_IN'
  const f = fixture({ exchangeResult: exchanged, signOutThrows: true })
  safeError(await acceptSupportPasswordRecovery(form({ code }), f.deps))
  assert.deepEqual(f.state.signOuts, [{ scope: 'local' }])
  assert.deepEqual(f.state.redirects, [])
  noBusinessChanges(f.state)
})

test('fragment recovery verifies access, rotates native refresh and verifies the resulting session without PKCE', async () => {
  const f = fixture()
  await assert.rejects(() => acceptSupportPasswordRecovery(form({
    access_token: accessToken, refresh_token: refreshToken,
    password: 'do-not-update-this', role: 'admin', next: 'https://untrusted.example.invalid',
  }), f.deps), /REDIRECT \/login\/update-password$/)
  assert.deepEqual(f.state.events, ['client', 'verified-access-user', 'refresh', 'verified-user'])
  assert.deepEqual(f.state.accessChecks, [accessToken])
  assert.deepEqual(f.state.refreshes, [{ refresh_token: refreshToken }])
  assert.deepEqual(f.state.codes, [])
  assert.deepEqual(f.state.redirects, ['/login/update-password'])
  assert.deepEqual(f.state.signOuts, [])
  assert.equal(f.state.sessionLive, true)
  noBusinessChanges(f.state)
})

test('fragment recovery accepts both tokens at the 16384-character limit', async () => {
  const f = fixture()
  const access = 'a'.repeat(16_384)
  const refresh = 'r'.repeat(16_384)
  await assert.rejects(() => acceptSupportPasswordRecovery(form({ access_token: access, refresh_token: refresh }), f.deps), /REDIRECT \/login\/update-password$/)
  assert.deepEqual(f.state.accessChecks, [access])
  assert.deepEqual(f.state.refreshes, [{ refresh_token: refresh }])
  assert.deepEqual(f.state.codes, [])
  noBusinessChanges(f.state)
})

test('fragment recovery rejects incomplete, blank, whitespace or oversized tokens before Auth access', async () => {
  for (const values of [
    { access_token: accessToken }, { refresh_token: refreshToken },
    { access_token: '', refresh_token: refreshToken }, { access_token: accessToken, refresh_token: '' },
    { access_token: '   ', refresh_token: refreshToken }, { access_token: accessToken, refresh_token: '   ' },
    { access_token: 'embedded whitespace', refresh_token: refreshToken }, { access_token: accessToken, refresh_token: 'embedded\nwhitespace' },
    { access_token: 'a'.repeat(16_385), refresh_token: refreshToken }, { access_token: accessToken, refresh_token: 'r'.repeat(16_385) },
  ]) {
    const f = fixture()
    safeError(await acceptSupportPasswordRecovery(form(values), f.deps))
    assert.equal(f.state.clients, 0)
    assert.deepEqual(f.state.accessChecks, [])
    assert.deepEqual(f.state.refreshes, [])
    assert.deepEqual(f.state.signOuts, [])
    assert.deepEqual(f.state.redirects, [])
    noBusinessChanges(f.state)
  }
})

test('mixed PKCE code and fragment credentials are rejected before an Auth client or session mutation', async () => {
  for (const values of [
    { code, access_token: accessToken, refresh_token: refreshToken },
    { code, access_token: accessToken }, { code, refresh_token: refreshToken },
  ]) {
    const f = fixture()
    safeError(await acceptSupportPasswordRecovery(form(values), f.deps))
    assert.equal(f.state.clients, 0)
    assert.deepEqual(f.state.codes, [])
    assert.deepEqual(f.state.accessChecks, [])
    assert.deepEqual(f.state.refreshes, [])
    assert.deepEqual(f.state.signOuts, [])
    assert.deepEqual(f.state.redirects, [])
    noBusinessChanges(f.state)
  }
})

test('fragment access-token verification must return a confirmed user before refresh is attempted', async () => {
  for (const options of [
    { accessUserResult: { data: { user: null }, error: null } },
    { accessUserResult: { data: { user: { ...user, email_confirmed_at: null } }, error: null } },
    { accessUserResult: { data: { user: { ...user, email_confirmed_at: undefined } }, error: null } },
    { accessUserResult: { data: { user }, error: { status: 401, message: privateMessage } } },
    { accessUserResult: { data: { user: null }, error: { status: 503, message: privateMessage } } },
    { accessUserThrows: true },
  ]) {
    const f = fixture(options)
    safeError(await acceptSupportPasswordRecovery(form({ access_token: accessToken, refresh_token: refreshToken }), f.deps))
    assert.deepEqual(f.state.accessChecks, [accessToken])
    assert.deepEqual(f.state.refreshes, [])
    assert.deepEqual(f.state.codes, [])
    assert.deepEqual(f.state.signOuts, [{ scope: 'local' }])
    assert.deepEqual(f.state.redirects, [])
    assert.equal(f.state.sessionLive, false)
    noBusinessChanges(f.state)
  }
})

test('fragment refresh rejects missing session/user and mismatched access/refresh identities', async () => {
  const invalid = []
  for (const part of ['user', 'session']) {
    const refreshed = recoveryRefresh()
    refreshed.data[part] = null
    invalid.push(refreshed)
  }
  const foreignRefreshUser = recoveryRefresh()
  foreignRefreshUser.data.user = { ...foreignUser }
  invalid.push(foreignRefreshUser)
  const foreignSessionUser = recoveryRefresh()
  foreignSessionUser.data.session.user = { ...foreignUser }
  invalid.push(foreignSessionUser)
  const entirelyForeign = recoveryRefresh()
  entirelyForeign.data.user = { ...foreignUser }
  entirelyForeign.data.session.user = { ...foreignUser }
  invalid.push(entirelyForeign)
  for (const refreshResult of invalid) {
    const f = fixture({ refreshResult })
    safeError(await acceptSupportPasswordRecovery(form({ access_token: accessToken, refresh_token: refreshToken }), f.deps))
    assert.deepEqual(f.state.accessChecks, [accessToken])
    assert.deepEqual(f.state.refreshes, [{ refresh_token: refreshToken }])
    assert.deepEqual(f.state.codes, [])
    assert.deepEqual(f.state.signOuts, [{ scope: 'local' }])
    assert.deepEqual(f.state.redirects, [])
    assert.equal(f.state.sessionLive, false)
    noBusinessChanges(f.state)
  }
})

test('fragment refresh SDK errors and throws clear only local state and never expose token details', async () => {
  for (const options of [
    { refreshResult: { data: { user: null, session: null }, error: { status: 401, message: privateMessage } } },
    { refreshResult: { data: { user: null, session: null }, error: { status: 503, message: privateMessage } } },
    { refreshThrows: true },
  ]) {
    const f = fixture(options)
    safeError(await acceptSupportPasswordRecovery(form({ access_token: accessToken, refresh_token: refreshToken }), f.deps))
    assert.deepEqual(f.state.refreshes, [{ refresh_token: refreshToken }])
    assert.deepEqual(f.state.signOuts, [{ scope: 'local' }])
    assert.deepEqual(f.state.codes, [])
    assert.deepEqual(f.state.redirects, [])
    assert.equal(f.state.sessionLive, false)
    noBusinessChanges(f.state)
  }
})

test('the canonical getUser after fragment refresh must verify the same recovered identity', async () => {
  for (const options of [
    { userResult: { data: { user: foreignUser }, error: null } },
    { userResult: { data: { user: null }, error: null } },
    { userResult: { data: { user }, error: { status: 401, message: privateMessage } } },
    { userResult: { data: { user: null }, error: { status: 503, message: privateMessage } } },
    { userThrows: true },
  ]) {
    const f = fixture(options)
    safeError(await acceptSupportPasswordRecovery(form({ access_token: accessToken, refresh_token: refreshToken }), f.deps))
    assert.deepEqual(f.state.events, ['client', 'verified-access-user', 'refresh', 'verified-user', 'sign-out'])
    assert.deepEqual(f.state.signOuts, [{ scope: 'local' }])
    assert.deepEqual(f.state.codes, [])
    assert.deepEqual(f.state.redirects, [])
    assert.equal(f.state.sessionLive, false)
    noBusinessChanges(f.state)
  }
})
