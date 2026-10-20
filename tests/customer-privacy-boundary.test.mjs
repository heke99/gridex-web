import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { GET, POST } from '../app/api/web/customer/privacy-requests/route.ts'

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'privacy@example.invalid', email_confirmed_at: '2026-10-20T00:00:00Z' }
const operationId = '22222222-2222-4222-8222-222222222222'
const id = '33333333-3333-4333-8333-333333333333'
let currentUser, rpcError, rpcCalls, readError, readOwner
const request = (body = { kind: 'access', client_operation_id: operationId }, headers = {}) => new Request('https://gridex.se/api/web/customer/privacy-requests', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://gridex.se', ...headers }, body: JSON.stringify(body),
})
beforeEach(() => {
  currentUser = user; rpcError = null; rpcCalls = []; readError = null; readOwner = null
  globalThis.__privacyBoundary = {
    authClient: { auth: { getUser: async () => ({ data: { user: currentUser } }) } },
    service: {
      async rpc(name, args) { rpcCalls.push({ name, args }); return { data: rpcError ? null : { id, kind: args.p_kind, created_at: '2026-10-20T00:00:00Z', replayed: false }, error: rpcError } },
      from() { return { select() { return this }, eq(field, value) { if (field === 'user_id') readOwner = value; return this }, order() { return this }, async limit() { return { data: [], error: readError } } } },
    },
  }
})
test('unauthenticated and unconfirmed visitors cannot create requests', async () => {
  currentUser = null
  assert.equal((await POST(request())).status, 401)
  assert.equal((await GET()).status, 401)
  currentUser = { ...user, email_confirmed_at: null }
  assert.equal((await POST(request())).status, 403)
  assert.equal(rpcCalls.length, 0)
})
test('cross-site, oversized, wrong content-type and owner-spoofing writes never reach RPC', async () => {
  assert.equal((await POST(request(undefined, { Origin: 'https://foreign.example' }))).status, 403)
  assert.equal((await POST(request(undefined, { 'Content-Length': '1025' }))).status, 413)
  assert.equal((await POST(request(undefined, { 'Content-Type': 'text/plain' }))).status, 415)
  assert.equal((await POST(request({ kind: 'access', client_operation_id: operationId, user_id: id }))).status, 400)
  assert.equal(rpcCalls.length, 0)
})
test('verified identity reaches one atomic RPC and receives a private accepted receipt', async () => {
  const response = await POST(request())
  assert.equal(response.status, 202)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal((await response.json()).data.id, id)
  assert.deepEqual(rpcCalls, [{ name: 'gridex_enqueue_privacy_request_v1', args: {
    p_user_id: user.id, p_kind: 'access', p_operation_id: operationId, p_identity: { userId: user.id, email: user.email },
  } }])
})
test('conflicts, durable quota and database outage never become successful receipts', async () => {
  const originalError = console.error
  console.error = () => {}
  try {
    for (const [message, status] of [['privacy_idempotency_conflict', 409], ['privacy_request_limit', 429], ['connection failed', 503]]) {
      rpcError = { message }
      const response = await POST(request())
      assert.equal(response.status, status)
      assert.equal((await response.json()).data, undefined)
    }
  } finally { console.error = originalError }
})
test('history is scoped to verified session; a failed read is not an empty history', async () => {
  assert.equal((await GET()).status, 200)
  assert.equal(readOwner, user.id)
  readError = { message: 'database unavailable' }
  const originalError = console.error
  console.error = () => {}
  try { assert.equal((await GET()).status, 503) } finally { console.error = originalError }
})
