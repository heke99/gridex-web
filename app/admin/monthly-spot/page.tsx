import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePermissionServer } from '@/lib/auth/requirePermissionServer'
import { logPermissionAudit } from '@/lib/auth/audit'
import { requireAdminPageAccess } from '@/lib/admin/guards'

type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'
const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

type SpotRow = {
  price_area: string
  year: number
  month: number
  avg_spot_ore: number
  updated_at?: string | null
}

type SpotBasisCfgRow = {
  active_year: number
  active_month: number
}

type PublishLogRow = {
  id: string
  action: string
  active_year: number
  active_month: number
  reason: string | null
  created_at: string
  created_by: string | null
}

type SearchParams = {
  year?: string
  month?: string
}

function ymLabel(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function isValidYM(year: number, month: number) {
  return Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12
}

function prevYearMonth(now: Date): { year: number; month: number } {
  const month = now.getMonth() + 1
  if (month === 1) return { year: now.getFullYear() - 1, month: 12 }
  return { year: now.getFullYear(), month: month - 1 }
}

function shiftMonth(
  ym: { year: number; month: number },
  delta: number
) {
  const d = new Date(Date.UTC(ym.year, ym.month - 1, 1))
  d.setUTCMonth(d.getUTCMonth() + delta)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

function parseNumber(value: FormDataEntryValue | null): number {
  if (value == null) return Number.NaN
  const cleaned = String(value).trim().replace(/\s+/g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : Number.NaN
}

function buildYearList(
  nowYear: number,
  minDb?: number | null,
  maxDb?: number | null
) {
  const defaultMin = nowYear - 15
  const defaultMax = nowYear + 3

  const minYear = Number.isFinite(Number(minDb))
    ? Math.min(Number(minDb), defaultMin)
    : defaultMin

  const maxYear = Number.isFinite(Number(maxDb))
    ? Math.max(Number(maxDb), defaultMax)
    : defaultMax

  const years: number[] = []
  for (let year = maxYear; year >= minYear; year--) {
    years.push(year)
  }

  return years
}

export const dynamic = 'force-dynamic'

export default async function AdminMonthlySpotPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const ctx = await requireAdminPageAccess({
    anyOf: ['spot.read', 'spot.write', 'spot.publish', 'pricing.write', 'admin.access'],
  })

  const supabase = ctx.supabase
  const now = new Date()
  const fallback = prevYearMonth(now)

  const isAdmin =
    ctx.isAdmin ||
    ctx.roles.includes('admin') ||
    ctx.permissions.includes('admin.access')

  const canWrite =
    isAdmin ||
    ctx.permissions.includes('spot.write') ||
    ctx.permissions.includes('pricing.write')

  const canPublish =
    isAdmin ||
    ctx.permissions.includes('spot.publish')

  const { data: cfg, error: cfgError } = await supabase
    .from('gridex_spot_basis_config')
    .select('active_year,active_month')
    .eq('id', 1)
    .maybeSingle<SpotBasisCfgRow>()

  if (cfgError) {
    throw new Error(cfgError.message)
  }

  const activeYear = Number(cfg?.active_year)
  const activeMonth = Number(cfg?.active_month)
  const active = isValidYM(activeYear, activeMonth)
    ? { year: activeYear, month: activeMonth }
    : fallback

  const sp = searchParams ? await searchParams : undefined
  const qYear = sp?.year ? Number(sp.year) : Number.NaN
  const qMonth = sp?.month ? Number(sp.month) : Number.NaN

  const selected = isValidYM(qYear, qMonth)
    ? { year: qYear, month: qMonth }
    : active

  const selectedLabel = ymLabel(selected.year, selected.month)
  const activeLabel = ymLabel(active.year, active.month)
  const publicExpected = fallback
  const publicExpectedLabel = ymLabel(publicExpected.year, publicExpected.month)
  const isSelectedActive =
    selected.year === active.year && selected.month === active.month
  const activeMatchesPublicExpected =
    active.year === publicExpected.year && active.month === publicExpected.month

  const { data: rows, error: rowsError } = await supabase
    .from('gridex_monthly_spot_prices')
    .select('price_area,year,month,avg_spot_ore,updated_at')
    .eq('year', selected.year)
    .eq('month', selected.month)
    .order('price_area', { ascending: true })
    .returns<SpotRow[]>()

  if (rowsError) {
    throw new Error(rowsError.message)
  }

  const { data: publicExpectedRows, error: publicExpectedRowsError } = await supabase
    .from('gridex_monthly_spot_prices')
    .select('price_area,avg_spot_ore')
    .eq('year', publicExpected.year)
    .eq('month', publicExpected.month)
    .order('price_area', { ascending: true })

  if (publicExpectedRowsError) {
    throw new Error(publicExpectedRowsError.message)
  }

  const publicExpectedByArea = new Map<PriceArea, number>()
  ;(publicExpectedRows ?? []).forEach((row: { price_area: string; avg_spot_ore: number }) => {
    const area = row.price_area as PriceArea
    const value = Number(row.avg_spot_ore)
    if (AREAS.includes(area) && Number.isFinite(value) && value > 0) {
      publicExpectedByArea.set(area, value)
    }
  })
  const missingPublicExpectedAreas = AREAS.filter((area) => !publicExpectedByArea.has(area))
  const publicPricingReady = missingPublicExpectedAreas.length === 0

  const byArea = new Map<PriceArea, number>()
  const updatedAtByArea = new Map<PriceArea, string | null>()

  ;(rows ?? []).forEach((row) => {
    const area = row.price_area as PriceArea
    if (AREAS.includes(area)) {
      byArea.set(area, Number(row.avg_spot_ore))
      updatedAtByArea.set(area, row.updated_at ?? null)
    }
  })

  const completeness = AREAS.reduce(
    (acc, area) => acc + (byArea.has(area) ? 1 : 0),
    0
  )

  const prev = shiftMonth(selected, -1)

  const { data: prevRows, error: prevRowsError } = await supabase
    .from('gridex_monthly_spot_prices')
    .select('price_area,avg_spot_ore')
    .eq('year', prev.year)
    .eq('month', prev.month)
    .order('price_area', { ascending: true })

  if (prevRowsError) {
    throw new Error(prevRowsError.message)
  }

  const prevByArea = new Map<PriceArea, number>()
  ;(prevRows ?? []).forEach((row: { price_area: string; avg_spot_ore: number }) => {
    const area = row.price_area as PriceArea
    if (AREAS.includes(area)) {
      prevByArea.set(area, Number(row.avg_spot_ore))
    }
  })

  const { data: minAgg, error: minAggError } = await supabase
    .from('gridex_monthly_spot_prices')
    .select('year')
    .order('year', { ascending: true })
    .limit(1)

  if (minAggError) {
    throw new Error(minAggError.message)
  }

  const { data: maxAgg, error: maxAggError } = await supabase
    .from('gridex_monthly_spot_prices')
    .select('year')
    .order('year', { ascending: false })
    .limit(1)

  if (maxAggError) {
    throw new Error(maxAggError.message)
  }

  const years = buildYearList(
    now.getFullYear(),
    (minAgg && minAgg[0]?.year) ?? null,
    (maxAgg && maxAgg[0]?.year) ?? null
  )

  const { data: publishLog, error: publishLogError } = await supabase
    .from('gridex_spot_basis_publish_log')
    .select('id,action,active_year,active_month,reason,created_at,created_by')
    .order('created_at', { ascending: false })
    .limit(10)
    .returns<PublishLogRow[]>()

  if (publishLogError) {
    throw new Error(publishLogError.message)
  }

  async function navigateAction(formData: FormData) {
    'use server'

    const year = Number(formData.get('year'))
    const month = Number(formData.get('month'))

    if (!isValidYM(year, month)) {
      throw new Error('Ogiltigt year/month')
    }

    redirect(`/admin/monthly-spot?year=${year}&month=${month}`)
  }

  async function navQuickAction(formData: FormData) {
    'use server'

    const year = Number(formData.get('year'))
    const month = Number(formData.get('month'))
    const delta = Number(formData.get('delta'))

    if (!isValidYM(year, month) || !Number.isFinite(delta)) {
      throw new Error('Ogiltig navigering')
    }

    const next = shiftMonth({ year, month }, delta)
    redirect(`/admin/monthly-spot?year=${next.year}&month=${next.month}`)
  }

  async function savePricesAction(formData: FormData) {
    'use server'

    const { supabase: serverSupabase, user } = await requirePermissionServer(
      'spot.write'
    ).catch(async () => {
      return await requirePermissionServer('pricing.write')
    })

    const year = Number(formData.get('year'))
    const month = Number(formData.get('month'))

    if (!isValidYM(year, month)) {
      throw new Error('Ogiltigt year/month')
    }

    const payload: Array<{
      price_area: PriceArea
      year: number
      month: number
      avg_spot_ore: number
    }> = []

    for (const area of AREAS) {
      const value = parseNumber(formData.get(`${area}_avg_spot_ore`))
      if (!Number.isFinite(value)) {
        throw new Error(`Ogiltigt värde för ${area}`)
      }

      payload.push({
        price_area: area,
        year,
        month,
        avg_spot_ore: value,
      })
    }

    const { error } = await serverSupabase
      .from('gridex_monthly_spot_prices')
      .upsert(payload, {
        onConflict: 'price_area,year,month',
      })

    if (error) {
      throw new Error(error.message)
    }

    await logPermissionAudit({
      actorId: user.id,
      action: 'spot.monthly_prices.upsert',
      metadata: {
        year,
        month,
        values: payload.map((row) => ({
          area: row.price_area,
          avg_spot_ore: row.avg_spot_ore,
        })),
      },
    }).catch(() => null)

    revalidatePath('/admin')
    revalidatePath('/admin/monthly-spot')
    revalidatePath('/admin/pricing')
    revalidatePath('/admin/calculator')
    revalidatePath('/admin/customer-spec')
    revalidatePath('/avtal')
  revalidatePath('/elavtal')
    revalidatePath('/teckna')
  revalidatePath('/teckna-avtal')
    revalidatePath('/elpris')
    revalidatePath('/api/web/market-price/current')

    redirect(`/admin/monthly-spot?year=${year}&month=${month}`)
  }

  async function publishActiveAction(formData: FormData) {
    'use server'

    const { supabase: serverSupabase, user } = await requirePermissionServer(
      'spot.publish'
    ).catch(async () => {
      return await requirePermissionServer('admin.access')
    })

    const year = Number(formData.get('year'))
    const month = Number(formData.get('month'))
    const reason = String(formData.get('reason') ?? '').trim() || null

    if (!isValidYM(year, month)) {
      throw new Error('Ogiltigt year/month')
    }

    const { error } = await serverSupabase.rpc('gridex_spot_publish_active_basis', {
      p_year: year,
      p_month: month,
      p_reason: reason,
    })

    if (error) {
      throw new Error(error.message)
    }

    await logPermissionAudit({
      actorId: user.id,
      action: 'spot.basis.publish_active',
      metadata: { year, month, reason },
    }).catch(() => null)

    revalidatePath('/admin')
    revalidatePath('/admin/monthly-spot')
    revalidatePath('/admin/pricing')
    revalidatePath('/admin/calculator')
    revalidatePath('/admin/customer-spec')
    revalidatePath('/avtal')
  revalidatePath('/elavtal')
    revalidatePath('/teckna')
  revalidatePath('/teckna-avtal')
    revalidatePath('/elpris')
    revalidatePath('/api/web/market-price/current')

    redirect(`/admin/monthly-spot?year=${year}&month=${month}`)
  }

  async function rollbackAction(formData: FormData) {
    'use server'

    const { supabase: serverSupabase, user } = await requirePermissionServer(
      'spot.publish'
    ).catch(async () => {
      return await requirePermissionServer('admin.access')
    })

    const reason = String(formData.get('reason') ?? '').trim() || null

    const { error } = await serverSupabase.rpc('gridex_spot_rollback_last_publish', {
      p_reason: reason,
    })

    if (error) {
      throw new Error(error.message)
    }

    await logPermissionAudit({
      actorId: user.id,
      action: 'spot.basis.rollback',
      metadata: { reason },
    }).catch(() => null)

    revalidatePath('/admin')
    revalidatePath('/admin/monthly-spot')
    revalidatePath('/admin/pricing')
    revalidatePath('/admin/calculator')
    revalidatePath('/admin/customer-spec')
    revalidatePath('/avtal')
  revalidatePath('/elavtal')
    revalidatePath('/teckna')
  revalidatePath('/teckna-avtal')
    revalidatePath('/elpris')
    revalidatePath('/api/web/market-price/current')

    redirect('/admin/monthly-spot')
  }

  const defaultKwh = 2000
  const defaultCustomersPerArea = 250

  const diffFor = (area: PriceArea) => {
    const current = byArea.get(area)
    const previous = prevByArea.get(area)
    if (current == null || previous == null) return null
    return current - previous
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Spot-basis (månadsgenomsnitt)</h1>
          <p className="max-w-3xl text-gray-400">
            Detta är kärndata för spot/tim-avtal. Publik kalkylator använder alltid föregående kalendermånad i Europe/Stockholm. Aktiv period används för
            admin/publish/snapshot och historik, men styr inte publik prisberäkning.
          </p>
          <div className="text-sm text-gray-400">
            Aktiv period:{' '}
            <span className="font-semibold text-gray-200">{activeLabel}</span>
            <span className="mx-2 text-gray-600">•</span>
            Förväntad publik period:{' '}
            <span className="font-semibold text-gray-200">{publicExpectedLabel}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/pricing"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:border-cyan-500/40"
          >
            Till prissättning
          </Link>
          <Link
            href="/admin/calculator"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:border-cyan-500/40"
          >
            Testkalkylator
          </Link>
        </div>
      </div>

      <div
        className={`rounded-2xl border p-5 ${
          publicPricingReady
            ? 'border-emerald-500/20 bg-emerald-500/10'
            : 'border-amber-500/30 bg-amber-500/10'
        }`}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-lg font-semibold text-gray-100">Publik kalkylator-readiness</div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-300">
              Publik teckningskalkylator ska använda {publicExpectedLabel}. Om SE1–SE4 saknas
              för den perioden ska webben visa ett tydligt fel och aldrig falla tillbaka till
              en äldre månad som {activeLabel}.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-200">
            {publicPricingReady ? 'Klar för publik prisberäkning' : 'Saknar publik prisgrund'}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-gray-500">Förväntad publik period</div>
            <div className="mt-1 text-xl font-semibold text-white">{publicExpectedLabel}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-gray-500">SE1–SE4 status</div>
            <div className="mt-1 text-xl font-semibold text-white">
              {AREAS.length - missingPublicExpectedAreas.length}/{AREAS.length} kompletta
            </div>
            {!publicPricingReady ? (
              <div className="mt-1 text-xs text-amber-100">Saknas: {missingPublicExpectedAreas.join(', ')}</div>
            ) : null}
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-gray-500">Aktiv admin-period</div>
            <div className="mt-1 text-xl font-semibold text-white">{activeLabel}</div>
            {!activeMatchesPublicExpected ? (
              <div className="mt-1 text-xs text-amber-100">Mismatch är okej i admin, men används inte publikt.</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-2xl border border-gray-800 bg-gray-950 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="text-sm text-gray-400">Vald period</div>
            <div className="flex items-center gap-2">
              <div className="text-xl font-semibold text-gray-100">
                {selectedLabel}
              </div>

              {isSelectedActive ? (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                  AKTIV
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-300">
                  ej aktiv
                </span>
              )}

              <span
                className={`rounded-full border px-2 py-1 text-[11px] ${
                  completeness === 4
                    ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                }`}
                title="Hur många områden som har ifylld spot-basis i vald period"
              >
                {completeness}/4 områden ifyllda
              </span>
            </div>

            <div className="text-xs text-gray-500">
              Ange värden i öre/kWh. Du kan skriva 92,5 eller 92.5.
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form action={navQuickAction} className="flex items-center gap-2">
              <input type="hidden" name="year" value={selected.year} />
              <input type="hidden" name="month" value={selected.month} />
              <input type="hidden" name="delta" value={-1} />
              <button className="h-10 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm text-gray-200 hover:border-cyan-500/40">
                ← Föregående
              </button>
            </form>

            <form action={navigateAction} className="flex items-center gap-2">
              <select
                name="year"
                className="h-10 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm text-gray-200"
                defaultValue={String(selected.year)}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <select
                name="month"
                className="h-10 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm text-gray-200"
                defaultValue={String(selected.month)}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={month}>
                    {String(month).padStart(2, '0')}
                  </option>
                ))}
              </select>

              <button className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-black hover:bg-white/90">
                Öppna
              </button>
            </form>

            <form action={navQuickAction} className="flex items-center gap-2">
              <input type="hidden" name="year" value={selected.year} />
              <input type="hidden" name="month" value={selected.month} />
              <input type="hidden" name="delta" value={1} />
              <button className="h-10 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm text-gray-200 hover:border-cyan-500/40">
                Nästa →
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {AREAS.map((area) => {
            const updatedAt = updatedAtByArea.get(area)
            const diff = diffFor(area)

            return (
              <div
                key={area}
                className="space-y-2 rounded-lg border border-gray-800 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{area}</div>
                  <div className="text-[11px] text-gray-500">
                    {updatedAt
                      ? new Date(updatedAt).toLocaleString('sv-SE')
                      : 'Ej sparad ännu'}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">
                    Avg spot (öre/kWh)
                  </label>
                  <input
                    name={`${area}_avg_spot_ore`}
                    form="prices-form"
                    defaultValue={byArea.get(area) ?? ''}
                    className="mt-1 w-full rounded-lg border border-gray-800 bg-black p-2 text-gray-100"
                    placeholder="t.ex 92.5"
                    required
                    inputMode="decimal"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="text-gray-500">
                    Diff vs {ymLabel(prev.year, prev.month)}:
                  </div>
                  <div
                    className={
                      diff == null
                        ? 'text-gray-500'
                        : diff >= 0
                        ? 'text-emerald-200'
                        : 'text-amber-200'
                    }
                  >
                    {diff == null ? '—' : `${diff >= 0 ? '+' : ''}${diff.toFixed(3)} öre`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <form id="prices-form" action={savePricesAction} className="flex items-center gap-2">
              <input type="hidden" name="year" value={selected.year} />
              <input type="hidden" name="month" value={selected.month} />
              <button
                className="rounded-xl bg-cyan-500 px-4 py-2 font-bold text-black hover:opacity-95 disabled:opacity-60"
                disabled={!canWrite}
                title={!canWrite ? 'Saknar spot.write / pricing.write' : 'Spara månadspriser'}
              >
                Spara månadspriser
              </button>
            </form>

            <div className="text-xs text-gray-500">
              Spara = write. Publish aktiv = adminhistorik + snapshot + rollback.
            </div>
          </div>

          <div className="w-full space-y-2 md:w-[520px]">
            <form action={publishActiveAction} className="space-y-2">
              <input type="hidden" name="year" value={selected.year} />
              <input type="hidden" name="month" value={selected.month} />
              <label className="text-sm text-gray-400">Publish reason (audit)</label>
              <input
                name="reason"
                className="w-full rounded-lg border border-gray-800 bg-black/40 p-2 text-gray-100"
                placeholder="t.ex: Nord Pool final snitt, verifierad av ekonomi"
              />
              <button
                className="w-full rounded-xl border border-gray-800 bg-black/40 px-4 py-2 text-gray-200 hover:border-cyan-500/40 disabled:opacity-60"
                disabled={!canPublish}
                title={!canPublish ? 'Saknar spot.publish' : 'Sätt vald period som aktiv'}
              >
                Publish: sätt {selectedLabel} som aktiv admin-period
              </button>
              <div className="text-xs text-gray-500">
                Publish validerar att alla 4 områden finns, skapar snapshot och uppdaterar aktiv admin-period. Publik kalkylator använder ändå föregående kalendermånad.
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-gray-900 bg-black/30 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-gray-100">
                Impact estimator
              </div>
              <div className="text-sm text-gray-400">
                Visar påverkan i SEK om spot-basis ändras jämfört med {ymLabel(prev.year, prev.month)}.
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Antagande: diff (öre/kWh) × kWh / 100 = SEK
            </div>
          </div>

          <form className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-gray-900 p-3">
              <div className="text-sm text-gray-400">kWh per kund / månad</div>
              <input
                className="mt-1 w-full rounded-lg border border-gray-800 bg-black/40 p-2 text-gray-100"
                defaultValue={String(defaultKwh)}
                name="kwh"
                disabled
              />
              <div className="mt-1 text-xs text-gray-500">
                Bas = 2000 kWh.
              </div>
            </div>

            {AREAS.map((area) => (
              <div key={area} className="rounded-lg border border-gray-900 p-3">
                <div className="text-sm text-gray-400">Kunder i {area}</div>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-800 bg-black/40 p-2 text-gray-100"
                  defaultValue={String(defaultCustomersPerArea)}
                  name={`customers_${area}`}
                  disabled
                />
                <div className="mt-1 text-xs text-gray-500">
                  Bas = 250/område.
                </div>
              </div>
            ))}
          </form>

          <div className="grid gap-2 md:grid-cols-2">
            {AREAS.map((area) => {
              const diff = diffFor(area)
              const sekPerCustomer = diff == null ? null : (diff * defaultKwh) / 100
              const sekTotal =
                sekPerCustomer == null
                  ? null
                  : sekPerCustomer * defaultCustomersPerArea

              return (
                <div
                  key={area}
                  className="flex items-center justify-between rounded-lg border border-gray-900 p-3"
                >
                  <div>
                    <div className="font-semibold text-gray-100">{area}</div>
                    <div className="text-xs text-gray-500">
                      Diff: {diff == null ? '—' : `${diff >= 0 ? '+' : ''}${diff.toFixed(3)} öre/kWh`}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-gray-200">
                      {sekTotal == null
                        ? '—'
                        : `${sekTotal >= 0 ? '+' : ''}${Math.round(sekTotal).toLocaleString('sv-SE')} kr/mån`}
                    </div>
                    <div className="text-xs text-gray-500">
                      ({defaultCustomersPerArea} kunder × {defaultKwh} kWh)
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="text-xs text-gray-500">
            Nästa steg: göra inputs justerbara, spara scenarios och visa total över alla områden.
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-gray-900 bg-black/30 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-lg font-semibold text-gray-100">
                Rollback & Publish log
              </div>
              <div className="text-sm text-gray-400">
                Snapshot tas vid publish. Rollback sätter aktiv admin-period till föregående logg-entry. Publik kalkylator påverkas inte av rollback.
              </div>
            </div>

            <form action={rollbackAction} className="w-full space-y-2 md:w-[420px]">
              <label className="text-sm text-gray-400">Rollback reason (audit)</label>
              <input
                name="reason"
                className="w-full rounded-lg border border-gray-800 bg-black/40 p-2 text-gray-100"
                placeholder="t.ex: felimport, korrigerar"
              />
              <button
                className="w-full rounded-xl border border-gray-800 bg-black/40 px-4 py-2 text-gray-200 hover:border-amber-500/40 disabled:opacity-60"
                disabled={!canPublish}
                title={!canPublish ? 'Saknar spot.publish' : 'Rollback till föregående publish-entry'}
              >
                Rollback (till föregående)
              </button>
            </form>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-900">
            <div className="grid grid-cols-12 gap-2 bg-black/30 px-4 py-2 text-xs text-gray-500">
              <div className="col-span-2">Tid</div>
              <div className="col-span-2">Action</div>
              <div className="col-span-2">Period</div>
              <div className="col-span-6">Reason</div>
            </div>

            {(publishLog ?? []).length === 0 ? (
              <div className="p-4 text-sm text-gray-500">
                Ingen publish-logg ännu.
              </div>
            ) : (
              (publishLog ?? []).map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-12 gap-2 border-t border-gray-900 px-4 py-3 text-sm"
                >
                  <div className="col-span-2 text-gray-400">
                    {new Date(row.created_at).toLocaleString('sv-SE')}
                  </div>

                  <div className="col-span-2">
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] ${
                        row.action === 'publish'
                          ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                      }`}
                    >
                      {row.action.toUpperCase()}
                    </span>
                  </div>

                  <div className="col-span-2 font-semibold text-gray-200">
                    {ymLabel(row.active_year, row.active_month)}
                  </div>

                  <div className="col-span-6 text-gray-300">
                    {row.reason ?? <span className="text-gray-600">—</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-gray-900 pt-2 text-sm text-gray-400">
          <div className="mb-1 font-semibold text-gray-200">Enterprise-flöde</div>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="text-gray-200">spot.write</span>: får spara månadspriser.
            </li>
            <li>
              <span className="text-gray-200">spot.publish</span>: får publish aktiv admin-period och skapa snapshot.
            </li>
            <li>
              Publik kalkylator läser alltid föregående kalendermånad.{' '}
              <span className="text-gray-200">gridex_spot_basis_config</span> används bara för admin/publish-historik.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
