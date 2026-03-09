import AdminShell from '@/app/admin/ui/AdminShell'
import { requireAdminAccess } from '@/lib/admin/guards'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await requireAdminAccess()

  return <AdminShell ctx={ctx}>{children}</AdminShell>
}