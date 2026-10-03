import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stablePortalCustomerIdentityMatches } from '../lib/customerPortal/stableIdentity.ts'
import { parseOpsWebhookEnvelope, verifyOpsWebhookSignature } from '../lib/webhooks/opsWebhook.ts'
import { OpsError } from '../lib/ops/errors.ts'

const root = resolve(import.meta.dirname, '..')
const state = globalThis.__gridexPortalDurableIdentity = {
  tables: {}, confirmed: false, missingUser: false, ops: [], profiles: [], queries: [],
  replaceLease: false, replaceOnboardingLease: false, insertUnvalidatedJob: false, rpc: [],
  dispatchError: null, dispatchResult: null, authPatch: null,
}

class Query {
  constructor(table) { this.table = table; this.filters = []; this.action = 'select' }
  select() { return this }
  update(patch) { this.action = 'update'; this.patch = patch; return this }
  upsert(rows) { this.action = 'upsert'; this.rows = rows; return this }
  delete() { this.action = 'delete'; return this }
  eq(column, value) { this.filters.push((row) => row[column] === value); return this }
  in(column, values) { this.filters.push((row) => values.includes(row[column])); return this }
  or(expression) {
    const conditions = expression.split(',').map((condition) => condition.split('.eq.'))
    this.filters.push((row) => conditions.some(([column, value]) => row[column] === value))
    return this
  }
  lte(column, value) { this.filters.push((row) => row[column] != null && row[column] <= value); return this }
  lt(column, value) { this.filters.push((row) => row[column] != null && row[column] < value); return this }
  order() { return this }
  limit() { return this }
  returns() { return this }
  async execute(single = false) {
    state.queries.push({ table: this.table, action: this.action, patch: this.patch })
    if (this.action === 'upsert') {
      state.profiles.push({ table: this.table, rows: this.rows })
      return { data: this.rows, error: null }
    }
    const rows = (state.tables[this.table] ?? []).filter((row) => this.filters.every((filter) => filter(row)))
    const snapshot = rows.map((row) => structuredClone(row))
    if (this.action === 'update') for (const row of rows) Object.assign(row, this.patch)
    if (this.action === 'select' && this.table === 'portal_onboarding_jobs' && state.insertUnvalidatedJob) {
      state.insertUnvalidatedJob = false
      state.tables[this.table].push({ ...structuredClone(state.tables[this.table][0]), id: 'unvalidated-job',
        auth_user_id: null, payload: { ...structuredClone(state.tables[this.table][0].payload),
          application: { external_customer_id: 'other-customer', customer_number: 'OTHER' } } })
    }
    const result = this.action === 'select' ? snapshot : rows.map((row) => structuredClone(row))
    return { data: single ? result[0] ?? null : result, error: null }
  }
  maybeSingle() { return this.execute(true) }
  single() { return this.execute(true) }
  then(resolve, reject) { return this.execute().then(resolve, reject) }
}
state.client = {
  from: (table) => new Query(table),
  rpc: async (name, args) => { state.rpc.push({ name, args }); return { data: [{ result: 'applied' }], error: null } },
  auth: { admin: { getUserById: async (id) => ({ data: { user: state.missingUser ? null : {
    id, email: 'owner@example.test', email_confirmed_at: state.confirmed ? new Date().toISOString() : null,
    ...(state.authPatch ?? {}),
  } }, error: null }) } },
}
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const mockedOps = fixture(`
  const call = async (kind,input) => {
    const state=globalThis.__gridexPortalDurableIdentity; state.ops.push({kind,input});
    if(state.dispatchError) throw state.dispatchError;
    if(state.replaceOnboardingLease && kind==='portal-sync') {
      state.tables.portal_onboarding_jobs[0].locked_at='2099-01-01T00:00:00Z';
    }
    if(state.replaceLease) {
      const row=state.tables.customer_portal_write_outbox[0];
      // A stale lease can be replaced after manual replay resets the retry budget.
      // The attempt count is identical; its actual timestamp must fence the old worker.
      row.last_attempt_at='2099-01-01T00:00:00Z';
    }
    if(state.dispatchResult) return state.dispatchResult;
    if(kind==='portal-sync') return {ok:true,status:'linked',synced:{access_granted:true,portal_role:'owner',identity_id:'portal-identity'}};
    if(kind==='customer-sync') return {ok:true,status:'synced',synced:{}};
    return {ok:true,status:'accepted',data:{}};
  };
  export const getVerifiedOpsIntegrationContext = async () => ({organization_reference:'organization_abcdefghijklmnopqrst'});
  export const submitOpsCustomerPortalSync = (input) => call('portal-sync',input);
  export const markOpsCustomerNotificationsRead = (input) => call('notifications',input);
  export const sendOpsCustomerEvent = (input) => call('event',input);
  export const submitOpsCustomerMoveOut = (input) => call('move-out',input);
  export const submitOpsCustomerProfileUpdate = (input) => call('profile',input);
  export const submitOpsCustomerSync = (input) => call('customer-sync',input);
  export { OpsError, isOpsError } from '${pathToFileURL(resolve(root, 'lib/ops/errors.ts')).href}';
`)
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/ops/client') return { url: mockedOps, shortCircuit: true }
  if (specifier === '@/lib/supabase/service') return { url: fixture('export const supabaseService=globalThis.__gridexPortalDurableIdentity.client;'), shortCircuit: true }
  if (specifier === '@supabase/supabase-js') return { url: fixture('export const createClient=()=>globalThis.__gridexPortalDurableIdentity.client;'), shortCircuit: true }
  if (specifier === 'next/server') return nextResolve('next/server.js', context)
  if (specifier.startsWith('@/')) {
    const path = resolve(root, `${specifier.slice(2)}.ts`)
    if (existsSync(path)) return { url: pathToFileURL(path).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
} })
const { processPortalOnboardingJobs } = await import('../lib/customerPortal/onboarding.ts')
const { resumePortalOnboardingForConfirmedUserSafely } = await import('../lib/customerPortal/onboardingResume.ts')
const { processPortalWriteOutbox } = await import('../lib/customerPortal/outbox.ts')
const { processOpsWebhookRetries } = await import('../lib/webhooks/retry.ts')
const { POST: receiveWebhook } = await import('../app/webhooks/gridex/route.ts')
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key'

