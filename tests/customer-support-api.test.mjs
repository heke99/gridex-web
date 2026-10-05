import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'

process.env.GRIDEX_API_KEY = 'customer-support-api-test-machine-key'
process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
process.env.VERCEL_ENV = 'production'

const originalFetch = globalThis.fetch
let requests = []
let responseForRequest
globalThis.fetch = async (input, init) => {
  const request = { url: new URL(String(input)), init, headers: new Headers(init?.headers) }
  requests.push(request)
  if (!responseForRequest) throw new Error('Unexpected support API request in test')
  return responseForRequest(request)
}
after(() => { globalThis.fetch = originalFetch })

const {
  listOpsCustomerSupportCases,
  fetchOpsCustomerSupportCase,
  listOpsCustomerSupportMessages,
  createOpsCustomerSupportCase,
  sendOpsCustomerSupportMessage,
} = await import('../lib/ops/client/customerSupport.ts')

const version = '2026-10-04.1'
const caseReference = `support_case_${'a'.repeat(32)}`
const identity = {
  userId: '44444444-4444-4444-8444-444444444444',
  email: 'customer@example.test',
  customerNumber: 'DX-100001',
  externalCustomerId: 'tenant-customer-stable-1',
}
const supportCase = {
  case_reference: caseReference,
  title: 'Fråga om fakturan',
  description: 'Kan ni förklara fakturan?',
  status: 'received',
  channel: 'customer_portal',
  created_at: '2026-10-05T12:00:00Z',
  updated_at: '2026-10-05T12:00:00Z',
  resolved_at: null,
}
const message = {
  message_reference: `support_message_${'b'.repeat(32)}`,
  author_type: 'customer',
  kind: 'message',
  body: 'Kan ni förklara fakturan?',
  created_at: '2026-10-05T12:00:00Z',
}
const page = { limit: 25, offset: 0, returned: 1, has_more: true, next_cursor: 'opaque+/=next' }
const envelope = data => ({ data, request_id: 'customer-support-test-request', contract_schema_version: version })
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'X-Gridex-Contract-Version': version },
})
beforeEach(() => {
  requests = []
  responseForRequest = undefined
})

test('lists canonical support cases with verified customer headers and preserves pagination', async () => {
  const expected = { ...envelope([supportCase]), page }
  responseForRequest = () => json(expected)
  assert.deepEqual(await listOpsCustomerSupportCases(identity, { limit: 25, cursor: 'opaque+/=next' }), expected)
  assert.equal(requests.length, 1)
  const request = requests[0]
  assert.equal(request.url.pathname, '/api/v1/customer/support/cases')
  assert.equal(request.url.searchParams.get('limit'), '25')
  assert.equal(request.url.searchParams.get('cursor'), 'opaque+/=next')
  assert.equal(request.headers.get('authorization'), 'Bearer customer-support-api-test-machine-key')
  assert.equal(request.headers.get('x-gridex-customer-portal-user-id'), identity.userId)
  assert.equal(request.headers.get('x-gridex-auth-user-id'), identity.userId)
  assert.equal(request.headers.get('x-gridex-external-customer-id'), identity.externalCustomerId)
  assert.equal(request.headers.get('x-gridex-customer-number'), identity.customerNumber)
  assert.equal(request.headers.get('x-gridex-customer-email'), identity.email)
  assert.equal(request.headers.has('x-gridex-staff-assertion'), false)
  assert.equal(request.init.redirect, 'manual')
  assert.equal(request.init.cache, 'no-store')
})

test('reads case detail and only customer-visible messages from their canonical endpoints', async () => {
  responseForRequest = request => json(envelope(request.url.pathname.endsWith('/messages')
    ? [message] : { ...supportCase, messages: [message] }))
  assert.deepEqual(await fetchOpsCustomerSupportCase(identity, caseReference), envelope({ ...supportCase, messages: [message] }))
  assert.deepEqual(await listOpsCustomerSupportMessages(identity, caseReference), envelope([message]))
  assert.deepEqual(requests.map(request => request.url.pathname), [
    `/api/v1/customer/support/cases/${caseReference}`,
    `/api/v1/customer/support/cases/${caseReference}/messages`,
  ])
})

test('creates one canonical case with the closed customer payload and an unchanged retry identity', async () => {
  responseForRequest = () => json(envelope(supportCase), 201)
  const input = { title: supportCase.title, message: message.body, category: 'invoice' }
  const key = 'customer-support-create:operation_1'
  assert.deepEqual(await createOpsCustomerSupportCase(identity, input, key), envelope(supportCase))
  await createOpsCustomerSupportCase(identity, input, key)
  assert.equal(requests.length, 2)
  for (const request of requests) {
    assert.equal(request.url.pathname, '/api/v1/customer/support/cases')
    assert.equal(request.init.method, 'POST')
    assert.equal(request.headers.get('idempotency-key'), key)
    assert.deepEqual(JSON.parse(request.init.body), input)
  }
})

