// app/admin/page.tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

type PublishedVersion = {
  id: string
  valid_from: string
  created_at: string
}

type AuditRow = {
  id: string
  contract_id: string
  action: 'publish' | 'unpublish'
  performed_at: string
}

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient()
  await requireAdminRole(supabase)

  // OBS: du använder is_published här. Jag rör inte din affärslogik.
  const { data: publishedVersion } = await supabase
    .from('contract_pricing_versions')
    .select('id, valid_from, created_at')
    .eq('is_published', true)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle<PublishedVersion>()

  const { data: latestAudit } = await supabase
    .from('pricing_version_audit')
    .select('id, contract_id, action, performed_at')
    .order('performed_at', { ascending: false })
    .limit(1)
    .maybeSingle<AuditRow>()

  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-400 mt-3">
          Central hub för pricing-versioner, avtal, användare och systemstyrning.
        </p>

        <div className="mt-6 space-y-3 text-sm text-gray-400">
          {publishedVersion ? (
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Senast publicerad version:{' '}
              <span className="text-white">
                {new Date(publishedVersion.valid_from).toLocaleDateString(
                  'sv-SE'
                )}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Ingen publicerad pricing-version
            </div>
          )}

          {latestAudit && (
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              Senaste audit: <span className="text-white">{latestAudit.action}</span>{' '}
              {new Date(latestAudit.performed_at).toLocaleString('sv-SE')}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/pricing"
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6 hover:border-cyan-500/40 transition"
        >
          <div className="text-white font-semibold">Prishantering</div>
          <div className="text-sm text-gray-400 mt-2">Versioner per kontrakt</div>
        </Link>

        <Link
          href="/admin/contracts"
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6 hover:border-cyan-500/40 transition"
        >
          <div className="text-white font-semibold">Elavtal</div>
          <div className="text-sm text-gray-400 mt-2">Skapa & hantera produkter</div>
        </Link>

        <Link
          href="/admin/users"
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6 hover:border-cyan-500/40 transition"
        >
          <div className="text-white font-semibold">Användare</div>
          <div className="text-sm text-gray-400 mt-2">Roller & åtkomst</div>
        </Link>

        <Link
          href="/admin/audit/pricing"
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6 hover:border-cyan-500/40 transition"
        >
          <div className="text-white font-semibold">Audit</div>
          <div className="text-sm text-gray-400 mt-2">Publish-historik & export</div>
        </Link>

        <Link
          href="/admin/monthly-spot"
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6 hover:border-cyan-500/40 transition"
        >
          <div className="text-white font-semibold">Månads-Spot</div>
          <div className="text-sm text-gray-400 mt-2">Underlag per SE1–SE4</div>
        </Link>

        <Link
          href="/admin/spot-settings"
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6 hover:border-cyan-500/40 transition"
        >
          <div className="text-white font-semibold">Spot-inställningar</div>
          <div className="text-sm text-gray-400 mt-2">Påslag/avgifter</div>
        </Link>

        <Link
          href="/admin/portfolio-pricing"
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6 hover:border-cyan-500/40 transition"
        >
          <div className="text-white font-semibold">Portfölj & Fast</div>
          <div className="text-sm text-gray-400 mt-2">Pris per område</div>
        </Link>
      </div>
    </div>
  )
}