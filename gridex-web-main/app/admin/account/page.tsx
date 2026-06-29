import { requireAdminPageAccess } from '@/lib/admin/guards'
import { updateAccountEmail, updateAccountName, updateAccountPassword } from './actions'

export const dynamic = 'force-dynamic'

type ProfileRow = {
  id: string
  full_name: string | null
}

type RoleRow = {
  role: string
  is_active: boolean | null
}

type OverrideRow = {
  permission_id: string
  enabled: boolean | null
  reason: string | null
  created_at: string
}

export default async function AdminAccountPage() {
  const ctx = await requireAdminPageAccess({ anyOf: ['admin.access'] })
  const supabase = ctx.supabase

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .eq('id', ctx.userId)
    .maybeSingle<ProfileRow>()

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role, is_active')
    .eq('user_id', ctx.userId)
    .returns<RoleRow[]>()

  const activeRoles =
    (roleRows ?? [])
      .filter((r) => r.is_active !== false)
      .map((r) => String(r.role)) ?? []

  const { data: overridesRaw } = await supabase
    .from('user_permissions')
    .select('permission_id, enabled, reason, created_at')
    .eq('user_id', ctx.userId)
    .returns<OverrideRow[]>()

  const overrides = overridesRaw ?? []

  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">Account</h1>

        <p className="text-gray-400 mt-3">
          Hantera din profil och säkerhet. Alla ändringar är server-side enforcement + audit-loggade.
        </p>

        <div className="mt-4 grid gap-3 text-sm">
          <div>
            <span className="text-gray-400">User ID:</span>{' '}
            <span className="font-mono text-gray-200">{ctx.userId}</span>
          </div>

          <div>
            <span className="text-gray-400">Email:</span>{' '}
            <span className="text-gray-200">{ctx.email ?? '—'}</span>
          </div>

          <div>
            <span className="text-gray-400">Aktiva roller:</span>{' '}
            <span className="text-gray-200">
              {activeRoles.length ? activeRoles.join(', ') : '—'}
            </span>
          </div>

          <div>
            <span className="text-gray-400">Effektiva permissions:</span>{' '}
            <span className="text-gray-200">
              {ctx.permissions.length ? ctx.permissions.join(', ') : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* NAME */}
        <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
          <div className="text-lg font-semibold">Uppdatera namn</div>

          <form action={updateAccountName} className="mt-4 space-y-3">
            <div>
              <label className="text-xs text-gray-400">Fullt namn</label>

              <input
                name="full_name"
                defaultValue={profile?.full_name ?? ''}
                className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                placeholder="Förnamn Efternamn"
              />
            </div>

            <div className="flex justify-end">
              <button className="h-11 rounded-xl bg-cyan-500 px-6 text-sm font-bold text-black hover:bg-cyan-400">
                Spara
              </button>
            </div>
          </form>
        </div>

        {/* EMAIL */}
        <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
          <div className="text-lg font-semibold">Uppdatera email</div>

          <form action={updateAccountEmail} className="mt-4 space-y-3">
            <div>
              <label className="text-xs text-gray-400">Ny email</label>

              <input
                name="email"
                type="email"
                defaultValue={ctx.email ?? ''}
                className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                placeholder="name@domain.com"
              />
            </div>

            <div className="flex justify-end">
              <button className="h-11 rounded-xl bg-cyan-500 px-6 text-sm font-bold text-black hover:bg-cyan-400">
                Uppdatera email
              </button>
            </div>
          </form>
        </div>

        {/* PASSWORD */}
        <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6 lg:col-span-2">
          <div className="text-lg font-semibold">Ändra lösenord</div>

          <form
            action={updateAccountPassword}
            className="mt-4 grid gap-4 md:grid-cols-3 items-end"
          >
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400">Nytt lösenord</label>

              <input
                name="password"
                type="password"
                className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                placeholder="Minst 8 tecken"
              />
            </div>

            <div className="md:col-span-1 flex justify-end">
              <button className="h-11 w-full rounded-xl bg-cyan-500 px-6 text-sm font-bold text-black hover:bg-cyan-400">
                Byt lösenord
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* OVERRIDES */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <div className="text-lg font-semibold">Permission overrides</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400 border-b border-gray-800">
              <tr>
                <th className="p-4">permission_id</th>
                <th className="p-4">enabled</th>
                <th className="p-4">reason</th>
                <th className="p-4">created_at</th>
              </tr>
            </thead>

            <tbody>
              {overrides.length ? (
                overrides.map((o) => (
                  <tr
                    key={o.permission_id + o.created_at}
                    className="border-t border-gray-800"
                  >
                    <td className="p-4 font-mono text-gray-200">
                      {o.permission_id}
                    </td>

                    <td className="p-4 text-gray-200">
                      {o.enabled === null
                        ? '—'
                        : o.enabled
                        ? 'true'
                        : 'false'}
                    </td>

                    <td className="p-4 text-gray-300">
                      {o.reason ?? '—'}
                    </td>

                    <td className="p-4 text-gray-400">
                      {o.created_at}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-gray-800">
                  <td
                    className="p-4 text-gray-500"
                    colSpan={4}
                  >
                    Inga overrides
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