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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?reason=unauthorized')
  }

  // 1) Legacy admin_users (behåll)
  const legacy = await requireAdminRole(supabase).catch(() => null)

  // 2) New permission-based admin access
  const { data: hasPerm, error: permErr } = await supabase.rpc(
    'gridex_has_permission',
    { p_user_id: user.id, p_permission: 'admin.access' }
  )

  const permAllowed = !permErr && hasPerm === true
  const legacyAllowed = !!legacy

  if (!legacyAllowed && !permAllowed) {
    redirect('/login?reason=forbidden')
  }

  return (
    <AdminShell email={user.email ?? null}>
      {children}
    </AdminShell>
  )
}