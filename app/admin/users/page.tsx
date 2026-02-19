import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/auth/admin'
import { setUserActive, setUserRole, type UserRole } from './actions'

export const dynamic = 'force-dynamic'

type UserRow = {
  id: string
  email: string | null
  full_name: string | null
  role: UserRole | null
  is_active: boolean | null
  created_at: string
}

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient()
  await requireAdminRole(supabase)

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id,email,full_name,role,is_active,created_at')
    .order('created_at', { ascending: false })
    .returns<UserRow[]>()

  if (error) throw new Error(error.message)

  const users = data ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Användare</h1>
        <p className="text-gray-400 mt-2">
          Hantera roller och åtkomst. (Enterprise RBAC)
        </p>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400 border-b border-gray-800">
              <tr>
                <th className="p-4">Email</th>
                <th className="p-4">Namn</th>
                <th className="p-4">Roll</th>
                <th className="p-4">Status</th>
                <th className="p-4">Skapad</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const active = u.is_active !== false
                return (
                  <tr key={u.id} className="border-t border-gray-800">
                    <td className="p-4 text-gray-200">{u.email ?? '—'}</td>
                    <td className="p-4 text-gray-400">{u.full_name ?? '—'}</td>

                    <td className="p-4">
                      <form action={setUserRole} className="flex items-center gap-2">
                        <input type="hidden" name="user_id" value={u.id} />
                        <select
                          name="role"
                          defaultValue={u.role ?? 'user'}
                          className="rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm"
                        >
                          <option value="user">user</option>
                          <option value="editor">editor</option>
                          <option value="admin">admin</option>
                        </select>
                        <button className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-white/90">
                          Spara
                        </button>
                      </form>
                    </td>

                    <td className="p-4">
                      <span className={active ? 'text-emerald-300' : 'text-rose-300'}>
                        {active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>

                    <td className="p-4 text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('sv-SE')}
                    </td>

                    <td className="p-4">
                      <form action={setUserActive}>
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="is_active" value={active ? 'false' : 'true'} />
                        <button className="rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-xs text-gray-200 hover:border-cyan-500/40">
                          {active ? 'Inaktivera' : 'Aktivera'}
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}

              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-gray-500">
                    Inga användare hittades i user_profiles.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Tips: Koppla signups till en trigger som skapar en rad i <span className="text-gray-300">user_profiles</span>.
      </div>
    </div>
  )
}