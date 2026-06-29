import { requireAdminPageAccess } from '@/lib/admin/guards'
import { createRole, toggleRolePermission } from '../actions'

export const dynamic = 'force-dynamic'

type RoleRow = {
  id: string
  name: string
  description: string | null
  created_at: string
}

type PermissionRow = {
  id: string
  name: string
  description: string | null
}

type RolePermissionRow = {
  role_id: string
  permission_id: string
}

export default async function RolesPage() {
  const ctx = await requireAdminPageAccess({
    anyOf: ['rbac.write', 'admin.access'],
  })

  const supabase = ctx.supabase

  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id,name,description,created_at')
    .order('name', { ascending: true })
    .returns<RoleRow[]>()

  if (rolesError) {
    throw new Error(rolesError.message)
  }

  const { data: permissions, error: permissionsError } = await supabase
    .from('permissions')
    .select('id,name,description')
    .order('name', { ascending: true })
    .returns<PermissionRow[]>()

  if (permissionsError) {
    throw new Error(permissionsError.message)
  }

  const { data: rolePerms, error: rolePermsError } = await supabase
    .from('role_permissions')
    .select('role_id,permission_id')
    .returns<RolePermissionRow[]>()

  if (rolePermsError) {
    throw new Error(rolePermsError.message)
  }

  const rpSet = new Set(
    (rolePerms ?? []).map((row) => `${row.role_id}:${row.permission_id}`)
  )

  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">Roles</h1>
        <p className="mt-3 text-gray-400">
          Skapa roller och mappa permissions via role_permissions.
        </p>

        <form
          action={createRole}
          className="mt-6 grid gap-3 md:grid-cols-[220px_1fr_auto]"
        >
          <input
            name="name"
            placeholder="role name (t.ex. billing_admin)"
            className="rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            name="description"
            placeholder="description"
            className="rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm"
          />
          <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
            Skapa role
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-950">
        <div className="border-b border-gray-800 p-6">
          <div className="text-lg font-semibold">Role → Permissions</div>
          <div className="mt-1 text-xs text-gray-500">
            Toggle mapping. Alla ändringar audit-loggas.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-800 text-xs text-gray-400">
              <tr>
                <th className="p-4">Role</th>
                <th className="p-4">Description</th>
                <th className="p-4">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {(roles ?? []).map((role) => (
                <tr key={role.id} className="align-top border-t border-gray-800">
                  <td className="p-4 font-medium text-gray-200">{role.name}</td>
                  <td className="p-4 text-gray-500">{role.description ?? '—'}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {(permissions ?? []).map((permission) => {
                        const key = `${role.id}:${permission.id}`
                        const enabled = rpSet.has(key)

                        return (
                          <form key={key} action={toggleRolePermission}>
                            <input type="hidden" name="role_id" value={role.id} />
                            <input
                              type="hidden"
                              name="permission_id"
                              value={permission.id}
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
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
                                  : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
                              ].join(' ')}
                              title={permission.description ?? permission.name}
                            >
                              {permission.name}
                            </button>
                          </form>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              ))}

              {(roles ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-gray-500">
                    Inga roles. Skapa en role ovan.
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