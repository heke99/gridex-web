import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import {
  AccessDeniedError, assertActionAccess, canAccessByRule, canEnterAdminConsole,
  cisOperationRule, normalizePermissions, pricingPublishRule,
} from '../lib/admin/access.ts'
import { getWebCompanyId } from '../lib/auth/tenant.ts'

const staff = { userId: 'staff-1', permissions: ['admin.access', 'support_tickets.manage'], roles: ['admin'], isAdmin: true }
assert.equal(canEnterAdminConsole(staff.permissions), true)
for (const permission of ['pricing.write', 'pricing.publish', 'pricing.publish_prod', 'rbac.write', 'users.write', 'integrations.write']) {
  assert.throws(() => assertActionAccess(staff, { allOf: [permission] }), AccessDeniedError,
    `console access and role labels never imply ${permission}`)
}
assert.throws(() => assertActionAccess({ userId: '', permissions: ['pricing.write'] }, { allOf: ['pricing.write'] }),
  (error) => error.status === 401)
assert.equal(canEnterAdminConsole(['customer.access']), false)
assert.equal(canAccessByRule(['pricing.publish'], pricingPublishRule(true)), false)
assert.equal(canAccessByRule(['pricing.publish_prod'], pricingPublishRule(true)), true)
assert.equal(canAccessByRule(['pricing.write'], pricingPublishRule(false)), false)
assert.equal(canAccessByRule(['cis.sync.write'], cisOperationRule('resend_signature')), false)
assert.equal(canAccessByRule(['cis.signature.write'], cisOperationRule('retry')), false)
assert.deepEqual(normalizePermissions(['pricing.read', 99, null, 'pricing.read']), ['pricing.read'])
assert.equal(canAccessByRule(['a'], { allOf: ['a'], anyOf: [] }), false)
assert.equal(canAccessByRule(['a'], { allOf: ['a'], anyOf: ['b'] }), false)

const originalCompanyId = process.env.GRIDEX_WEB_COMPANY_ID
delete process.env.GRIDEX_WEB_COMPANY_ID
assert.equal(getWebCompanyId(), null, 'unset company scope grants global roles only')
process.env.GRIDEX_WEB_COMPANY_ID = 'organization_ops_opaque_reference'
assert.throws(() => getWebCompanyId(), /local authentication company/)
process.env.GRIDEX_WEB_COMPANY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
assert.equal(getWebCompanyId(), process.env.GRIDEX_WEB_COMPANY_ID)
if (originalCompanyId === undefined) delete process.env.GRIDEX_WEB_COMPANY_ID
else process.env.GRIDEX_WEB_COMPANY_ID = originalCompanyId

