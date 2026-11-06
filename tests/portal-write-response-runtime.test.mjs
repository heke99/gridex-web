import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

// Execute the real client, transport, schema validators and first-link service.
// Only HTTP, local persistence and the offline assertion signer are replaced.
registerHooks({ resolve(specifier, context, nextResolve) {
  const seams = {
    'server-only': 'export {}',
    '@/lib/supabase/service': 'export const supabaseService = { from: (...args) => globalThis.portalWriteFixture.from(...args) };',
    '@/lib/ops/customerAssertion': 'export const signCustomerAssertion = () => "offline-customer-assertion";',
  }
  if (specifier in seams) return { url: 'data:text/javascript,' + encodeURIComponent(seams[specifier]), shortCircuit: true }
  return nextResolve(specifier, context)
} })
process.env.GRIDEX_API_KEY = 'offline_portal_write_regression_key'
process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
process.env.VERCEL_ENV = 'production'

const { GRIDEX_CUSTOMER_PORTAL_API_CONTRACT_VERSION: version } = await import('../lib/ops/contract.ts')
const { responseObject, submitOpsCustomerSync, submitOpsCustomerPortalSync, mapCustomerWriteResult } = await import('../lib/ops/client/portal.ts')
const { linkExistingPortalCustomer } = await import('../lib/customerPortal/existingCustomerLink.ts')
const id = '11111111-1111-4111-8111-111111111111'
const identity = { userId: id, email: 'owner@example.com', customerNumber: 'C-1001', externalCustomerId: 'original-external' }
const envelope = data => ({ data, request_id: 'offline-request', correlation_id: 'offline-correlation', contract_schema_version: version })
const customer = { status: 'synced', customer_reference: 'customer-ref', customer_number: 'C-1001', external_customer_id: 'original-external', summary: {} }
const portal = { status: 'linked', access_granted: true, portal_role: 'owner', customer_number: 'C-1001', external_customer_id: 'original-external', auth_user_id: id, customer_portal_user_id: id }

function fixture(overrides = {}) {
  const f = { profile: null, writes: [], requests: [],
    from(table) {
      assert.equal(table, 'customer_profiles')
      const predicates = []; let patch, insert = false
      return {
        select() { return this }, eq(k,v) { predicates.push([k,v]); return this }, is(k,v) { predicates.push([k,v]); return this },
        update(value) { patch = value; return this },
        upsert(rows, options) { assert.equal(options.ignoreDuplicates, true); patch = rows[0]; insert = true; return this },
        async maybeSingle() {
          if (!patch) return { data: f.profile && structuredClone(f.profile), error: null }
          if (insert ? f.profile : !f.profile || !predicates.every(([k,v]) => (f.profile[k] ?? null) === v)) return { data: null, error: null }
          f.writes.push(structuredClone(patch)); f.profile = { ...f.profile, ...patch }
          return { data: { user_id: id }, error: null }
        },
      }
    },
  }
  globalThis.portalWriteFixture = f
  globalThis.fetch = async (url, init) => {
    const path = new URL(url).pathname
    assert.equal(new URL(url).origin, 'https://app.gridex.se')
    assert.equal(new Headers(init.headers).get('x-gridex-customer-portal-user-id'), id)
    const data = {
      '/api/v1/customer/sync': overrides.customer ?? customer,
      '/api/v1/customer-portal/sync': overrides.portal ?? portal,
      '/api/v1/customer/me': { profile: { customer_number: identity.customerNumber, external_customer_id: identity.externalCustomerId, email: identity.email } },
    }[path]
    assert.ok(data, 'Unexpected HTTP boundary: ' + path)
    f.requests.push({ path, body: init.body, key: new Headers(init.headers).get('idempotency-key') })
    return new Response(JSON.stringify(envelope(data)), { headers: { 'content-type': 'application/json', 'x-gridex-contract-version': version } })
  }
  return f
}

test('response helper preserves the complete envelope and diagnostic fields', () => {
  const value = envelope(customer)
  assert.deepEqual(responseObject(value), value)
  for (const invalid of [null, undefined, 0, 'text', []]) assert.deepEqual(responseObject(invalid), {})
})

test('real HTTP customer-sync response retains synced identity and request metadata', async () => {
  fixture()
  const result = await submitOpsCustomerSync({ identity, idempotencyKey: 'offline-operation' })
  assert.equal(result.ok, true); assert.equal(result.status, 'synced')
  assert.deepEqual(result.synced, customer)
  assert.equal(result.requestId, 'offline-request'); assert.equal(result.correlationId, 'offline-correlation')
  assert.equal(result.contractSchemaVersion, version); assert.deepEqual(result.raw, envelope(customer))
})

test('real HTTP portal-sync response retains explicit access and both verified subjects', async () => {
  fixture()
  const result = await submitOpsCustomerPortalSync({ identity, idempotencyKey: 'offline-operation' })
  assert.equal(result.ok, true); assert.equal(result.status, 'linked')
  assert.deepEqual(result.synced, portal); assert.equal(result.requestId, 'offline-request')
})

test('write-result mapper keeps data and refuses negative outcomes', () => {
  assert.equal(mapCustomerWriteResult(envelope({ status: 'updated' })).ok, true)
  for (const status of ['rejected', 'failed', 'declined']) {
    const result = mapCustomerWriteResult(envelope({ status }))
    assert.equal(result.ok, false); assert.equal(result.status, status)
    assert.equal(result.requestId, 'offline-request')
  }
  assert.equal(mapCustomerWriteResult({ request_id: 'missing-data' }).ok, false)
})

const link = () => linkExistingPortalCustomer({ user: { id, email: identity.email, email_confirmed_at: '2026-10-19T10:00:00Z' }, customerNumber: identity.customerNumber, operationId: 'offline-first-link' })
test('first link completes through actual sync clients, readback and local identity persistence', async () => {
  const f = fixture(); const result = await link()
  assert.equal(result.status, 'linked'); assert.equal(f.writes.length, 1)
  assert.equal(f.profile.customer_number, identity.customerNumber)
  assert.equal(f.profile.external_customer_id, identity.externalCustomerId)
  assert.deepEqual(f.requests.map(x => x.path), ['/api/v1/customer/sync', '/api/v1/customer-portal/sync', '/api/v1/customer/me'])
  await link()
  assert.deepEqual(f.requests.slice(0, 2), f.requests.slice(3, 5), 'Retries preserve the original request and operation keys')
})

for (const patch of [
  { status: 'pending_review', access_granted: false },
  { status: 'rejected', access_granted: false },
  { portal_role: 'viewer' },
  { auth_user_id: '22222222-2222-4222-8222-222222222222' },
]) test('real response cannot grant a local link with ' + JSON.stringify(patch), async () => {
  const f = fixture({ portal: { ...portal, ...patch } })
  await assert.rejects(link()); assert.equal(f.writes.length, 0)
  assert.ok(!f.requests.some(x => x.path === '/api/v1/customer/me'))
})

test('malformed upstream success is rejected by the real response schema', async () => {
  const f = fixture({ customer: { status: 'synced' } })
  await assert.rejects(link(), error => error.code === 'canonical_response_schema_invalid')
  assert.equal(f.writes.length, 0); assert.equal(f.requests.length, 1)
})
