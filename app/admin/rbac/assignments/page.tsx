import { createSupabaseServerClient } from '@/lib/supabase/server'
import { setUserPermissionOverride, setUserRoleActive } from '../actions'

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

  const overrideSet = new Set((userPerms ?? []).map((x) => `${x.user_id}:${x.permission_id}`))

  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">Assignments</h1>
        <p className="text-gray-400 mt-3">
          Tilldela roles via <span className="text-gray-200">user_roles.role</span> och overrides via{' '}
          <span className="text-gray-200">user_permissions</span>.
        </p>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <div className="text-lg font-semibold">Users</div>
          <div className="text-xs text-gray-500 mt-1">Allt loggas i permission_audit.</div>
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
                  <td className="p-4 text-gray-200">{u.email ?? '—'}</td>
                  <td className="p-4 text-gray-500">{u.full_name ?? '—'}</td>

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
                            <input type="hidden" name="active" value={enabled ? 'false' : 'true'} />
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
                      {(roles ?? []).length === 0 && (
                        <span className="text-xs text-gray-500">Skapa roles först.</span>
                      )}
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
                            <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />

                            <button
                              className={[
                                'text-[11px] border px-2 py-1 rounded-full transition',
                                enabled
                                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15'
                                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10',
                              ].join(' ')}
                              title={p.name}
                            >
                              {p.name}
                            </button>
                          </form>
                        )
                      })}
                      {(perms ?? []).length === 0 && (
                        <span className="text-xs text-gray-500">Skapa permissions först.</span>
                      )}
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
          Notis: Roles tilldelas via er befintliga <span className="text-gray-300">user_roles</span>-tabell (text role).
          Det gör systemet kompatibelt utan breaking changes.
        </div>
      </div>
    </div>
  )
}