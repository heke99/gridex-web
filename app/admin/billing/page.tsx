// app/admin/billing/page.tsx
import { requireAdminPageAccess } from '@/lib/admin/guards'

export const dynamic = 'force-dynamic'

export default async function AdminBillingPage() {
  await requireAdminPageAccess({ anyOf: ['admin.access'] })

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Fakturering & betalningar</h1>
        <p className="mt-2 text-sm text-white/60">
          Framtidsflik: fakturastatus, betalningsstatus, export, integrationer mot ekonomi/CIS.
        </p>
      </div>
    </div>
  )
}