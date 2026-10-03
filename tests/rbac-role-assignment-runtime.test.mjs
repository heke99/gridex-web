import assert from 'node:assert/strict'
import fs from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerHooks, stripTypeScriptTypes } from 'node:module'

// Fixture mirrors the inspected production schema: PK(id), plus active-only
// unique expression indexes on (user,coalesce(company,zero),lower(role)) and
// (user,coalesce(company,zero),role_id). No UNIQUE(user_id,role) exists.
const state = globalThis.__gridexRoleTest = {
  globalPermissions: ['rbac.write', 'users.write'], conflicts: 0, badUpserts: 0, sequence: 0, audits: [],
  permissionCalls: [], directPermissionWrites: 0,
  tables: {
    roles: [
      { id: 'role-admin', key: 'admin', name: 'admin', is_active: true },
      { id: 'role-support', key: 'customer_service_agent', name: 'customer_service_agent', is_active: true },
      { id: 'role-retired', key: 'retired', name: 'retired', is_active: false },
    ],
    user_profiles: [],
    permissions: [
      { id: 'permission-publish', key: 'pricing.publish', name: 'Friendly price publish label' },
      { id: 'permission-publish-alias', key: 'pricing.publish', name: 'Other price publish label' },
    ],
    user_permissions: [
      { user_id: 'target-user', permission_id: 'permission-publish', company_id: 'company-other', effect: 'allow', status: 'active', is_active: true },
      { user_id: 'legacy-global-user', permission_id: 'permission-publish', company_id: null, effect: 'allow', status: 'active', is_active: true },
      { user_id: 'legacy-global-user', permission_id: 'permission-publish-alias', company_id: null, effect: 'deny', status: 'active', is_active: true },
    ],
    user_permission_overrides: [],
    user_roles: [
      { id: 'company-role', user_id: 'target-user', role: 'admin', role_id: 'role-admin', company_id: 'company-other', is_active: true, status: 'active' },
      { id: 'race-company-role', user_id: 'race-user', role: 'admin', role_id: 'role-admin', company_id: 'company-other', is_active: true, status: 'active' },
    ],
  },
}
const companyBefore = structuredClone(state.tables.user_roles)
const active = (row) => row.is_active !== false && (row.status ?? 'active') === 'active'
function conflict(candidate, existing) {
  return active(candidate) && active(existing) && candidate.id !== existing.id &&
    candidate.user_id === existing.user_id && (candidate.company_id ?? null) === (existing.company_id ?? null) &&
    (candidate.role.toLowerCase() === existing.role.toLowerCase() ||
      (candidate.role_id != null && existing.role_id != null && candidate.role_id === existing.role_id))
}
class Query {
  constructor(table) { this.table = table; this.filters = []; this.operation = 'select' }
  select() { return this }
  returns() { return this }
  eq(key, value) { this.filters.push((row) => row[key] === value); return this }
  is(key, value) { this.filters.push((row) => (row[key] ?? null) === value); return this }
  in(key, values) { this.filters.push((row) => values.includes(row[key])); return this }
  insert(payload) { this.operation = 'insert'; this.payload = payload; return this }
  update(payload) { this.operation = 'update'; this.payload = payload; return this }
  upsert(payload, options) { this.operation = 'upsert'; this.payload = payload; this.options = options; return this }
  maybeSingle() { return this.execute(true) }
  single() { return this.execute(true) }
  then(onfulfilled, onrejected) { return this.execute(false).then(onfulfilled, onrejected) }
  async execute(single) {
    await Promise.resolve()
    const table = state.tables[this.table]
    if (!table) throw new Error(`Unexpected table ${this.table}`)
    if (this.operation !== 'select' && this.table === 'user_permissions') state.directPermissionWrites++
    if (this.operation === 'upsert' && this.table === 'user_roles' && this.options?.onConflict === 'user_id,role') {
      state.badUpserts++
      return { data: null, error: { code: '42P10', message: 'no unique or exclusion constraint matching the ON CONFLICT specification' } }
    }
    let rows
    if (this.operation === 'select') rows = table.filter((row) => this.filters.every((filter) => filter(row)))
    else if (this.operation === 'update') {
      rows = table.filter((row) => this.filters.every((filter) => filter(row)))
      for (const row of rows) {
        const candidate = { ...row, ...this.payload }
        if (this.table === 'user_roles' && table.some((existing) => conflict(candidate, existing))) {
          state.conflicts++
          return { data: null, error: { code: '23505', message: 'duplicate key violates user_roles_active_unique_role_text_idx' } }
        }
      }
      rows.forEach((row) => Object.assign(row, this.payload))
    } else {
      const row = { id: `row-${++state.sequence}`, company_id: null, is_active: true, status: 'active', ...this.payload }
      if (this.operation === 'upsert' && this.table === 'user_profiles') {
        const existing = table.find((value) => value.id === row.id)
        if (existing) { Object.assign(existing, row); rows = [existing] }
      }
      if (!rows) {
        if (this.table === 'user_roles' && table.some((existing) => conflict(row, existing))) {
          state.conflicts++
          return { data: null, error: { code: '23505', message: 'duplicate key violates user_roles_active_unique_role_text_idx' } }
        }
        table.push(row); rows = [row]
      }
    }
    if (single && rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } }
    return { data: structuredClone(single ? rows[0] ?? null : rows), error: null }
  }
}
const service = {
  from: (table) => new Query(table),
  rpc: async (name, args) => {
    if (name !== 'gridex_web_set_global_permission_override') return { data: state.globalPermissions, error: null }
    // Contract fixture; the separate native SQL suite validates the RPC itself.
    state.permissionCalls.push({ name, args })
    assert.equal(args.p_actor_id, 'global-administrator')
    assert.ok(state.globalPermissions.includes('rbac.write'))
    assert.ok(['allow', 'deny'].includes(args.p_effect))
    const permission = state.tables.permissions.find((row) => row.id === args.p_permission_id)
    assert.ok(permission)
    const canonicalKey = permission.key || permission.name
    const aliases = state.tables.permissions.filter((row) => (row.key || row.name) === canonicalKey).map((row) => row.id)
    state.tables.user_permissions.filter((row) => row.company_id == null && row.user_id === args.p_user_id &&
      aliases.includes(row.permission_id)).forEach((row) => { row.is_active = false; row.status = 'inactive' })
    const globalHistory = state.tables.user_permission_overrides.filter((row) => row.company_id == null &&
      row.user_id === args.p_user_id && row.permission_key === canonicalKey)
    const current = globalHistory[0] ?? { id: `override-${++state.sequence}`, company_id: null,
      user_id: args.p_user_id, permission_key: canonicalKey }
    globalHistory.slice(1).forEach((row) => { row.is_active = false })
    Object.assign(current, { effect: args.p_effect, is_active: true, valid_from: null, valid_to: null })
    if (!globalHistory.length) state.tables.user_permission_overrides.push(current)
    return { data: { permission_key: canonicalKey, effect: args.p_effect }, error: null }
  },
  auth: { admin: {
    createUser: async () => ({ data: { user: { id: `created-user-${++state.sequence}` } }, error: null }),
  } },
}
state.service = service
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const mocks = {
  'next/cache': fixture('export const revalidatePath = () => {};'),
  'next/navigation': fixture('export const redirect = () => { throw new Error("Unexpected redirect"); };'),
  '@/lib/supabase/service': fixture('export const supabaseService = globalThis.__gridexRoleTest.service;'),
  '@supabase/supabase-js': fixture('export const createClient = () => globalThis.__gridexRoleTest.service;'),
  '@/lib/auth/audit': fixture('export const logPermissionAudit = async (event) => { globalThis.__gridexRoleTest.audits.push(event); };'),
}
const context = fixture('export const getAdminContext = async () => ({ userId: "global-administrator", permissions: [], roles: [], supabase: globalThis.__gridexRoleTest.service });')
registerHooks({
  resolve(specifier, contextInfo, nextResolve) {
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
    if (specifier === './getAdminContext' && contextInfo.parentURL?.endsWith('/lib/admin/guards.ts')) {
      return { url: context, shortCircuit: true }
    }
    if (specifier.startsWith('@/')) return { url: pathToFileURL(resolve(specifier.slice(2) + '.ts')).href, shortCircuit: true }
    if (specifier.startsWith('./') && contextInfo.parentURL?.startsWith('file:')) {
      const url = new URL(specifier + '.ts', contextInfo.parentURL)
      if (fs.existsSync(url)) return { url: url.href, shortCircuit: true }
    }
    return nextResolve(specifier, contextInfo)
  },
  load(url, contextInfo, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.ts')) {
      return { format: 'module', source: stripTypeScriptTypes(fs.readFileSync(new URL(url), 'utf8')), shortCircuit: true }
    }
    return nextLoad(url, contextInfo)
  },
})
const users = await import('../app/admin/users/actions.ts')
const assignments = await import('../app/admin/rbac/assignments/actions.ts')
const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://no-network.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-only'
function roleForm(userId, enabled, role = 'admin') {
  const form = new FormData()
  form.set('user_id', userId); form.set('role', role)
  form.set('is_active', String(enabled)); form.set('active', String(enabled))
  return form
}
const globals = (userId) => state.tables.user_roles.filter((row) => row.user_id === userId && row.company_id == null && row.role === 'admin')

