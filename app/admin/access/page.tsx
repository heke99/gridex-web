import { requireGlobalAdminPageAccess } from '@/lib/admin/guards'
import { supabaseService } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

type AdminUserRow = {
  user_id: string
  role: string
  is_active?: boolean | null
  created_at?: string
}

export default async function AdminAccessPage() {
  await requireGlobalAdminPageAccess({ allOf: ['rbac.read'] })
  const supabase = supabaseService

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
          Historiska administratörsposter. Aktuell åtkomst styrs av aktiva roller och effektiva behörigheter i RBAC.
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
