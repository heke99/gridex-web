import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import React from 'react'
import ts from 'typescript'

// Exercise the actual client table and permission route. Friendly catalog labels
// deliberately differ from the canonical key written by the server action.
const state = globalThis.__gridexRbacClient = {
  authUser: { id: 'verified-user' }, authError: null, permissionCalls: [],
  permissions: ['support_tickets.read'], rules: [], queries: [], directoryCalls: [],
}
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const actions = fixture('export const setUserPermissionOverride = () => {}; export const setUserRoleActive = () => {}; export const deactivateUser = () => {}; export const createUserWithRole = () => {};')
const mocks = {
  '@/app/admin/rbac/assignments/actions': actions,
  '@/lib/supabase/server': fixture(`export const createSupabaseServerClient = async () => ({ auth: { getUser: async () => ({ data: { user: globalThis.__gridexRbacClient.authUser }, error: globalThis.__gridexRbacClient.authError }) } });`),
  '@/lib/auth/permissions': fixture(`export const loadUserPermissions = async (userId) => { const s=globalThis.__gridexRbacClient; s.permissionCalls.push(userId); return s.permissions; };`),
  '@/lib/supabase/service': fixture('export const supabaseService = globalThis.__gridexRbacClient.service;'),
  '@/lib/admin/guards': fixture('export const requireGlobalAdminPageAccess = async (rule) => { const s=globalThis.__gridexRbacClient; s.rules.push(rule); return {userId:"directory-actor", permissions:["rbac.write"], supabase:s.service}; };'),
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
    if (specifier === './actions' && context.parentURL?.endsWith('/app/admin/rbac/assignments/page.tsx')) return { url: actions, shortCircuit: true }
    if (specifier.startsWith('@/')) {
      const path = resolve(specifier.slice(2))
      const modulePath = [path, `${path}.ts`, `${path}.tsx`].find(existsSync)
      if (modulePath) return { url: pathToFileURL(modulePath).href, shortCircuit: true }
    }
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const path = resolve(dirname(fileURLToPath(context.parentURL)), specifier)
      const modulePath = [path, `${path}.ts`, `${path}.tsx`].find(existsSync)
      if (modulePath) return { url: pathToFileURL(modulePath).href, shortCircuit: true }
    }
    if (specifier === 'next/server') return nextResolve('next/server.js', context)
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && /\.tsx?$/.test(url)) {
      const result = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      })
      return { format: 'module', source: result.outputText, shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})
const { default: RBACUserTable } = await import('../components/admin/RBACUserTable.tsx')
const { GET: permissionsGET } = await import('../app/api/me/permissions/route.ts')
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes)
  if (!React.isValidElement(value)) return []
  return [value, ...nodes(value.props.children)]
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join('')
  if (React.isValidElement(value)) return text(value.props.children)
  return value == null || typeof value === 'boolean' ? '' : String(value)
}
const role = { id: 'role-support', key: 'customer_service_agent', name: 'Kundservicehandläggare', is_active: true }
const user = { id: 'target-user', email: 'user@example.test', full_name: 'Kundservice' }
function roleForm(assignments, catalog = role) {
  const tree = RBACUserTable({ users: [user], roles: [catalog], perms: [], userRoles: assignments, userPerms: [] })
  const form = nodes(tree).find((node) => node.type === 'form' && nodes(node).some((child) => child.type === 'input' && child.props.name === 'role'))
  assert.ok(form)
  const inputs = Object.fromEntries(nodes(form).filter((node) => node.type === 'input').map((input) => [input.props.name, input.props.value]))
  return { inputs, button: nodes(form).find((node) => node.type === 'button') }
}
const assignment = { user_id: user.id, role: 'old_role_name', role_id: role.id, is_active: true, status: 'active' }
assert.equal(roleForm([assignment]).inputs.active, 'false', 'assigned role_id renders a revoke even when the old text and catalog label differ')
assert.equal(roleForm([assignment]).inputs.role, role.key, 'role actions receive the canonical key rather than a display label')
assert.equal(roleForm([{ ...assignment, status: 'disabled' }]).inputs.active, 'true', 'disabled status is inactive even if legacy is_active remains true')
assert.equal(roleForm([{ ...assignment, role_id: 'another-role', role: role.key }]).inputs.active, 'true', 'an assignment to another exact role ID cannot be treated as this catalog role')
assert.equal(roleForm([{ ...assignment, role_id: null, role: role.key.toUpperCase() }]).inputs.active, 'false', 'legacy text assignments use the same case-insensitive canonical fallback as authorization')
assert.equal(roleForm([], { ...role, is_active: false }).button.props.disabled, true, 'inactive catalog roles cannot offer a failing grant')
assert.equal(roleForm([assignment], { ...role, is_active: false }).button.props.disabled, false, 'an inactive catalog role can still have its assignment revoked')

for (const authUser of [null, { id: 'verified-user' }]) {
  state.authUser = authUser
  const response = await permissionsGET()
  assert.equal(response.headers.get('cache-control'), 'private, no-store', 'permission responses never enter public/CDN caches')
  assert.equal(response.headers.get('vary'), 'Cookie', 'sessions vary by cookie at the HTTP boundary')
  assert.deepEqual(await response.json(), { permissions: authUser ? state.permissions : [] })
}
state.authError = { message: 'Session verification failed' }
const callsBefore = state.permissionCalls.length
assert.deepEqual(await (await permissionsGET()).json(), { permissions: [] }, 'an auth verification error cannot expose a grant')
assert.equal(state.permissionCalls.length, callsBefore)

