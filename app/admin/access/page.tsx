import { requireAdminPageAccess } from '@/lib/admin/guards'

export const dynamic = 'force-dynamic'

type AdminUserRow = {
  user_id: string
  role: string
  is_active?: boolean | null
  created_at?: string
}

export default async function AdminAccessPage() {
  const ctx = await requireAdminPageAccess({ anyOf: ['admin.access'] })
  const supabase = ctx.supabase

  // Read-only visning
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id, role, is_active, created_at')
    .order('created_at', { ascending: false })

  const rows = (data || []) as AdminUserRow[]

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-semibold">RBAC • Admin Users</div>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Behörigheter styrs via <code className="text-white/80">admin_users</code>. Den här vyn är read-only (säker baseline).
          Senare kan vi lägga till CRUD + audit log utan att riskera pricing/publish-logiken.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        {error && (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-rose-200">
            Kunde inte läsa admin_users: {error.message}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-white/60">
              <tr>
                <th className="py-2 pr-4">user_id</th>
                <th className="py-2 pr-4">role</th>
                <th className="py-2 pr-4">active</th>
                <th className="py-2 pr-4">created</th>
              </tr>
            </thead>
            <tbody className="text-white/85">
              {rows.map((r) => (
                <tr key={r.user_id} className="border-t border-white/10">
                  <td className="py-3 pr-4 font-mono text-xs text-white/70">{r.user_id}</td>
                  <td className="py-3 pr-4">{r.role}</td>
                  <td className="py-3 pr-4">{typeof r.is_active === 'undefined' ? '—' : r.is_active ? 'yes' : 'no'}</td>
                  <td className="py-3 pr-4">{r.created_at ? new Date(r.created_at).toLocaleString('sv-SE') : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="py-4 text-sm text-white/60" colSpan={4}>
                    Inga rader hittades i admin_users.
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