function job() {
  return { id: 'validated-job', submission_attempt_id: 'attempt-1', status: 'pending',
    auth_user_id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', attempt_count: 0, max_attempts: 10,
    next_attempt_at: '2026-01-01T00:00:00Z', locked_at: null,
    payload: { submissionAttemptId: 'attempt-1', authenticatedUserId: '11111111-1111-4111-8111-111111111111',
      email: 'contact@example.test', customerType: 'private', offerReference: 'offer',
      application: { external_customer_id: 'external-1', customer_number: 'C-1', status: 'accepted' } } }
}
state.tables = { portal_onboarding_jobs: [job()] }
await processPortalOnboardingJobs()
assert.equal(state.ops.length, 0, 'a durable authenticated UUID must not bypass fresh Auth email confirmation')
assert.equal(state.tables.portal_onboarding_jobs[0].status, 'pending')
assert.equal(state.tables.portal_onboarding_jobs[0].attempt_count, 0, 'waiting for confirmation preserves retry budget')
state.confirmed = true
state.tables = { portal_onboarding_jobs: [job()] }
await processPortalOnboardingJobs()
assert.equal(state.ops.length, 1)
assert.equal(state.tables.portal_onboarding_jobs[0].status, 'completed', 'confirmed owner keeps valid alternate contact email')
state.ops.length = 0
state.tables = { portal_onboarding_jobs: [job()] }
state.replaceOnboardingLease = true
await processPortalOnboardingJobs()
assert.equal(state.tables.portal_onboarding_jobs[0].status, 'processing', 'the old onboarding worker cannot complete or fail a replacement lock with the same attempt count')
assert.equal(state.tables.portal_onboarding_jobs[0].locked_at, '2099-01-01T00:00:00Z')
state.replaceOnboardingLease = false
state.ops.length = 0
state.missingUser = true
state.tables = { portal_onboarding_jobs: [job()] }
const beforeMissingUserUpserts = state.profiles.length
await processPortalOnboardingJobs()
assert.equal(state.ops.length, 0, 'deleted Auth users must not be linked from a stored UUID')
assert.equal(state.tables.portal_onboarding_jobs[0].status, 'manual_review')
assert.equal(state.profiles.length, beforeMissingUserUpserts, 'a missing Auth user must not receive new local projections')
state.missingUser = false

