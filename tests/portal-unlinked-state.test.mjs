import assert from 'node:assert/strict'
import { test, after } from 'node:test'

process.env.GRIDEX_API_KEY = 'gridex_unlinked_portal_synthetic'
process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
const { GRIDEX_CUSTOMER_PORTAL_API_CONTRACT_VERSION: version } = await import('../lib/ops/contract.ts')
const { fetchOpsCustomerPortalBundle, fetchOpsCustomerResource } = await import('../lib/ops/client/portalConsistency.ts')
const originalFetch = globalThis.fetch
const identity = { userId: '11111111-1111-4111-8111-111111111111', email: 'new-customer@example.invalid' }
const invoiceReference = '33333333-3333-4333-8333-333333333333'
let status = 403, code = 'customer_portal_link_required', calls = 0
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input)), headers = new Headers(init.headers)
  assert.equal(url.origin, 'https://app.gridex.se', 'remote network is forbidden')
  // The documented bundle read uses POST; granular resource reads use GET.
  // No sync, claim, link or other write endpoint is allowed by this fixture.
  assert.equal(init.method ?? 'GET', url.pathname === '/api/v1/customer/portal-bundle' ? 'POST' : 'GET')
  assert.ok(['portal-bundle', 'me', 'invoices', 'contracts', `invoices/${invoiceReference}`].some(path => url.pathname === '/api/v1/customer/'+path))
  assert.equal(init.cache, 'no-store')
  assert.equal(headers.get('Authorization'), 'Bearer gridex_unlinked_portal_synthetic')
  assert.equal(headers.get('x-gridex-customer-portal-user-id'), identity.userId)
  assert.equal(headers.get('x-gridex-auth-user-id'), identity.userId)
  calls++
  return Response.json({ error: { code, message: 'Synthetic portal response', retryable: false },
    request_id: '22222222-2222-4222-8222-222222222222', contract_schema_version: version },
    { status, headers: { 'X-Gridex-Contract-Version': version } })
}
after(() => { globalThis.fetch = originalFetch })

test('native403 link-required is a normal start state only for an auth-only account', async () => {
  status = 403; code = 'customer_portal_link_required'
  const before = calls
  const bundle = await fetchOpsCustomerPortalBundle(identity)
  assert.equal(bundle.profile.customer_link_state, 'not_linked')
  assert.equal(bundle.customerStatus.code, 'not_linked')
  assert.deepEqual(bundle.contracts, [])
  assert.equal(bundle.profile.email, identity.email)
  assert.equal(calls, before + 1, 'OPS must first verify the auth-only portal identity')
  assert.equal((await fetchOpsCustomerResource(identity, 'me')).data.profile.onboarding_state, 'not_linked')
  assert.deepEqual((await fetchOpsCustomerResource(identity, 'invoices')).data, [])
  assert.equal((await fetchOpsCustomerResource(identity, 'invoices', invoiceReference)).data, null)
})

test('a recorded customer reference cannot hide a missing or revoked portal link', async () => {
  status = 403; code = 'customer_portal_link_required'
  for (const reference of [{ customerNumber: 'KTEST0001' }, { externalCustomerId: 'customer_stable_synthetic' }]) {
    await assert.rejects(fetchOpsCustomerPortalBundle({ ...identity, ...reference }),
      error => error.status === 403 && error.code === code)
    await assert.rejects(fetchOpsCustomerResource({ ...identity, ...reference }, 'contracts'),
      error => error.status === 403 && error.code === code)
  }
})

test('other authorization, identity and availability errors never become an empty portal', async () => {
  for (const [nextStatus, nextCode] of [[401, 'customer_portal_link_required'], [404, 'customer_portal_link_required'],
    [403, 'forbidden'], [403, 'customer_assertion_invalid'], [503, 'portal_unavailable']]) {
    status = nextStatus; code = nextCode
    await assert.rejects(fetchOpsCustomerPortalBundle(identity), error => error.status === status && error.code === code)
  }
})

test('existing404 unlinked semantics and stable-reference integrity errors are retained', async () => {
  status = 404; code = 'customer_not_found'
  assert.equal((await fetchOpsCustomerPortalBundle(identity)).customerStatus.code, 'not_linked')
  await assert.rejects(fetchOpsCustomerPortalBundle({ ...identity, customerNumber: 'KTEST0001' }),
    error => error.status === 409 && error.code === 'customer_portal_link_out_of_sync')
})
