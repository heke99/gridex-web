import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

const errors = new URL('../lib/ops/errors.ts', import.meta.url).href
const seams = new Map([
  ['server-only', 'export {}'],
  ['@/lib/supabase/service', 'export const supabaseService = { from: (...args) => globalThis.firstLink.from(...args) };'],
  ['@/lib/ops/customerAssertion', 'export const signCustomerAssertion = (...args) => globalThis.firstLink.sign(...args);'],
  ['@/lib/supabase/server', 'export async function createSupabaseServerActionClient() { return { auth: { getUser: async () => globalThis.firstLink.authResult } }; }'],
  ['@/lib/customerPortal/service', 'export class CustomerPortalAccessError extends Error {} export async function getOpsPortalIdentityForUser(client,user) { return { userId: user.id, email: user.email, customerNumber: "C-1001", externalCustomerId: "original-external" }; }'],
  ['@/lib/security/rateLimit', 'export const clientIpFromHeaders = () => "192.0.2.1"; export const checkRateLimit = (...args) => globalThis.firstLink.rate(...args);'],
  ['@/lib/ops/client', `export { OpsError } from ${JSON.stringify(errors)}; export const submitOpsCustomerSync = x => globalThis.firstLink.sync(x); export const submitOpsCustomerPortalSync = x => globalThis.firstLink.portal(x); export const fetchOpsCustomerResource = (...x) => globalThis.firstLink.me(...x);`],
])
registerHooks({ resolve(specifier, context, nextResolve) {
  if (seams.has(specifier)) return { url: 'data:text/javascript,' + encodeURIComponent(seams.get(specifier)), shortCircuit: true }
  return nextResolve(specifier, context)
} })
globalThis.fetch = () => { throw new Error('No real network is permitted') }
const { linkExistingPortalCustomer } = await import('../lib/customerPortal/existingCustomerLink.ts')
const id = '11111111-1111-4111-8111-111111111111'
const user = { id, email: 'Owner@Example.com', email_confirmed_at: '2026-10-19T10:00:00Z' }

function fixture(options = {}) {
  const f = {
    profile: options.profile ?? null, calls: [], writes: [], options, authResult: { data: { user }, error: null },
    async rate(key, limits) { this.calls.push(['rate',key,limits]); return { allowed: !options.rateDenied, source: options.rateUnavailable ? 'unavailable' : 'shared', resetAt: Date.now()+30000 } },
    sign(subject) { this.calls.push(['sign', subject]); return options.noAssertion ? null : 'local-proof' },
    async sync(input) { this.calls.push(['sync', input]); if (options.syncError) throw options.syncError
      return { ok: !options.syncPending, status: options.syncPending ? 'pending' : 'synced', synced: { customer_number: options.wrongSyncNumber ? 'C-OTHER' : 'C-1001', external_customer_id: 'original-external' } } },
    async portal(input) { this.calls.push(['portal', input]); const synced = { access_granted: !options.portalPending, portal_role: options.viewer ? 'viewer' : 'owner', customer_number: options.wrongPortalNumber ? 'C-OTHER' : 'C-1001', external_customer_id: options.wrongPortalExternal ? 'other-external' : 'original-external', auth_user_id: options.wrongPortalSubject ? 'other-subject' : id, customer_portal_user_id: options.wrongPortalUser ? 'other-subject' : id }
      for (const field of options.omitSubjects ?? []) delete synced[field]
      for (const field of options.nullSubjects ?? []) synced[field] = null
      return { ok: !options.portalPending, status: options.portalPending ? 'pending_review' : 'linked', synced } },
    async me(identity, resource) { this.calls.push(['me', identity, resource]); if (options.meError) throw options.meError
      if (options.concurrentCustomer) this.profile = { customer_number: 'C-OTHER', external_customer_id: 'other-external' }
      return { data: { customer_number: options.wrongMeNumber ? 'C-OTHER' : 'C-1001', email: options.wrongEmail ? 'other@example.com' : 'owner@example.com', external_customer_id: options.wrongExternal ? 'other-external' : 'original-external' } } },
    from(table) {
      assert.equal(table, 'customer_profiles', 'No Auth/jobs/submissions/roles may be created or changed')
      const predicates = []
      let payload, insertion = false
      return {
        select() { return this },
        eq(k,v) { predicates.push([k,v]); return this },
        is(k,v) { predicates.push([k,v]); return this },
        update(p) { payload=p; return this },
        upsert(rows, opts) { assert.equal(opts.ignoreDuplicates, true); payload=rows[0]; insertion=true; return this },
        async maybeSingle() {
          if (options.profileReadError && !payload) return { data: null, error: { message: 'database unavailable' } }
          if (!payload) return { data: f.profile ? structuredClone(f.profile) : null, error: null }
          if (options.casRace) f.profile = { user_id: id, customer_number: 'C-OTHER', external_customer_id: 'other-external' }
          const current=f.profile ? { user_id: id, ...f.profile } : null
          if (insertion && current || !insertion && (!current || !predicates.every(([k,v]) => (current[k] ?? null) === v))) return { data: null, error: null }
          f.writes.push(structuredClone(payload));f.profile={ ...f.profile, ...payload };return { data: { user_id: id }, error: null }
        },
      }
    },
  }
  globalThis.firstLink = f
  return f
}
const invoke = (overrides = {}) => linkExistingPortalCustomer({ user, customerNumber: 'C-1001', operationId: 'operation-1', ...overrides })

