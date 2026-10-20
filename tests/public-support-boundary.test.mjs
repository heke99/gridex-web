import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { POST } from '../app/api/support/public/route.ts'

const operation = '22222222-2222-4222-8222-222222222222'
const ticket = '33333333-3333-4333-8333-333333333333'
const body = { client_operation_id: operation, name: 'Test', email: 'test@example.invalid', subject: 'Fråga', message: 'Mitt meddelande' }
const request = (value = body, headers = {}) => new Request('https://gridex.se/api/support/public', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://gridex.se', ...headers }, body: JSON.stringify(value),
})
let calls, allowed, rpcError
beforeEach(() => {
  calls = []; allowed = true; rpcError = null
  globalThis.__publicSupport = {
    rate: async () => ({ allowed }),
    rpc: async (name, args) => { calls.push({ name, args }); return { data: rpcError ? null : ticket, error: rpcError } },
  }
})
test('invalid JSON shapes, unknown fields, wrong MIME and foreign origins never reach the database', async () => {
  for (const value of [null, [], 'text', { ...body, user_id: ticket }]) assert.equal((await POST(request(value))).status, 400)
  assert.equal((await POST(request(body, { 'Content-Type': 'text/plain' }))).status, 415)
  assert.equal((await POST(request(body, { Origin: 'https://foreign.example' }))).status, 403)
  const malformed = new Request('https://gridex.se/api/support/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })
  assert.equal((await POST(malformed)).status, 400)
  assert.equal(calls.length, 0)
})
test('declared and physically oversized bodies are bounded even without Content-Length', async () => {
  assert.equal((await POST(request(body, { 'Content-Length': String(24 * 1024 + 1) }))).status, 413)
  const response = await POST(request({ ...body, message: 'å'.repeat(24 * 1024) }))
  assert.equal(response.status, 413)
  assert.equal(typeof (await response.json()).error, 'string', 'existing form can display validation failures')
  assert.equal(calls.length, 0)
})
test('valid retries retain the same atomic RPC operation and normalized payload hash', async () => {
  const response = await POST(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, ticketId: ticket, confirmation_status: 'queued' })
  await POST(request())
  assert.equal(calls.length, 2)
  assert.equal(calls[0].name, 'gridex_create_public_inquiry_v1')
  assert.equal(calls[0].args.p_operation_id, operation)
  assert.match(calls[0].args.p_payload_hash, /^[a-f0-9]{64}$/)
  assert.deepEqual(calls[0], calls[1])
})
test('rate denial, idempotency conflict and database outage never claim a queued receipt', async () => {
  allowed = false
  assert.equal((await POST(request())).status, 429)
  assert.equal(calls.length, 0)
  allowed = true
  for (const [message, status] of [['idempotency_conflict', 409], ['connection failed', 503]]) {
    rpcError = { message }
    const response = await POST(request())
    assert.equal(response.status, status)
    assert.equal((await response.json()).confirmation_status, undefined)
  }
})
