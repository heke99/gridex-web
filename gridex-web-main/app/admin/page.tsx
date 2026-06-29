import Link from 'next/link'
import { requireAdminPageAccess } from '@/lib/admin/guards'

export const dynamic = 'force-dynamic'

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

function fmtInt(v: number | null | undefined) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return new Intl.NumberFormat('sv-SE').format(v)
}

type CountAwaitable = {
  then: (
    onfulfilled: (value: { count: number | null; error: unknown }) => unknown,
    onrejected?: (reason: unknown) => unknown
  ) => unknown
}

async function safeExactCount(builder: CountAwaitable): Promise<number | null> {
  try {
    const res = await builder
    if (res?.error) return null
    return typeof res.count === 'number' ? res.count : null
  } catch {
    return null
  }
}

function hasAnyPermission(permissions: string[], required: string[]): boolean {
  return required.some((permission) => permissions.includes(permission))
}

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
      className="group rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-semibold text-white/90">{title}</div>
          <div className="mt-1 text-[11px] text-white/55">{subtitle}</div>
        </div>
        <div className="text-white/25 group-hover:text-white/40">→</div>
      </div>
    </Link>
  )
}

export default async function AdminDashboard() {
  const ctx = await requireAdminPageAccess({
    anyOf: ['admin.access', 'support_tickets.manage'],
  })

  const supabase = ctx.supabase
  const permissions = ctx.permissions

  const canAccessCommercial = permissions.includes('admin.access')
  const canManageSupport = hasAnyPermission(permissions, [
    'admin.access',
    'support_tickets.manage',
  ])
  const canAccessPortfolio = hasAnyPermission(permissions, [
    'portfolio.read',
    'portfolio.write',
    'pricing.write',
    'admin.access',
  ])
  const canAccessSpot = hasAnyPermission(permissions, [
    'spot.read',
    'spot.write',
    'spot.publish',
    'pricing.write',
    'admin.access',
  ])

  const customersCountP = canAccessCommercial
    ? safeExactCount(
        supabase
          .from('user_roles')
          .select('user_id', { count: 'exact', head: true })
          .eq('role', 'customer')
          .or('is_active.is.null,is_active.eq.true')
      )
    : Promise.resolve<number | null>(null)

  const contractsTotalP = canAccessCommercial
    ? safeExactCount(
        supabase.from('contract_products').select('id', {
          count: 'exact',
          head: true,
        })
      )
    : Promise.resolve<number | null>(null)

  const contractsActiveP = canAccessCommercial
    ? safeExactCount(
        supabase
          .from('contract_products')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
      )
    : Promise.resolve<number | null>(null)

  const publishedAnyP = canAccessCommercial
    ? (async (): Promise<PricingVersionRow | null> => {
        const { data, error } = await supabase
          .from('contract_pricing_versions')
          .select('id,valid_from')
          .eq('is_published', true)
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle<PricingVersionRow>()

        if (error || !data) return null
        return data
      })()
    : Promise.resolve<PricingVersionRow | null>(null)

  const auditLatestP = canAccessCommercial
    ? (async (): Promise<PricingAuditRow | null> => {
        const { data, error } = await supabase
          .from('pricing_version_audit')
          .select('id,action,performed_at')
          .order('performed_at', { ascending: false })
          .limit(1)
          .maybeSingle<PricingAuditRow>()

        if (error || !data) return null
        return data
      })()
    : Promise.resolve<PricingAuditRow | null>(null)

  const spotCoverageP = canAccessCommercial
    ? (async () => {
        const { data: activeSpot } = await supabase
          .from('contract_products')
          .select('id')
          .eq('contract_type', 'spot_hourly')
          .eq('is_active', true)

        const spotIds = (activeSpot ?? []).map((row: IdRow) => row.id)
        const expected = spotIds.length * AREAS.length

        if (!spotIds.length) return { expected: 0, actual: 0 }

        const { count } = await supabase
          .from('gridex_spot_area_settings')
          .select('contract_id', { count: 'exact', head: true })
          .in('contract_id', spotIds)

        return { expected, actual: count ?? 0 }
      })()
    : Promise.resolve<{ expected: number; actual: number } | null>(null)

  const portfolioCoverageP = canAccessCommercial
    ? (async () => {
        const { data: activePortfolio } = await supabase
          .from('contract_products')
          .select('id')
          .in('contract_type', ['portfolio_managed', 'fixed'])
          .eq('is_active', true)

        const ids = (activePortfolio ?? []).map((row: IdRow) => row.id)
        const expected = ids.length * AREAS.length

        if (!ids.length) return { expected: 0, actual: 0 }

        const { count } = await supabase
          .from('gridex_portfolio_area_pricing')
          .select('contract_id', { count: 'exact', head: true })
          .in('contract_id', ids)

        return { expected, actual: count ?? 0 }
      })()
    : Promise.resolve<{ expected: number; actual: number } | null>(null)

  const supportOpenP = canManageSupport
    ? safeExactCount(
        supabase
          .from('customer_support_tickets')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'waiting_on_customer', 'waiting_on_internal'])
      )
    : Promise.resolve<number | null>(null)

  const supportResolvedP = canManageSupport
    ? safeExactCount(
        supabase
          .from('customer_support_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'resolved')
      )
    : Promise.resolve<number | null>(null)

  const supportUnassignedP = canManageSupport
    ? safeExactCount(
        supabase
          .from('customer_support_tickets')
          .select('id', { count: 'exact', head: true })
          .is('assigned_user_id', null)
          .in('status', ['open', 'waiting_on_customer', 'waiting_on_internal'])
      )
    : Promise.resolve<number | null>(null)

  const [
    customersCount,
    contractsTotal,
    contractsActive,
    publishedAny,
    latestAudit,
    spotCoverage,
    portfolioCoverage,
    supportOpen,
    supportResolved,
    supportUnassigned,
  ] = await Promise.all([
    customersCountP,
    contractsTotalP,
    contractsActiveP,
    publishedAnyP,
    auditLatestP,
    spotCoverageP,
    portfolioCoverageP,
    supportOpenP,
    supportResolvedP,
    supportUnassignedP,
  ])

  const publishStatus = publishedAny
    ? `Publicerad ${new Date(publishedAny.valid_from).toLocaleDateString('sv-SE')}`
    : 'Ingen publicerad version'

  const publishTrend = publishedAny
    ? { label: 'OK', tone: 'good' as const }
    : { label: 'Saknas', tone: 'bad' as const }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">
              Gridex Admin
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">
              Översikt
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-white/60">
              Samlad status för avtal, publicering, prissättning och
              supportflöden. Dashboarden visar endast de block som den inloggade
              användaren har rätt att se och arbeta med.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="text-[11px] text-white/50">Behörighet</div>
              <div className="mt-1 text-sm text-white/90">
                {ctx.roles.length > 0 ? ctx.roles.join(', ') : 'Ingen roll'}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="text-[11px] text-white/50">Publicering</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-white/90">
                <span
                  className={[
                    'inline-block h-2.5 w-2.5 rounded-full',
                    publishedAny ? 'bg-emerald-400' : 'bg-rose-400',
                  ].join(' ')}
                />
                <span>{publishStatus}</span>
              </div>
            </div>
          </div>
        </div>

        {latestAudit ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-white/60">
            Senaste audit: <span className="text-white/85">{latestAudit.action}</span>{' '}
            • {new Date(latestAudit.performed_at).toLocaleString('sv-SE')}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {canAccessCommercial ? (
          <>
            <KpiCard label="Kunder" value={fmtInt(customersCount)} />
            <KpiCard
              label="Avtal"
              value={`${fmtInt(contractsActive)} / ${fmtInt(contractsTotal)}`}
              hint="Aktiva / totalt"
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
                  ? `${fmtInt(spotCoverage.actual)}/${fmtInt(spotCoverage.expected)}`
                  : '—'
              }
              hint="Aktiva spotkontrakt med area-inställningar"
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
              hint="Aktiva portfölj/fixed-kontrakt med area-pris"
            />
          </>
        ) : null}

        {canManageSupport ? (
          <>
            <KpiCard
              label="Support • öppna"
              value={fmtInt(supportOpen)}
              hint="Öppna + väntar"
              trend={
                typeof supportOpen === 'number' && supportOpen > 0
                  ? { label: 'Behöver bevakning', tone: 'warn' }
                  : { label: 'Under kontroll', tone: 'good' }
              }
            />
            <KpiCard
              label="Support • olösta utan handläggare"
              value={fmtInt(supportUnassigned)}
              hint="Ej tilldelade ärenden"
              trend={
                typeof supportUnassigned === 'number' && supportUnassigned > 0
                  ? { label: 'Kräver tilldelning', tone: 'bad' }
                  : { label: 'Tilldelade', tone: 'good' }
              }
            />
            <KpiCard
              label="Support • lösta"
              value={fmtInt(supportResolved)}
              hint="Status = resolved"
            />
          </>
        ) : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Snabbåtgärder</h2>
            <p className="mt-1 text-sm text-white/55">
              Endast moduler som användaren har åtkomst till visas här.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {canAccessCommercial ? (
            <>
              <QuickAction
                href="/admin/contracts"
                title="Skapa / hantera avtal"
                subtitle="contract_products • featured • sortering • publicering"
              />
              <QuickAction
                href="/admin/pricing"
                title="Skapa prisversion"
                subtitle="clone • write • publish • versionsflöde"
              />
              <QuickAction
                href="/admin/calculator"
                title="Kalkylator preview"
                subtitle="validera kundspec och publicerad logik"
              />
            </>
          ) : null}

          {canAccessSpot ? (
            <QuickAction
              href="/admin/spot-settings"
              title="Spot Settings"
              subtitle="area-inställningar och spotrelaterad konfiguration"
            />
          ) : null}

          {canAccessPortfolio ? (
            <QuickAction
              href="/admin/portfolio-pricing"
              title="Portfölj & fastpris"
              subtitle="SE1–SE4 priser för portfolio/fixed"
            />
          ) : null}

          {canAccessCommercial ? (
            <QuickAction
              href="/admin/customer-spec"
              title="Kundspec-preview"
              subtitle="kontroll av kundens prisrad och flöde"
            />
          ) : null}

          {canManageSupport ? (
            <QuickAction
              href="/admin/support-tickets"
              title="Supportärenden"
              subtitle="inkommande ärenden • tilldelning • status • svar"
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Databasstatus</h2>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <span>Kontraktstabeller</span>
              <span className="text-white/90">
                {canAccessCommercial ? 'Kopplade' : 'Ej tillgängligt för din roll'}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <span>Pricing audit</span>
              <span className="text-white/90">
                {canAccessCommercial ? 'Aktiv läsning' : 'Ej tillgängligt för din roll'}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <span>Supporttabeller</span>
              <span className="text-white/90">
                {canManageSupport ? 'Aktiv läsning / hantering' : 'Ej tillgängligt för din roll'}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Arbetsyta</h2>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                Inloggad användare
              </div>
              <div className="mt-1 text-white/90">{ctx.email ?? '—'}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                Aktiva roller
              </div>
              <div className="mt-1 text-white/90">
                {ctx.roles.length > 0 ? ctx.roles.join(', ') : '—'}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                Behörigheter
              </div>
              <div className="mt-1 text-white/90">
                {ctx.permissions.length > 0
                  ? `${ctx.permissions.length} st laddade`
                  : 'Inga behörigheter hittades'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}