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
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'customer@example.invalid' }
const identity = { userId: user.id, email: user.email, customerNumber: 'C-1001', externalCustomerId: 'tenant-customer-1' }
const operationId = '33333333-3333-4333-8333-333333333333'
const observedAt = '2026-10-18T12:30:00.000Z'

function consent() {
  return {
    document_reference: 'poa-document-opaque-1', scope: ['supplier_switch', 'facility_information_lookup'],
    accepted: true, accepted_at: '2020-01-01T00:00:00.000Z',
    signer_name: 'Synthetic Customer', signer_identity_number: '199001011234', method: 'website_acceptance',
    ip_address: '192.0.2.123', user_agent: 'Untrusted body claim',
  }
}

// Exercise the actual route, receipt, JSON reader, validator, hashing and IP
// extraction. Replace only Auth, outbound OPS and Supabase storage. Each test
// gets its own module graph, clock, credentials and in-memory PostgREST adapter.
function fixture({ failRead = false, failInsert = false, opsFailures = 0 } = {}) {
  const state = { rows: new Map(), attempts: [], commits: new Map(), now: Date.parse(observedAt), opsFailures }
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [state.now])) }
    static now() { return state.now }
  }
  class CustomerPortalAccessError extends Error {}
  class Query {
    constructor() { this.filters = []; this.columns = '*' }
    select(columns = '*') { this.columns = columns; return this }
    eq(key, value) { this.filters.push(row => row[key] === value); return this }
    update(patch) { this.patch = patch; return this }
    insert(row) { this.inserted = structuredClone(row); return this }
    async maybeSingle() { return this.execute(true) }
    then(resolvePromise, rejectPromise) { return this.execute(false).then(resolvePromise, rejectPromise) }
    async execute(single) {
      if (this.inserted) {
        if (failInsert) return { data: null, error: { code: 'XX000', message: 'Synthetic insert failure' } }
        const key = this.inserted.idempotency_key
        if (state.rows.has(key)) return { data: null, error: { code: '23505', message: 'duplicate' } }
        state.rows.set(key, { id: 'receipt-1', ...this.inserted })
        return { data: null, error: null }
      }
      if (failRead) return { data: null, error: { code: 'XX000', message: 'Synthetic read failure' } }
      const rows = [...state.rows.values()].filter(row => this.filters.every(predicate => predicate(row)))
      if (this.patch) for (const row of rows) Object.assign(row, structuredClone(this.patch))
      const projected = rows.map(row => this.columns === '*' ? structuredClone(row)
        : Object.fromEntries(this.columns.split(',').map(key => [key, structuredClone(row[key])])))
      return { data: single ? projected[0] ?? null : projected, error: null }
    }
  }
  const storage = { from(table) { assert.equal(table, 'customer_portal_write_outbox'); return new Query() } }
  const authClient = { auth: { async getUser() { return { data: { user }, error: null } } } }
  const modules = new Map()
  const boundaries = {
    '@supabase/supabase-js': {
      createClient(url, key) {
        assert.equal(url, 'https://receipt-fixture.invalid')
        assert.equal(key, 'synthetic-offline-key')
        return storage
      },
    },
    '@/lib/supabase/server': { createSupabaseServerActionClient: async () => authClient },
    '@/lib/customerPortal/service': {
      CustomerPortalAccessError,
      async getOpsPortalIdentityForUser(client, currentUser) {
        assert.equal(client, authClient)
        assert.equal(currentUser, user)
        return { ...identity }
      },
    },
    '@/lib/ops/client': {
      isOpsError: error => load(resolve(root, 'lib/ops/errors.ts')).isOpsError(error),
      async submitOpsCustomerSync(input) {
        state.attempts.push(structuredClone(input))
        if (state.opsFailures > 0) {
          state.opsFailures -= 1
          const { OpsError } = load(resolve(root, 'lib/ops/errors.ts'))
          throw new OpsError('Synthetic upstream outage', 503, { code: 'ops_temporarily_unavailable', retryable: true })
        }
        const key = `${input.identity.userId}:${input.idempotencyKey}`
        if (!state.commits.has(key)) state.commits.set(key, structuredClone(input))
        return { ok: true, status: 'accepted', reference: 'sync-opaque-1' }
      },
    },
  }
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }
    modules.set(file, module)
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    vm.runInNewContext(compiled, {
      module, exports: module.exports,
      require(specifier) {
        if (Object.hasOwn(boundaries, specifier)) return boundaries[specifier]
        if (specifier === 'next/server') return nativeRequire('next/server.js')
        if (specifier === 'node:net') return { isIP: nativeRequire('node:net').isIP }
        if (specifier === 'node:crypto') return { createHash: nativeRequire('node:crypto').createHash }
        if (specifier.startsWith('@/') || specifier.startsWith('.')) {
          const candidate = specifier.startsWith('@/') ? resolve(root, specifier.slice(2)) : resolve(dirname(file), specifier)
          const path = [candidate, `${candidate}.ts`, `${candidate}.js`].find(value => existsSync(value))
          if (path) return load(path)
        }
        throw new Error(`Unexpected boundary import: ${specifier}`)
      },
      Request, Response, Headers, ReadableStream, TextEncoder, TextDecoder,
      AbortSignal, AbortController, Uint8Array, ArrayBuffer, URL, Date: Clock,
      Error, TypeError, RangeError, SyntaxError, crypto: webcrypto, console, setTimeout, clearTimeout,
      process: { env: { VERCEL: '1', NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://receipt-fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-offline-key' } },
      fetch() { throw new Error('Unexpected outbound network request') },
    }, { filename: file })
    return module.exports
  }
  return { ...load(resolve(root, 'app/api/web/customer/sync/route.ts')), state }
}

