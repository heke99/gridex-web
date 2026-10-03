import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, extname, resolve } from 'node:path'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
function existingModule(candidate) {
  const choices = extname(candidate) ? [candidate] : [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}.js`, `${candidate}.mjs`, resolve(candidate, 'index.ts')]
  return choices.find((path) => existsSync(path) && statSync(path).isFile())
}
const state = globalThis.__gridexEventTest = {
  userId: '11111111-1111-4111-8111-111111111111', calls: [], fail: false, rows: [],
}
class Query {
  constructor(table) { this.table = table; this.filters = []; this.operation = 'select' }
  select() { return this }
  returns() { return this }
  order() { return this }
  limit() { return this }
  eq(key, value) { this.filters.push((row) => row[key] === value); return this }
  in(key, values) { this.filters.push((row) => values.includes(row[key])); return this }
  or(expression) {
    const conditions = expression.split(',').map((condition) => condition.split('.eq.'))
    this.filters.push((row) => conditions.some(([key, value]) => row[key] === value))
    return this
  }
  lt(key, value) { this.filters.push((row) => row[key] < value); return this }
  lte(key, value) { this.filters.push((row) => row[key] <= value); return this }
  insert(payload) { this.operation = 'insert'; this.payload = payload; return this }
  update(payload) { this.operation = 'update'; this.payload = payload; return this }
  delete() { this.operation = 'delete'; return this }
  maybeSingle() { return this.execute(true) }
  then(onfulfilled, onrejected) { return this.execute(false).then(onfulfilled, onrejected) }
  async execute(single) {
    if (this.table === 'distributed_rate_limits') return { data: [], error: null }
    if (this.table === 'user_profiles') return { data: { user_status: 'active' }, error: null }
    assert.equal(this.table, 'customer_portal_write_outbox')
    let rows = state.rows.filter((row) => this.filters.every((filter) => filter(row)))
    if (this.operation === 'insert') {
      if (state.rows.some((row) => row.idempotency_key === this.payload.idempotency_key)) {
        return { data: null, error: { code: '23505', message: 'duplicate idempotency key' } }
      }
      const row = { id: crypto.randomUUID(), attempt_count: 0, max_attempts: 10, ...structuredClone(this.payload) }
      state.rows.push(row); rows = [row]
    } else if (this.operation === 'update') rows.forEach((row) => Object.assign(row, structuredClone(this.payload)))
    return { data: structuredClone(single ? rows[0] ?? null : rows), error: null }
  }
}
state.service = {
  from: (table) => new Query(table),
  auth: {
    getUser: async () => ({ data: { user: { id: state.userId, email: 'verified@example.test' } }, error: null }),
    admin: { getUserById: async (id) => ({ data: { user: { id, email_confirmed_at: '2026-01-01T00:00:00Z' } }, error: null }) },
  },
}
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const errorsUrl = pathToFileURL(resolve(projectRoot, 'lib/ops/errors.ts')).href
const mocks = {
  '@/lib/supabase/service': fixture('export const supabaseService=globalThis.__gridexEventTest.service;'),
  '@/lib/supabase/server': fixture('export const createSupabaseServerActionClient = async () => globalThis.__gridexEventTest.service;'),
  '@supabase/supabase-js': fixture('export const createClient = () => globalThis.__gridexEventTest.service;'),
  '@/lib/customerPortal/service': fixture(`
    export class CustomerPortalAccessError extends Error {}
    export const getOpsPortalIdentityForUser = async (_client,user) => ({userId:user.id,email:user.email});
    export const getCanonicalCustomerResource = () => {throw new Error('Unexpected resource read');};
  `),
  '@/lib/ops/client': fixture(`
    import { OpsError } from '${errorsUrl}';
    export { OpsError, isOpsError } from '${errorsUrl}';
    export const isOpsCustomerEventType = (type) => ['customer.opened_document','customer.downloaded_document'].includes(type);
    export const sendOpsCustomerEvent = async (identity,event) => {
      const state=globalThis.__gridexEventTest;
      state.calls.push(structuredClone({identity,event}));
      if(state.fail) throw new OpsError('Timed out',504,{code:'ops_request_timeout',retryable:true});
      return {status:'accepted'};
    };
    export const markOpsCustomerNotificationsRead = () => {throw new Error('Unexpected notification');};
    export const submitOpsCustomerMoveOut = () => {throw new Error('Unexpected move out');};
    export const submitOpsCustomerPortalSync = () => {throw new Error('Unexpected portal sync');};
    export const submitOpsCustomerProfileUpdate = async (input) => {
      const state=globalThis.__gridexEventTest;
      state.calls.push(structuredClone({profileUpdate:input}));
      if(state.fail) throw new OpsError('Timed out',504,{code:'ops_request_timeout',retryable:true});
      return {ok:true,status:'submitted',data:{completion_reference:'completion_address',facility_updated:false}};
    };
    export const submitOpsCustomerSync = () => {throw new Error('Unexpected sync');};
  `),
}
registerHooks({ resolve(specifier, context, nextResolve) {
  if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
  if (specifier.startsWith('@/')) {
    const path = existingModule(resolve(projectRoot, specifier.slice(2)))
    if (path) return { url: pathToFileURL(path).href, shortCircuit: true }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const path = existingModule(resolve(dirname(fileURLToPath(context.parentURL)), specifier))
    if (path) return { url: pathToFileURL(path).href, shortCircuit: true }
  }
  if (specifier === 'next/server') return nextResolve('next/server.js', context)
  return nextResolve(specifier, context)
} })

const { POST } = await import('../app/api/web/customer/events/route.ts')
const { POST: profileUpdate } = await import('../app/api/web/customer/profile-update/route.ts')
const { enqueuePortalWrite, processPortalWriteOutbox } = await import('../lib/customerPortal/outbox.ts')
const occurredAt = '2026-10-03T17:00:00.000Z'
const body = {
  event_type: 'customer.opened_document', entity_type: 'document', entity_id: 'document_123',
  client_operation_id: 'event-operation-123', occurred_at: occurredAt,
}
const request = (payload) => new Request('https://gridex.se/api/web/customer/events', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://gridex.se', 'x-gridex-auth-user-id': 'attacker' },
  body: JSON.stringify(payload),
})
assert.equal((await POST(request(body))).status, 200)
assert.equal((await POST(request(body))).status, 200)
assert.deepEqual(state.calls[1], state.calls[0], 'the real BFF forwards the original event evidence unchanged on replay')
assert.equal(state.calls[0].identity.userId, state.userId)
assert.equal(state.calls[0].event.occurred_at, occurredAt)
for (const timestamp of [undefined, '2026-02-30T12:00:00Z', '2026-10-03', '2026-10-03T25:00:00Z']) {
  const result = await POST(request({ ...body, occurred_at: timestamp }))
  assert.equal(result.status, 400)
  assert.equal((await result.json()).error.field, 'occurred_at')
}
assert.equal(state.calls.length, 2, 'invalid or missing time fails before OPS writes')

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service-key'
const queued = {
  userId: state.userId, operationType: 'customer_event', idempotencyKey: 'queued-event-123',
  identity: { userId: state.userId, email: 'verified@example.test' },
  payload: { event_type: body.event_type, entity_type: body.entity_type, entity_id: body.entity_id,
    operation_id: body.client_operation_id, occurred_at: occurredAt },
}
await enqueuePortalWrite(queued)
await enqueuePortalWrite(queued)
assert.equal(state.rows.length, 1, 'an exact re-enqueue retains one durable operation')
await assert.rejects(enqueuePortalWrite({ ...queued, payload: { ...queued.payload, occurred_at: '2026-10-03T17:01:00.000Z' } }),
  (error) => error.code === 'idempotency_conflict')
state.fail = true
assert.equal((await processPortalWriteOutbox()).failed, 1)
state.fail = false
state.rows[0].next_attempt_at = '2020-01-01T00:00:00.000Z'
assert.equal((await processPortalWriteOutbox()).completed, 1)
assert.deepEqual(state.calls.at(-1), state.calls.at(-2), 'durable dispatch keeps timestamp and operation identity after timeout')
assert.equal(state.calls.at(-1).event.occurred_at, occurredAt)

state.rows.push({ ...structuredClone(state.rows[0]), id: crypto.randomUUID(), idempotency_key: 'legacy-event',
  status: 'pending', next_attempt_at: '2020-01-01T00:00:00.000Z', payload: { event_type: body.event_type } })
const before = state.calls.length
assert.equal((await processPortalWriteOutbox()).failed, 1)
assert.equal(state.calls.length, before, 'historical events without the original wire time are never replayed with invented evidence')
assert.equal(state.rows.at(-1).status, 'dead_letter')
assert.equal(state.rows.at(-1).last_error_code, 'customer_event_replay_evidence_missing')
await assert.rejects(enqueuePortalWrite({ ...queued, idempotencyKey: 'new-missing-event', payload: { event_type: body.event_type } }),
  (error) => error.code === 'validation_error' && error.details.field === 'occurred_at')

const address = { facility_reference: 'facility_canonical', address: { street: 'Ny gata 2', postal_code: '23456', city: 'Uppsala', country: 'SE' } }
const profileBody = { facility_data: address, client_operation_id: 'address-operation-123' }
assert.equal((await profileUpdate(request(profileBody))).status, 200)
assert.equal((await profileUpdate(request(profileBody))).status, 200)
assert.deepEqual(state.calls.at(-1), state.calls.at(-2), 'actual facility-only BFF preserves payload and operation on exact replay')
assert.equal(state.calls.at(-1).profileUpdate.identity.userId, state.userId)
assert.equal(state.calls.at(-1).profileUpdate.profile, null)
assert.deepEqual(state.calls.at(-1).profileUpdate.facilityData, address)
assert.equal((await profileUpdate(request({ ...profileBody, profile: { phone: '+46701234567' } }))).status, 200)
assert.equal(state.calls.at(-1).profileUpdate.profile.phone, '+46701234567', 'combined updates preserve both documented sections')
const beforeInvalidProfile = state.calls.length
for (const invalid of [{ ...profileBody, facility_data: { ...address, customer_number: 'DX-ATTACKER' } },
  { ...profileBody, facility_data: { ...address, price_area: 'SE1' } },
  { ...profileBody, facility_data: {} }, { ...profileBody, profile: {} },
  { ...profileBody, client_operation_id: undefined }]) {
  assert.equal((await profileUpdate(request(invalid))).status, 400)
}
assert.equal(state.calls.length, beforeInvalidProfile, 'invalid supplied sections are rejected rather than silently omitted')
await enqueuePortalWrite({ userId: state.userId, operationType: 'profile_update', idempotencyKey: 'queued-address-123',
  identity: { userId: state.userId, email: 'verified@example.test' },
  payload: { facility_data: address, operation_id: profileBody.client_operation_id } })
state.fail = true
assert.equal((await processPortalWriteOutbox()).failed, 1)
state.fail = false
state.rows.at(-1).next_attempt_at = '2020-01-01T00:00:00.000Z'
assert.equal((await processPortalWriteOutbox()).completed, 1)
assert.deepEqual(state.calls.at(-1), state.calls.at(-2), 'durable facility address dispatch preserves exact evidence after timeout')
assert.deepEqual(state.calls.at(-1).profileUpdate.facilityData, address)
await enqueuePortalWrite({ userId: state.userId, operationType: 'profile_update', idempotencyKey: 'invalid-queued-address',
  identity: { userId: state.userId, email: 'verified@example.test' },
  payload: { profile: { phone: '+46701234567' }, facility_data: { ...address, price_area: 'SE1' } } })
const beforeInvalidDispatch = state.calls.length
assert.equal((await processPortalWriteOutbox()).failed, 1)
assert.equal(state.calls.length, beforeInvalidDispatch, 'invalid durable address cannot silently become a contact-only update')
assert.equal(state.rows.at(-1).status, 'dead_letter')
console.log('Event and facility-update BFF/durable replay evidence regressions passed')