// Matches exist outside the first unfiltered page. The actual directory must
// select them before pagination, not filter a ten-user profile snapshot.
const profiles = Array.from({ length: 25 }, (_, index) => ({
  id: `profile-${String(index).padStart(2, '0')}`, email: `user${index}@example.test`, full_name: `User ${index}`,
  created_at: new Date(Date.UTC(2026, 9, 3, 12, 30 - index)).toISOString(),
}))
const matchingAssignments = profiles.slice(20).map((profile) => ({ ...assignment, user_id: profile.id, role: role.key }))
const tables = { roles: [role], permissions: [], user_profiles: profiles, user_roles: matchingAssignments, user_permissions: [], user_permission_overrides: [] }
class Query {
  constructor(table) { this.table = table; this.filters = []; this.orders = []; state.queries.push(this) }
  select(fields) { this.fields = fields.split(','); return this }
  order(column, options) { this.orders.push({ column, ascending: options.ascending }); return this }
  is(column, value) { this.filters.push((row) => (row[column] ?? null) === value); return this }
  in(column, values) { this.filters.push((row) => values.includes(row[column])); return this }
  range(from, to) { this.interval = [from, to]; return this }
  returns() { return this }
  or() { return this }
  then(fulfill, reject) {
    let rows = tables[this.table].filter((row) => this.filters.every((filter) => filter(row)))
    rows.sort((a, b) => {
      for (const order of this.orders) {
        const compared = a[order.column].localeCompare(b[order.column])
        if (compared) return order.ascending ? compared : -compared
      }
      return 0
    })
    const count = rows.length
    if (this.interval) rows = rows.slice(this.interval[0], this.interval[1] + 1)
    return Promise.resolve({ data: rows.map((row) => Object.fromEntries(this.fields.map((field) => [field, row[field]]))), count, error: null }).then(fulfill, reject)
  }
}
state.service = {
  from: (table) => new Query(table),
  rpc: async (name, args) => {
    state.directoryCalls.push({ name, args })
    assert.equal(name, 'gridex_web_list_global_rbac_users')
    assert.equal(args.p_actor_id, 'directory-actor')
    let rows = profiles.filter((profile) => matchingAssignments.some((row) => row.user_id === profile.id && row.role_id === args.p_role_id))
    if (args.p_query) rows = rows.filter((profile) => profile.email.includes(args.p_query) || profile.full_name.includes(args.p_query))
    const users = rows.slice(args.p_offset, args.p_offset + args.p_limit)
    return { data: {
      users, total: rows.length,
      user_roles: matchingAssignments.filter((row) => users.some((user) => user.id === row.user_id)),
      user_permissions: [], user_permission_overrides: [],
    }, error: null }
  },
}
const { default: AssignmentsPage } = await import('../app/admin/rbac/assignments/page.tsx')
const directory = await AssignmentsPage({ searchParams: Promise.resolve({ role: role.key, active: 'true', per_page: '10' }) })
const renderedTable = nodes(directory).find((node) => node.type === RBACUserTable)
assert.ok(renderedTable)
assert.deepEqual(renderedTable.props.users.map((row) => row.id), profiles.slice(20).map((row) => row.id), 'globally matching users beyond the first profile page are returned on the first filtered page')
assert.deepEqual(state.directoryCalls.at(-1).args, { p_actor_id: 'directory-actor', p_query: null, p_role_id: role.id, p_active: true, p_limit: 10, p_offset: 0 })
assert.equal(state.queries.filter((query) => query.table === 'user_profiles').length, 0, 'the page never retrieves an unfiltered profile snapshot')
assert.deepEqual(state.rules.at(-1), { anyOf: ['rbac.write'] })
assert.ok(text(directory).includes('av 5'), 'total counts the complete filtered directory')
assert.equal(nodes(directory).find((node) => node.type === 'a' && text(node) === 'Nästa →').props['aria-disabled'], true, 'unfiltered users do not create a phantom next page')

matchingAssignments.push(...profiles.slice(10, 20).map((profile) => ({ ...assignment, user_id: profile.id, role: role.key })))
const nextDirectory = await AssignmentsPage({ searchParams: Promise.resolve({ role: role.key, active: 'true', per_page: '10', page: '2' }) })
const nextTable = nodes(nextDirectory).find((node) => node.type === RBACUserTable)
assert.deepEqual(nextTable.props.users.map((row) => row.id), profiles.slice(20).map((row) => row.id), 'offset is applied after filtering on later pages too')
assert.ok(text(nextDirectory).includes('av 15'))
assert.equal(state.directoryCalls.at(-1).args.p_offset, 10)
assert.equal(state.queries.filter((query) => ['user_profiles', 'user_roles', 'user_permissions', 'user_permission_overrides'].includes(query.table)).length, 0, 'all page detail arrays arrive in the same bounded RPC snapshot')

await AssignmentsPage({ searchParams: Promise.resolve({ role: role.key, q: ' (),% ' }) })
assert.equal(state.directoryCalls.at(-1).args.p_query, '(),%', 'search punctuation is sent as a literal parameter rather than interpolated filter syntax')
const callCount = state.directoryCalls.length
const invalidRoleDirectory = await AssignmentsPage({ searchParams: Promise.resolve({ role: 'unknown-role' }) })
assert.deepEqual(nodes(invalidRoleDirectory).find((node) => node.type === RBACUserTable).props.users, [])
assert.equal(state.directoryCalls.length, callCount, 'an unknown catalog role never broadens to the full directory')

delete globalThis.__gridexRbacClient
console.log('RBAC client runtime regressions passed: canonical role identity/status, private permissions and globally filtered pagination.')
