import { supabaseService } from '@/lib/supabase/service'
import RBACUserTable from '@/components/admin/RBACUserTable'
import { requireGlobalAdminPageAccess } from '@/lib/admin/guards'
import { createUserWithRole } from './actions'
import { globalPermissionOverrideRows } from '@/lib/admin/permissionOverrides'
import type { RegisteredRole } from '@/lib/admin/roleAssignmentState'
import { loadGlobalRbacDirectory } from '@/lib/admin/assignmentDirectory'

export const dynamic = 'force-dynamic'

type SearchParams = {
  q?: string
  role?: string
  active?: string
  page?: string
  per_page?: string
}

type PermissionRow = {
  id: string
  name: string
  key: string | null
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
  const ctx = await requireGlobalAdminPageAccess({
    anyOf: ['rbac.write'],
  })

  const supabase = supabaseService
  const resolvedSearchParams = searchParams ? await searchParams : {}

  const q = typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q.trim().slice(0, 200) : ''
  const filterRole = typeof resolvedSearchParams.role === 'string' ? resolvedSearchParams.role : ''
  const filterActive = resolvedSearchParams.active === 'true' ? true : resolvedSearchParams.active === 'false' ? false : null

  const perPage = clampInt(resolvedSearchParams.per_page, 50, 10, 200)
  const page = clampInt(resolvedSearchParams.page, 1, 1, 1000000)

  const from = (page - 1) * perPage
  const [roleResult, permissionResult] = await Promise.all([
    supabase.from('roles').select('id,name,key,is_active').order('name', { ascending: true }).returns<RegisteredRole[]>(),
    supabase.from('permissions').select('id,name,key').order('name', { ascending: true }).returns<PermissionRow[]>(),
  ])
  const { data: rolesRaw, error: rolesError } = roleResult

  if (rolesError) {
    throw new Error(rolesError.message)
  }

  const roles = rolesRaw ?? []

  const { data: permsRaw, error: permsError } = permissionResult

  if (permsError) {
    throw new Error(permsError.message)
  }

  const perms = permsRaw ?? []

  const legacyMatches = filterRole ? roles.filter((role) => (role.key || role.name) === filterRole || role.name === filterRole) : []
  const registered = filterRole
    ? roles.find((role) => role.id === filterRole) ?? (legacyMatches.length === 1 ? legacyMatches[0] : undefined)
    : undefined
  const directory = filterRole && !registered
    ? { users: [], total: 0, userRoles: [], userPermissions: [], overrides: [] }
    : await loadGlobalRbacDirectory(supabase, {
      actorId: ctx.userId, query: q || null, roleId: registered?.id ?? null,
      active: filterActive, limit: perPage, offset: from,
    })
  const { users, total, userRoles } = directory
  const userPerms = globalPermissionOverrideRows(perms, directory.userPermissions, directory.overrides)

  const showingFrom = users.length > 0 ? from + 1 : 0
  const showingTo = users.length > 0 ? from + users.length : 0
  const hasPrev = page > 1
  const hasNext = from + users.length < total

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
            maxLength={200}
            placeholder="Sök email eller namn"
            defaultValue={q}
            className="rounded bg-black p-2 border border-gray-700 md:col-span-2"
          />

          <select
            name="role"
            defaultValue={registered?.id ?? filterRole}
            className="rounded border border-gray-700 bg-black p-2"
          >
            <option value="">Alla roller</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>

          <select
            name="active"
            defaultValue={filterActive === null ? '' : String(filterActive)}
            className="rounded border border-gray-700 bg-black p-2"
          >
            <option value="">Alla</option>
            <option value="true">Med aktiva globala roller</option>
            <option value="false">Utan aktiva globala roller</option>
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
              <option key={role.id} value={role.key || role.name} disabled={role.is_active === false}>
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
        users={users.map((user) => ({
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
