import Link from 'next/link'
import { requireAdminPageAccess } from '@/lib/admin/guards'

export const dynamic = 'force-dynamic'

export default async function RbacOverviewPage() {
  const ctx = await requireAdminPageAccess({ anyOf: ['rbac.read', 'rbac.write', 'admin.access'] })
  const supabase = ctx.supabase

  const { data: perms } = await supabase.rpc('gridex_get_user_permissions', { p_user_id: ctx.userId })

  const permissions = (perms ?? []) as string[]

  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">RBAC & Permissions</h1>
        <p className="text-gray-400 mt-3">
          Enterprise-behörighetssystem: roles → role_permissions → permissions, med user overrides + audit.
        </p>

        <div className="mt-5 text-xs text-gray-500">
          Din effektiva permissions-set:
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {permissions.map((p) => (
            <span
              key={p}
              className="text-[11px] border border-white/10 bg-white/5 px-2 py-1 rounded-full text-white/70"
            >
              {p}
            </span>
          ))}
          {permissions.length === 0 && (
            <span className="text-xs text-gray-500">Inga permissions (kontrollera role mapping)</span>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Link
          href="/admin/rbac/roles"
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6 hover:border-cyan-500/40 transition"
        >
          <div className="text-white font-semibold">Roles</div>
          <div className="text-sm text-gray-400 mt-2">Skapa roller + mappa permissions</div>
        </Link>

        <Link
          href="/admin/rbac/permissions"
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6 hover:border-cyan-500/40 transition"
        >
          <div className="text-white font-semibold">Permissions</div>
          <div className="text-sm text-gray-400 mt-2">Skapa permissions och dokumentera</div>
        </Link>

        <Link
          href="/admin/rbac/assignments"
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6 hover:border-cyan-500/40 transition"
        >
          <div className="text-white font-semibold">Assignments</div>
          <div className="text-sm text-gray-400 mt-2">Tilldela roles + overrides per user</div>
        </Link>
      </div>
    </div>
  )
}