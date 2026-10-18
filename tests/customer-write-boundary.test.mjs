import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nativeRequire = createRequire(import.meta.url)
const verifiedUser = Object.freeze({
  id: '11111111-1111-4111-8111-111111111111',
  email: 'verified-customer@example.invalid',
  email_confirmed_at: '2026-10-01T09:00:00Z',
})
const verifiedIdentity = Object.freeze({
  userId: verifiedUser.id,
  email: verifiedUser.email,
  customerNumber: 'C-1001',
  externalCustomerId: 'tenant-customer-1',
})
const operationId = '33333333-3333-4333-8333-333333333333'

// Run actual route, validation, error mapping and bounded-reader modules using
// the repository's TypeScript VM convention. Only Auth, OPS and rate limiting
// are replaced; no production account, network, email or database is reachable.
function harness(route, { authenticated = true } = {}) {
  const state = { attempts: [], mutations: new Map(), priceReads: [], rateKeys: [] }
  class CustomerPortalAccessError extends Error {
    constructor() { super('Du behöver logga in.'); this.status = 401; this.code = 'unauthorized' }
  }
  const user = authenticated ? verifiedUser : null
  const sdk = { auth: { async getUser() { return { data: { user }, error: null } } } }
  const requireIdentity = () => {
    if (!user) throw new CustomerPortalAccessError()
    return { ...verifiedIdentity }
  }
  async function mutate(kind, input) {
    const identity = requireIdentity()
    assert.deepEqual({ ...input.identity }, identity, 'mutation uses the verified server identity')
    const key = `${kind}:${identity.userId}:${input.idempotencyKey}`
    state.attempts.push({ kind, input: structuredClone(input) })
    if (!state.mutations.has(key)) state.mutations.set(key, structuredClone(input))
    return { ok: true, status: 'accepted', reference: key }
  }
  const boundaries = {
    '@/lib/supabase/server': {
      createSupabaseServerActionClient: async () => sdk,
      createSupabaseServerClient: async () => sdk,
      getVerifiedServerUser: client => client.auth.getUser(),
    },
    '@/lib/customerPortal/service': {
      CustomerPortalAccessError,
      async getPortalSession() {
        requireIdentity()
        return { supabase: sdk, user }
      },
      async getOpsPortalIdentityForUser(client, actualUser) {
        assert.equal(client, sdk)
        assert.equal(actualUser, user)
        return requireIdentity()
      },
      async markCustomerNotificationsRead(input) {
        const identity = requireIdentity()
        await mutate('notifications', { identity, idempotencyKey: input.operationId, notificationIds: input.notificationIds })
        return { ok: true, opsSynced: true, localSynced: true, queued: false }
      },
    },
    '@/lib/ops/client': {
      isOpsError: value => load(resolve(root, 'lib/ops/errors.ts')).isOpsError(value),
      submitOpsCustomerSync: input => mutate('sync', input),
      submitOpsCustomerPortalSync: input => mutate('portal-sync', input),
      submitOpsCustomerProfileUpdate: input => mutate('profile-update', input),
      submitOpsCustomerMoveOut: input => mutate('move-out', input),
      async fetchOpsCurrentMarketPrice(resolutionId) {
        state.priceReads.push(resolutionId)
        return { resolution_id: resolutionId, price: 123.45, raw: {}, request_id: 'price-request-1', contract_schema_version: '2026-10-09.1' }
      },
    },
    '@/lib/customerPortal/syncReceipt': {
      async prepareCustomerSyncReceipt() { throw new Error('Profile-only sync must not create a consent receipt') },
      async completeCustomerSyncReceipt() { throw new Error('Profile-only sync must not complete a consent receipt') },
    },
    '@/lib/security/rateLimit': {
      clientIpFromHeaders: () => '192.0.2.10',
      async checkRateLimit(key) {
        state.rateKeys.push(key)
        return { allowed: true, resetAt: Date.now() + 60_000 }
      },
    },
  }
  const modules = new Map()
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports
    const cjsModule = { exports: {} }
    modules.set(file, cjsModule)
    const source = readFileSync(file, 'utf8')
    const compiled = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    vm.runInNewContext(compiled, {
      module: cjsModule, exports: cjsModule.exports,
      require(specifier) {
        if (Object.hasOwn(boundaries, specifier)) return boundaries[specifier]
        if (specifier === 'next/server') return nativeRequire('next/server.js')
        if (specifier === 'node:net') return { isIP: nativeRequire('node:net').isIP }
        if (specifier.startsWith('@/') || specifier.startsWith('.')) {
          const candidate = specifier.startsWith('@/')
            ? resolve(root, specifier.slice(2)) : resolve(dirname(file), specifier)
          const path = [candidate, `${candidate}.ts`, `${candidate}.js`].find(value => existsSync(value))
          if (!path) throw new Error(`Missing test dependency: ${specifier}`)
          return load(path)
        }
        throw new Error(`Unexpected boundary import: ${specifier}`)
      },
      Request, Response, Headers, ReadableStream, TextEncoder, TextDecoder,
      AbortSignal, AbortController, Uint8Array, ArrayBuffer, URL,
      Error, TypeError, RangeError, SyntaxError, crypto: webcrypto,
      console, setTimeout, clearTimeout,
      fetch() { throw new Error('Unexpected outbound network request') },
    }, { filename: file })
    return cjsModule.exports
  }
  const exports = load(resolve(root, route))
  return { state, POST: exports.POST, exports, loadModule: relative => load(resolve(root, relative)) }
}

