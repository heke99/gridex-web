// Executes the real worker; only the SQL/provider boundaries are synthetic.
import assert from 'node:assert/strict'
import { processPortalWriteOutbox } from '../../../lib/customerPortal/outbox.ts'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://synthetic.example.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-audit-key'
const row = { id: 'audit-row', user_id: 'audit-user', status: 'pending', attempt_count: 0,
  max_attempts: 10, last_attempt_at: null, next_attempt_at: '2000-01-01T00:00:00Z',
  created_at: '2000-01-01T00:00:00Z', operation_type: 'customer_event',
  idempotency_key: 'audit-operation', identity: { userId: 'audit-user' },
  payload: { event_type: 'customer.opened_document', operation_id: 'audit-operation' } }
class Query {
  constructor(table) { this.table = table; this.filters = []; this.patch = null; this.one = false }
  select() { return this }
  update(patch) { this.patch = patch; return this }
  delete() { this.deleting = true; return this }
  eq(k,v) { this.filters.push(r => r[k] === v); return this }
  in(k,v) { this.filters.push(r => v.includes(r[k])); return this }
  lt(k,v) { this.filters.push(r => r[k] != null && r[k] < v); return this }
  lte(k,v) { this.filters.push(r => r[k] != null && r[k] <= v); return this }
  order() { return this }
  limit() { return this }
  returns() { return this }
  maybeSingle() { this.one = true; return this }
  then(resolve,reject) {
    try {
      const matches = this.table === 'customer_portal_write_outbox' && this.filters.every(f => f(row))
      if (matches && this.patch) Object.assign(row, this.patch)
      const data = matches ? (this.one ? { ...row } : [{ ...row }]) : (this.one ? null : [])
      return Promise.resolve({ data, error: null }).then(resolve,reject)
    } catch (error) { return Promise.reject(error).then(resolve,reject) }
  }
}
globalThis.__auditOutbox = {
  client: { from: table => new Query(table) },
  async dispatch() {
    // Worker A stalls; another worker reclaims the lease and starts attempt 2.
    // Represent the state that exists when A's API call finally returns.
    Object.assign(row, { status: 'processing', attempt_count: 2,
      last_attempt_at: new Date(Date.now() + 1000).toISOString() })
  },
}
await processPortalWriteOutbox(1)
assert.equal(row.attempt_count, 2)
assert.equal(row.status, 'completed')
console.log('CONFIRMED: stale attempt 1 marks another worker attempt 2 completed; completion has no lease fence')
