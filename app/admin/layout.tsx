// app/admin/layout.tsx
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'
import { requireAdminRole } from '@/lib/auth/admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()

  const authResult = await requireAdminRole(supabase).catch(() => null)

  if (!authResult) {
    redirect('/')
  }

  const { user } = authResult

  return (
    <AdminShell email={user.email ?? null}>
      {children}
    </AdminShell>
  )
}