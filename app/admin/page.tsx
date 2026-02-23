// app/admin/page.tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/* ===============================
   TYPES
================================ */

type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'
const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

type IdRow = { id: string }

type PricingVersionRow = {
  id: string
  valid_from: string
}

type PricingAuditRow = {
  id: string
  action: string
  performed_at: string
}

/* ===============================
   FORMATTERS
================================ */

function fmtInt(v: number | null | undefined) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return new Intl.NumberFormat('sv-SE').format(v)
}

function fmtMoney(v: number | null | undefined) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(v)
}

function fmtOre(v: number | null | undefined) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return `${new Intl.NumberFormat('sv-SE', {
    maximumFractionDigits: 2,
  }).format(v)} öre/kWh`
}

/* ===============================
   SAFE COUNT (STRICT SAFE)
================================ */

async function safeExactCount(
  builder: {
    then: (
      onfulfilled: (value: { count: number | null; error: unknown }) => unknown,
      onrejected?: (reason: unknown) => unknown
    ) => unknown
  }
): Promise<number | null> {
  try {
    const res = await builder
    if (res?.error) return null
    return typeof res.count === 'number' ? res.count : null
  } catch {
    return null
  }
}

/* ===============================
   UI COMPONENTS
================================ */

function KpiCard({
  label,
  value,
  hint,
  trend,
}: {
  label: string
  value: string
  hint?: string
  trend?: { label: string; tone?: 'good' | 'warn' | 'bad' }
}) {
  const tone = trend?.tone ?? 'good'
  const toneCls =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'warn'
      ? 'text-amber-300'
      : 'text-rose-300'

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>

      {(hint || trend) && (
        <div className="mt-2 flex items-center justify-between gap-3">
          {hint ? (
            <div className="text-[11px] text-white/50">{hint}</div>
          ) : (
            <div />
          )}
          {trend && (
            <div className={['text-[11px]', toneCls].join(' ')}>
              {trend.label}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function QuickAction({
  href,
  title,
  subtitle,
}: {
  href: string
  title: string
  subtitle: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold text-white/90">{title}</div>
          <div className="mt-1 text-[11px] text-white/55">{subtitle}</div>
        </div>
        <div className="text-white/25 group-hover:text-white/40">→</div>
      </div>
    </Link>
  )
}

/* ===============================
   DASHBOARD
================================ */

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
        Session saknas.
      </div>
    )
  }

  /* ===============================
     KPI QUERIES
  ================================= */

  const customersCountP = safeExactCount(
    supabase
      .from('user_roles')
      .select('user_id', { count: 'exact', head: true })
      .eq('role', 'customer')
      .or('is_active.is.null,is_active.eq.true')
  )

  const contractsTotalP = safeExactCount(
    supabase.from('contract_products').select('id', {
      count: 'exact',
      head: true,
    })
  )

  const contractsActiveP = safeExactCount(
    supabase
      .from('contract_products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
  )

  const publishedAnyP = (async (): Promise<PricingVersionRow | null> => {
    const { data, error } = await supabase
      .from('contract_pricing_versions')
      .select('id, valid_from')
      .eq('is_published', true)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle<PricingVersionRow>()

    if (error || !data) return null
    return data
  })()

  const auditLatestP = (async (): Promise<PricingAuditRow | null> => {
    const { data, error } = await supabase
      .from('pricing_version_audit')
      .select('id, action, performed_at')
      .order('performed_at', { ascending: false })
      .limit(1)
      .maybeSingle<PricingAuditRow>()

    if (error || !data) return null
    return data
  })()

  const spotCoverageP = (async () => {
    const { data: activeSpot } = await supabase
      .from('contract_products')
      .select('id')
      .eq('contract_type', 'spot_hourly')
      .eq('is_active', true)

    const spotIds = (activeSpot ?? []).map((r: IdRow) => r.id)
    const expected = spotIds.length * AREAS.length

    if (!spotIds.length) return { expected: 0, actual: 0 }

    const { count } = await supabase
      .from('gridex_spot_area_settings')
      .select('contract_id', { count: 'exact', head: true })
      .in('contract_id', spotIds)

    return { expected, actual: count ?? 0 }
  })()

  const portfolioCoverageP = (async () => {
    const { data: activePortfolio } = await supabase
      .from('contract_products')
      .select('id')
      .in('contract_type', ['portfolio_managed', 'fixed'])
      .eq('is_active', true)

    const ids = (activePortfolio ?? []).map((r: IdRow) => r.id)
    const expected = ids.length * AREAS.length

    if (!ids.length) return { expected: 0, actual: 0 }

    const { count } = await supabase
      .from('gridex_portfolio_area_pricing')
      .select('contract_id', { count: 'exact', head: true })
      .in('contract_id', ids)

    return { expected, actual: count ?? 0 }
  })()

  const [
    customersCount,
    contractsTotal,
    contractsActive,
    publishedAny,
    latestAudit,
    spotCoverage,
    portfolioCoverage,
  ] = await Promise.all([
    customersCountP,
    contractsTotalP,
    contractsActiveP,
    publishedAnyP,
    auditLatestP,
    spotCoverageP,
    portfolioCoverageP,
  ])

  const publishStatus = publishedAny
    ? `Publicerad ${new Date(publishedAny.valid_from).toLocaleDateString(
        'sv-SE'
      )}`
    : 'Ingen publicerad version'

  const publishTrend = publishedAny
    ? { label: 'OK', tone: 'good' as const }
    : { label: 'Saknas', tone: 'bad' as const }

  /* ===============================
     UI
  ================================= */

  return (
    <div className="space-y-10">
      {/* HEADER BLOCK */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-bold">Admin • Översikt</h1>

        <div className="mt-6 flex items-center gap-4 text-sm text-white/70">
          <span
            className={[
              'h-2 w-2 rounded-full',
              publishedAny ? 'bg-emerald-400' : 'bg-rose-400',
            ].join(' ')}
          />
          {publishStatus}
        </div>

        {latestAudit && (
          <div className="mt-3 text-xs text-white/50">
            Senaste audit: {latestAudit.action} •{' '}
            {new Date(latestAudit.performed_at).toLocaleString('sv-SE')}
          </div>
        )}
      </div>

      {/* KPI GRID */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Kunder" value={fmtInt(customersCount)} />
        <KpiCard
          label="Avtal"
          value={`${fmtInt(contractsActive)} / ${fmtInt(contractsTotal)}`}
        />
        <KpiCard
          label="Publish-status"
          value={publishedAny ? 'LIVE' : 'OFF'}
          trend={publishTrend}
        />
        <KpiCard
          label="SE1–SE4 coverage (Spot)"
          value={
            spotCoverage
              ? `${fmtInt(spotCoverage.actual)}/${fmtInt(
                  spotCoverage.expected
                )}`
              : '—'
          }
        />
        <KpiCard
          label="SE1–SE4 coverage (Portfölj)"
          value={
            portfolioCoverage
              ? `${fmtInt(portfolioCoverage.actual)}/${fmtInt(
                  portfolioCoverage.expected
                )}`
              : '—'
          }
        />
      </div>

      {/* QUICK ACTIONS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <QuickAction
          href="/admin/contracts"
          title="Skapa/Hantera avtal"
          subtitle="contract_products • featured • sortering"
        />
        <QuickAction
          href="/admin/pricing"
          title="Skapa prisversion"
          subtitle="clone • write • publish"
        />
        <QuickAction
          href="/admin/calculator"
          title="Kalkylator preview"
          subtitle="validera kundspec"
        />
      </div>
    </div>
  )
}