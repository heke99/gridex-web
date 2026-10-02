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

const state = globalThis.__gridexSupportTest = {
  authenticated: true, calls: [], rateKeys: [], rpc: [], rpcError: null, permissions: [], writes: 0,
  userId: '11111111-1111-4111-8111-111111111111',
}
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const errorsUrl = pathToFileURL(resolve('lib/ops/errors.ts')).href
const mockPortal = fixture(`
  export class CustomerPortalAccessError extends Error { constructor() { super('Logga in.'); this.status=401; this.code='unauthorized'; } }
  export const getPortalSession = async () => {
    if (!globalThis.__gridexSupportTest.authenticated) throw new CustomerPortalAccessError();
    return { supabase:{},user:{id:globalThis.__gridexSupportTest.userId,email:'verified@example.test'} };
  };
  export const getOpsPortalIdentityForUser = async (_supabase,user) => ({userId:user.id,email:user.email});
`)
const mockOps = fixture(`export { isOpsError } from '${errorsUrl}'; export const hashIp = () => 'hashed-ip';`)
const mockRate = fixture(`
  export const checkRateLimit = async (key) => { globalThis.__gridexSupportTest.rateKeys.push(key); return {allowed:true,resetAt:Date.now()+1000}; };
  export const clientIpFromHeaders = (headers) => headers.get('x-forwarded-for') || 'unknown';
`)
const mockSupport = fixture(`
  const result = {data:{case_reference:'support_case_123456789012345678901234'},request_id:'trace',contract_schema_version:'2026-10-02.2'};
  const call = async (kind,...args) => { globalThis.__gridexSupportTest.calls.push({kind,args}); return result; };
  export const fetchOpsCustomerSupportTickets = (...args) => call('list',...args);
  export const fetchOpsCustomerSupportCase = (...args) => call('detail',...args);
  export const fetchOpsCustomerSupportMessages = (...args) => call('messages',...args);
  export const fetchOpsCustomerSupportAttachments = (...args) => call('attachments',...args);
  export const createOpsCustomerSupportCase = (...args) => call('create',...args);
  export const replyOpsCustomerSupportCase = (...args) => call('reply',...args);
  export const uploadOpsCustomerSupportAttachment = (...args) => call('upload',...args);
  export const downloadOpsCustomerSupportAttachment = (...args) => call('download',...args);
  export const readBoundedSupportBytes = async (response,max) => { const data=new Uint8Array(await response.arrayBuffer()); if(data.length>max) throw new Error('too large'); return data; };
`)
const mockService = fixture(`export const supabaseService = {
  rpc: async (name,args) => {globalThis.__gridexSupportTest.rpc.push({name,args}); return {data:'private-ticket-uuid',error:globalThis.__gridexSupportTest.rpcError};}
};`)
const mockGuards = fixture(`export const requireGlobalAdminActionAccess = async (rule) => {
  const state=globalThis.__gridexSupportTest;
  if(!rule.allOf.every((permission)=>state.permissions.includes(permission))) throw new Error('Forbidden');
  return {userId:state.userId,supabase:{from:()=>{state.writes++;throw new Error('write reached');}}};
};`)
const mockCache = fixture(`export const revalidatePath = () => {};`)
registerHooks({ resolve(specifier, context, nextResolve) {
  const mocks = {
    '@/lib/customerPortal/service': mockPortal,
    '@/lib/ops/client': mockOps,
    '@/lib/ops/client/support': mockSupport,
    '@/lib/security/rateLimit': mockRate,
    '@/lib/supabase/service': mockService,
    '@/lib/admin/guards': mockGuards,
    'next/cache': mockCache,
  }
  if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
  if (specifier.startsWith('@/')) {
    const modulePath = existingModule(resolve(projectRoot, specifier.slice(2)))
    if (modulePath) return { url: pathToFileURL(modulePath).href, shortCircuit: true }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const modulePath = existingModule(resolve(dirname(fileURLToPath(context.parentURL)), specifier))
    if (modulePath) return { url: pathToFileURL(modulePath).href, shortCircuit: true }
  }
  if (['next/server', 'next/headers', 'next/navigation', 'next/cache'].includes(specifier)) return nextResolve(`${specifier}.js`, context)
  return nextResolve(specifier, context)
} })

const routes = await import('../lib/support/customerRoutes.ts')
const { POST: publicPOST } = await import('../app/api/support/public/route.ts')
const actions = await import('../app/admin/support-tickets/actions.ts')
const caseRef = 'support_case_123456789012345678901234'
const key = 'a1234567-1234-4123-8123-123456789012'
function request(body, options = {}) {
  return new Request('https://support123.gridex.se/api/web/customer/support/cases', {
    method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': key, origin: 'https://support123.gridex.se', ...options.headers },
    body: JSON.stringify(body), ...options,
  })
}

