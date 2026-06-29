import RBACUserTable from '@/components/admin/RBACUserTable'
import { requireAdminPageAccess } from '@/lib/admin/guards'
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

type RoleRow = {
  id: string
  name: string
}

type PermissionRow = {
  id: string
  name: string
}

type UserPermissionRow = {
  user_id: string
  permission_id: string
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function buildHref(
  basePath: string,
  current: SearchParams,
  patch: Partial<SearchParams>
) {
  const params = new URLSearchParams()
  const merged: SearchParams = { ...current, ...patch }

  Object.entries(merged).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    const strValue = String(value)
    if (!strValue.length) return
    params.set(key, strValue)
  })

  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const ctx = await requireAdminPageAccess({
    anyOf: ['rbac.write', 'admin.access'],
  })

  const supabase = ctx.supabase
  const resolvedSearchParams = searchParams ? await searchParams : {}

  const q = resolvedSearchParams.q ?? ''
  const filterRole = resolvedSearchParams.role ?? ''
  const filterActive = resolvedSearchParams.active ?? ''

  const perPage = clampInt(resolvedSearchParams.per_page, 50, 10, 200)
  const page = clampInt(resolvedSearchParams.page, 1, 1, 1000000)

  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let userQuery = supabase
    .from('user_profiles')
    .select('id,email,full_name,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (q) {
    userQuery = userQuery.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
  }

  const {
    data: usersRaw,
    error: usersError,
    count,
  } = await userQuery.range(from, to).returns<UserProfileRow[]>()

  if (usersError) {
    throw new Error(usersError.message)
  }

  const users = usersRaw ?? []
  const total = typeof count === 'number' ? count : null

  const { data: rolesRaw, error: rolesError } = await supabase
    .from('roles')
    .select('id,name')
    .order('name', { ascending: true })
    .returns<RoleRow[]>()

  if (rolesError) {
    throw new Error(rolesError.message)
  }

  const roles = rolesRaw ?? []

  const { data: permsRaw, error: permsError } = await supabase
    .from('permissions')
    .select('id,name')
    .order('name', { ascending: true })
    .returns<PermissionRow[]>()

  if (permsError) {
    throw new Error(permsError.message)
  }

  const perms = permsRaw ?? []

  const userIds = users.map((user) => user.id)
  const hasUsers = userIds.length > 0

  const { data: userRolesRaw, error: userRolesError } = hasUsers
    ? await supabase
        .from('user_roles')
        .select('user_id,role,is_active')
        .in('user_id', userIds)
        .returns<UserRoleRow[]>()
    : { data: [], error: null }

  if (userRolesError) {
    throw new Error(userRolesError.message)
  }

  const userRoles = userRolesRaw ?? []

  const { data: userPermsRaw, error: userPermsError } = hasUsers
    ? await supabase
        .from('user_permissions')
        .select('user_id,permission_id')
        .in('user_id', userIds)
        .returns<UserPermissionRow[]>()
    : { data: [], error: null }

  if (userPermsError) {
    throw new Error(userPermsError.message)
  }

  const userPerms = userPermsRaw ?? []

  const filteredUsers = users.filter((user) => {
    const rolesForUser = userRoles.filter((row) => row.user_id === user.id)

    if (filterRole) {
      const hasRole = rolesForUser.some(
        (row) => row.role === filterRole && row.is_active !== false
      )
      if (!hasRole) return false
    }

    if (filterActive === 'true') {
      if (!rolesForUser.some((row) => row.is_active !== false)) {
        return false
      }
    }

    if (filterActive === 'false') {
      if (rolesForUser.some((row) => row.is_active !== false)) {
        return false
      }
    }

    return true
  })

  const showingFrom = users.length > 0 ? from + 1 : 0
  const showingTo = from + filteredUsers.length
  const hasPrev = page > 1
  const hasNext =
    total !== null ? to + 1 < total : users.length === perPage

  const prevHref = buildHref('/admin/rbac/assignments', resolvedSearchParams, {
    page: String(page - 1),
    per_page: String(perPage),
  })

  const nextHref = buildHref('/admin/rbac/assignments', resolvedSearchParams, {
    page: String(page + 1),
    per_page: String(perPage),
  })

  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">RBAC Assignments</h1>
        <p className="mt-3 text-gray-400">
          Enterprise user management • roller • overrides • deaktivering • audit
        </p>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <form className="grid gap-4 md:grid-cols-6">
          <input
            name="q"
            placeholder="Sök email eller namn"
            defaultValue={q}
            className="rounded bg-black p-2 border border-gray-700 md:col-span-2"
          />

          <select
            name="role"
            defaultValue={filterRole}
            className="rounded border border-gray-700 bg-black p-2"
          >
            <option value="">Alla roller</option>
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>

          <select
            name="active"
            defaultValue={filterActive}
            className="rounded border border-gray-700 bg-black p-2"
          >
            <option value="">Alla</option>
            <option value="true">Aktiva</option>
            <option value="false">Inaktiva</option>
          </select>

          <select
            name="per_page"
            defaultValue={String(perPage)}
            className="rounded border border-gray-700 bg-black p-2"
          >
            <option value="25">25 / sida</option>
            <option value="50">50 / sida</option>
            <option value="100">100 / sida</option>
            <option value="200">200 / sida</option>
          </select>

          <button className="rounded bg-cyan-600 px-4 py-2">
            Filtrera
          </button>

          <input type="hidden" name="page" value="1" />
        </form>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="mb-4 text-lg font-semibold">Skapa ny användare</div>

        <form action={createUserWithRole} className="grid gap-4 md:grid-cols-4">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="rounded border border-gray-700 bg-black p-2"
          />

          <input
            name="full_name"
            placeholder="Full name"
            required
            className="rounded border border-gray-700 bg-black p-2"
          />

          <input
            name="phone"
            placeholder="Phone"
            className="rounded border border-gray-700 bg-black p-2"
          />

          <select
            name="role"
            required
            className="rounded border border-gray-700 bg-black p-2"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>

          <button className="col-span-full rounded bg-cyan-600 px-4 py-2 hover:bg-cyan-700">
            Skapa användare & tilldela roll
          </button>
        </form>
      </div>

      <div className="flex items-center justify-between rounded-3xl border border-gray-800 bg-gray-950 p-5">
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
              'rounded-full border px-3 py-2 text-xs transition',
              hasPrev
                ? 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                : 'cursor-not-allowed border-white/5 bg-white/0 text-white/30',
            ].join(' ')}
          >
            ← Föregående
          </a>

          <a
            href={hasNext ? nextHref : undefined}
            aria-disabled={!hasNext}
            className={[
              'rounded-full border px-3 py-2 text-xs transition',
              hasNext
                ? 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                : 'cursor-not-allowed border-white/5 bg-white/0 text-white/30',
            ].join(' ')}
          >
            Nästa →
          </a>
        </div>
      </div>

      <RBACUserTable
        users={filteredUsers.map((user) => ({
          id: user.id,
          email: user.email,
          full_name: user.full_name,
        }))}
        roles={roles}
        perms={perms}
        userRoles={userRoles}
        userPerms={userPerms}
      />
    </div>
  )
}