for (const [label, confirmed, authPatch, accountStatus] of [
  ['banned', true, { banned_until: '2099-01-01T00:00:00Z' }, 'active'],
  ['deleted', true, { deleted_at: '2026-10-03T12:00:00Z' }, 'active'],
  ['disabled', true, {}, 'disabled'],
  ['unconfirmed banned', false, { banned_until: '2099-01-01T00:00:00Z' }, 'active'],
  ['unconfirmed deleted', false, { deleted_at: '2026-10-03T12:00:00Z' }, 'active'],
]) {
  state.confirmed = confirmed
  state.authPatch = authPatch
  state.tables = { portal_onboarding_jobs: [job()], user_profiles: [{
    id: '11111111-1111-4111-8111-111111111111', user_status: accountStatus,
  }] }
  const opsBefore = state.ops.length
  const upsertsBefore = state.profiles.length
  await processPortalOnboardingJobs()
  const row = state.tables.portal_onboarding_jobs[0]
  assert.equal(row.status, 'manual_review', `${label} account requires review before portal reconciliation`)
  assert.equal(row.next_attempt_at, null)
  assert.equal(row.locked_at, null)
  assert.equal(row.completed_at, undefined)
  assert.equal(state.ops.length, opsBefore, `${label} account cannot send a fresh OPS assertion`)
  assert.equal(state.profiles.length, upsertsBefore, `${label} account cannot write local onboarding projections`)
}
state.confirmed = true
state.authPatch = null

for (const [httpStatus, retryable] of [[503, false], [502, false], [503, true], [400, true]]) {
  state.tables = { portal_onboarding_jobs: [job()] }
  state.dispatchError = new OpsError('Portal reconciliation could not proceed.', httpStatus, {
    code: 'portal_reconciliation_failed', retryable,
  })
  const callsBefore = state.ops.length
  const result = await processPortalOnboardingJobs()
  const row = state.tables.portal_onboarding_jobs[0]
  assert.equal(row.status, retryable ? 'retryable_failure' : 'manual_review', 'onboarding respects explicit canonical retryability across HTTP status classes')
  assert.equal(row.attempt_count, 1)
  assert.equal(row.locked_at, null)
  assert.equal(row.completed_at, undefined)
  assert.equal(result.failed, retryable ? 0 : 1)
  assert.equal(row.next_attempt_at === null, !retryable)
  assert.equal(state.ops.length, callsBefore + 1)
  // Even when manually made due, a terminal review job is excluded from the
  // automatic worker. An explicitly transient response remains retryable.
  row.next_attempt_at = '2026-01-01T00:00:00Z'
  await processPortalOnboardingJobs()
  assert.equal(state.ops.length, callsBefore + (retryable ? 2 : 1))
}
state.dispatchError = null