function request(powerOfAttorney = consent(), { headers = {}, profile } = {}) {
  return new Request('https://gridex.se/api/web/customer/sync', {
    method: 'POST',
    headers: {
      Origin: 'https://gridex.se', 'Content-Type': 'application/json',
      'X-Vercel-Forwarded-For': '203.0.113.15', 'X-Forwarded-For': '198.51.100.200',
      'User-Agent': 'Trusted first browser', ...headers,
    },
    body: JSON.stringify({
      client_operation_id: operationId, power_of_attorney: powerOfAttorney, profile,
      user_id: '22222222-2222-4222-8222-222222222222', customer_number: 'C-OTHER',
    }),
  })
}

test('customer sync sends complete explicit POA with server-observed IP, browser and timestamp', async () => {
  const { POST, state } = fixture()
  assert.equal((await POST(request())).status, 200)
  assert.equal(state.attempts.length, 1)
  const submission = state.attempts[0]
  assert.deepEqual(submission.identity, identity)
  assert.equal(submission.idempotencyKey, operationId)
  assert.deepEqual(submission.powerOfAttorney, {
    ...consent(), accepted_at: observedAt, ip_address: '203.0.113.15', user_agent: 'Trusted first browser',
  })
  assert.equal(state.rows.size, 1)
  const receipt = state.rows.values().next().value
  assert.equal(receipt.user_id, user.id)
  assert.equal(receipt.status, 'completed')
  assert.equal(receipt.payload.power_of_attorney.accepted_at, observedAt)
})

test('a route retry after an OPS outage preserves the original POA body and operation key', async () => {
  const { POST, state } = fixture({ opsFailures: 1 })
  assert.equal((await POST(request())).status, 503)
  assert.equal(state.rows.values().next().value.status, 'pending')
  state.now += 30 * 60_000
  assert.equal((await POST(request(consent(), {
    headers: { 'X-Vercel-Forwarded-For': '198.51.100.42', 'User-Agent': 'Changed retry browser' },
  }))).status, 200)
  assert.equal(state.attempts.length, 2)
  assert.deepEqual(state.attempts[1], state.attempts[0])
  assert.equal(state.rows.size, 1)
  assert.equal(state.commits.size, 1)
  assert.equal(state.rows.values().next().value.status, 'completed')
})

test('missing or coerced explicit POA acceptance never reaches OPS, even alongside a valid profile', async () => {
  for (const accepted of [undefined, false, 'true', 1, null]) {
    const { POST, state } = fixture()
    const response = await POST(request({ ...consent(), accepted }, { profile: { phone: '+46701234567' } }))
    assert.equal(response.status, 400, `accepted=${String(accepted)}`)
    assert.equal(state.attempts.length, 0)
    assert.equal(state.rows.size, 0)
  }
})

test('browser claims of completed BankID or imported signature methods are rejected before OPS', async () => {
  for (const method of ['bankid', 'electronic_signature', 'manual_signature']) {
    const { POST, state } = fixture()
    assert.equal((await POST(request({ ...consent(), method }))).status, 400, method)
    assert.equal(state.attempts.length, 0)
    assert.equal(state.rows.size, 0)
  }
})

test('invalid signer or scope cannot silently disappear when a valid profile is also supplied', async () => {
  const invalid = [
    { ...consent(), signer_name: '' }, { ...consent(), signer_identity_number: '' },
    { ...consent(), scope: [] }, { ...consent(), scope: ['supplier_switch', 'unknown'] },
  ]
  for (const poa of invalid) {
    const { POST, state } = fixture()
    assert.equal((await POST(request(poa, { profile: { phone: '+46701234567' } }))).status, 400)
    assert.equal(state.attempts.length, 0)
    assert.equal(state.rows.size, 0)
  }
})

test('receipt storage failures prevent the route from writing consent to OPS', async () => {
  for (const options of [{ failRead: true }, { failInsert: true }]) {
    const { POST, state } = fixture(options)
    assert.equal((await POST(request())).status, 503)
    assert.equal(state.attempts.length, 0)
    assert.equal(state.commits.size, 0)
    assert.equal(state.rows.size, 0)
  }
})

test('forged ordinary forwarding headers cannot replace a missing trusted Vercel IP', async () => {
  const { POST, state } = fixture()
  const response = await POST(request(consent(), {
    headers: { 'X-Vercel-Forwarded-For': '', 'X-Forwarded-For': '198.51.100.200', 'X-Real-IP': '198.51.100.201' },
  }))
  assert.equal(response.status, 503)
  assert.equal(state.attempts.length, 0)
  assert.equal(state.rows.size, 0)
})

test('a reused operation ID with a different signed document cannot reach OPS again', async () => {
  const { POST, state } = fixture()
  assert.equal((await POST(request())).status, 200)
  assert.equal((await POST(request({ ...consent(), document_reference: 'different-document' }))).status, 409)
  assert.equal(state.attempts.length, 1)
  assert.equal(state.rows.size, 1)
})