// First demonstrate the exact failure the old action used to hit.
assert.equal((await service.from('user_roles').upsert({ user_id: 'control', role: 'admin' }, {
  onConflict: 'user_id,role',
})).error.code, '42P10')
await users.setUserRole(roleForm('target-user', true))
assert.equal(globals('target-user').length, 1)
const globalId = globals('target-user')[0].id
assert.equal(globals('target-user')[0].role_id, 'role-admin')
assert.equal(active(globals('target-user')[0]), true)
await users.setUserRole(roleForm('target-user', false))
assert.equal(active(globals('target-user')[0]), false)
assert.equal(globals('target-user')[0].disabled_by, 'global-administrator')
await assignments.setUserRoleActive(roleForm('target-user', true))
assert.equal(globals('target-user')[0].id, globalId, 'an inactive global assignment is reused rather than duplicated')
assert.equal(globals('target-user')[0].status, 'active')
assert.equal(globals('target-user')[0].disabled_at, null)
await assignments.setUserRoleActive(roleForm('target-user', false))
assert.equal(active(globals('target-user')[0]), false)
assert.deepEqual(state.tables.user_roles.filter((row) => row.company_id != null), companyBefore,
  'grant/revoke must never select or reactivate another company assignment')

await Promise.all([
  users.setUserRole(roleForm('race-user', true)),
  assignments.setUserRoleActive(roleForm('race-user', true)),
])
assert.equal(globals('race-user').filter(active).length, 1, 'concurrent grants leave one active global assignment')
assert.ok(state.conflicts > 0, 'the inspected active-only index conflict is handled by bounded refetch')
await assignments.deactivateUser(roleForm('race-user', false))
assert.equal(globals('race-user').some(active), false)
assert.deepEqual(state.tables.user_roles.filter((row) => row.company_id != null), companyBefore)
await assignments.setUserRoleActive(roleForm('target-user', false))
assert.equal(globals('target-user').length, 1, 'repeated revoke is idempotent')
await assert.rejects(() => assignments.setUserRoleActive(roleForm('target-user', true, 'retired')), /inactive role/)

