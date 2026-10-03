import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { OpsError } from '../lib/ops/errors.ts'

const state = globalThis.__gridexProfileActionOutcome = {
  authFailure: false, opsFailure: false, result: null,
  userId: '11111111-1111-4111-8111-111111111111', calls: [], projections: [], revalidated: [], redirects: [], queues: [], queueFailure: false,
}
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const errorsUrl = pathToFileURL(resolve(import.meta.dirname, '../lib/ops/errors.ts')).href
const mocks = {
  'next/cache': fixture('export const revalidatePath=(path)=>globalThis.__gridexProfileActionOutcome.revalidated.push(path);'),
  'next/navigation': fixture("export const redirect=(path)=>{globalThis.__gridexProfileActionOutcome.redirects.push(path);throw new Error('REDIRECT '+path)};"),
  '@/lib/supabase/server': fixture(`export const createSupabaseServerActionClient=async()=>({auth:{getUser:async()=>{
    const state=globalThis.__gridexProfileActionOutcome;
    return {data:{user:{id:state.userId,email:'verified@example.test'}},error:state.authFailure?new Error('invalid auth'):null};
  }}});`),
  '@/lib/supabase/service': fixture(`export const supabaseService={from:(table)=>({upsert:async(row)=>{
    globalThis.__gridexProfileActionOutcome.projections.push({table,row});return {error:null};
  }})};`),
  '@/lib/customerPortal/service': fixture('export const getOpsPortalIdentityForUser=async(_client,user)=>({userId:user.id,email:user.email});'),
  '@/lib/customerPortal/outbox': fixture(`export const enqueuePortalWrite=async(input)=>{
    const state=globalThis.__gridexProfileActionOutcome;if(state.queueFailure) throw new Error('durable storage unavailable');
    state.queues.push(structuredClone(input));
  };`),
  '@/lib/ops/client': fixture(`export { isOpsError } from '${errorsUrl}'; export const submitOpsCustomerProfileUpdate=async(input)=>{
    const state=globalThis.__gridexProfileActionOutcome;state.calls.push(structuredClone(input));
    if(state.opsFailure) throw state.opsFailure;
    return state.result;
  };`),
}
registerHooks({ resolve(specifier, context, nextResolve) {
  if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
  return nextResolve(specifier, context)
} })
const { updateCustomerProfileAction } = await import('../app/dashboard/profile/actions.ts')
const form = new FormData()
form.set('first_name', 'New');form.set('last_name', 'Name');form.set('phone', '+46701234567');form.set('language_code', 'sv')
form.set('client_operation_id', 'profile-operation-123');form.set('user_id', 'attacker')

for (const status of ['submitted','accepted']) {
  state.result = { ok: true, status, data: { profile_updated: false, facility_updated: false } }
  await assert.rejects(updateCustomerProfileAction(form), /REDIRECT \/dashboard\/profile\?status=profile-received/)
  assert.equal(state.projections.length, 0, 'staff intake must not fabricate an applied local OPS projection')
}
for (const status of ['rejected','failed','pending_review','unknown']) {
  state.result = { ok: true, status, data: { profile_updated: true } }
  await assert.rejects(updateCustomerProfileAction(form), /REDIRECT \/dashboard\/profile\?status=profile-sync-failed/)
  assert.equal(state.projections.length, 0, 'a rejected/unknown status must not bypass a contradictory application flag')
}
state.result = { ok: false, status: 'submitted', data: { profile_updated: true } }
await assert.rejects(updateCustomerProfileAction(form), /status=profile-sync-failed/)
assert.equal(state.projections.length, 0)
for (const status of ['submitted','accepted']) {
  state.result = { ok: true, status, data: { profile_updated: true } }
  await assert.rejects(updateCustomerProfileAction(form), /REDIRECT \/dashboard\/profile\?status=profile-updated/)
  assert.equal(state.projections.length, 0, 'even confirmed application does not fabricate a local readback from submitted values')
}
assert.equal(state.projections.length, 0)
assert.equal(state.calls.at(-1).identity.userId, state.userId, 'browser form identity never selects the profile owner')
assert.equal(state.calls.at(-1).idempotencyKey, 'profile-operation-123')

const calls = state.calls.length
state.authFailure = true
await assert.rejects(updateCustomerProfileAction(form), /Du behöver logga in igen/)
assert.equal(state.calls.length, calls)
assert.equal(state.projections.length, 0)
state.authFailure = false
state.opsFailure = new OpsError('synthetic lost response', 504, {code:'ops_request_timeout',retryable:true})
await assert.rejects(updateCustomerProfileAction(form), /status=profile-queued/)
assert.equal(state.projections.length, 0, 'a lost upstream response cannot be stamped as current local data')
assert.equal(state.queues.length, 1)
const direct = state.calls.at(-1), retained = state.queues.at(-1)
assert.equal(retained.idempotencyKey, `profile-update:${state.userId}:profile-operation-123`)
assert.equal(retained.payload.operation_id, direct.idempotencyKey)
assert.deepEqual(retained.identity, direct.identity)
assert.deepEqual(retained.payload.profile, direct.profile)
assert.deepEqual(retained.payload.metadata, direct.metadata)
for (const error of [new OpsError('config missing',503,{code:'configuration_invalid',retryable:false}),
  new OpsError('denied',403,{code:'forbidden',retryable:false}),new Error('unclassified failure')]) {
  state.opsFailure = error
  await assert.rejects(updateCustomerProfileAction(form), /status=profile-sync-failed/)
  assert.equal(state.queues.length, 1, 'false/business/unclassified failures are not retried as lost responses')
}
state.opsFailure = new OpsError('synthetic lost response',504,{code:'ops_request_timeout',retryable:true})
state.queueFailure = true
await assert.rejects(updateCustomerProfileAction(form), /status=profile-sync-failed/)
assert.equal(state.queues.length, 1, 'queue storage failure cannot claim retained retry')
console.log('Actual profile action distinguishes applied, received, rejected and lost-response outcomes')
