import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nativeRequire = createRequire(import.meta.url)
const actorId = '11111111-1111-4111-8111-111111111111'
const targetId = '22222222-2222-4222-8222-222222222222'
const newUserId = '33333333-3333-4333-8333-333333333333'
const createdAt = '2026-10-18T12:00:00.000Z'

// Execute the real page, actions, admin guards and audit helper. The SDK fake
// enforces the hosted profile schema and service-only Auth-list RPC. No real
// Auth account, database, email, staff workflow or network is reachable.
function fixture(options = {}) {
  const state = {
    authorized: false, serviceAccesses: 0, rpcCalls: [], dbWrites: [], authCreates: [],
    authUpdates: [], authDeletes: [], revalidations: [], now: Date.parse(createdAt), roleRaceWon: false,
    authUsers: new Map([
      [actorId, { id: actorId, email: 'admin@example.invalid', created_at: createdAt, banned_until: null }],
      [targetId, { id: targetId, email: 'existing@example.invalid', created_at: createdAt, banned_until: null }],
    ]),
    tables: {
      user_profiles: [
        { id: actorId, full_name: 'Synthetic Admin', user_status: 'active', created_at: createdAt },
        { id: targetId, full_name: 'Existing Customer', user_status: 'inactive', created_at: createdAt },
      ],
      user_roles: [
        { id: 'role-actor', user_id: actorId, role: options.allowed === false ? 'customer' : 'admin', company_id: null, status: 'active', is_active: true },
        { id: 'role-target', user_id: targetId, role: 'customer', company_id: null, status: 'active', is_active: true },
      ],
      admin_users: [], permission_audit: [],
    },
  }
  const adminAllowed = options.allowed !== false
  const sessionUser = options.anonymous ? null : state.authUsers.get(actorId)
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [state.now])) }
    static now() { return state.now }
  }
  const schemaError = () => ({ code: '42703', message: 'column user_profiles.is_active does not exist' })
  class Query {
    constructor(table, privileged) {
      assert.ok(Object.hasOwn(state.tables, table), `Unexpected table ${table}`)
      this.table = table; this.privileged = privileged; this.columns = '*'; this.filters = []
    }
    select(columns = '*') { this.columns = columns; return this }
    eq(key, value) { this.filters.push(row => row[key] === value); return this }
    is(key, value) { this.filters.push(row => (row[key] ?? null) === value); return this }
    in(key, values) { this.filters.push(row => values.includes(row[key])); return this }
    upsert(input, upsertOptions = {}) { this.input = structuredClone(input); this.conflict = upsertOptions.onConflict; return this }
    insert(input) { this.input = structuredClone(input); return this }
    update(patch) { this.patch = structuredClone(patch); return this }
    delete() { this.deleting = true; return this }
    returns() { return this }
    maybeSingle() { this.one = true; return this }
    single() { this.one = true; return this }
    then(resolvePromise, rejectPromise) {
      try { return Promise.resolve(this.execute()).then(resolvePromise, rejectPromise) }
      catch (error) { return Promise.reject(error).then(resolvePromise, rejectPromise) }
    }
    execute() {
      const writing = this.input || this.patch || this.deleting
      if (writing) {
        state.dbWrites.push({ table: this.table, input: structuredClone(this.input ?? this.patch ?? {}) })
        if (this.table !== 'permission_audit') assert.equal(this.privileged, true, 'admin writes use the service role')
      }
      const profileFields = this.input ?? this.patch
      if (this.table === 'user_profiles' &&
        ((this.columns !== '*' && this.columns.split(',').map(value => value.trim()).includes('is_active')) ||
          (profileFields && Object.hasOwn(profileFields, 'is_active')))) {
        return { data: null, error: schemaError() }
      }
      if (this.table === 'user_roles' && this.conflict === 'user_id,role') {
        return { data: null, error: { code: '42P10', message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' } }
      }
      if (writing && !this.deleting && this.table === 'user_profiles' && options.profileWriteError) {
        return { data: null, error: { code: 'XX000', message: 'Synthetic profile storage failure' } }
      }
      if (writing && !this.deleting && this.table === 'user_roles' && options.roleWriteError) {
        return { data: null, error: { code: 'XX000', message: 'Synthetic role storage failure' } }
      }
      if (!writing && this.table === 'user_roles' && this.privileged && options.roleReadError) {
        return { data: null, error: { code: '08006', message: 'Synthetic global role read failure' } }
      }
      if (this.input && this.table === 'user_roles' && options.roleInsertRace && !state.roleRaceWon) {
        // Another writer commits the same scoped role between this worker's
        // empty lookup and insert. PostgreSQL rejects this worker's insert.
        state.roleRaceWon = true
        state.tables.user_roles.push({ id: 'role-concurrent-winner', created_at: createdAt, ...structuredClone(this.input) })
        return { data: null, error: { code: '23505', message: 'duplicate global role' } }
      }
      if (this.input && this.table === 'user_roles' && options.roleInsertError) {
        return { data: null, error: structuredClone(options.roleInsertError) }
      }
      let rows = state.tables[this.table].filter(row => this.filters.every(predicate => predicate(row)))
      if (this.input) {
        const inputs = Array.isArray(this.input) ? this.input : [this.input]
        if (this.table === 'user_roles' && !this.conflict && inputs.some(input => state.tables.user_roles.some(candidate =>
          candidate.user_id === input.user_id && candidate.role === input.role &&
          (candidate.company_id ?? null) === (input.company_id ?? null) &&
          candidate.status === (input.status ?? 'active') && candidate.is_active === (input.is_active ?? true)))) {
          return { data: null, error: { code: '23505', message: 'duplicate global role' } }
        }
        rows = inputs.map(input => {
          const keys = (this.conflict ?? (this.table === 'user_roles' ? 'user_id,role' : 'id')).split(',')
          let row = this.conflict ? state.tables[this.table].find(candidate => keys.every(key => candidate[key] === input[key])) : null
          if (!row) {
            row = this.table === 'user_roles'
              ? { id: `role-${state.tables.user_roles.length + 1}`, company_id: null, status: 'active', created_at: createdAt }
              : { created_at: createdAt }
            state.tables[this.table].push(row)
          }
          Object.assign(row, structuredClone(input))
          return row
        })
      }
      if (this.patch) for (const row of rows) Object.assign(row, structuredClone(this.patch))
      if (this.deleting) state.tables[this.table] = state.tables[this.table].filter(row => !rows.includes(row))
      const selected = rows.map(row => this.columns === '*' ? structuredClone(row)
        : Object.fromEntries(this.columns.split(',').map(key => [key.trim(), structuredClone(row[key.trim()])])))
      return { data: this.one ? selected[0] ?? null : selected, error: null }
    }
  }
  const adminAuth = {
    async getUserById(id) {
      assert.equal(state.authorized, true)
      const found = state.authUsers.get(id)
      return found ? { data: { user: structuredClone(found) }, error: null }
        : { data: { user: null }, error: { message: 'Auth user not found' } }
    },
    async createUser(input) {
      assert.equal(state.authorized, true)
      state.authCreates.push(structuredClone(input))
      if (options.authCreateError) return { data: { user: null }, error: { message: 'Synthetic Auth creation failure' } }
      const newUser = { id: newUserId, email: input.email, created_at: createdAt, banned_until: null }
      state.authUsers.set(newUserId, newUser)
      return { data: { user: structuredClone(newUser) }, error: null }
    },
    async deleteUser(id) {
      assert.equal(state.authorized, true)
      state.authDeletes.push(id)
      state.authUsers.delete(id)
      // Auth user deletion cascades only this user's profile/role foreign keys.
      state.tables.user_profiles = state.tables.user_profiles.filter(row => row.id !== id)
      state.tables.user_roles = state.tables.user_roles.filter(row => row.user_id !== id)
      return { data: {}, error: null }
    },
    async updateUserById(id, input) {
      assert.equal(state.authorized, true)
      state.authUpdates.push({ id, input: structuredClone(input) })
      if (options.authUpdateError) return { data: { user: null }, error: { message: 'Synthetic Auth activation failure' } }
      const found = state.authUsers.get(id)
      if (!found) return { data: { user: null }, error: { message: 'Auth user not found' } }
      Object.assign(found, structuredClone(input))
      if (input.ban_duration === 'none') found.banned_until = null
      else if (typeof input.ban_duration === 'string') {
        const match = input.ban_duration.match(/^(\d+)(s|m|h)$/)
        assert.ok(match, 'Auth fixture accepts documented numeric ban durations')
        const milliseconds = Number(match[1]) * { s: 1000, m: 60_000, h: 3_600_000 }[match[2]]
        found.banned_until = new Clock(state.now + milliseconds).toISOString()
      }
      return { data: { user: structuredClone(found) }, error: null }
    },
  }
  function client(privileged) {
    return {
      auth: privileged ? { admin: adminAuth } : { async getUser() { return { data: { user: sessionUser }, error: null } } },
      from(table) { return new Query(table, privileged) },
      async rpc(name) {
        state.rpcCalls.push({ name, privileged })
        if (name === 'gridex_my_permissions_v1' || name === 'gridex_my_has_permission_v1') {
          const allowed = Boolean(sessionUser && adminAllowed)
          if (allowed) state.authorized = true
          return { data: name === 'gridex_my_permissions_v1' ? allowed ? ['admin.access'] : [] : allowed, error: null }
        }
        assert.equal(name, 'admin_list_auth_users')
        if (!privileged && !options.allowSessionAuthList) {
          return { data: null, error: { code: '42501', message: 'permission denied for function admin_list_auth_users' } }
        }
        assert.equal(state.authorized, true)
        return { data: [...state.authUsers.values()].map(row => structuredClone(row)), error: null }
      },
    }
  }
  const session = client(false)
  const service = client(true)
  const modules = new Map()
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports
    const loadedModule = { exports: {} }
    modules.set(file, loadedModule)
    const source = ts.transpileModule(readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText
    vm.runInNewContext(source, {
      module: loadedModule, exports: loadedModule.exports,
      require(specifier) {
        if (specifier === 'react/jsx-runtime') return nativeRequire(specifier)
        if (specifier === 'next/cache') return { revalidatePath: path => state.revalidations.push(path) }
        if (specifier === 'next/navigation') return { redirect(path) { throw new Error(`REDIRECT ${path}`) } }
        if (specifier === '@/lib/supabase/server') return { createSupabaseServerClient: async () => session }
        if (specifier === '@supabase/supabase-js') return { createClient() {
          state.serviceAccesses += 1
          assert.equal(state.authorized, true, 'service client is only created after verified admin access')
          return service
        } }
        if (specifier.startsWith('@/') || specifier.startsWith('.')) {
          const candidate = specifier.startsWith('@/') ? resolve(root, specifier.slice(2)) : resolve(dirname(file), specifier)
          const path = [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}.js`].find(value => existsSync(value))
          if (path) return load(path)
        }
        throw new Error(`Unexpected boundary import: ${specifier}`)
      },
      Error, TypeError, RangeError, URL, FormData, console, Date: Clock,
      process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://admin-fixture.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-offline-key' } },
      fetch() { throw new Error('Unexpected outbound network request') },
    }, { filename: file })
    return loadedModule.exports
  }
  return { state, actions: load(resolve(root, 'app/admin/users/actions.ts')), page: () => load(resolve(root, 'app/admin/users/page.tsx')).default() }
}

function form(values) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}
const createForm = () => form({ full_name: 'New Customer', email: 'new@example.invalid', temp_password: 'Synthetic123!', role: 'customer' })
const toggleForm = (active, id = targetId) => form({ user_id: id, is_active: String(active) })
function nodes(tree) { return tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [] }
function text(tree) { return typeof tree === 'string' ? tree : tree && typeof tree === 'object' ? [tree.props?.children].flat(Infinity).map(text).join('') : '' }
function noSuccess(state) {
  assert.equal(state.tables.permission_audit.length, 0, 'no successful permission audit is written')
  assert.equal(state.revalidations.length, 0, 'failure never refreshes the page as a successful action')
}
function noMutations(state) {
  assert.equal(state.dbWrites.length, 0)
  assert.equal(state.authCreates.length, 0)
  assert.equal(state.authUpdates.length, 0)
  assert.equal(state.authDeletes.length, 0)
}

test('verified admin user listing calls the Auth-list RPC with the service role', async () => {
  const f = fixture()
  const tree = await f.page()
  assert.ok(text(tree).includes('existing@example.invalid'))
  assert.ok(f.state.rpcCalls.some(call => call.name === 'admin_list_auth_users' && call.privileged))
  assert.equal(f.state.rpcCalls.some(call => call.name === 'admin_list_auth_users' && !call.privileged), false)
})

test('user listing reads hosted user_status and renders inactive profiles correctly', async () => {
  // Allow the legacy RPC solely to expose the independent profile-column bug.
  const f = fixture({ allowSessionAuthList: true })
  const tree = await f.page()
  const targetRow = nodes(tree).find(node => node.type === 'tr' && text(node).includes('existing@example.invalid'))
  assert.ok(targetRow)
  const cells = nodes(targetRow).filter(node => node.type === 'td')
  assert.equal(text(cells[2]), 'Inaktiv')
  assert.ok(nodes(targetRow).some(node => node.type === 'button' && text(node) === 'Aktivera'))
})

test('successful user creation writes user_status active and a real user_roles.is_active flag', async () => {
  const f = fixture()
  await f.actions.createUser(createForm())
  assert.equal(f.state.tables.user_profiles.find(row => row.id === newUserId)?.user_status, 'active')
  assert.equal(f.state.tables.user_roles.find(row => row.user_id === newUserId)?.is_active, true)
  assert.equal(f.state.tables.user_roles.find(row => row.user_id === newUserId)?.status, 'active')
  assert.equal(f.state.authUsers.has(newUserId), true)
  assert.equal(f.state.tables.permission_audit.filter(row => row.action === 'admin.user.create').length, 1)
})

test('setting a global role never rewrites an existing company-specific role', async () => {
  const f = fixture()
  const companyRole = {
    id: 'role-company-1', user_id: targetId, role: 'support',
    company_id: '44444444-4444-4444-8444-444444444444', status: 'active', is_active: true,
  }
  f.state.tables.user_roles.push(structuredClone(companyRole))
  await f.actions.setUserRole(form({ user_id: targetId, role: 'support', is_active: 'false' }))
  assert.deepEqual(f.state.tables.user_roles.find(row => row.id === companyRole.id), companyRole)
  const globalRole = f.state.tables.user_roles.find(row => row.user_id === targetId && row.role === 'support' && row.company_id === null)
  assert.ok(globalRole)
  assert.equal(globalRole.is_active, false)
  assert.equal(globalRole.status, 'inactive')
})

test('an inactive global role is reactivated on its original ID while the tenant role is preserved', async () => {
  const f = fixture()
  const globalBefore = f.state.tables.user_roles.find(row => row.id === 'role-target')
  globalBefore.status = 'inactive'
  globalBefore.is_active = false
  const tenantRole = {
    id: 'role-tenant-customer', user_id: targetId, role: 'customer',
    company_id: '44444444-4444-4444-8444-444444444444', status: 'active', is_active: true,
  }
  f.state.tables.user_roles.push(structuredClone(tenantRole))
  await f.actions.setUserRole(form({ user_id: targetId, role: 'customer', is_active: 'true' }))
  const globals = f.state.tables.user_roles.filter(row => row.user_id === targetId && row.role === 'customer' && row.company_id === null)
  assert.equal(globals.length, 1)
  assert.equal(globals[0].id, 'role-target')
  assert.equal(globals[0].status, 'active')
  assert.equal(globals[0].is_active, true)
  assert.deepEqual(f.state.tables.user_roles.find(row => row.id === tenantRole.id), tenantRole)
  assert.equal(f.state.tables.permission_audit.filter(row => row.action === 'admin.user.set_role').length, 1)
})

test('a concurrent global-role insert is recovered as the same winning global row', async () => {
  const f = fixture({ roleInsertRace: true })
  const tenantRole = {
    id: 'role-tenant-support', user_id: targetId, role: 'support',
    company_id: '44444444-4444-4444-8444-444444444444', status: 'inactive', is_active: false,
  }
  f.state.tables.user_roles.push(structuredClone(tenantRole))
  await f.actions.setUserRole(form({ user_id: targetId, role: 'support', is_active: 'true' }))
  const globals = f.state.tables.user_roles.filter(row => row.user_id === targetId && row.role === 'support' && row.company_id === null)
  assert.equal(f.state.roleRaceWon, true)
  assert.equal(globals.length, 1)
  assert.equal(globals[0].id, 'role-concurrent-winner')
  assert.equal(globals[0].status, 'active')
  assert.equal(globals[0].is_active, true)
  assert.deepEqual(f.state.tables.user_roles.find(row => row.id === tenantRole.id), tenantRole)
  assert.equal(f.state.tables.permission_audit.filter(row => row.action === 'admin.user.set_role').length, 1)
})

test('a 23505 conflict without a matching global role is rejected without a success audit', async () => {
  const f = fixture({ roleInsertError: { code: '23505', message: 'Synthetic unrelated unique conflict' } })
  const firstRoles = structuredClone(f.state.tables.user_roles)
  await assert.rejects(() => f.actions.setUserRole(form({ user_id: targetId, role: 'support', is_active: 'true' })))
  assert.deepEqual(f.state.tables.user_roles, firstRoles)
  noSuccess(f.state)
})

test('a global role lookup failure is rejected before role writes or success audit', async () => {
  const f = fixture({ roleReadError: true })
  const firstRoles = structuredClone(f.state.tables.user_roles)
  await assert.rejects(() => f.actions.setUserRole(form({ user_id: targetId, role: 'support', is_active: 'true' })))
  assert.equal(f.state.dbWrites.some(write => write.table === 'user_roles'), false)
  assert.deepEqual(f.state.tables.user_roles, firstRoles)
  noSuccess(f.state)
})

for (const failure of ['profileWriteError', 'roleWriteError']) {
  test(`user creation rejects ${failure} and rolls back only the newly created Auth account`, async () => {
    const f = fixture({ [failure]: true })
    await assert.rejects(() => f.actions.createUser(createForm()))
    assert.deepEqual(f.state.authDeletes, [newUserId])
    assert.equal(f.state.authUsers.has(newUserId), false)
    assert.equal(f.state.authUsers.has(actorId), true)
    assert.equal(f.state.authUsers.has(targetId), true)
    assert.equal(f.state.tables.user_profiles.some(row => row.id === newUserId), false)
    assert.equal(f.state.tables.user_roles.some(row => row.user_id === newUserId), false)
    noSuccess(f.state)
  })
}

test('an Auth creation failure never deletes an existing account or reports success', async () => {
  const f = fixture({ authCreateError: true })
  await assert.rejects(() => f.actions.createUser(createForm()))
  assert.deepEqual(f.state.authDeletes, [])
  assert.equal(f.state.authUsers.has(actorId), true)
  assert.equal(f.state.authUsers.has(targetId), true)
  noSuccess(f.state)
})

for (const [active, status, ban] of [[true, 'active', 'none'], [false, 'inactive', '876000h']]) {
  test(`activation=${active} persists ${status} and applies the matching Auth ban policy`, async () => {
    const f = fixture()
    f.state.tables.user_profiles.find(row => row.id === targetId).user_status = active ? 'inactive' : 'active'
    f.state.authUsers.get(targetId).banned_until = active ? '2026-10-18T13:00:00.000Z' : null
    await f.actions.setUserActive(toggleForm(active))
    assert.equal(f.state.tables.user_profiles.find(row => row.id === targetId)?.user_status, status)
    assert.ok(f.state.authUpdates.some(update => update.id === targetId && update.input.ban_duration === ban))
    assert.equal(f.state.authUsers.get(targetId).ban_duration, ban)
    assert.equal(f.state.tables.permission_audit.filter(row => row.action === 'admin.user.set_active').length, 1)
  })
}

for (const failure of ['profileWriteError', 'authUpdateError']) {
  test(`activation ${failure} is rejected without a false success audit`, async () => {
    const f = fixture({ [failure]: true })
    await assert.rejects(() => f.actions.setUserActive(toggleForm(false)))
    noSuccess(f.state)
  })
}

test('failed profile activation restores an originally unbanned Auth account', async () => {
  const f = fixture({ profileWriteError: true })
  f.state.tables.user_profiles.find(row => row.id === targetId).user_status = 'active'
  await assert.rejects(() => f.actions.setUserActive(toggleForm(false)))
  assert.deepEqual(f.state.authUpdates.map(update => update.input.ban_duration), ['876000h', 'none'])
  assert.equal(f.state.authUsers.get(targetId).banned_until, null)
  assert.equal(f.state.tables.user_profiles.find(row => row.id === targetId).user_status, 'active')
  noSuccess(f.state)
})

test('failed profile activation restores the previous remaining Auth ban', async () => {
  const f = fixture({ profileWriteError: true })
  const previousBanUntil = '2026-10-18T13:00:00.000Z'
  f.state.authUsers.get(targetId).banned_until = previousBanUntil
  await assert.rejects(() => f.actions.setUserActive(toggleForm(true)))
  assert.equal(f.state.authUpdates.length, 2)
  assert.equal(f.state.authUpdates[0].input.ban_duration, 'none')
  assert.equal(f.state.authUsers.get(targetId).banned_until, previousBanUntil)
  assert.equal(f.state.tables.user_profiles.find(row => row.id === targetId).user_status, 'inactive')
  noSuccess(f.state)
})

test('an Auth activation failure leaves profile storage untouched', async () => {
  const f = fixture({ authUpdateError: true })
  const firstProfile = structuredClone(f.state.tables.user_profiles.find(row => row.id === targetId))
  await assert.rejects(() => f.actions.setUserActive(toggleForm(false)))
  assert.equal(f.state.dbWrites.some(write => write.table === 'user_profiles'), false)
  assert.deepEqual(f.state.tables.user_profiles.find(row => row.id === targetId), firstProfile)
  noSuccess(f.state)
})

for (const id of ['', 'not-a-uuid', '11111111-1111-1111-1111-11111111111z']) {
  test(`invalid activation target ${JSON.stringify(id)} is rejected before mutations`, async () => {
    const f = fixture()
    await assert.rejects(() => f.actions.setUserActive(toggleForm(false, id)))
    noMutations(f.state)
    noSuccess(f.state)
  })
}

test('an administrator cannot deactivate their own account', async () => {
  const f = fixture()
  await assert.rejects(() => f.actions.setUserActive(toggleForm(false, actorId)))
  noMutations(f.state)
  noSuccess(f.state)
})

test('a non-admin cannot list accounts or initialize privileged SDK access', async () => {
  const f = fixture({ allowed: false })
  await assert.rejects(() => f.page())
  assert.equal(f.state.serviceAccesses, 0)
  assert.equal(f.state.rpcCalls.some(call => call.name === 'admin_list_auth_users'), false)
  noMutations(f.state)
})

test('a non-admin cannot create or activate accounts', async () => {
  const f = fixture({ allowed: false })
  await assert.rejects(() => f.actions.createUser(createForm()))
  await assert.rejects(() => f.actions.setUserActive(toggleForm(false)))
  assert.equal(f.state.serviceAccesses, 0)
  noMutations(f.state)
  noSuccess(f.state)
})