for (const create of [users.createUser, assignments.createUserWithRole]) {
  const form = roleForm('', true, 'customer_service_agent')
  form.set('email', 'staff@example.test'); form.set('full_name', 'New staff')
  form.set('temp_password', 'test-long-password')
  await create(form)
}
const supportGrants = state.tables.user_roles.filter((row) => row.role_id === 'role-support')
assert.equal(supportGrants.length, 2, 'both actual create-user actions assign the registered canonical support role')
assert.ok(supportGrants.every((row) => row.company_id == null && active(row)))
assert.equal(state.badUpserts, 1, 'the fixed actions never use the invalid ON CONFLICT key')
assert.ok(state.audits.some((event) => event.action === 'admin.user.set_role'))
assert.ok(state.audits.some((event) => event.action === 'rbac.user_roles.set_active'))

const { globalPermissionOverrideRows, globalOverrideState } = await import('../lib/admin/permissionOverrides.ts')
const scopedPermissionBefore = structuredClone(state.tables.user_permissions.filter((row) => row.company_id != null))
const scopedOverride = { id: 'scoped-override', company_id: 'company-other', user_id: 'target-user',
  permission_key: 'pricing.publish', effect: 'deny', is_active: true, valid_from: null, valid_to: null }
state.tables.user_permission_overrides.push(scopedOverride)
const scopedOverrideBefore = structuredClone(scopedOverride)
function overrideForm(userId, allowed, permissionId = 'permission-publish') {
  const form = new FormData()
  form.set('user_id', userId); form.set('permission_id', permissionId); form.set('enabled', String(allowed))
  return form
}
function uiRows(userId) {
  return globalPermissionOverrideRows(state.tables.permissions,
    state.tables.user_permissions.filter((row) => row.company_id == null && row.user_id === userId),
    state.tables.user_permission_overrides.filter((row) => row.company_id == null && row.user_id === userId))
}
const inherited = new Set(['pricing.publish'])
function effectivePublish(userId) {
  const effect = globalOverrideState(uiRows(userId), userId, 'permission-publish')
  return effect === 'deny' ? false : effect === 'allow' || inherited.has('pricing.publish')
}
function assertPublishUiState(userId, effect) {
  for (const permission of state.tables.permissions) {
    assert.equal(globalOverrideState(uiRows(userId), userId, permission.id), effect,
      `canonical ${effect ?? 'unset'} must apply to every catalog alias: ${permission.id}`)
  }
}
assert.equal(effectivePublish('target-user'), true)
assertPublishUiState('target-user', null)
assertPublishUiState('legacy-global-user', 'deny')
assert.equal(effectivePublish('legacy-global-user'), false,
  'a direct deny on an alias overrides a direct allow for the same canonical right')
