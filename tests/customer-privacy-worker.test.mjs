import assert from 'node:assert/strict'
import { test } from 'node:test'
import { processPortalWriteOutbox } from '../lib/customerPortal/outbox.ts'
import { OpsError } from '../lib/ops/errors.ts'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://privacy-worker.example.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-privacy-worker-key'

function fixture() {
  const row = { id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222',
    status: 'pending', attempt_count: 0, max_attempts: 10, next_attempt_at: '2020-01-01T00:00:00Z',
    created_at: '2020-01-01T00:00:00Z', operation_type: 'privacy_request', last_attempt_at: null,
    idempotency_key: 'portal-privacy:synthetic:original-operation', identity: { userId: '22222222-2222-4222-8222-222222222222' },
    payload: { privacy_request_id: '33333333-3333-4333-8333-333333333333', kind: 'access' } }
  const state = { row, rpcCalls: [], sent: [], rpcFailure: false, dispatchError: null, stealLease: false }
  class Query {
    constructor(table) { this.table = table; this.filters = [] }
    select() { return this } update(patch) { this.patch = patch; return this } delete() { return this }
    eq(key, value) { this.filters.push(r => r[key] === value); return this }
    in(key, values) { this.filters.push(r => values.includes(r[key])); return this }
    lt(key, value) { this.filters.push(r => r[key] != null && r[key] < value); return this }
    lte(key, value) { this.filters.push(r => r[key] != null && r[key] <= value); return this }
    order() { return this } limit() { return this } returns() { return this }
    maybeSingle() { this.single = true; return this }
    then(resolve, reject) {
      try {
        const matches = this.table === 'customer_portal_write_outbox' && this.filters.every(f => f(row))
        if (matches && this.patch) {
          assert.notEqual(this.patch.status, 'completed', 'privacy completion must use the atomic receipt RPC')
          Object.assign(row, this.patch)
        }
        return Promise.resolve({ data: matches ? this.single ? { ...row } : [{ ...row }] : this.single ? null : [], error: null }).then(resolve, reject)
      } catch (error) { return Promise.reject(error).then(resolve, reject) }
    }
  }
  globalThis.__auditOutbox = {
    client: { from: table => new Query(table), async rpc(name, args) {
      state.rpcCalls.push({ name, args })
      assert.equal(name, 'gridex_complete_privacy_request_v1')
      if (state.rpcFailure) return { data: false, error: { message: 'synthetic database outage' } }
      if (args.p_attempt !== row.attempt_count || args.p_locked_at !== row.last_attempt_at) return { data: false, error: null }
      row.status = 'completed'
      return { data: true, error: null }
    } },
    async dispatch(queued) {
      state.sent.push(structuredClone(queued))
      if (state.dispatchError) throw state.dispatchError
      if (state.stealLease) { row.attempt_count++; row.last_attempt_at = new Date(Date.now() + 1000).toISOString() }
      return `support_case_${'a'.repeat(32)}`
    },
  }
  return state
}
test('real worker settles a privacy case only via the exact-lease atomic RPC', async () => {
  const state = fixture()
  assert.deepEqual(await processPortalWriteOutbox(1), { processed: 1, completed: 1, failed: 0 })
  assert.equal(state.row.status, 'completed')
  assert.deepEqual(state.rpcCalls[0].args, { p_outbox_id: state.row.id, p_attempt: 1,
    p_locked_at: state.row.last_attempt_at, p_case_reference: `support_case_${'a'.repeat(32)}` })
})
test('upstream acceptance followed by local failure retries with unchanged OPS key and payload', async () => {
  const state = fixture(); state.rpcFailure = true
  assert.deepEqual(await processPortalWriteOutbox(1), { processed: 1, completed: 0, failed: 1 })
  state.rpcFailure = false; state.row.next_attempt_at = '2020-01-01T00:00:00Z'
  assert.deepEqual(await processPortalWriteOutbox(1), { processed: 1, completed: 1, failed: 0 })
  assert.equal(state.sent[0].idempotency_key, state.sent[1].idempotency_key)
  assert.deepEqual(state.sent[0].payload, state.sent[1].payload)
  assert.equal(state.row.attempt_count, 2)
})
test('a stale privacy worker cannot complete or fail a replacement lease', async () => {
  const state = fixture(); state.stealLease = true
  await assert.rejects(processPortalWriteOutbox(1), /concurrent worker/)
  assert.equal(state.row.attempt_count, 2)
  assert.equal(state.row.status, 'processing')
})
test('permanent OPS rejection becomes visible manual review and never a completion receipt', async () => {
  const state = fixture()
  state.dispatchError = new OpsError('Rejected', 403, { code: 'customer_not_authorized', retryable: false })
  assert.deepEqual(await processPortalWriteOutbox(1), { processed: 1, completed: 0, failed: 1 })
  assert.equal(state.row.status, 'dead_letter')
  assert.equal(state.rpcCalls.length, 0)
})