const profile = { external_customer_id: 'external-1', customer_number: 'C-1' }
assert.equal(stablePortalCustomerIdentityMatches(profile, { external_customer_id: 'external-1', customer_number: 'OTHER' }), false)
assert.equal(stablePortalCustomerIdentityMatches(profile, { external_customer_id: 'OTHER', customer_number: 'C-1' }), false)
assert.equal(stablePortalCustomerIdentityMatches(profile, { external_customer_id: 'external-1' }), true)
assert.equal(stablePortalCustomerIdentityMatches({}, { external_customer_id: 'external-1' }), false)
assert.equal(stablePortalCustomerIdentityMatches({ external_customer_id: 'external-1', contract_customer_ref: 'external-1' }, { external_customer_id: 'external-1', customer_number: 'C-1' }), true)

state.tables = { portal_onboarding_jobs: [job()], customer_profiles: [{ user_id: '11111111-1111-4111-8111-111111111111', ...profile }] }
state.insertUnvalidatedJob = true
await resumePortalOnboardingForConfirmedUserSafely({ userId: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test' })
assert.equal(state.tables.portal_onboarding_jobs[0].status, 'completed')
assert.equal(state.tables.portal_onboarding_jobs[1].auth_user_id, null, 'a job queued after validation cannot inherit the login identity')
assert.equal(state.tables.portal_onboarding_jobs[1].status, 'pending')

state.tables = { customer_portal_write_outbox: [{ id: 'outbox-1', user_id: '11111111-1111-4111-8111-111111111111', operation_type: 'notification_read',
  idempotency_key: 'notification-1', identity: { userId: '11111111-1111-4111-8111-111111111111' }, payload: { notification_ids: ['notification-ref'] },
  status: 'pending', attempt_count: 0, max_attempts: 10, next_attempt_at: '2026-01-01T00:00:00Z' }] }
state.replaceLease = true
await assert.rejects(() => processPortalWriteOutbox(), /Outbox failure state was lost to a concurrent worker/)
assert.equal(state.tables.customer_portal_write_outbox[0].status, 'processing', 'an old worker cannot overwrite a replacement processing lease')
assert.equal(state.tables.customer_portal_write_outbox[0].attempt_count, 1)
assert.equal(state.tables.customer_portal_write_outbox[0].last_attempt_at, '2099-01-01T00:00:00Z')
state.replaceLease = false

for (const retryable of [false, true]) {
  state.tables = { customer_portal_write_outbox: [{ id: 'outbox-retry-policy', user_id: '11111111-1111-4111-8111-111111111111', operation_type: 'notification_read',
    idempotency_key: 'notification-retry-policy', identity: { userId: '11111111-1111-4111-8111-111111111111' }, payload: { notification_ids: ['notification-ref'] },
    status: 'pending', attempt_count: 0, max_attempts: 10, next_attempt_at: '2026-01-01T00:00:00Z' }] }
  state.dispatchError = new OpsError('Tenant operation could not proceed.', 503, { code: 'tenant_operation_failed', retryable })
  const callsBefore = state.ops.length
  await processPortalWriteOutbox()
  const row = state.tables.customer_portal_write_outbox[0]
  assert.equal(row.status, retryable ? 'failed' : 'dead_letter', 'canonical retryable controls queue replay even for the same HTTP 503 status')
  assert.equal(row.attempt_count, 1)
  assert.equal(row.last_http_status, 503)
  assert.equal(row.last_error_code, 'tenant_operation_failed')
  assert.equal(Boolean(row.dead_letter_at), !retryable)
  assert.equal(state.ops.length, callsBefore + 1)
  // Force retry time due; a terminal business rejection remains out of the
  // automated queue while the explicitly transient request can dispatch again.
  row.next_attempt_at = '2026-01-01T00:00:00Z'
  await processPortalWriteOutbox()
  assert.equal(state.ops.length, callsBefore + (retryable ? 2 : 1))
}
state.dispatchError = null

for (const [operationType, payload, outcome, completed] of [
  ['profile_update', { profile: { first_name: 'Owner' } }, { ok: false, status: 'rejected' }, false],
  ['profile_update', { profile: { first_name: 'Owner' } }, { ok: false, status: 'future_status' }, false],
  ['profile_update', { profile: { first_name: 'Owner' } }, { ok: true, status: 'submitted', data: { profile_updated: false } }, true],
  ['move_out', { move_out: { facility_reference: 'facility-ref', requested_move_out_date: '2026-11-01' } }, { ok: false, status: 'rejected' }, false],
  ['move_out', { move_out: { facility_reference: 'facility-ref', requested_move_out_date: '2026-11-01' } }, { ok: true, status: 'accepted' }, true],
  ['customer_sync', { profile: { first_name: 'Owner' } }, { ok: false, status: 'rejected', synced: {} }, false],
  ['facility_data_update', { facility_data: [] }, { ok: false, status: 'rejected', synced: {} }, false],
  ['customer_portal_sync', { external_customer_id: 'external-1' }, { ok: false, status: 'pending_review', synced: { access_granted: false } }, false],
  ['customer_portal_sync', { external_customer_id: 'external-1' }, { ok: true, status: 'linked', synced: { access_granted: false, portal_role: 'owner' } }, false],
  ['customer_portal_sync', { external_customer_id: 'external-1' }, { ok: true, status: 'linked', synced: { access_granted: true, portal_role: 'staff' } }, false],
  ['customer_portal_sync', { external_customer_id: 'external-1' }, { ok: true, status: 'linked', synced: { access_granted: true, portal_role: 'owner' } }, true],
  ['notification_read', { notification_ids: ['notification-ref'] }, { ok: false }, false],
  ['notification_read', { notification_ids: ['notification-ref'] }, { ok: true }, true],
]) {
  state.tables = { customer_portal_write_outbox: [{ id: 'outbox-outcome', user_id: '11111111-1111-4111-8111-111111111111', operation_type: operationType,
    idempotency_key: `outcome-${operationType}`, identity: { userId: '11111111-1111-4111-8111-111111111111' }, payload,
    status: 'pending', attempt_count: 0, max_attempts: 10, next_attempt_at: '2026-01-01T00:00:00Z' }] }
  state.dispatchResult = outcome
  const callsBefore = state.ops.length
  const result = await processPortalWriteOutbox()
  const row = state.tables.customer_portal_write_outbox[0]
  assert.equal(row.status, completed ? 'completed' : 'dead_letter', `${operationType} must follow its business receipt, not HTTP success alone`)
  assert.equal(result.completed, completed ? 1 : 0)
  assert.equal(Boolean(row.completed_at), completed)
  if (!completed) {
    assert.equal(row.last_error_code, 'portal_outbox_business_outcome_rejected')
    assert.equal(row.last_http_status, 409)
    row.next_attempt_at = '2026-01-01T00:00:00Z'
    await processPortalWriteOutbox()
    assert.equal(state.ops.length, callsBefore + 1, 'a rejected/pending business receipt is held for review instead of automatically replayed')
  }
}
state.dispatchResult = null

const timestamp = String(Math.floor(Date.now() / 1000)), secret = 'synthetic-signing-secret', rawBody = '{"data":{}}'
const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
const verify = (value) => verifyOpsWebhookSignature({ rawBody, secret, toleranceSeconds: 300,
  headers: new Headers({ 'x-gridex-signature': `sha256=${value}`, 'x-gridex-timestamp': timestamp }) })
assert.equal(verify(signature).ok, true)
assert.equal(verify(`${signature}f`).ok, false, 'an odd trailing nibble must not be silently discarded by Buffer hex decoding')
assert.equal(verify(signature.slice(0, 63)).ok, false)
assert.equal(verify(signature.replace(/^./, signature[0] === '0' ? '1' : '0')).ok, false)
const parsed = parseOpsWebhookEnvelope({ event_id: 'event-1', event_type: 'invoice.paid', occurred_at: new Date().toISOString(),
  organization_reference: 'organization_abcdefghijklmnopqrst', subject_reference: 'invoice-ref', data: { customer_reference: 'customer-ref' } })
assert.equal(parsed.customer_id, 'customer-ref')
assert.equal(parsed.related_entity_id, 'invoice-ref', 'documented subject_reference must reach invoice projection correlation')

const validEvent = { event_id: 'event-retry', event_type: 'invoice.paid', occurred_at: '2026-10-03T17:00:00Z',
  organization_reference: 'organization_abcdefghijklmnopqrst', delivery_id: 'delivery-retry', data: { external_customer_id: 'external-1' } }
const storedEvent = { id: 'stored-retry', event_id: validEvent.event_id, event_type: validEvent.event_type,
  delivery_id: validEvent.delivery_id, organization_reference: validEvent.organization_reference, occurred_at: validEvent.occurred_at,
  payload_hash: 'signed-payload-hash', payload: validEvent, status: 'retryable_failure', next_attempt_at: '2026-01-01T00:00:00Z' }
for (const patch of [
  { organization_reference: 'organization_otherabcdefghijklmnop' },
  { delivery_id: 'other-delivery' },
  { occurred_at: '2026-10-03T17:01:00Z' },
]) {
  state.tables = { ops_webhook_events: [{ ...structuredClone(storedEvent), ...patch }] }
  const count = state.rpc.length
  await processOpsWebhookRetries()
  assert.equal(state.rpc.length, count, 'a stored webhook with mismatched signed identity cannot be projected on retry')
  assert.equal(state.tables.ops_webhook_events[0].status, 'permanent_failure')
}
state.tables = { ops_webhook_events: [structuredClone(storedEvent)] }
assert.equal((await processOpsWebhookRetries()).applied, 1)
assert.equal(state.rpc.at(-1).args.p_organization_reference, validEvent.organization_reference)


process.env.GRIDEX_WEBHOOK_SIGNING_SECRET = 'synthetic-webhook-key-32-characters-long'
const callback = { event_id: 'event_0123456789abcdef0123456789abcdef', event_type: 'customer_application.status_changed',
  created_at: '2026-10-03T17:00:00Z', organization_reference: 'organization_abcdefghijklmnopqrst',
  aggregate: { type: 'website_customer_application', reference: 'APP-1' },
  customer: { customer_reference: 'customer-ref', customer_number: 'C-1' },
  data: { application_number: 'APP-1', status: 'accepted', workflow_state: 'processing', event_code: 'accepted' },
  contract_schema_version: '2026-10-02.4' }
const callbackBody = JSON.stringify(callback)
const callbackHeaders = {
  'content-type': 'application/json', 'x-gridex-event-id': callback.event_id, 'x-gridex-delivery-id': 'callback-delivery',
  'x-gridex-timestamp': timestamp, 'x-gridex-signature': `sha256=${createHmac('sha256', process.env.GRIDEX_WEBHOOK_SIGNING_SECRET).update(`${timestamp}.${callbackBody}`).digest('hex')}`,
}
const callbackRequest = (extraHeaders = {}) => new Request('https://gridex.se/webhooks/gridex', {
  method: 'POST', headers: { ...callbackHeaders, ...extraHeaders }, body: callbackBody,
})
assert.equal((await receiveWebhook(callbackRequest())).status, 200, 'the exact documented callback headers do not need an extra event-type header')
assert.equal(state.rpc.at(-1).args.p_event_type, callback.event_type)
const rpcCount = state.rpc.length
assert.equal((await receiveWebhook(callbackRequest({ 'x-gridex-event-type': 'invoice.paid' }))).status, 400)
assert.equal(state.rpc.length, rpcCount, 'a mismatched optional legacy event-type header cannot reach durable apply')

console.log('Portal durable identity, confirmation, validated resume set, outbox leases and webhook signature/correlation regressions passed')