test('customer errors preserve OPS retryability and request/correlation identifiers', async () => {
  const h = harness('lib/customerPortal/apiErrors.ts')
  const { OpsError } = h.loadModule('lib/ops/errors.ts')
  const error = new OpsError('OPS är tillfälligt otillgängligt.', 503, {
    error: {
      code: 'customer_sync_temporarily_unavailable',
      retryable: true,
      request_id: 'ops-request-123',
      correlation_id: 'ops-correlation-456',
    },
  })
  const response = h.exports.customerApiErrorResponse(error, {
    logLabel: 'synthetic-error-regression', fallbackMessage: 'Försök igen.',
  })
  const body = await response.json()
  assert.equal(response.status, 503)
  assert.equal(body.error.code, 'customer_sync_temporarily_unavailable')
  assert.equal(body.error.retryable, true)
  assert.equal(body.error.request_id, 'ops-request-123')
  assert.equal(body.error.correlation_id, 'ops-correlation-456')
  assert.equal(body.error.upstream_status, 503)
  assert.equal(response.headers.get('X-Request-Id'), 'ops-request-123')
})

test('customer rate-limit errors forward the OPS Retry-After without losing error identity', async () => {
  const h = harness('lib/customerPortal/apiErrors.ts')
  const { OpsError } = h.loadModule('lib/ops/errors.ts')
  const error = new OpsError('För många anrop.', 429, {
    code: 'rate_limited', retryable: true, retry_after_seconds: 25,
    request_id: 'ops-rate-request-123', correlation_id: 'ops-rate-correlation-456',
  })
  const response = h.exports.customerApiErrorResponse(error, {
    logLabel: 'synthetic-rate-regression', fallbackMessage: 'Försök igen senare.',
  })
  const body = await response.json()
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('Retry-After'), '25')
  assert.equal(body.error.retryable, true)
  assert.equal(body.error.request_id, 'ops-rate-request-123')
  assert.equal(body.error.correlation_id, 'ops-rate-correlation-456')
  assert.equal(response.headers.get('X-Request-Id'), 'ops-rate-request-123')
})

const routes = [
  { path: 'customer/sync', body: { profile: { phone: '+46701234567' } } },
  { path: 'customer-portal/sync', body: {} },
  { path: 'customer/profile-update', body: { profile: { invoice_email: 'invoice@example.invalid' } } },
  { path: 'customer/move-out', body: { move_out: { facility_reference: 'facility-opaque-1', requested_move_out_date: '2026-12-01' } } },
  { path: 'customer/notifications/read', body: { notification_ids: ['notification-opaque-1'] } },
  { path: 'market-price/current', public: true, body: { resolution_id: 'resolution-opaque-1' } },
]