state.authenticated = false
assert.equal((await routes.supportCasesGET(new Request('https://support123.gridex.se/api/web/customer/support/cases'))).status, 401)
assert.equal((await routes.supportCasesPOST(request({ title: 'Hej', message: 'Text' }))).status, 401)
assert.equal(state.calls.length, 0, 'anonymous portal calls never reach OPS support')
state.authenticated = true
const created = await routes.supportCasesPOST(request({ title: 'Hej', message: 'Text' }, { headers: { 'content-type': 'application/json', 'Idempotency-Key': key, origin: 'https://support123.gridex.se', 'x-gridex-auth-user-id': 'attacker', 'x-gridex-customer-number': 'DX-ATTACKER' } }))
assert.equal(created.status, 201)
assert.equal(created.headers.get('cache-control'), 'private, no-store')
assert.deepEqual(state.calls.at(-1), { kind: 'create', args: [{ userId: state.userId, email: 'verified@example.test' }, { title: 'Hej', message: 'Text' }, key] })
assert.ok(state.rateKeys.includes(`ops-support-write:${state.userId}`))
let calls = state.calls.length
for (const extra of ['user_id','customer_number','external_customer_id','company_id','is_internal_note']) {
  assert.equal((await routes.supportCasesPOST(request({ title: 'Hej', message: 'Text', [extra]: 'attacker' }))).status, 400)
}
assert.equal(state.calls.length, calls)
assert.equal((await routes.supportCasesGET(new Request('https://support123.gridex.se/api/web/customer/support/cases?customer_number=DX-ATTACKER'))).status, 400)
const reply = await routes.supportMessagesPOST(request({ message: 'Svar' }), caseRef)
assert.equal(reply.status, 201)
assert.equal(state.calls.at(-1).kind, 'reply')
assert.equal(state.calls.at(-1).args[0].userId, state.userId)
calls = state.calls.length
for (const origin of ['https://attacker.invalid', 'null', 'malformed origin', 'https://support123.gridex.se.evil.invalid']) {
  assert.equal((await routes.supportCasesPOST(request({ title: 'Hej', message: 'Text' }, { headers: { 'content-type': 'application/json', 'Idempotency-Key': key, origin } }))).status, 403)
  const upload = new Request('https://support123.gridex.se/api/web/customer/support/cases/ref/attachments', { method: 'POST', headers: { 'content-type': 'application/pdf', 'Idempotency-Key': key, origin }, body: '%PDF-1.7' })
  assert.equal((await routes.supportAttachmentsPOST(upload, caseRef)).status, 403)
}
assert.equal(state.calls.length, calls, 'malformed and cross-site origins fail before OPS writes')

const contact = { name: 'Kund', email: 'EMAIL@example.test', phone: '', category: 'general', subject: 'Fråga', message: 'Text', website: '' }
const contactResponse = await publicPOST(request(contact))
assert.equal(contactResponse.status, 200)
assert.deepEqual(await contactResponse.json(), { ok: true, request_id: key }, 'anonymous response contains no database identifiers or customer data')
assert.deepEqual(state.rpc.at(-1), { name: 'gridex_create_public_support_contact', args: {
  p_request_id: key, p_name: 'Kund', p_email: 'email@example.test', p_phone: '', p_category: 'general', p_subject: 'Fråga', p_message: 'Text', p_ip_hash: 'hashed-ip',
} })
state.rpcError = { code: '22023', message: 'PUBLIC_SUPPORT_IDEMPOTENCY_CONFLICT' }
assert.equal((await publicPOST(request(contact))).status, 409)
state.rpcError = { code: '42P01', message: 'relation private_table does not exist SQL secrets API_KEY_SECRET' }
const failed = await publicPOST(request(contact))
assert.equal(failed.status, 503)
assert.doesNotMatch(JSON.stringify(await failed.json()), /private_table|SQL|API_KEY_SECRET/)
const rpcCount = state.rpc.length
assert.equal((await publicPOST(request({ ...contact, customer_id: 'attacker' }))).status, 400)
assert.equal((await publicPOST(request({ ...contact, message: 'x'.repeat(4001) }))).status, 400)
assert.equal(state.rpc.length, rpcCount)

const form = new FormData()
form.set('ticket_id', '22222222-2222-4222-8222-222222222222')
form.set('status', 'closed'); form.set('body', 'Note'); form.set('client_request_id', key)
for (const permissions of [['admin.access'], ['support_tickets.read'], ['support_tickets.manage']]) {
  state.permissions = permissions
  await assert.rejects(() => actions.assignSupportTicketAction(form), /Forbidden/)
  await assert.rejects(() => actions.updateSupportTicketStatusAction(form), /Forbidden/)
  await assert.rejects(() => actions.replyToSupportTicketAction(form), /Forbidden/)
}
assert.equal(state.writes, 0, 'staff mutations need explicit global read + exact manage/reply permission')
console.log('Support BFF runtime regressions passed: verified customer, request field isolation, malformed-origin CSRF, private responses, atomic public intake, safe errors, exact staff permissions.')
