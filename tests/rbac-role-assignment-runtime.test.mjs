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
  tables: {
    roles: [
      { id: 'role-admin', key: 'admin', name: 'admin', is_active: true },
      { id: 'role-support', key: 'customer_service_agent', name: 'customer_service_agent', is_active: true },
      { id: 'role-retired', key: 'retired', name: 'retired', is_active: false },
    ],
    user_profiles: [],
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
  rpc: async () => ({ data: state.globalPermissions, error: null }),
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
if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl
if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey
delete globalThis.__gridexRoleTest
console.log('Role assignment actual-action schema/scope/concurrency regressions passed')
