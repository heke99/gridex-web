//componenents/admin/RBACUserTable.tsx
'use client'

import {
  setUserPermissionOverride,
  setUserRoleActive,
  deactivateUser,
} from '@/app/admin/rbac/assignments/actions'

type UserProfileRow = {
  id: string
  email: string | null
  full_name: string | null
}

type UserRoleRow = {
  user_id: string
  role: string
  is_active: boolean | null
}

type RoleRow = { id: string; name: string }
type PermissionRow = { id: string; name: string }
type UserPermissionRow = { user_id: string; permission_id: string }

export default function RBACUserTable({
  users,
  roles,
  perms,
  userRoles,
  userPerms,
}: {
  users: UserProfileRow[]
  roles: RoleRow[]
  perms: PermissionRow[]
  userRoles: UserRoleRow[]
  userPerms: UserPermissionRow[]
}) {
  const activeRoleSet = new Set(
    userRoles
      .filter((x) => x.is_active !== false)
      .map((x) => `${x.user_id}:${x.role}`)
  )

  const overrideSet = new Set(
    userPerms.map((x) => `${x.user_id}:${x.permission_id}`)
  )

  return (
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
              <th className="p-4">Deactivate</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
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
                    {roles.map((r) => {
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
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                                : 'border-white/10 bg-white/5 text-white/70',
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
                    {perms.map((p) => {
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
                                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                                : 'border-white/10 bg-white/5 text-white/60',
                            ].join(' ')}
                          >
                            {p.name}
                          </button>
                        </form>
                      )
                    })}
                  </div>
                </td>

                {/* Deactivate */}
                <td className="p-4">
                  <form action={deactivateUser}>
                    <input type="hidden" name="user_id" value={u.id} />
                    <button className="bg-red-600 text-xs px-3 py-1 rounded">
                      Deactivate
                    </button>
                  </form>
                </td>

              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-gray-500">
                  Inga användare hittades.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}