test('ordinary first link uses real session identity, canonical original reference, explicit link result and readback before local CAS', async () => {
  const f=fixture();const result=await invoke()
  assert.equal(result.ok,true);assert.equal(result.status,'linked')
  assert.deepEqual(f.calls.map(x=>x[0]),['sign','sync','portal','me'])
  for (const [,input] of f.calls.filter(x=>['sync','portal'].includes(x[0]))) {
    assert.equal(input.identity.userId,id);assert.equal(input.identity.email,'owner@example.com');assert.equal(input.identity.customerNumber,'C-1001')
  }
  assert.equal(f.calls.find(x=>x[0]==='portal')[1].externalCustomerId,'original-external')
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].user_id,id);assert.equal(f.writes[0].customer_number,'C-1001')
})
for (const [name,patch] of [
  ['unverified email',{email_confirmed_at:null}],['anonymous login',{is_anonymous:true}],
  ['missing email',{email:null}],['deleted account',{deleted_at:'2026-10-19T10:00:00Z'}],
  ['banned account',{banned_until:'2099-01-01T00:00:00Z'}],
]) test(name+' is refused before any API or local write',async()=>{
  const f=fixture();await assert.rejects(invoke({user:{...user,...patch}}));assert.equal(f.calls.length,0);assert.equal(f.writes.length,0)
})
for (const value of ['', ' ', '../C-1001', 'C-1001\nother', {}, 'x'.repeat(101)]) test('invalid explicit customer number '+JSON.stringify(value),async()=>{
  const f=fixture();await assert.rejects(invoke({customerNumber:value}));assert.equal(f.calls.length,0);assert.equal(f.writes.length,0)
})
test('first link fails closed when server assertion configuration is unavailable',async()=>{
  const f=fixture({noAssertion:true});await assert.rejects(invoke());assert.deepEqual(f.calls.map(x=>x[0]),['sign']);assert.equal(f.writes.length,0)
})
test('a stable existing customer cannot be replaced by request input',async()=>{
  const f=fixture({profile:{customer_number:'C-OTHER',external_customer_id:'other-external'}})
  await assert.rejects(invoke());assert.ok(!f.calls.some(x=>x[0]==='sync'));assert.equal(f.writes.length,0)
})
test('an existing external-only link is not repointed by guessing a customer number',async()=>{
  const f=fixture({profile:{external_customer_id:'existing-external'}});await assert.rejects(invoke());assert.ok(!f.calls.some(x=>x[0]==='sync'));assert.equal(f.writes.length,0)
})
for (const options of [{syncPending:true},{wrongSyncNumber:true},{portalPending:true},{viewer:true},{wrongPortalNumber:true},{wrongPortalExternal:true},{wrongPortalSubject:true},{meError:new Error('read denied')},{wrongMeNumber:true},{wrongEmail:true},{wrongExternal:true},{profileReadError:true},{concurrentCustomer:true},{casRace:true}]) {
  test('incomplete, conflicting or concurrent result never stores a successful local link '+Object.keys(options)[0],async()=>{
    const f=fixture(options);await assert.rejects(invoke());assert.equal(f.writes.length,0)
  })
}
test('retry preserves operation identifiers and original canonical external reference',async()=>{
  const f=fixture();await invoke();await invoke()
  const calls=f.calls.filter(x=>['sync','portal'].includes(x[0]));assert.deepEqual(calls[0][1],calls[2][1]);assert.deepEqual(calls[1][1],calls[3][1])
  assert.equal(f.profile.external_customer_id,'original-external')
})
for (const fields of [['auth_user_id'], ['customer_portal_user_id'], ['auth_user_id','customer_portal_user_id']]) {
  for (const mode of ['omitSubjects','nullSubjects']) test('link requires both explicit matching subjects: '+mode+' '+fields.join(','),async()=>{
    const f=fixture({[mode]:fields});await assert.rejects(invoke());assert.ok(!f.calls.some(x=>x[0]==='me'));assert.equal(f.writes.length,0)
  })
}
test('a different portal-user subject is refused before readback or local write',async()=>{
  const f=fixture({wrongPortalUser:true});await assert.rejects(invoke());assert.ok(!f.calls.some(x=>x[0]==='me'));assert.equal(f.writes.length,0)
})

