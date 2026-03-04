// app/admin/rbac/assignments/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminServer } from '@/lib/auth/requireAdminServer'
import {
  setUserPermissionOverride,
  setUserRoleActive,
  createUserWithRole,
} from './actions'

export const dynamic = 'force-dynamic'

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

export default async function AssignmentsPage() {
  await requireAdminServer()

  const supabase = await createSupabaseServerClient()

  const { data: users, error: uErr } = await supabase
    .from('user_profiles')
    .select('id,email,full_name,created_at')
    .order('created_at', { ascending: false })
    .returns<UserProfileRow[]>()

  if (uErr) throw new Error(uErr.message)

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

  const { data: userRoles, error: urErr } = await supabase
    .from('user_roles')
    .select('user_id,role,is_active')
    .returns<UserRoleRow[]>()

  if (urErr) throw new Error(urErr.message)

  const { data: userPerms, error: upErr } = await supabase
    .from('user_permissions')
    .select('user_id,permission_id')
    .returns<UserPermissionRow[]>()

  if (upErr) throw new Error(upErr.message)

  const activeRoleSet = new Set(
    (userRoles ?? [])
      .filter((x) => x.is_active !== false)
      .map((x) => `${x.user_id}:${x.role}`)
  )

  const overrideSet = new Set(
    (userPerms ?? []).map((x) => `${x.user_id}:${x.permission_id}`)
  )

  return (
    <div className="space-y-10">

      {/* HEADER */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">RBAC Assignments</h1>
        <p className="text-gray-400 mt-3">
          Skapa användare • Tilldela roller • Permission overrides • Audit-logg
        </p>
      </div>

      {/* CREATE USER SECTION */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-lg font-semibold mb-4">
          Skapa ny användare
        </div>

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

      {/* USERS TABLE (din befintliga struktur) */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <div className="text-lg font-semibold">Users</div>
          <div className="text-xs text-gray-500 mt-1">
            Alla ändringar loggas i permission_audit.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400 border-b border-gray-800">
              <tr>
                <th className="p-4">Email</th>
                <th className="p-4">Namn</th>
                <th className="p-4">Roles</th>
                <th className="p-4">Overrides</th>
              </tr>
            </thead>

            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-gray-800 align-top">

                  <td className="p-4 text-gray-200">
                    {u.email ?? '—'}
                  </td>

                  <td className="p-4 text-gray-500">
                    {u.full_name ?? '—'}
                  </td>

                  {/* Roles */}
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {(roles ?? []).map((r) => {
                        const key = `${u.id}:${r.name}`
                        const enabled = activeRoleSet.has(key)

                        return (
                          <form key={key} action={setUserRoleActive}>
                            <input type="hidden" name="user_id" value={u.id} />
                            <input type="hidden" name="role" value={r.name} />
                            <input
                              type="hidden"
                              name="active"
                              value={enabled ? 'false' : 'true'}
                            />
                            <button
                              className={[
                                'text-[11px] border px-2 py-1 rounded-full transition',
                                enabled
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
                                  : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
                              ].join(' ')}
                            >
                              {r.name}
                            </button>
                          </form>
                        )
                      })}
                    </div>
                  </td>

                  {/* Overrides */}
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {(perms ?? []).map((p) => {
                        const key = `${u.id}:${p.id}`
                        const enabled = overrideSet.has(key)

                        return (
                          <form key={key} action={setUserPermissionOverride}>
                            <input type="hidden" name="user_id" value={u.id} />
                            <input type="hidden" name="permission_id" value={p.id} />
                            <input
                              type="hidden"
                              name="enabled"
                              value={enabled ? 'false' : 'true'}
                            />
                            <button
                              className={[
                                'text-[11px] border px-2 py-1 rounded-full transition',
                                enabled
                                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15'
                                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10',
                              ].join(' ')}
                            >
                              {p.name}
                            </button>
                          </form>
                        )
                      })}
                    </div>
                  </td>

                </tr>
              ))}

              {(users ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-gray-500">
                    Inga användare hittades i user_profiles.
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-gray-800 text-xs text-gray-500">
          Systemet är kompatibelt med text-baserad role-kolumn i user_roles.
        </div>
      </div>

    </div>
  )
}