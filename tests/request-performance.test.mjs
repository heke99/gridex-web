import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import React from 'react'
import ts from 'typescript'

// Exercise React's real server cache with a fresh request cache container for
// each render. This is deliberately not a shared application cache mock.
const internals = React.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
assert.ok(internals, 'Run with --conditions=react-server')
const state = globalThis.__gridexRequestPerformanceTest = {
  userId: 'customer-a', factories: 0, authReads: 0, resources: [], refreshes: 0,
}

const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const headersMock = moduleUrl(`export async function cookies() {
  const id = globalThis.__gridexRequestPerformanceTest.userId
  return { get: () => ({ value: id }), set: () => {} }
} export async function headers() { return new Headers({host:'gridex.se'}) }`)
const ssrMock = moduleUrl(`export function createServerClient(_url, _key, options) {
  const state = globalThis.__gridexRequestPerformanceTest
  state.factories += 1
  return { auth: { getUser: async () => {
    state.authReads += 1
    return { data: { user: { id: options.cookies.get('session') } }, error: state.authFailure ? new Error('invalid session') : null }
  } }, from: () => ({ upsert: async () => ({ error: null }) }) }
}`)
const portalMock = moduleUrl(`export async function getCanonicalCustomerResource(resource) {
  globalThis.__gridexRequestPerformanceTest.resources.push(resource)
  return { data: resource === 'me' ? { first_name: 'Canonical', last_name: 'Customer' } : [] }
}
export async function getPortalSession() { return { user: { email: 'customer@example.test' } } }
export async function getOpsPortalIdentityForUser(_client, user) { return { userId: user.id } }`)

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'react' && context.parentURL?.endsWith('/AuthSessionSync.tsx')) {
      return { url: moduleUrl('export function useEffect(effect) { globalThis.__gridexRequestPerformanceTest.cleanup = effect() }'), shortCircuit: true }
    }
    if (specifier === 'next/headers') return { url: headersMock, shortCircuit: true }
    if (specifier === '@supabase/ssr') return { url: ssrMock, shortCircuit: true }
    if (specifier === '@/lib/customerPortal/service') return { url: portalMock, shortCircuit: true }
    if (specifier === '@/lib/ops/client') {
      return { url: moduleUrl('export const isOpsError = () => false; export async function submitOpsCustomerProfileUpdate(input) { const state = globalThis.__gridexRequestPerformanceTest; state.profileMutation = input; if (state.opsFailure) throw new Error("synthetic upstream failure"); return {ok:true,status:"submitted",data:{profile_updated:true}} }'), shortCircuit: true }
    }
    if (specifier === 'next/cache') {
      return { url: moduleUrl('export function revalidatePath() {}'), shortCircuit: true }
    }
    if (specifier === '@/lib/customerPortal/statusHelper') {
      return nextResolve(new URL('../lib/customerPortal/statusHelper.ts', import.meta.url).href, context)
    }
    if (specifier === '@/components/customer/CustomerHistoryNotice') {
      return nextResolve(new URL('../components/customer/CustomerHistoryNotice.tsx', import.meta.url).href, context)
    }
    if (specifier === 'next/link') {
      return { url: moduleUrl('export default function Link() { return null }'), shortCircuit: true }
    }
    if (specifier === 'next/navigation') {
      return { url: moduleUrl("export const usePathname = () => '/dashboard'; export const useRouter = () => ({ refresh: () => { globalThis.__gridexRequestPerformanceTest.refreshes += 1 } }); export function redirect(path) { globalThis.__gridexRequestPerformanceTest.redirect = path; throw new Error('REDIRECT') }"), shortCircuit: true }
    }
    if (specifier === '@/components/account/LogoutForm') {
      return { url: moduleUrl('export default function LogoutForm() { return null }'), shortCircuit: true }
    }
    if (specifier === '@/lib/admin/access') {
      return nextResolve(new URL('../lib/admin/access.ts', import.meta.url).href, context)
    }
    if (specifier === '@/lib/supabase/server') {
      return nextResolve(new URL('../lib/supabase/server.ts', import.meta.url).href, context)
    }
    if (specifier === '@/lib/auth/customerHostBoundary') return nextResolve(new URL('../lib/auth/customerHostBoundary.ts', import.meta.url).href, context)
    if (specifier === '@/lib/routing/supportHost') return nextResolve(new URL('../lib/routing/supportHost.ts', import.meta.url).href, context)
    if (specifier === '@/lib/customerPortal/outbox') {
      return { url: moduleUrl('export const enqueuePortalWrite = async () => { throw new Error("Unexpected enqueue") }'), shortCircuit: true }
    }
    if (specifier === '@/lib/supabase/service') {
      return { url: moduleUrl('export const supabaseService = { from: () => ({ upsert: async (row) => { globalThis.__gridexRequestPerformanceTest.profileProjection = row; return { error: null } } }) }'), shortCircuit: true }
    }
    if (specifier === '@/lib/supabase/client') {
      return { url: moduleUrl(`export function createSupabaseBrowserClient() {
        return { auth: { onAuthStateChange: (listener) => {
          const state = globalThis.__gridexRequestPerformanceTest
          state.authListener = listener
          return { data: { subscription: { unsubscribe: () => { state.unsubscribed = true } } } }
        } } }
      }`), shortCircuit: true }
    }
    if (specifier === './actions' && context.parentURL?.endsWith('/dashboard/profile/page.tsx')) {
      return { url: moduleUrl('export const updateCustomerEmailAction = () => {}; export const updateCustomerPasswordAction = () => {}; export const updateCustomerProfileAction = () => {};'), shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.tsx')) {
      const { outputText } = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      })
      return { format: 'module', source: outputText, shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon-key'
const { createSupabaseServerClient, createSupabaseServerActionClient, getSupabaseUser } =
  await import('../lib/supabase/server.ts')

function requestScope(userId) {
  state.userId = userId
  const requestCaches = new Map()
  internals.A = { getCacheForType(factory) {
    if (!requestCaches.has(factory)) requestCaches.set(factory, factory())
    return requestCaches.get(factory)
  } }
}

try {
  requestScope('customer-a')
  const [clientA, clientB, identityA, identityB] = await Promise.all([
    createSupabaseServerClient(), createSupabaseServerClient(), getSupabaseUser(), getSupabaseUser(),
  ])
  assert.equal(clientA, clientB, 'Layout and page share one client within their render')
  assert.equal(identityA, identityB, 'Parallel auth readers share verification')
  assert.equal(identityA.data.user.id, 'customer-a')
  assert.equal(state.factories, 1)
  assert.equal(state.authReads, 1)
  assert.equal(await getSupabaseUser(clientA), identityA, 'Explicit client RBAC validation shares the same verified identity')
  assert.equal(state.authReads, 1)
  let otherClientReads = 0
  const otherClient = { auth: { getUser: async () => {
    otherClientReads += 1
    return { data: { user: { id: 'other-client-user' } }, error: null }
  } } }
  assert.equal((await getSupabaseUser(otherClient)).data.user.id, 'other-client-user', 'A supplied client never inherits another client identity')
  await getSupabaseUser(otherClient)
  assert.equal(otherClientReads, 1)

  requestScope('customer-b')
  const identityC = await getSupabaseUser()
  const clientC = await createSupabaseServerClient()
  assert.equal(identityC.data.user.id, 'customer-b', 'A new request never inherits customer A')
  assert.notEqual(clientC, clientA)
  assert.equal(state.factories, 2)
  assert.equal(state.authReads, 2)

  const [actionA, actionB] = await Promise.all([
    createSupabaseServerActionClient(), createSupabaseServerActionClient(),
  ])
  assert.notEqual(actionA, actionB, 'Mutable auth action clients remain independent')
  assert.equal(state.factories, 4)

  // Outside a React render (e.g. route handlers), cache is a passthrough.
  internals.A = null
  state.userId = 'customer-c'
  assert.equal((await getSupabaseUser()).data.user.id, 'customer-c')
  state.userId = 'customer-d'
  assert.equal((await getSupabaseUser()).data.user.id, 'customer-d')
  assert.equal(state.authReads, 4)

  const contracts = await import('../app/dashboard/contracts/page.tsx')
  await contracts.default()
  assert.deepEqual(state.resources, ['contracts', 'sites', 'events'])

  state.resources = []
  const approvals = await import('../app/dashboard/approvals/page.tsx')
  await approvals.default()
  assert.deepEqual(state.resources, ['legal-acceptances', 'powers-of-attorney'])

  state.resources = []
  const profile = await import('../app/dashboard/profile/page.tsx')
  const tree = await profile.default({ searchParams: Promise.resolve({}) })
  assert.deepEqual(state.resources, ['me'])
  function findInput(node, name) {
    if (!node || typeof node !== 'object') return null
    if (node.type === 'input' && node.props?.name === name) return node.props
    for (const child of React.Children.toArray(node.props?.children)) {
      const found = findInput(child, name)
      if (found) return found
    }
    return null
  }
  assert.equal(findInput(tree, 'first_name')?.defaultValue, 'Canonical', 'The profile form uses authoritative OPS data')

  const { default: DashboardNav } = await import('../app/dashboard/ui/DashboardNav.tsx')
  function hrefs(node, result = new Set()) {
    if (!node || typeof node !== 'object') return result
    if (node.props?.href) result.add(node.props.href)
    for (const child of React.Children.toArray(node.props?.children)) hrefs(child, result)
    return result
  }
  const customerLinks = hrefs(DashboardNav({ roles: ['super_admin', 'support'], permissions: [] }))
  assert.equal(customerLinks.has('/dashboard/support'), true, 'All authenticated customers can open their own support')
  assert.equal(customerLinks.has('/admin'), false, 'Role names alone do not authorize a staff link')
  assert.equal(customerLinks.has('/support-center/staff'), false)
  assert.equal(customerLinks.has('/partner'), false, 'Navigation does not advertise an unimplemented route')
  const staffLinks = hrefs(DashboardNav({ roles: [], permissions: ['support_tickets.read'], showStaffSupport: true }))
  assert.equal(staffLinks.has('/support-center/staff'), true, 'Verified global support read permission exposes the staff workspace')
  assert.equal(staffLinks.has('/admin'), true)
  assert.equal(hrefs(DashboardNav({ permissions: ['support.access'] })).has('/support-center/staff'), false, 'Retired generic permissions do not grant staff support')
  assert.equal(hrefs(DashboardNav({ permissions: ['support_tickets.reply'] })).has('/support-center/staff'), false, 'Reply permission alone does not authorize the staff case list')
  assert.equal(hrefs(DashboardNav({ permissions: ['support_tickets.read'] })).has('/support-center/staff'), false, 'Company-scoped permissions alone do not authorize global staff support')

  const { default: AuthSessionSync } = await import('../components/auth/AuthSessionSync.tsx')
  AuthSessionSync()
  state.authListener('INITIAL_SESSION')
  assert.equal(state.refreshes, 0, 'Hydrating an already verified session does not reload all private data')
  state.authListener('TOKEN_REFRESHED')
  state.authListener('SIGNED_OUT')
  assert.equal(state.refreshes, 2, 'Real authentication changes still refresh server permissions')
  state.cleanup()
  assert.equal(state.unsubscribed, true, 'The auth subscription is removed on unmount')

  const { updateCustomerProfileAction } = await import('../app/dashboard/profile/actions.ts')
  const profileForm = new FormData()
  profileForm.set('client_operation_id', 'profile-update:runtime-test')
  profileForm.set('language_code', 'sv')
  await assert.rejects(updateCustomerProfileAction(profileForm), /REDIRECT/)
  assert.deepEqual(state.profileMutation.profile, { first_name: '', last_name: '', phone: '', language_code: 'sv' }, 'Cleared fields remain API-compatible strings')
  assert.equal(state.redirect, '/dashboard/profile?status=profile-updated')
  assert.equal(state.profileProjection ?? null, null, 'Submitted browser values are never stamped as a canonical local projection')
  state.profileMutation = null
  state.profileProjection = null
  state.authFailure = true
  await assert.rejects(updateCustomerProfileAction(profileForm), /Du behöver logga in igen/)
  assert.equal(state.profileMutation, null, 'An auth error cannot submit a profile mutation')
  assert.equal(state.profileProjection, null, 'An auth error cannot update the protected local projection')
  state.authFailure = false
  state.opsFailure = true
  await assert.rejects(updateCustomerProfileAction(profileForm), /REDIRECT/)
  assert.equal(state.redirect, '/dashboard/profile?status=profile-sync-failed')
  assert.equal(state.profileProjection, null, 'A failed canonical mutation cannot update the local projection')
  console.log('Request performance: auth deduplication, customer isolation, uncached actions and granular page reads passed')
} finally {
  internals.A = null
  hooks.deregister()
  delete globalThis.__gridexRequestPerformanceTest
}
