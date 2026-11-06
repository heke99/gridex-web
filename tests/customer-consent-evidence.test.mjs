import assert from 'node:assert/strict'
import { test } from 'node:test'
import { syncPowerOfAttorney } from '../lib/customerPortal/writeValidation.ts'

const consent = () => ({
  document_reference: 'document_synthetic_poa', scope: ['supplier_switch', 'facility_information_lookup'],
  accepted: true, accepted_at: '2026-10-18T10:00:00Z', signer_name: 'Synthetic Customer',
  signer_identity_number: '199001011234', method: 'website_acceptance',
  ip_address: '192.0.2.10', user_agent: 'Synthetic original browser',
})

test('customer sync preserves the complete explicitly accepted signing evidence', () => {
  const input = consent()
  const result = syncPowerOfAttorney(input)
  assert.deepEqual(result, input)
})

test('missing, false or coerced acceptance never becomes an explicit consent', () => {
  for (const accepted of [undefined, false, 'true', 'false', 1, null]) {
    assert.equal(syncPowerOfAttorney({ ...consent(), accepted }), null)
  }
})

test('incomplete signing evidence or widened/invalid scope is rejected rather than downgraded', () => {
  for (const field of ['signer_name', 'signer_identity_number', 'method']) {
    const input = consent(); delete input[field]
    assert.equal(syncPowerOfAttorney(input), null, field)
  }
  for (const scope of [[], ['facility_information_lookup'], ['supplier_switch', 'supplier_switch'], ['supplier_switch', 'unknown']]) {
    assert.equal(syncPowerOfAttorney({ ...consent(), scope }), null)
  }
})

test('signing evidence rejects overlong identity fields and mixed scopes without silently rewriting them', () => {
  for (const [field, length] of [['document_reference', 201], ['signer_name', 241], ['signer_identity_number', 121], ['method', 41]]) {
    assert.equal(syncPowerOfAttorney({ ...consent(), [field]: 'x'.repeat(length) }), null, field)
  }
  assert.equal(syncPowerOfAttorney({ ...consent(), scope: ['supplier_switch', true] }), null)
})

async function receiptFixture(run) {
  const { prepareCustomerSyncReceipt, completeCustomerSyncReceipt } = await import('../lib/customerPortal/syncReceipt.ts')
  const previous = { fetch: globalThis.fetch, url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://receipt-fixture.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-offline-service-key'
  const rows = new Map()
  let failInsert = false
  const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    assert.equal(url.origin, 'https://receipt-fixture.invalid', 'unexpected external network request')
    assert.equal(url.pathname, '/rest/v1/customer_portal_write_outbox')
    const key = url.searchParams.get('idempotency_key')?.replace(/^eq\./, '')
    if (!init.method || init.method === 'GET') return respond(rows.has(key) ? [rows.get(key)] : [])
    if (init.method === 'POST') {
      if (failInsert) return respond({ code: 'XX000', message: 'Synthetic storage failure' }, 500)
      const row = JSON.parse(init.body)
      if (rows.has(row.idempotency_key)) return respond({ code: '23505', message: 'duplicate' }, 409)
      rows.set(row.idempotency_key, { id: `synthetic-${rows.size}`, ...row })
      return respond(null, 201)
    }
    assert.equal(init.method, 'PATCH')
    const row = rows.get(key)
    const owner = url.searchParams.get('user_id')?.replace(/^eq\./, '')
    const hash = url.searchParams.get('payload_hash')?.replace(/^eq\./, '')
    if (!row || row.user_id !== owner || row.payload_hash !== hash) return respond([])
    Object.assign(row, JSON.parse(init.body))
    return respond(new Headers(init.headers).get('accept')?.includes('object+json') ? row : [row])
  }
  const input = {
    userId: '11111111-1111-4111-8111-111111111111',
    operationId: '22222222-2222-4222-8222-222222222222',
    identity: { userId: '11111111-1111-4111-8111-111111111111', externalCustomerId: 'synthetic_customer' },
    payload: { power_of_attorney: syncPowerOfAttorney(consent()), profile: { first_name: 'Synthetic' }, metadata: { source: 'gridex_web_customer_sync_route' } },
    evidence: { ipAddress: '203.0.113.15', userAgent: 'Trusted ingress browser' },
  }
  try {
    await run({ prepare: prepareCustomerSyncReceipt, complete: completeCustomerSyncReceipt, rows, input, setFailInsert: value => { failInsert = value } })
  } finally {
    globalThis.fetch = previous.fetch
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url
    if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key
  }
}