test('sends a customer message without accepting a staff actor or visibility in the payload', async () => {
  responseForRequest = () => json(envelope(message), 201)
  assert.deepEqual(await sendOpsCustomerSupportMessage(identity, caseReference, { message: message.body }, 'customer-support-message:operation_2'), envelope(message))
  assert.equal(requests[0].url.pathname, `/api/v1/customer/support/cases/${caseReference}/messages`)
  assert.equal(requests[0].init.method, 'POST')
  assert.equal(requests[0].headers.get('idempotency-key'), 'customer-support-message:operation_2')
  assert.deepEqual(JSON.parse(requests[0].init.body), { message: message.body })
})

for (const reference of ['', '44444444-4444-4444-8444-444444444444', '../messages', `${caseReference}/messages`, `${caseReference}?company_id=foreign`, `${caseReference}%2fmessages`, `${caseReference}\n`]) {
  test(`rejects invalid or injected case reference before transport: ${JSON.stringify(reference)}`, async () => {
    await assert.rejects(() => fetchOpsCustomerSupportCase(identity, reference), error => error.status === 400)
    await assert.rejects(() => listOpsCustomerSupportMessages(identity, reference), error => error.status === 400)
    await assert.rejects(() => sendOpsCustomerSupportMessage(identity, reference, { message: 'Hej' }, 'operation-valid-key'), error => error.status === 400)
    assert.equal(requests.length, 0)
  })
}

for (const key of [undefined, '', 'short', ' key-with-space', 'operation/key', 'x'.repeat(201), 'operation-valid-key\n']) {
  test(`requires a valid stable idempotency key before transport: ${JSON.stringify(key)}`, async () => {
    await assert.rejects(() => createOpsCustomerSupportCase(identity, { title: 'Hej', message: 'En fråga' }, key), error => error.status === 400)
    await assert.rejects(() => sendOpsCustomerSupportMessage(identity, caseReference, { message: 'En fråga' }, key), error => error.status === 400)
    assert.equal(requests.length, 0)
  })
}

test('rejects out-of-contract paging and identity fields rather than creating arbitrary query parameters', async () => {
  for (const query of [{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { limit: '25' }, { cursor: 3 }, { company_id: 'foreign' }]) {
    await assert.rejects(() => listOpsCustomerSupportCases(identity, query), error => error.status === 400)
  }
  assert.equal(requests.length, 0)
})

test('inherits request schema validation for empty and oversized customer text', async () => {
  for (const input of [{ title: '', message: 'Hej' }, { title: 'x'.repeat(181), message: 'Hej' }, { title: 'Hej', message: '' }, { title: 'Hej', message: 'x'.repeat(8001) }, { title: 'Hej', message: 'Fråga', category: 'x'.repeat(121) }]) {
    await assert.rejects(() => createOpsCustomerSupportCase(identity, input, 'operation-valid-key'), error => error.code === 'canonical_request_schema_invalid')
  }
  await assert.rejects(() => sendOpsCustomerSupportMessage(identity, caseReference, { message: '' }, 'operation-valid-key'), error => error.code === 'canonical_request_schema_invalid')
  assert.equal(requests.length, 0)
})

test('does not forward tenant identity, internal notes, author or priority from a customer request', async () => {
  for (const field of ['company_id', 'customer_id', 'actor_user_id', 'visibility', 'author_type', 'priority']) {
    await assert.rejects(() => createOpsCustomerSupportCase(identity, { title: 'Hej', message: 'Fråga', [field]: 'foreign' }, 'operation-valid-key'), error => error.status === 400)
    await assert.rejects(() => sendOpsCustomerSupportMessage(identity, caseReference, { message: 'Fråga', [field]: 'foreign' }, 'operation-valid-key'), error => error.status === 400)
  }
  assert.equal(requests.length, 0)
})

test('rejects malformed canonical responses instead of presenting a local or empty success', async () => {
  responseForRequest = () => json({ ...envelope([supportCase]), page: undefined })
  await assert.rejects(() => listOpsCustomerSupportCases(identity), error => error.code === 'canonical_response_schema_invalid')
  responseForRequest = () => json(envelope({ ...supportCase, status: 'waiting_on_internal', messages: [] }))
  await assert.rejects(() => fetchOpsCustomerSupportCase(identity, caseReference), error => error.code === 'canonical_response_schema_invalid')
})

for (const [status, code] of [[403, 'customer_assertion_required'], [404, 'support_case_not_found'], [409, 'support_case_closed'], [429, 'rate_limited'], [503, 'support_unavailable']]) {
  test(`preserves OPS ${status} ${code} without local fallback or write retry`, async () => {
    responseForRequest = () => json({ error: { code, message: 'Begäran kunde inte utföras.' }, request_id: 'upstream-support-error', contract_schema_version: version }, status)
    await assert.rejects(() => sendOpsCustomerSupportMessage(identity, caseReference, { message: 'Fråga' }, 'operation-valid-key'), error => error.status === status && error.code === code && error.requestId === 'upstream-support-error')
    assert.equal(requests.length, 1)
  })
}
