import Link from 'next/link'
import { requireAdminPageAccess } from '@/lib/admin/guards'

export const dynamic = 'force-dynamic'

export default async function RbacOverviewPage() {
  const ctx = await requireAdminPageAccess({
    anyOf: ['rbac.read', 'rbac.write', 'admin.access'],
  })

  const supabase = ctx.supabase

  const { data: perms, error } = await supabase.rpc('gridex_get_user_permissions', {
    p_user_id: ctx.userId,
  })

  if (error) {
    throw new Error(error.message)
  }

  const permissions = (perms ?? []) as string[]

  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">RBAC & Permissions</h1>
        <p className="mt-3 text-gray-400">
          Enterprise-behörighetssystem med roles → role_permissions → permissions,
          user overrides och audit.
        </p>

        <div className="mt-5 text-xs text-gray-500">
          Din effektiva permissions-set:
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {permissions.map((permission) => (
            <span
              key={permission}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70"
            >
              {permission}
            </span>
          ))}

          {permissions.length === 0 && (
            <span className="text-xs text-gray-500">
              Inga permissions (kontrollera role mapping)
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Link
          href="/admin/rbac/roles"
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6 transition hover:border-cyan-500/40"
        >
          <div className="font-semibold text-white">Roles</div>
          <div className="mt-2 text-sm text-gray-400">
            Skapa roller och mappa permissions
          </div>
        </Link>

        <Link
          href="/admin/rbac/permissions"
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6 transition hover:border-cyan-500/40"
        >
          <div className="font-semibold text-white">Permissions</div>
          <div className="mt-2 text-sm text-gray-400">
            Skapa permissions och dokumentera dem
          </div>
        </Link>

        <Link
          href="/admin/rbac/assignments"
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6 transition hover:border-cyan-500/40"
        >
          <div className="font-semibold text-white">Assignments</div>
          <div className="mt-2 text-sm text-gray-400">
            Tilldela roller och overrides per användare
          </div>
        </Link>
      </div>
    </div>
  )
}