test('durable consent uses trusted ingress evidence and preserves its first timestamp/IP across retries', () => receiptFixture(async ({ prepare, input, rows }) => {
  const start = Date.now()
  const first = await prepare(input)
  const poa = first.payload.power_of_attorney
  assert.equal(poa.ip_address, input.evidence.ipAddress)
  assert.equal(poa.user_agent, input.evidence.userAgent)
  assert.ok(Date.parse(poa.accepted_at) >= start)
  assert.notEqual(poa.accepted_at, consent().accepted_at)
  const retry = await prepare({ ...input, evidence: { ipAddress: 'unknown', userAgent: 'Changed browser' } })
  assert.deepEqual(retry, first)
  assert.equal(rows.size, 1)
}))

test('the durable original retains the complete trusted browser header', () => receiptFixture(async ({ prepare, input }) => {
  const userAgent = 'Trusted Browser ' + 'x'.repeat(1200)
  const receipt = await prepare({ ...input, evidence: { ...input.evidence, userAgent } })
  assert.equal(receipt.payload.power_of_attorney.user_agent, userAgent)
}))

test('a consent retry cannot change the signed document, signer, scope or operation owner', () => receiptFixture(async ({ prepare, input }) => {
  await prepare(input)
  for (const changed of [
    { ...input.payload.power_of_attorney, document_reference: 'another_document' },
    { ...input.payload.power_of_attorney, signer_name: 'Different Signer' },
    { ...input.payload.power_of_attorney, scope: ['supplier_switch'] },
  ]) {
    await assert.rejects(() => prepare({ ...input, payload: { ...input.payload, power_of_attorney: changed } }), error => error.status === 409)
  }
  await assert.rejects(() => prepare({ ...input, userId: '33333333-3333-4333-8333-333333333333' }), error => error.status === 403)
}))

test('a browser cannot assert BankID or substitute an untrusted/missing ingress IP', () => receiptFixture(async ({ prepare, input, rows }) => {
  await assert.rejects(() => prepare({ ...input, payload: { ...input.payload, power_of_attorney: { ...input.payload.power_of_attorney, method: 'bankid' } } }), error => error.status === 400)
  for (const ipAddress of ['unknown', '', '127.0.0.1', '192.0.2.1, 198.51.100.1', 'arbitrary-client-value']) {
    await assert.rejects(() => prepare({ ...input, evidence: { ipAddress, userAgent: 'browser' } }), error => error.status === 503)
  }
  assert.equal(rows.size, 0)
}))

test('no prepared consent is returned if durable storage fails or its stored content is corrupted', () => receiptFixture(async ({ prepare, input, rows, setFailInsert }) => {
  setFailInsert(true)
  await assert.rejects(() => prepare(input))
  setFailInsert(false)
  await prepare(input)
  rows.values().next().value.payload.power_of_attorney.ip_address = '198.51.100.200'
  await assert.rejects(() => prepare(input), error => error.status === 409)
}))

test('receipt completion binds the original owner/key/hash and never marks another record completed', () => receiptFixture(async ({ prepare, complete, input, rows }) => {
  const receipt = await prepare(input)
  await assert.rejects(() => complete({ ...receipt, userId: '33333333-3333-4333-8333-333333333333' }))
  assert.equal(rows.values().next().value.status, 'pending')
  await complete(receipt)
  assert.equal(rows.values().next().value.status, 'completed')
}))

test('simultaneous first submissions converge on one durable original consent', () => receiptFixture(async ({ prepare, input, rows }) => {
  const receipts = await Promise.all([
    prepare(input),
    prepare({ ...input, evidence: { ipAddress: '198.51.100.30', userAgent: 'Concurrent retry browser' } }),
  ])
  assert.deepEqual(receipts[0], receipts[1])
  assert.equal(rows.size, 1)
}))
