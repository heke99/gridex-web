// app/admin/users/page.tsx

import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type AuthUserRow = {
  id: string
  email: string | null
  created_at: string
}

type UserProfileRow = {
  id: string
  full_name: string | null
  created_at: string
}

type UserRoleRow = {
  user_id: string
  role: string
  is_active: boolean | null
}

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient()

  // 1️⃣ RPC call (NO .returns<T[]>())
  const { data: rawUsers, error: authErr } = await supabase.rpc(
    'admin_list_auth_users'
  )

  if (authErr) {
    throw new Error(authErr.message)
  }

  // Hard assert to correct type (enterprise-safe after SQL definition)
  const authUsers: AuthUserRow[] = Array.isArray(rawUsers)
    ? (rawUsers as AuthUserRow[])
    : []

  // 2️⃣ Profiles
  const { data: profilesRaw, error: profileErr } = await supabase
    .from('user_profiles')
    .select('id,full_name,created_at')

  if (profileErr) {
    throw new Error(profileErr.message)
  }

  const profiles: UserProfileRow[] = (profilesRaw ?? []) as UserProfileRow[]

  // 3️⃣ Roles
  const { data: rolesRaw, error: roleErr } = await supabase
    .from('user_roles')
    .select('user_id,role,is_active')

  if (roleErr) {
    throw new Error(roleErr.message)
  }

  const userRoles: UserRoleRow[] = (rolesRaw ?? []) as UserRoleRow[]

  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  const roleMap = new Map<string, UserRoleRow[]>()
  for (const r of userRoles) {
    if (!roleMap.has(r.user_id)) {
      roleMap.set(r.user_id, [])
    }
    roleMap.get(r.user_id)!.push(r)
  }

  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-gray-400 mt-3">
          Auth users + profiles + active roles.
        </p>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400 border-b border-gray-800">
              <tr>
                <th className="p-4">Email</th>
                <th className="p-4">Full name</th>
                <th className="p-4">Roles</th>
                <th className="p-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {authUsers.map((u) => {
                const profile = profileMap.get(u.id)
                const roles = (roleMap.get(u.id) ?? []).filter(
                  (r) => r.is_active !== false
                )

                return (
                  <tr key={u.id} className="border-t border-gray-800">
                    <td className="p-4 text-gray-200">
                      {u.email ?? '—'}
                    </td>
                    <td className="p-4 text-gray-500">
                      {profile?.full_name ?? '—'}
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
                          <span className="text-xs text-gray-500">
                            no active roles
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-500">
                      {new Date(u.created_at).toLocaleString('sv-SE')}
                    </td>
                  </tr>
                )
              })}

              {authUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-gray-500">
                    Inga auth users hittades
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