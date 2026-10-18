import assert from 'node:assert/strict'
import test from 'node:test'
import { processPortalWriteOutbox } from '../lib/customerPortal/outbox.ts'
import { OpsError } from '../lib/ops/errors.ts'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://synthetic-outbox.example.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-offline-outbox-key'
const now = Date.parse('2026-10-18T12:00:00.000Z')

// The existing audit-outbox loader isolates the provider and SDK. This adapter
// executes the worker's real predicates and compare-and-swap state transitions;
// it does not implement retry scheduling or infer the expected next-attempt date.
function fixture(error, { attemptCount = 0, maxAttempts = 10 } = {}) {
  const row = {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: '22222222-2222-4222-8222-222222222222',
    status: 'pending', attempt_count: attemptCount, max_attempts: maxAttempts,
    last_attempt_at: null, next_attempt_at: '2026-10-18T11:59:00.000Z',
    created_at: '2026-10-18T11:00:00.000Z', operation_type: 'customer_sync',
    idempotency_key: 'customer-sync:verified-user:operation-1',
    identity: { userId: '22222222-2222-4222-8222-222222222222', externalCustomerId: 'tenant-customer-1' },
    payload: { operation_id: 'operation-1', profile: { phone: '+46701234567' } },
  }
  const tables = { customer_portal_write_outbox: [row], distributed_rate_limits: [] }
  let dispatched = 0
  class Query {
    constructor(table) { assert.ok(Object.hasOwn(tables, table)); this.table = table; this.filters = []; this.columns = '*' }
    select(columns = '*') { this.columns = columns; return this }
    update(patch) { this.patch = patch; return this }
    delete() { this.deleting = true; return this }
    eq(key, value) { this.filters.push(candidate => candidate[key] === value); return this }
    in(key, values) { this.filters.push(candidate => values.includes(candidate[key])); return this }
    lt(key, value) { this.filters.push(candidate => candidate[key] != null && candidate[key] < value); return this }
    lte(key, value) { this.filters.push(candidate => candidate[key] != null && candidate[key] <= value); return this }
    order(key) { this.orderKey = key; return this }
    limit(count) { this.maximum = count; return this }
    returns() { return this }
    maybeSingle() { this.single = true; return this }
    then(resolve, reject) {
      try {
        let rows = tables[this.table].filter(candidate => this.filters.every(predicate => predicate(candidate)))
        if (this.orderKey) rows.sort((left, right) => String(left[this.orderKey]).localeCompare(String(right[this.orderKey])))
        if (this.maximum !== undefined) rows = rows.slice(0, this.maximum)
        if (this.deleting) tables[this.table] = tables[this.table].filter(candidate => !rows.includes(candidate))
        if (this.patch) for (const candidate of rows) Object.assign(candidate, structuredClone(this.patch))
        const selected = rows.map(candidate => this.columns === '*' ? structuredClone(candidate)
          : Object.fromEntries(this.columns.split(',').map(key => [key, structuredClone(candidate[key])])))
        return Promise.resolve({ data: this.single ? selected[0] ?? null : selected, error: null }).then(resolve, reject)
      } catch (failure) { return Promise.reject(failure).then(resolve, reject) }
    }
  }
  globalThis.__auditOutbox = {
    client: { from: table => new Query(table) },
    async dispatch() { dispatched += 1; throw error },
  }
  return { row, dispatchCount: () => dispatched }
}

for (const placement of ['root', 'nested']) {
  test(`outbox respects a two-hour OPS Retry-After in the ${placement} error body`, async t => {
    t.mock.timers.enable({ apis: ['Date'], now })
    const details = { code: 'rate_limited', retryable: true, retry_after_seconds: 7200 }
    const f = fixture(new OpsError('Synthetic OPS rate limit', 429, placement === 'nested' ? { error: details } : details))
    assert.deepEqual(await processPortalWriteOutbox(1), { processed: 1, completed: 0, failed: 1 })
    assert.equal(f.dispatchCount(), 1)
    assert.equal(f.row.status, 'failed')
    assert.equal(f.row.attempt_count, 1)
    assert.equal(f.row.last_http_status, 429)
    assert.equal(f.row.last_error_code, 'rate_limited')
    assert.equal(f.row.next_attempt_at, new Date(now + 7200 * 1000).toISOString())
  })
}

test('missing or invalid OPS retry guidance retains the exponential backoff', async t => {
  t.mock.timers.enable({ apis: ['Date'], now })
  for (const retryAfter of [undefined, null, 'later', -30, 0, Number.NaN, Number.POSITIVE_INFINITY, {}]) {
    for (const [attemptCount, expectedMinutes] of [[0, 2], [2, 8], [8, 512]]) {
      const details = { code: 'ops_temporarily_unavailable', retryable: true, retry_after_seconds: retryAfter }
      const f = fixture(new OpsError('Synthetic OPS outage', 503, details), { attemptCount })
      assert.deepEqual(await processPortalWriteOutbox(1), { processed: 1, completed: 0, failed: 1 })
      assert.equal(f.row.status, 'failed')
      assert.equal(f.row.next_attempt_at, new Date(now + expectedMinutes * 60_000).toISOString(),
        `retry_after_seconds=${String(retryAfter)}, previous attempts=${attemptCount}`)
    }
  }
})

test('a shorter OPS Retry-After never reduces the existing exponential backoff', async t => {
  t.mock.timers.enable({ apis: ['Date'], now })
  const f = fixture(new OpsError('Synthetic OPS rate limit', 429, {
    code: 'rate_limited', retryable: true, retry_after_seconds: 30,
  }), { attemptCount: 3 })
  await processPortalWriteOutbox(1)
  assert.equal(f.row.status, 'failed')
  assert.equal(f.row.next_attempt_at, new Date(now + 16 * 60_000).toISOString())
})

test('a permanent OPS error becomes a dead letter even when it contains retry guidance', async t => {
  t.mock.timers.enable({ apis: ['Date'], now })
  const f = fixture(new OpsError('Synthetic invalid consent', 400, {
    code: 'validation_error', retryable: false, retry_after_seconds: 7200,
  }))
  assert.deepEqual(await processPortalWriteOutbox(1), { processed: 1, completed: 0, failed: 1 })
  assert.equal(f.dispatchCount(), 1)
  assert.equal(f.row.status, 'dead_letter')
  assert.equal(f.row.next_attempt_at, '9999-12-31T00:00:00.000Z')
  assert.equal(f.row.dead_letter_at, new Date(now).toISOString())
  assert.equal(f.row.last_error_code, 'validation_error')
})

test('a finite but unschedulable server wait never causes an earlier automatic retry', async t => {
  t.mock.timers.enable({ apis: ['Date'], now })
  const f = fixture(new OpsError('Synthetic long hold', 429, {
    code: 'rate_limited', retryable: true, retry_after_seconds: Number.MAX_VALUE,
  }))
  await processPortalWriteOutbox(1)
  assert.equal(f.row.status, 'dead_letter')
  assert.equal(f.row.next_attempt_at, '9999-12-31T00:00:00.000Z')
})
