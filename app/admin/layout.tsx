// app/admin/layout.tsx

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'
import { requireAdminRole } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()

  // --------------------------------------------------
  // 1️⃣ Auth
  // --------------------------------------------------
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr || !user) {
    redirect('/login?reason=unauthorized')
  }

  // --------------------------------------------------
  // 2️⃣ Legacy admin (behåll för bakåtkompatibilitet)
  // --------------------------------------------------
  let legacyAllowed = false

  try {
    const legacy = await requireAdminRole(supabase)
    legacyAllowed = !!legacy
  } catch {
    legacyAllowed = false
  }

  // --------------------------------------------------
  // 3️⃣ Permission-based admin access (NEW SYSTEM)
  // --------------------------------------------------
  let permAllowed = false

  const { data: hasPerm, error: permErr } = await supabase.rpc(
    'gridex_has_permission',
    {
      p_user_id: user.id,
      p_permission: 'admin.access',
    }
  )

  if (!permErr && hasPerm === true) {
    permAllowed = true
  }

  // --------------------------------------------------
  // 4️⃣ Block access if neither allowed
  // --------------------------------------------------
  if (!legacyAllowed && !permAllowed) {
    redirect('/login?reason=forbidden')
  }

  // --------------------------------------------------
  // 5️⃣ Load roles (SAFE, no recursion)
  // --------------------------------------------------
  let roles: string[] = []

  const { data: roleRows, error: roleErr } = await supabase
    .from('user_roles')
    .select('role,is_active')
    .eq('user_id', user.id)

  if (roleErr) {
    console.error('[admin.layout] roles read error', roleErr)
  } else {
    roles =
      roleRows
        ?.filter((r) => r.is_active !== false)
        .map((r) => String(r.role)) ?? []
  }

  // --------------------------------------------------
  // 6️⃣ Load permissions (via RPC)
  // --------------------------------------------------
  let permissions: string[] = []

  const { data: perms, error: permsErr } = await supabase.rpc(
    'gridex_get_user_permissions',
    {
      p_user_id: user.id,
    }
  )

  if (permsErr) {
    console.error('[admin.layout] permissions rpc error', permsErr)
  } else if (Array.isArray(perms)) {
    permissions = perms.map((p) => String(p))
  }

  // --------------------------------------------------
  // 7️⃣ Render shell
  // --------------------------------------------------
  return (
    <AdminShell
      email={user.email ?? null}
      roles={roles}
      permissions={permissions}
    >
      {children}
    </AdminShell>
  )
}