// app/admin/users/page.tsx

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createUser, resetUserPassword, setUserActive, setUserRole, type AdminUserRole } from './actions'
import { requirePermissionServer } from '@/lib/auth/requirePermissionServer'

export const dynamic = 'force-dynamic'

type AuthUserRow = {
  id: string
  email: string | null
  created_at: string
}

type UserProfileRow = {
  id: string
  full_name: string | null
  is_active?: boolean | null
  created_at: string
}

type UserRoleRow = {
  user_id: string
  role: string
  is_active: boolean | null
}

const ROLES: AdminUserRole[] = ['admin', 'support', 'partner', 'customer']

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient()

  // Gate: admin.access (RBAC) OR legacy admin_users
  await requirePermissionServer('admin.access').catch(async () => {
    // Legacy fallback
    const { requireAdminRole } = await import('@/lib/auth/admin')
    await requireAdminRole(supabase)
  })

  // 1️⃣ Auth users via RPC (admin_list_auth_users)
  const { data: rawUsers, error: authErr } = await supabase.rpc('admin_list_auth_users')
  if (authErr) throw new Error(authErr.message)

  const authUsers: AuthUserRow[] = Array.isArray(rawUsers) ? (rawUsers as AuthUserRow[]) : []

  // 2️⃣ Profiles
  const { data: profilesRaw, error: profileErr } = await supabase
    .from('user_profiles')
    .select('id,full_name,is_active,created_at')

  if (profileErr) throw new Error(profileErr.message)
  const profiles: UserProfileRow[] = (profilesRaw ?? []) as UserProfileRow[]

  // 3️⃣ Roles
  const { data: rolesRaw, error: roleErr } = await supabase
    .from('user_roles')
    .select('user_id,role,is_active')

  if (roleErr) throw new Error(roleErr.message)
  const userRoles: UserRoleRow[] = (rolesRaw ?? []) as UserRoleRow[]

  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  const roleMap = new Map<string, UserRoleRow[]>()
  for (const r of userRoles) {
    if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, [])
    roleMap.get(r.user_id)!.push(r)
  }

  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">User management</h1>
        <p className="text-gray-400 mt-3">
          Skapa användare (direkt godkända), sätt roller, aktivera/inaktivera och återställ lösenord.
          Alla admin-writes kör service role men access kontrolleras via <span className="font-mono">admin.access</span>.
        </p>
      </div>

      {/* Create user */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-lg font-semibold">Skapa användare</div>
        <p className="text-gray-400 mt-1 text-sm">
          Skapar Supabase Auth user + user_profiles + user_roles. Email markeras som bekräftad så användaren kan logga in direkt.
        </p>

        <form action={createUser} className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-400">Namn</label>
            <input
              name="full_name"
              className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              placeholder="Förnamn Efternamn"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-gray-400">Email</label>
            <input
              name="email"
              required
              className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              placeholder="name@domain.com"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-gray-400">Temporärt lösenord</label>
            <input
              name="temp_password"
              required
              className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              placeholder="Minst 8 tecken"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-gray-400">Roll (valfritt)</label>
            <select
              name="role"
              defaultValue="customer"
              className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 flex justify-end">
            <button className="h-11 rounded-xl bg-cyan-500 px-6 text-sm font-bold text-black hover:bg-cyan-400">
              Skapa användare
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <div className="text-lg font-semibold">Alla användare</div>
          <p className="text-gray-400 mt-1 text-sm">
            Visar Auth users (RPC), kopplade profiler och roller från <span className="font-mono">user_roles</span>.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400 border-b border-gray-800">
              <tr>
                <th className="p-4">Email</th>
                <th className="p-4">Namn</th>
                <th className="p-4">Aktiv</th>
                <th className="p-4">Roller (aktiva)</th>
                <th className="p-4">Actions</th>
                <th className="p-4">Skapad</th>
              </tr>
            </thead>
            <tbody>
              {authUsers.map((u) => {
                const profile = profileMap.get(u.id)
                const isActive = profile?.is_active !== false
                const roles = (roleMap.get(u.id) ?? []).filter((r) => r.is_active !== false)

                return (
                  <tr key={u.id} className="border-t border-gray-800 align-top">
                    <td className="p-4 text-gray-200">{u.email ?? '—'}</td>
                    <td className="p-4 text-gray-300">{profile?.full_name ?? '—'}</td>
                    <td className="p-4">
                      <span className={isActive ? 'text-emerald-300' : 'text-rose-300'}>
                        {isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {roles.length > 0 ? (
                          roles.map((r) => (
                            <span
                              key={r.role}
                              className="text-[11px] border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 rounded-full text-emerald-200"
                            >
                              {r.role}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="space-y-3">
                        {/* Active toggle */}
                        <form action={setUserActive} className="flex items-center gap-2">
                          <input type="hidden" name="user_id" value={u.id} />
                          <input type="hidden" name="is_active" value={isActive ? 'false' : 'true'} />
                          <button className="rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-xs text-gray-200 hover:border-cyan-500/40">
                            {isActive ? 'Inaktivera' : 'Aktivera'}
                          </button>
                        </form>

                        {/* Role set */}
                        <form action={setUserRole} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="user_id" value={u.id} />
                          <select
                            name="role"
                            defaultValue="customer"
                            className="h-9 rounded-lg border border-gray-800 bg-black/40 px-2 text-xs text-gray-200"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>

                          <select
                            name="is_active"
                            defaultValue="true"
                            className="h-9 rounded-lg border border-gray-800 bg-black/40 px-2 text-xs text-gray-200"
                          >
                            <option value="true">Aktivera roll</option>
                            <option value="false">Inaktivera roll</option>
                          </select>

                          <button className="h-9 rounded-lg border border-gray-800 bg-black/40 px-3 text-xs text-gray-200 hover:border-cyan-500/40">
                            Spara roll
                          </button>
                        </form>

                        {/* Password reset */}
                        <form action={resetUserPassword} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="user_id" value={u.id} />
                          <input
                            name="new_password"
                            placeholder="Nytt lösenord (min 8)"
                            className="h-9 w-52 rounded-lg border border-gray-800 bg-black/40 px-3 text-xs text-gray-200"
                            required
                          />
                          <button className="h-9 rounded-lg bg-cyan-500 px-3 text-xs font-bold text-black hover:bg-cyan-400">
                            Återställ
                          </button>
                        </form>
                      </div>
                    </td>

                    <td className="p-4 text-gray-500">{fmt(u.created_at)}</td>
                  </tr>
                )
              })}

              {authUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-gray-500">
                    Inga användare hittades.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}