// Exercise the real server guards/actions with mocked authenticated context and
// privileged I/O. A denial must happen before a service client or mutation.
const state = globalThis.__gridexRbacTest = { context: staff, globalPermissions: [], writes: 0, serviceClients: 0, rpcCalls: [], operations: [], reads: 0 }
const serviceStub = {
  rpc: async (name, args) => { state.rpcCalls.push({ name, args }); return { data: state.globalPermissions, error: null } },
  from(table) {
    return {
      select() { return this }, eq() { return this },
      async maybeSingle() { state.reads++; return { data: table === 'contract_pricing_versions' ? state.version : state.contract, error: null } },
      insert() { state.writes++; throw new Error('mutation reached') },
      update() { state.writes++; throw new Error('mutation reached') },
      delete() { state.writes++; throw new Error('mutation reached') },
    }
  },
}
state.service = serviceStub
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const mockContext = fixture('export const getAdminContext = async () => globalThis.__gridexRbacTest.context;')
const mockService = fixture('export const supabaseService = globalThis.__gridexRbacTest.service;')
const mockNextCache = fixture('export const revalidatePath = () => {};')
const mockNextNavigation = fixture('export const redirect = (url) => { throw new Error(`redirect:${url}`); };')
const mockSupabase = fixture('export const createClient = () => { globalThis.__gridexRbacTest.serviceClients++; return globalThis.__gridexRbacTest.service; };')
const mockAudit = fixture('export const logPermissionAudit = async () => {};')
const mockNextServer = fixture('export class NextRequest extends Request {} export class NextResponse extends Response { static json(data, init) { return new NextResponse(JSON.stringify(data), { ...init, headers: { \'content-type\': \'application/json\' } }); } }')
const mockCis = fixture('export const runCisActionOperation = async (_service, args) => { globalThis.__gridexRbacTest.operations.push(args); return { ok: true }; };')
const mockOutbox = fixture('export const replayPortalWriteOutbox = async (id) => { globalThis.__gridexRbacTest.operations.push({ id }); };')
const mockServer = fixture('export const createSupabaseServerClient = async () => ({}); export const getSupabaseUser = async () => ({ data: { user: globalThis.__gridexRbacTest.authUser }, error: null });')
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = {
      'next/cache': mockNextCache, 'next/navigation': mockNextNavigation,
      '@supabase/supabase-js': mockSupabase,
      '@/lib/supabase/service': mockService, '@/lib/auth/audit': mockAudit,
      '@/lib/admin/getAdminContext': mockContext, 'next/server': mockNextServer,
      '@/lib/integrations/cisActions': mockCis, '@/lib/customerPortal/outbox': mockOutbox,
      '@/lib/supabase/server': mockServer,
    }
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
    if (specifier === './getAdminContext' && context.parentURL?.endsWith('/lib/admin/guards.ts')) {
      return { url: mockContext, shortCircuit: true }
    }
    if (specifier.startsWith('@/')) return { url: pathToFileURL(resolve(specifier.slice(2) + '.ts')).href, shortCircuit: true }
    if (specifier === './access' && context.parentURL?.endsWith('/lib/admin/guards.ts')) {
      return { url: pathToFileURL(resolve('lib/admin/access.ts')).href, shortCircuit: true }
    }
    if (specifier.startsWith('./') && context.parentURL?.startsWith('file:')) {
      const url = new URL(specifier + '.ts', context.parentURL)
      if (fs.existsSync(url)) return { url: url.href, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.ts')) {
      return { format: 'module', source: stripTypeScriptTypes(fs.readFileSync(new URL(url), 'utf8')), shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})
const guards = await import('../lib/admin/guards.ts')
const contracts = await import('../app/admin/contracts/actions.ts')
const pricing = await import('../app/admin/pricing/[slug]/actions.ts')
const publication = await import('../app/admin/pricing/actions.ts')
const users = await import('../app/admin/users/actions.ts')
const assignments = await import('../app/admin/rbac/assignments/actions.ts')
const f = new FormData()
f.set('contract_id', 'contract-test')
f.set('version_id', 'version-test')
f.set('reason', 'regression')
f.set('user_id', 'another-user')
f.set('role', 'super_admin')
f.set('permission_id', 'permission-test')
f.set('enabled', 'false')

for (const run of [
  () => contracts.createContract(f), () => contracts.updateContractMetadata(f),
  () => pricing.createVersionAction(f), () => pricing.savePricingAction(f),
  () => pricing.publishVersionAction(f), () => pricing.cloneVersionAction(f),
  () => publication.publishPricingVersion('contract', 'version'),
  () => publication.unpublishPricingForContract('contract'),
  () => users.createUser(f), () => users.setUserRole(f), () => users.resetUserPassword(f),
  () => assignments.setUserPermissionOverride(f),
]) {
  await assert.rejects(run, (error) => error.status === 403)
}
assert.equal(state.writes, 0, 'denied actions never execute privileged mutations')
assert.equal(state.serviceClients, 0, 'denied actions never even create a service client')
state.context = { ...staff, permissions: ['rbac.write'] }
state.globalPermissions = []
await assert.rejects(() => guards.requireGlobalAdminActionAccess({ allOf: ['rbac.write'] }), (error) => error.status === 403,
  'a company-scoped grant cannot authorize the global user directory')
state.globalPermissions = ['rbac.write']
assert.equal((await guards.requireGlobalAdminActionAccess({ allOf: ['rbac.write'] })).userId, staff.userId)
state.context = { ...staff, permissions: ['pricing.write'] }
state.globalPermissions = ['pricing.write']
await assert.rejects(() => pricing.publishVersionAction(f), (error) => error.status === 403,
  'price editing cannot publish a version')
state.context = { ...staff, permissions: ['pricing.publish'] }
state.globalPermissions = ['pricing.publish']
const previousEnv = process.env.VERCEL_ENV
process.env.VERCEL_ENV = 'production'
await assert.rejects(() => pricing.publishVersionAction(f), (error) => error.status === 403,
  'non-production approval cannot publish in production')
await assert.rejects(() => publication.unpublishPricingForContract('contract'), (error) => error.status === 403,
  'production unpublish requires the production permission too')
if (previousEnv === undefined) delete process.env.VERCEL_ENV
else process.env.VERCEL_ENV = previousEnv
assert.equal(state.writes, 0)
const cis = await import('../app/api/admin/cis/actions/route.ts')
const outbox = await import('../app/api/admin/customer-portal/outbox/route.ts')
const exportRoute = await import('../app/api/admin/agreements/export/route.ts')
const pdfRoute = await import('../app/api/agreements/[id]/pdf/route.ts')
const post = (operation) => new Request('https://gridex.test/api/admin/cis/actions', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ actionId: 'action-1', operation }),
})
state.context = staff
for (const operation of ['retry', 'cancel', 'resend_signature']) {
  assert.equal((await cis.POST(post(operation))).status, 403)
}
assert.equal((await outbox.POST(new Request('https://gridex.test/api/admin/customer-portal/outbox', {
  method: 'POST', body: JSON.stringify({ id: 'outbox-1' }),
}))).status, 403)
assert.equal((await exportRoute.GET()).status, 403)
assert.equal((await pdfRoute.GET(new Request('https://gridex.test/api/agreements/agreement-1/pdf'), {
  params: Promise.resolve({ id: 'agreement-1' }),
})).status, 403)
assert.equal(state.operations.length, 0)
assert.equal(state.reads, 0, 'denied operations do not read privileged target records')
state.context = { ...staff, permissions: ['cis.sync.write'] }
state.globalPermissions = ['cis.sync.write']
assert.equal((await cis.POST(post('resend_signature'))).status, 403)
assert.equal((await cis.POST(post('retry'))).status, 200)
state.context = { ...staff, permissions: ['cis.signature.write'] }
state.globalPermissions = ['cis.signature.write']
assert.equal((await cis.POST(post('cancel'))).status, 403)
assert.equal((await cis.POST(post('resend_signature'))).status, 200)
assert.deepEqual(state.operations.map((operation) => operation.operation), ['retry', 'resend_signature'])

