// app/admin/incidents/page.tsx
import { requirePermissionServer } from '@/lib/auth/requirePermissionServer'

export const dynamic = 'force-dynamic'

export default async function AdminIncidentsPage() {
  await requirePermissionServer('admin.access')

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Incident management</h1>
        <p className="mt-2 text-sm text-white/60">
          Framtidsflik för incidenter, driftstatus, loggar och integrationsfel.
        </p>
      </div>
    </div>
  )
}