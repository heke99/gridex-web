import { requireAdminPageAccess } from '@/lib/admin/guards'
import { createPermission } from '../actions'

export const dynamic = 'force-dynamic'

type PermissionRow = {
  id: string
  name: string
  description: string | null
  created_at: string
}

export default async function PermissionsPage() {
  const ctx = await requireAdminPageAccess({
    anyOf: ['rbac.write', 'admin.access'],
  })

  const supabase = ctx.supabase

  const { data, error } = await supabase
    .from('permissions')
    .select('id,name,description,created_at')
    .order('name', { ascending: true })
    .returns<PermissionRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const permissions = data ?? []

  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">Permissions</h1>
        <p className="mt-3 text-gray-400">
          Skapa permissions och använd dem i guards, adminnav och UI.
        </p>

        <form
          action={createPermission}
          className="mt-6 grid gap-3 md:grid-cols-[280px_1fr_auto]"
        >
          <input
            name="name"
            placeholder="permission (t.ex. pricing.publish)"
            className="rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            name="description"
            placeholder="description"
            className="rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm"
          />
          <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
            Skapa permission
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-950">
        <div className="border-b border-gray-800 p-6">
          <div className="text-lg font-semibold">Registry</div>
          <div className="mt-1 text-xs text-gray-500">
            Source of truth för access control.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-800 text-xs text-gray-400">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Description</th>
                <th className="p-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => (
                <tr key={permission.id} className="border-t border-gray-800">
                  <td className="p-4 font-medium text-gray-200">
                    {permission.name}
                  </td>
                  <td className="p-4 text-gray-500">
                    {permission.description ?? '—'}
                  </td>
                  <td className="p-4 text-gray-500">
                    {new Date(permission.created_at).toLocaleString('sv-SE')}
                  </td>
                </tr>
              ))}

              {permissions.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-gray-500">
                    Inga permissions ännu.
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