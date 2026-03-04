import RBACUserTable from '@/components/admin/RBACUserTable'
import { requireAdminServer } from '@/lib/auth/requireAdminServer'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createUserWithRole } from './actions'

export const dynamic = 'force-dynamic'

type SearchParams = {
  q?: string
  role?: string
  active?: string
  page?: string
  per_page?: string
}

type UserProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  created_at: string
}

type UserRoleRow = {
  user_id: string
  role: string
  is_active: boolean | null
}

type RoleRow = { id: string; name: string }
type PermissionRow = { id: string; name: string }
type UserPermissionRow = { user_id: string; permission_id: string }

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function buildHref(basePath: string, current: SearchParams, patch: Partial<SearchParams>) {
  const params = new URLSearchParams()
  const merged: SearchParams = { ...current, ...patch }

  Object.entries(merged).forEach(([k, val]) => {
    if (val === undefined || val === null) return
    const s = String(val)
    if (s.length === 0) return
    params.set(k, s)
  })

  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireAdminServer()
  const supabase = await createSupabaseServerClient()

  // Filters
  const q = searchParams.q ?? ''
  const filterRole = searchParams.role ?? ''
  const filterActive = searchParams.active ?? ''

  // Pagination
  const perPage = clampInt(searchParams.per_page, 50, 10, 200) // enterprise-safe
  const page = clampInt(searchParams.page, 1, 1, 1000000)
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  /* -----------------------------------------
     USERS (PAGED + COUNT)
  ----------------------------------------- */

  let userQuery = supabase
    .from('user_profiles')
    .select('id,email,full_name,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (q) {
    userQuery = userQuery.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
  }

  const { data: usersRaw, error: uErr, count } = await userQuery
    .range(from, to)
    .returns<UserProfileRow[]>()

  if (uErr) throw new Error(uErr.message)

  const users = usersRaw ?? []
  const total = typeof count === 'number' ? count : null

  /* -----------------------------------------
     RBAC BASE DATA (SMALL TABLES)
  ----------------------------------------- */

  const { data: roles, error: rErr } = await supabase
    .from('roles')
    .select('id,name')
    .order('name', { ascending: true })
    .returns<RoleRow[]>()

  if (rErr) throw new Error(rErr.message)

  const { data: perms, error: pErr } = await supabase
    .from('permissions')
    .select('id,name')
    .order('name', { ascending: true })
    .returns<PermissionRow[]>()

  if (pErr) throw new Error(pErr.message)

  /* -----------------------------------------
     RBAC FOR CURRENT PAGE ONLY (ENTERPRISE)
  ----------------------------------------- */

  const userIds = users.map((u) => u.id)
  const hasUsers = userIds.length > 0

  const { data: userRoles, error: urErr } = hasUsers
    ? await supabase
        .from('user_roles')
        .select('user_id,role,is_active')
        .in('user_id', userIds)
        .returns<UserRoleRow[]>()
    : { data: [] as UserRoleRow[], error: null as null }

  if (urErr) throw new Error(urErr.message)

  const { data: userPerms, error: upErr } = hasUsers
    ? await supabase
        .from('user_permissions')
        .select('user_id,permission_id')
        .in('user_id', userIds)
        .returns<UserPermissionRow[]>()
    : { data: [] as UserPermissionRow[], error: null as null }

  if (upErr) throw new Error(upErr.message)

  /* -----------------------------------------
     OPTIONAL: FILTER BY ROLE/ACTIVE (IN-MEMORY)
     NOTE: Role/Active filter depends on user_roles, so we filter after we know them.
  ----------------------------------------- */

  const filteredUsers = users.filter((u) => {
    const rolesForUser = (userRoles ?? []).filter((r) => r.user_id === u.id)

    if (filterRole) {
      const hasRole = rolesForUser.some(
        (r) => r.role === filterRole && r.is_active !== false
      )
      if (!hasRole) return false
    }

    if (filterActive === 'true') {
      if (!rolesForUser.some((r) => r.is_active !== false)) return false
    }

    if (filterActive === 'false') {
      if (rolesForUser.some((r) => r.is_active !== false)) return false
    }

    return true
  })

  // Pagination UI numbers (best-effort)
  const showingFrom = from + 1
  const showingTo = from + filteredUsers.length
  const hasPrev = page > 1
  const hasNext = total !== null ? to + 1 < total : users.length === perPage

  const prevHref = buildHref('/admin/rbac/assignments', searchParams, {
    page: String(page - 1),
    per_page: String(perPage),
  })

  const nextHref = buildHref('/admin/rbac/assignments', searchParams, {
    page: String(page + 1),
    per_page: String(perPage),
  })

  return (
    <div className="space-y-10">
      {/* HEADER */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">RBAC Assignments</h1>
        <p className="text-gray-400 mt-3">
          Enterprise user management • Roles • Overrides • Deactivate • Audit
        </p>
      </div>

      {/* FILTER BAR */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <form className="grid md:grid-cols-6 gap-4">
          <input
            name="q"
            placeholder="Sök email eller namn"
            defaultValue={q}
            className="bg-black border border-gray-700 p-2 rounded md:col-span-2"
          />

          <select
            name="role"
            defaultValue={filterRole}
            className="bg-black border border-gray-700 p-2 rounded"
          >
            <option value="">Alla roller</option>
            {(roles ?? []).map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>

          <select
            name="active"
            defaultValue={filterActive}
            className="bg-black border border-gray-700 p-2 rounded"
          >
            <option value="">Alla</option>
            <option value="true">Aktiva</option>
            <option value="false">Inaktiva</option>
          </select>

          <select
            name="per_page"
            defaultValue={String(perPage)}
            className="bg-black border border-gray-700 p-2 rounded"
          >
            <option value="25">25 / sida</option>
            <option value="50">50 / sida</option>
            <option value="100">100 / sida</option>
            <option value="200">200 / sida</option>
          </select>

          <button className="bg-cyan-600 px-4 py-2 rounded">
            Filtrera
          </button>

          {/* keep page reset when filtering */}
          <input type="hidden" name="page" value="1" />
        </form>
      </div>

      {/* CREATE USER */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-lg font-semibold mb-4">Skapa ny användare</div>

        <form action={createUserWithRole} className="grid md:grid-cols-4 gap-4">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="bg-black border border-gray-700 p-2 rounded"
          />

          <input
            name="full_name"
            placeholder="Full name"
            required
            className="bg-black border border-gray-700 p-2 rounded"
          />

          <input
            name="phone"
            placeholder="Phone"
            className="bg-black border border-gray-700 p-2 rounded"
          />

          <select
            name="role"
            required
            className="bg-black border border-gray-700 p-2 rounded"
          >
            {(roles ?? []).map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>

          <button className="col-span-full bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded">
            Skapa användare & tilldela roll
          </button>
        </form>
      </div>

      {/* PAGINATION BAR */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-5 flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {total !== null ? (
            <>
              Visar <span className="text-gray-200">{showingFrom}</span>–
              <span className="text-gray-200">{showingTo}</span> av{' '}
              <span className="text-gray-200">{total}</span>
            </>
          ) : (
            <>
              Visar <span className="text-gray-200">{showingFrom}</span>–
              <span className="text-gray-200">{showingTo}</span>
            </>
          )}
          <span className="ml-3 text-gray-500">
            (page {page}, {perPage}/sida)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={hasPrev ? prevHref : undefined}
            aria-disabled={!hasPrev}
            className={[
              'text-xs border px-3 py-2 rounded-full transition',
              hasPrev
                ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white/80'
                : 'border-white/5 bg-white/0 text-white/30 cursor-not-allowed',
            ].join(' ')}
          >
            ← Föregående
          </a>

          <a
            href={hasNext ? nextHref : undefined}
            aria-disabled={!hasNext}
            className={[
              'text-xs border px-3 py-2 rounded-full transition',
              hasNext
                ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white/80'
                : 'border-white/5 bg-white/0 text-white/30 cursor-not-allowed',
            ].join(' ')}
          >
            Nästa →
          </a>
        </div>
      </div>

      {/* USER TABLE (ISOLATED COMPONENT) */}
      <RBACUserTable
        users={filteredUsers.map((u) => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
        }))}
        roles={roles ?? []}
        perms={perms ?? []}
        userRoles={userRoles ?? []}
        userPerms={userPerms ?? []}
      />
    </div>
  )
}