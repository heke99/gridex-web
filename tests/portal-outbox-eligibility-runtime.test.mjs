import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = resolve(import.meta.dirname, '..')
const userId = '11111111-1111-4111-8111-111111111111'
const state = globalThis.__gridexOutboxEligibility = { rows: [], authReads: [], dispatches: [], profileReads: [] }
const confirmedUser = () => ({ id: userId, email_confirmed_at: '2026-01-01T00:00:00Z' })
class Query {
  constructor(table) { this.table = table; this.filters = []; this.operation = 'select' }
  select() { return this }
  returns() { return this }
  order() { return this }
  limit() { return this }
  eq(key, value) { this.filters.push((row) => row[key] === value); return this }
  in(key, values) { this.filters.push((row) => values.includes(row[key])); return this }
  lt(key, value) { this.filters.push((row) => row[key] < value); return this }
  lte(key, value) { this.filters.push((row) => row[key] <= value); return this }
  or(expression) { state.profileReads.push(expression); return this }
  update(payload) { this.operation = 'update'; this.payload = payload; return this }
  delete() { this.operation = 'delete'; return this }
  maybeSingle() { return this.execute(true) }
  then(onfulfilled, onrejected) { return this.execute(false).then(onfulfilled, onrejected) }
  async execute(single) {
    if (this.table === 'distributed_rate_limits') return { data: [], error: null }
    if (this.table === 'user_profiles') return { data: state.profile, error: state.profileError }
    assert.equal(this.table, 'customer_portal_write_outbox')
    const rows = state.rows.filter((row) => this.filters.every((filter) => filter(row)))
    if (this.operation === 'update') rows.forEach((row) => Object.assign(row, structuredClone(this.payload)))
    return { data: structuredClone(single ? rows[0] ?? null : rows), error: null }
  }
}
state.service = {
  from: (table) => new Query(table),
  auth: { admin: { getUserById: async (id) => {
    state.authReads.push(id)
    const user = state.authSequence?.shift() ?? state.authUser
    return { data: { user }, error: state.authError }
  } } },
}
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const errorsUrl = pathToFileURL(resolve(projectRoot, 'lib/ops/errors.ts')).href
const mocks = {
  '@supabase/supabase-js': fixture('export const createClient=()=>globalThis.__gridexOutboxEligibility.service;'),
  '@/lib/supabase/service': fixture('export const supabaseService=globalThis.__gridexOutboxEligibility.service;'),
  '@/lib/ops/client': fixture(`
    export { OpsError, isOpsError } from '${errorsUrl}';
    const dispatch=async (...args)=>{globalThis.__gridexOutboxEligibility.dispatches.push(structuredClone(args));return {ok:true,status:'accepted'}};
    export const sendOpsCustomerEvent=dispatch;
    export const markOpsCustomerNotificationsRead=dispatch;
    export const submitOpsCustomerMoveOut=dispatch;
    export const submitOpsCustomerProfileUpdate=dispatch;
    export const submitOpsCustomerSync=dispatch;
    export const submitOpsCustomerPortalSync=async(...args)=>{await dispatch(...args);return {ok:true,status:'linked',synced:{access_granted:true,portal_role:'owner'}}};
  `),
}
function existingModule(candidate) {
  const choices = extname(candidate) ? [candidate] : [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}.js`, resolve(candidate, 'index.ts')]
  return choices.find((path) => existsSync(path) && statSync(path).isFile())
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
  return nextResolve(specifier, context)
} })
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service-key'
const { processPortalWriteOutbox } = await import('../lib/customerPortal/outbox.ts')
const payloads = {
  customer_event: { event_type: 'customer.opened_document', occurred_at: '2026-10-03T17:00:00Z' },
  notification_read: { notification_ids: ['notification_123'] },
  profile_update: { profile: { phone: '+46701234567' } },
  customer_sync: { profile: { phone: '+46701234567' } },
  customer_portal_sync: { customer_number: 'GX123' },
  move_out: { move_out: { move_out_date: '2026-12-01' } },
  facility_data_update: { facility_data: { facility_reference: 'facility_123', address: { city: 'Uppsala' } } },
}
function row(operation = 'customer_event') {
  return { id: crypto.randomUUID(), user_id: userId, identity: { userId, email: 'previous@example.test' },
    operation_type: operation, idempotency_key: crypto.randomUUID(), payload: payloads[operation],
    attempt_count: 0, max_attempts: 10, status: 'pending', next_attempt_at: '2020-01-01T00:00:00Z' }
}
function reset() {
  Object.assign(state, { rows: [row()], authReads: [], profileReads: [], dispatches: [],
    authUser: confirmedUser(), authSequence: null, authError: null, profile: { user_status: 'active' }, profileError: null })
}
for (const [description, user, profile, code] of [
  ['deleted Auth user', null, { user_status: 'active' }, 'portal_outbox_auth_user_missing'],
  ['deleted timestamp', { ...confirmedUser(), deleted_at: '2026-01-01T00:00:00Z' }, { user_status: 'active' }, 'portal_outbox_auth_user_missing'],
  ['unconfirmed Auth user', { id: userId }, { user_status: 'active' }, 'portal_outbox_auth_user_unconfirmed'],
  ['future Auth ban', { ...confirmedUser(), banned_until: '9999-12-31T00:00:00Z' }, { user_status: 'active' }, 'portal_outbox_auth_user_banned'],
  ['invalid Auth ban', { ...confirmedUser(), banned_until: 'invalid' }, { user_status: 'active' }, 'portal_outbox_auth_user_banned'],
  ['disabled profile', confirmedUser(), { user_status: 'disabled' }, 'customer_account_disabled'],
  ['suspended profile', confirmedUser(), { user_status: 'suspended' }, 'customer_account_disabled'],
]) {
  reset(); state.authUser = user; state.profile = profile
  assert.equal((await processPortalWriteOutbox()).failed, 1, description)
  assert.equal(state.dispatches.length, 0, `${description} must not reach fresh OPS assertion generation`)
  assert.equal(state.rows[0].status, 'dead_letter', description)
  assert.equal(state.rows[0].last_error_code, code, description)
}
for (const operation of Object.keys(payloads)) {
  reset(); state.rows = [row(operation)]; state.authUser = { id: userId }
  assert.equal((await processPortalWriteOutbox()).failed, 1)
  assert.equal(state.dispatches.length, 0, `${operation} checks current eligibility before dispatch`)
  assert.equal(state.rows[0].last_error_code, 'portal_outbox_auth_user_unconfirmed')
}
reset(); state.rows[0].identity.userId = '22222222-2222-4222-8222-222222222222'
assert.equal((await processPortalWriteOutbox()).failed, 1)
assert.equal(state.rows[0].last_error_code, 'portal_outbox_identity_invalid')
assert.equal(state.authReads.length, 0)
assert.equal(state.dispatches.length, 0)
for (const [authError, status] of [[{ status: 404 }, 'dead_letter'], [{ status: 503 }, 'failed']]) {
  reset(); state.authError = authError
  assert.equal((await processPortalWriteOutbox()).failed, 1)
  assert.equal(state.rows[0].status, status)
  assert.equal(state.dispatches.length, 0)
}
reset(); state.profileError = { message: 'temporary account read failure' }
assert.equal((await processPortalWriteOutbox()).failed, 1)
assert.equal(state.rows[0].status, 'failed', 'account lookup outages retain a retry without dispatch')
assert.equal(state.dispatches.length, 0)
assert.ok(Date.parse(state.rows[0].next_attempt_at) > Date.now())
for (const profile of [{ user_status: 'active' }, null]) {
  reset(); state.profile = profile; state.authUser.banned_until = '2020-01-01T00:00:00Z'
  assert.equal((await processPortalWriteOutbox()).completed, 1, 'active and verified auth-only onboarding accounts remain eligible')
  assert.deepEqual(state.authReads, [userId])
  assert.deepEqual(state.profileReads, [`user_id.eq.${userId},id.eq.${userId}`])
  assert.equal(state.dispatches.length, 1)
}
reset(); state.rows.push(row()); state.authSequence = [confirmedUser(), { id: userId }]
assert.deepEqual(await processPortalWriteOutbox(), { processed: 2, completed: 1, failed: 1 })
assert.deepEqual(state.authReads, [userId, userId], 'eligibility is fresh for each claimed operation and never cached across account changes')
assert.equal(state.dispatches.length, 1)
assert.equal(state.rows[1].status, 'dead_letter')
console.log('Actual outbox worker checks fresh Auth/account eligibility before every operation dispatch')