await assignments.setUserPermissionOverride(overrideForm('target-user', false))
assert.deepEqual(state.permissionCalls.at(-1).args, {
  p_actor_id: 'global-administrator', p_user_id: 'target-user', p_permission_id: 'permission-publish', p_effect: 'deny',
})
assert.equal(effectivePublish('target-user'), false, 'an explicit global deny overrides the inherited role grant')
assertPublishUiState('target-user', 'deny')
await assignments.setUserPermissionOverride(overrideForm('target-user', true, 'permission-publish-alias'))
assert.equal(effectivePublish('target-user'), true, 'allow after deny restores the effective permission')
assertPublishUiState('target-user', 'allow')
assert.equal(state.tables.user_permission_overrides.filter((row) => row.company_id == null && row.user_id === 'target-user' && row.is_active).length, 1)
assert.deepEqual(state.tables.user_permissions.filter((row) => row.company_id != null), scopedPermissionBefore,
  'the same-permission company direct row is never converted into a global row')
assert.deepEqual(scopedOverride, scopedOverrideBefore, 'company override history is untouched')
await assignments.setUserPermissionOverride(overrideForm('legacy-global-user', true))
assert.equal(effectivePublish('legacy-global-user'), true, 'an old global direct deny is superseded by the canonical allow')
assertPublishUiState('legacy-global-user', 'allow')
assert.ok(state.tables.user_permissions.filter((row) => row.user_id === 'legacy-global-user').every((row) => !row.is_active),
  'the RPC supersedes legacy global rows on every canonical alias')
assert.equal(state.directPermissionWrites, 0, 'the server action never writes the scope-blind direct permission table')

const beforeUnauthorized = state.permissionCalls.length
state.globalPermissions = ['users.write']
await assert.rejects(() => assignments.setUserPermissionOverride(overrideForm('target-user', false)), (error) => error.status === 403)
assert.equal(state.permissionCalls.length, beforeUnauthorized, 'unauthorized action must not invoke the privileged override RPC')
state.globalPermissions = ['rbac.write', 'users.write']
const now = Date.parse('2026-10-02T19:00:00Z')
const displayRows = globalPermissionOverrideRows(state.tables.permissions, [
  { user_id: 'display-user', permission_id: 'permission-publish', effect: 'allow', is_active: true, status: 'active' },
], [
  { user_id: 'display-user', permission_key: 'pricing.publish', effect: 'deny', is_active: true, valid_from: null, valid_to: null },
  { user_id: 'future-user', permission_key: 'pricing.publish', effect: 'deny', is_active: true, valid_from: '2026-10-03T19:00:00Z', valid_to: null },
  { user_id: 'expired-user', permission_key: 'pricing.publish', effect: 'deny', is_active: true, valid_from: null, valid_to: '2026-10-02T18:00:00Z' },
], now)
for (const permission of state.tables.permissions) {
  assert.equal(globalOverrideState(displayRows, 'display-user', permission.id), 'deny', 'UI uses the canonical catalog key and deny precedence across aliases')
  assert.equal(globalOverrideState(displayRows, 'future-user', permission.id), null)
  assert.equal(globalOverrideState(displayRows, 'expired-user', permission.id), null)
}
if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl
if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey
delete globalThis.__gridexRoleTest
console.log('Role/override actual-action schema/scope/concurrency regressions passed')