const { POST } = await import('../app/api/web/customer-portal/sync/route.ts')
const request = (body = {}, headers = {}) => new Request('https://gridex.se/api/web/customer-portal/sync', {
  method:'POST',headers:{'Content-Type':'application/json','Origin':'https://gridex.se',...headers},
  body:JSON.stringify({client_operation_id:'portal-link:operation-1',customer_number:'C-1001',...body}),
})
test('actual route derives user and email exclusively from Auth, ignoring client identity/role/mode fields',async()=>{
  const f=fixture();const response=await POST(request({user_id:'other',auth_user_id:'other',email:'attacker@example.com',mode:'link',role:'owner'}))
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/)
  assert.equal((await response.json()).data.synced.access_granted,true)
  assert.equal(f.calls.find(x=>x[0]==='sync')[1].identity.userId,id)
  assert.equal(f.calls.find(x=>x[0]==='sync')[1].identity.email,'owner@example.com')
  assert.equal(f.writes[0].user_id,id)
})
for (const authResult of [{data:{user:null},error:null},{data:{user},error:{message:'verification failed'}}]) {
  test('missing or failed native Auth is401 before body/rate/API/profile operations',async()=>{
    const f=fixture();f.authResult=authResult;const response=await POST(request());assert.equal(response.status,401);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0)
  })
}
test('foreign origin is blocked before rate/API/profile operations',async()=>{
  const f=fixture();const response=await POST(request({}, {'Origin':'https://other.example'}));assert.equal(response.status,403);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0)
})
for (const options of [{rateDenied:true},{rateDenied:true,rateUnavailable:true}]) test('distributed limiter refuses link '+JSON.stringify(options),async()=>{
  const f=fixture(options);const response=await POST(request());assert.equal(response.status,options.rateUnavailable?503:429);assert.ok(Number(response.headers.get('retry-after'))>=1);assert.ok(f.calls.every(x=>x[0]==='rate'));assert.equal(f.writes.length,0)
})
test('body limit is enforced before link providers or profiles',async()=>{
  const f=fixture();const response=await POST(request({padding:'x'.repeat(2100)}));assert.equal(response.status,413);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0)
})
test('ordinary linked-account recovery without a customer number retains its existing API path',async()=>{
  const f=fixture();const response=await POST(request({customer_number:undefined}));assert.equal(response.status,200);assert.deepEqual(f.calls.map(x=>x[0]),['portal']);assert.equal(f.writes.length,0)
})