const permissionReads = await import('../lib/auth/permissions.ts')
state.authUser = { id: 'authenticated-user' }
const rpcCallsBefore = state.rpcCalls.length
assert.deepEqual(await permissionReads.loadUserPermissionsWithClient({}, 'other-user'), [])
assert.deepEqual(await permissionReads.loadUserRolesWithClient({}, 'other-user'), [])
assert.equal(state.rpcCalls.length, rpcCallsBefore, 'caller cannot ask privileged RBAC reader for another user')
state.globalPermissions = ['pricing.read']
delete process.env.GRIDEX_WEB_COMPANY_ID
assert.deepEqual(await permissionReads.loadUserPermissionsWithClient({}, 'authenticated-user'), ['pricing.read'])
assert.deepEqual(state.rpcCalls.at(-1).args, { p_user_id: 'authenticated-user', p_company_id: null })
process.env.GRIDEX_WEB_COMPANY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
await permissionReads.loadUserPermissionsWithClient({}, 'authenticated-user')
assert.equal(state.rpcCalls.at(-1).args.p_company_id, process.env.GRIDEX_WEB_COMPANY_ID)
if (originalCompanyId === undefined) delete process.env.GRIDEX_WEB_COMPANY_ID
else process.env.GRIDEX_WEB_COMPANY_ID = originalCompanyId
const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-no-network'
state.context = { ...staff, permissions: ['pricing.write'] }
state.globalPermissions = ['pricing.write']
f.set('pricing_version_id', 'published-version')
f.set('contract_type', 'spot_hourly')
state.version = { id: 'published-version', contract_id: 'contract-1', is_published: true, status: 'published' }
await assert.rejects(() => pricing.savePricingAction(f), /Published pricing is immutable/,
  'price writer cannot edit an already published version without a new approval')
assert.equal(state.writes, 0)
state.version = { ...state.version, is_published: false, status: 'draft' }
state.contract = { id: 'contract-1', contract_type: 'fixed', slug: 'contract-1' }
await assert.rejects(() => pricing.savePricingAction(f), /Pricing type does not match/,
  'form metadata cannot change the authoritative contract product type')
assert.equal(state.writes, 0)
state.contract = { ...state.contract, contract_type: 'spot_hourly' }
await pricing.savePricingAction(f)
const draftCall = state.rpcCalls.at(-1)
assert.equal(draftCall.name, 'gridex_web_save_draft_pricing')
assert.equal(draftCall.args.p_rows.length, 4)
assert.deepEqual(draftCall.args.p_rows.map((row) => row.price_area), ['SE1', 'SE2', 'SE3', 'SE4'])
assert.ok(draftCall.args.p_rows.every((row) => row.pricing_version_id === 'published-version'))
state.context = { ...staff, permissions: ['pricing.publish_prod'] }
state.globalPermissions = ['pricing.publish_prod']
f.set('contract_id', 'contract-1')
f.set('version_id', 'published-version')
await pricing.publishVersionAction(f)
assert.equal(state.rpcCalls.at(-1).name, 'gridex_web_publish_pricing')
assert.deepEqual(state.rpcCalls.at(-1).args, {
  p_contract_id: 'contract-1', p_version_id: 'published-version', p_actor_id: staff.userId, p_reason: 'regression',
})
await publication.unpublishPricingForContract('contract-1')
assert.equal(state.rpcCalls.at(-1).name, 'gridex_web_publish_pricing')
assert.equal(state.rpcCalls.at(-1).args.p_version_id, null)
assert.equal(state.writes, 0, 'pricing mutations use one atomic RPC rather than separate delete/update/insert requests')
if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
if (previousServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey
delete globalThis.__gridexRbacTest
console.log('RBAC runtime authorization regressions passed')
