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
      .filter((row) => row.is_active !== false)
      .map((row) => `${row.user_id}:${row.role}`)
  )

  const overrideSet = new Set(
    userPerms.map((row) => `${row.user_id}:${row.permission_id}`)
  )

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-950">
      <div className="border-b border-gray-800 p-6">
        <div className="text-lg font-semibold">Users</div>
        <div className="mt-1 text-xs text-gray-500">
          Alla ändringar loggas i permission_audit.
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-800 text-xs text-gray-400">
            <tr>
              <th className="p-4">Email</th>
              <th className="p-4">Namn</th>
              <th className="p-4">Roles</th>
              <th className="p-4">Overrides</th>
              <th className="p-4">Deactivate</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="align-top border-t border-gray-800">
                <td className="p-4 text-gray-200">{user.email ?? '—'}</td>

                <td className="p-4 text-gray-500">{user.full_name ?? '—'}</td>

                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => {
                      const key = `${user.id}:${role.name}`
                      const enabled = activeRoleSet.has(key)

                      return (
                        <form key={key} action={setUserRoleActive}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <input type="hidden" name="role" value={role.name} />
                          <input
                            type="hidden"
                            name="active"
                            value={enabled ? 'false' : 'true'}
                          />
                          <button
                            className={[
                              'rounded-full border px-2 py-1 text-[11px] transition',
                              enabled
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                                : 'border-white/10 bg-white/5 text-white/70',
                            ].join(' ')}
                          >
                            {role.name}
                          </button>
                        </form>
                      )
                    })}
                  </div>
                </td>

                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {perms.map((perm) => {
                      const key = `${user.id}:${perm.id}`
                      const enabled = overrideSet.has(key)

                      return (
                        <form key={key} action={setUserPermissionOverride}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <input
                            type="hidden"
                            name="permission_id"
                            value={perm.id}
                          />
                          <input
                            type="hidden"
                            name="enabled"
                            value={enabled ? 'false' : 'true'}
                          />
                          <button
                            className={[
                              'rounded-full border px-2 py-1 text-[11px] transition',
                              enabled
                                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                                : 'border-white/10 bg-white/5 text-white/60',
                            ].join(' ')}
                          >
                            {perm.name}
                          </button>
                        </form>
                      )
                    })}
                  </div>
                </td>

                <td className="p-4">
                  <form action={deactivateUser}>
                    <input type="hidden" name="user_id" value={user.id} />
                    <button className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-500">
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