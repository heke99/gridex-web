// app/admin/support-tickets/page.tsx
import { requirePermissionServer } from '@/lib/auth/requirePermissionServer'

export const dynamic = 'force-dynamic'

export default async function AdminSupportTicketsPage() {
  // Support team can be allowed via permission, but admin.access always passes too.
  await requirePermissionServer('admin.access').catch(async () => {
    await requirePermissionServer('support.access')
  })

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Support tickets</h1>
        <p className="mt-2 text-sm text-white/60">
          Framtidsflik för ärendehantering. Routingen är på plats så att nav/guards är redo.
        </p>
      </div>
    </div>
  )
}