function payload(route) {
  return {
    client_operation_id: operationId,
    // Untrusted caller identities must never override the authenticated user.
    user_id: '22222222-2222-4222-8222-222222222222',
    email: 'other-customer@example.invalid',
    customer_number: 'C-OTHER', external_customer_id: 'tenant-other-customer',
    ...route.body,
  }
}

function request(route, { body = JSON.stringify(payload(route)), headers = {} } = {}) {
  return new Request(`https://gridex.se/api/web/${route.path}`, {
    method: 'POST', body, ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
    headers: { Origin: 'https://gridex.se', 'Content-Type': 'application/json', ...headers },
  })
}

function noUpstreamWork(state) {
  assert.equal(state.mutations.size, 0, 'rejected input creates no OPS mutation')
  assert.equal(state.priceReads.length, 0, 'rejected input creates no OPS price read')
}

for (const route of routes) {
  const file = `app/api/web/${route.path}/route.ts`
  test(`${route.path} rejects an unsupported MIME type before upstream work`, async () => {
    const { POST, state } = harness(file)
    const response = await POST(request(route, { headers: { 'Content-Type': 'text/plain' } }))
    assert.equal(response.status, 415)
    noUpstreamWork(state)
  })

  test(`${route.path} rejects a cross-origin request before upstream work`, async () => {
    const { POST, state } = harness(file)
    const response = await POST(request(route, { headers: { Origin: 'https://untrusted.example.invalid' } }))
    assert.equal(response.status, 403)
    noUpstreamWork(state)
  })

  test(`${route.path} rejects and cancels streaming overflow without reading the full body`, async () => {
    const { POST, state } = harness(file)
    const encoded = new TextEncoder().encode(JSON.stringify({ ...payload(route), padding: 'x'.repeat(512 * 1024) }))
    let offset = 0
    let cancelled = false
    const body = new ReadableStream({
      pull(controller) {
        if (offset === encoded.length) { controller.close(); return }
        const end = Math.min(encoded.length, offset + 8192)
        controller.enqueue(encoded.subarray(offset, end))
        offset = end
      },
      cancel() { cancelled = true },
    }, { highWaterMark: 0 })
    const response = await POST(request(route, { body }))
    assert.equal(response.status, 413)
    assert.equal(cancelled, true, 'overflow cancels unread request bytes')
    assert.ok(offset < encoded.length, 'the unread remainder never enters memory')
    noUpstreamWork(state)
  })

  test(`${route.path} rejects malformed JSON before upstream work`, async () => {
    const { POST, state } = harness(file)
    const response = await POST(request(route, { body: '{"client_operation_id":' }))
    assert.equal(response.status, 400)
    noUpstreamWork(state)
  })

  if (route.public) {
    test(`${route.path} keeps the valid public price flow available`, async () => {
      const { POST, state } = harness(file, { authenticated: false })
      const response = await POST(request(route))
      assert.equal(response.status, 200)
      assert.deepEqual(state.priceReads, ['resolution-opaque-1'])
      assert.equal(state.mutations.size, 0)
    })
  } else {
    test(`${route.path} rejects an anonymous request before mutation`, async () => {
      const { POST, state } = harness(file, { authenticated: false })
      const response = await POST(request(route))
      assert.equal(response.status, 401)
      noUpstreamWork(state)
    })

    test(`${route.path} keeps verified identity and the same operation ID on retry`, async () => {
      const { POST, state } = harness(file)
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await POST(request(route))
        assert.equal(response.status, 200)
      }
      assert.equal(state.attempts.length, 2)
      assert.equal(state.mutations.size, 1, 'the OPS fixture commits one write for two identical operation IDs')
      for (const attempt of state.attempts) {
        assert.deepEqual(attempt.input.identity, verifiedIdentity)
        assert.equal(attempt.input.idempotencyKey, operationId)
        if (route.path === 'customer-portal/sync') {
          assert.equal(attempt.input.customerNumber, verifiedIdentity.customerNumber)
          assert.equal(attempt.input.externalCustomerId, verifiedIdentity.externalCustomerId)
          assert.equal(attempt.input.email, verifiedIdentity.email)
        }
      }
    })
  }
}
