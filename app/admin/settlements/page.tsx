// app/admin/settlements/page.tsx
import { requirePermissionServer } from '@/lib/auth/requirePermissionServer'

export const dynamic = 'force-dynamic'

export default async function AdminSettlementsPage() {
  await requirePermissionServer('admin.access')

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Settlements</h1>
        <p className="mt-2 text-sm text-white/60">
          Framtidsflik för avräkning/settlement-flöden (BRP/eSett/Svk). Vi håller denna route live för att
          adminnav och guards ska vara end-to-end redo.
        </p>
      </div>
    </div>
  )
}