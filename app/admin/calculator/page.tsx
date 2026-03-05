// app/admin/calculator/page.tsx
import Link from 'next/link'
import { requireAdminPageAccess } from '@/lib/admin/guards'
import { logPermissionAudit } from '@/lib/auth/audit'
import {
  computeCustomerSpec,
  type ContractProduct,
  type PriceArea,
  type CustomerSpecResult,
} from '@/lib/gridex/previewEngine'

export const dynamic = 'force-dynamic'

const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

function toNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function fmtOre(v: number) {
  return `${new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(v)} öre/kWh`
}

function fmtMoney(v: number) {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(v)
}

function SpecTable({ spec }: { spec: CustomerSpecResult }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm text-white/60">Validering • Kundspec</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            {spec.contract.name}
          </div>
          <div className="mt-1 text-[12px] text-white/55">
            {spec.contract.slug} • {spec.contract.contract_type} • {spec.priceArea}{' '}
            • {spec.kwh} kWh/mån
          </div>
          <div className="mt-3 text-[11px] text-white/50">
            Prisversion:{' '}
            <span className="text-white/70">{spec.pricingVersion.id}</span>
            {spec.pricingVersion.version_number != null ? (
              <> • v{spec.pricingVersion.version_number}</>
            ) : null}
            {' • '}giltig från{' '}
            {new Date(spec.pricingVersion.valid_from).toLocaleDateString('sv-SE')}
          </div>
        </div>

        <div className="grid gap-2 text-right">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <div className="text-[11px] text-white/55">Totalt pris (öre/kWh)</div>
            <div className="mt-1 text-lg font-semibold">
              {fmtOre(spec.totalOrePerKwh)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <div className="text-[11px] text-white/55">Total månadskostnad</div>
            <div className="mt-1 text-lg font-semibold">
              {fmtMoney(spec.totalMonthlyCostSek)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-black/40">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">
                Komponent
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-white/70">
                Öre/kWh
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-white/70">
                SEK/mån
              </th>
              <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-white/70">
                Not
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {spec.lines.map((l) => (
              <tr key={l.key} className="bg-black/20">
                <td className="px-4 py-3 text-white/85">{l.label}</td>
                <td className="px-4 py-3 text-right text-white/85">
                  {typeof l.orePerKwh === 'number' ? fmtOre(l.orePerKwh) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-white/85">
                  {typeof l.sekPerMonth === 'number'
                    ? fmtMoney(l.sekPerMonth)
                    : '—'}
                </td>
                <td className="hidden md:table-cell px-4 py-3 text-[12px] text-white/55">
                  {l.note ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-[11px] text-white/45">
        Diagnostics: versionSelection=
        <span className="text-white/70">
          {spec.diagnostics.sources.versionSelection}
        </span>{' '}
        • spotKey=
        <span className="text-white/70">
          {spec.diagnostics.sources.spotSettingsKey}
        </span>{' '}
        • portfolioKey=
        <span className="text-white/70">
          {spec.diagnostics.sources.portfolioKey}
        </span>
        {spec.diagnostics.spotBasis ? (
          <>
            {' '}
            • spotBasis={spec.diagnostics.spotBasis.year}-
            {String(spec.diagnostics.spotBasis.month).padStart(2, '0')}
          </>
        ) : null}
      </div>
    </div>
  )
}

export default async function AdminCalculatorPreviewPage({
  searchParams,
}: {
  searchParams?: {
    contract?: string
    compare?: string
    area?: string
    kwh?: string
    run?: string
  }
}) {
  const ctx = await requireAdminPageAccess({ anyOf: ['admin.access'] })
const db = ctx.supabase

// Enterprise compatibility layer
// behåller gamla ctx.user API så resten av filen fungerar

const user = {
  id: ctx.userId,
  email: ctx.email,
}

  const { data: contractsRaw, error: cErr } = await db
    .from('contract_products')
    .select('id,name,slug,contract_type,is_active')
    .order('name', { ascending: true })

  if (cErr) throw new Error(cErr.message)
  const contracts = (contractsRaw ?? []) as ContractProduct[]

  const area = (searchParams?.area && AREAS.includes(searchParams.area as PriceArea)
    ? (searchParams.area as PriceArea)
    : 'SE3') as PriceArea

  const kwh = clamp(toNumber(searchParams?.kwh, 2000), 1, 200000)

  const contractSlug = (searchParams?.contract ?? '').trim()
  const compareSlug = (searchParams?.compare ?? '').trim()

  const contract =
    contracts.find((c) => c.slug === contractSlug && c.is_active !== false) ??
    null
  const compare =
    contracts.find((c) => c.slug === compareSlug && c.is_active !== false) ??
    null

  let primarySpec: CustomerSpecResult | null = null
  let compareSpec: CustomerSpecResult | null = null
  let primaryError: string | null = null
  let compareError: string | null = null

  const shouldRun = (searchParams?.run ?? '') === '1' && !!contract

  if (shouldRun && contract) {
    try {
      primarySpec = await computeCustomerSpec({
        supabase: db,
        contract,
        priceArea: area,
        kwh,
      })
    } catch (e) {
      primaryError = e instanceof Error ? e.message : String(e)
    }

    if (compare && compare.slug !== contract.slug) {
      try {
        compareSpec = await computeCustomerSpec({
          supabase: db,
          contract: compare,
          priceArea: area,
          kwh,
        })
      } catch (e) {
        compareError = e instanceof Error ? e.message : String(e)
      }
    }

    // ✅ Audit: log the preview action (permission_audit)
    await logPermissionAudit({
      actorId: user.id,
      action: 'admin.preview.calculator',
      metadata: {
        area,
        kwh,
        contractSlug: contract.slug,
        compareSlug: compare?.slug ?? null,
        primaryOk: !!primarySpec,
        compareOk: !!compareSpec,
        primaryError,
        compareError,
      },
    }).catch(() => null)
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Kalkylator • Admin Preview</h1>
        <p className="mt-2 text-sm text-white/60">
          Steg B: Kopplad mot publicerad pricing-version, area-priser och
          spot/portfolio-inställningar. Validera exakt kundspec (prisrad) och
          månadskostnad — inklusive jämförelse sida-vid-sida.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <form method="GET" className="rounded-3xl border border-white/10 bg-black/30 p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <label className="text-[11px] text-white/60">Avtal</label>
                <select
                  name="contract"
                  defaultValue={contractSlug || ''}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm"
                >
                  <option value="">Välj avtal…</option>
                  {contracts.filter((c) => c.is_active !== false).map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name} ({c.contract_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-white/60">Jämför med</label>
                <select
                  name="compare"
                  defaultValue={compareSlug || ''}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm"
                >
                  <option value="">Ingen</option>
                  {contracts.filter((c) => c.is_active !== false).map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name} ({c.contract_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-white/60">Elområde</label>
                <select
                  name="area"
                  defaultValue={area}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm"
                >
                  {AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-white/60">
                  Förbrukning (kWh/mån)
                </label>
                <input
                  name="kwh"
                  defaultValue={String(kwh)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm"
                />
              </div>
            </div>

            <input type="hidden" name="run" value="1" />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black">
                Kör preview
              </button>

              <Link
                href="/admin/customer-spec"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                Öppna Kundspec-preview
              </Link>

              <div className="text-[11px] text-white/45">
                Tips: säkerställ publicerad version med valid_from ≤ idag.
              </div>
            </div>
          </form>

          <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
            <div className="text-[11px] text-white/60">Datakällor</div>
            <div className="mt-2 text-sm text-white/70 leading-6">
              • contract_pricing_versions (published)
              <br />
              • contract_area_pricing (area)
              <br />
              • gridex_spot_area_settings / gridex_portfolio_area_pricing
              <br />
              • gridex_monthly_spot_prices (spot-basis)
            </div>
          </div>
        </div>
      </div>

      {!shouldRun && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
          Välj avtal, elområde och kWh — klicka sedan{' '}
          <span className="text-white">Kör preview</span>.
        </div>
      )}

      {shouldRun && contract && primaryError && (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">
          <div className="font-semibold">
            Kunde inte räkna fram kundspec för {contract.name}
          </div>
          <div className="mt-2 text-sm opacity-90">{primaryError}</div>
          <div className="mt-3 text-[12px] opacity-80">
            Kontrollera: pricing-version publicerad, area-priser satta och
            spot/portfolio-inställningar per område.
          </div>
        </div>
      )}

      {primarySpec && <SpecTable spec={primarySpec} />}

      {compare && compareError && (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
          <div className="font-semibold">
            Jämförelse kunde inte räknas för {compare.name}
          </div>
          <div className="mt-2 text-sm opacity-90">{compareError}</div>
        </div>
      )}

      {primarySpec && compareSpec && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">Jämförelse</div>
              <div className="text-[12px] text-white/55">
                Sida-vid-sida på samma område och kWh
              </div>
            </div>
            <div className="text-[12px] text-white/55">
              {primarySpec.priceArea} • {primarySpec.kwh} kWh/mån
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/40">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">
                    Metric
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white/70">
                    {primarySpec.contract.name}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white/70">
                    {compareSpec.contract.name}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                <tr className="bg-black/20">
                  <td className="px-4 py-3 text-white/75">Totalt (öre/kWh)</td>
                  <td className="px-4 py-3 text-right text-white/90">
                    {fmtOre(primarySpec.totalOrePerKwh)}
                  </td>
                  <td className="px-4 py-3 text-right text-white/90">
                    {fmtOre(compareSpec.totalOrePerKwh)}
                  </td>
                </tr>
                <tr className="bg-black/20">
                  <td className="px-4 py-3 text-white/75">Total månadskostnad</td>
                  <td className="px-4 py-3 text-right text-white/90">
                    {fmtMoney(primarySpec.totalMonthlyCostSek)}
                  </td>
                  <td className="px-4 py-3 text-right text-white/90">
                    {fmtMoney(compareSpec.totalMonthlyCostSek)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-[11px] text-white/45">
            Ändra inputs och kör igen för ny jämförelse.
          </div>
        </div>
      )}
    </div>
  )
}