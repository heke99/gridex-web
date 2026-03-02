// app/admin/monthly-spot/page.tsx

import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requirePermissionServer } from '@/lib/auth/requirePermissionServer'
import { logPermissionAudit } from '@/lib/auth/audit'

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

function ymLabel(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}`
}

function isValidYM(y: number, m: number) {
  return Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12
}

function prevYearMonth(now: Date): { year: number; month: number } {
  const m = now.getMonth() + 1
  if (m === 1) return { year: now.getFullYear() - 1, month: 12 }
  return { year: now.getFullYear(), month: m - 1 }
}

function shiftMonth(ym: { year: number; month: number }, delta: number) {
  const d = new Date(Date.UTC(ym.year, ym.month - 1, 1))
  d.setUTCMonth(d.getUTCMonth() + delta)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

function parseNumber(v: FormDataEntryValue | null): number {
  if (v == null) return NaN
  const cleaned = String(v).trim().replace(/\s+/g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

function buildYearList(nowYear: number, minDb?: number | null, maxDb?: number | null) {
  const defaultMin = nowYear - 15
  const defaultMax = nowYear + 3
  const minYear = Number.isFinite(Number(minDb)) ? Math.min(Number(minDb), defaultMin) : defaultMin
  const maxYear = Number.isFinite(Number(maxDb)) ? Math.max(Number(maxDb), defaultMax) : defaultMax
  const years: number[] = []
  for (let y = maxYear; y >= minYear; y--) years.push(y)
  return years
}

export const dynamic = 'force-dynamic'

export default async function AdminMonthlySpotPage({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string; month?: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const now = new Date()
  const fallback = prevYearMonth(now)

  // Who is viewing? (May be anon if someone misroutes; handle gracefully)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthed = Boolean(user?.id)

  // Permission flags (UI gating)
  let canWrite = false
  let canPublish = false
  if (isAuthed) {
    const r1 = await supabase.rpc('gridex_has_permission', { p_user_id: user!.id, p_permission: 'spot.write' })
    const r2 = await supabase.rpc('gridex_has_permission', { p_user_id: user!.id, p_permission: 'pricing.write' })
    const r3 = await supabase.rpc('gridex_has_permission', { p_user_id: user!.id, p_permission: 'spot.publish' })
    const r4 = await supabase.rpc('gridex_has_permission', { p_user_id: user!.id, p_permission: 'admin.access' })
    canWrite = r1.data === true || r2.data === true || r4.data === true
    canPublish = r3.data === true || r4.data === true
  }

  // Active basis
  const { data: cfg } = await supabase
    .from('gridex_spot_basis_config')
    .select('active_year,active_month')
    .eq('id', 1)
    .maybeSingle<SpotBasisCfgRow>()

  const activeYear = Number(cfg?.active_year)
  const activeMonth = Number(cfg?.active_month)
  const active = isValidYM(activeYear, activeMonth) ? { year: activeYear, month: activeMonth } : fallback

  // Selected
  const sp = searchParams ? await searchParams : undefined
  const qYear = sp?.year ? Number(sp.year) : NaN
  const qMonth = sp?.month ? Number(sp.month) : NaN
  const selected = isValidYM(qYear, qMonth) ? { year: qYear, month: qMonth } : active

  const selectedLabel = ymLabel(selected.year, selected.month)
  const activeLabel = ymLabel(active.year, active.month)
  const isSelectedActive = selected.year === active.year && selected.month === active.month

  // Read selected rows
  const { data: rows } = await supabase
    .from('gridex_monthly_spot_prices')
    .select('price_area,year,month,avg_spot_ore,updated_at')
    .eq('year', selected.year)
    .eq('month', selected.month)
    .order('price_area', { ascending: true })

  const byArea = new Map<PriceArea, number>()
  const updatedAtByArea = new Map<PriceArea, string | null>()
  ;(rows ?? []).forEach((r: SpotRow) => {
    const a = r.price_area as PriceArea
    if (AREAS.includes(a)) {
      byArea.set(a, Number(r.avg_spot_ore))
      updatedAtByArea.set(a, r.updated_at ?? null)
    }
  })

  const completeness = AREAS.reduce((acc, a) => acc + (byArea.has(a) ? 1 : 0), 0)

  // Diff vs previous month (for same selected month)
  const prev = shiftMonth(selected, -1)
  const { data: prevRows } = await supabase
    .from('gridex_monthly_spot_prices')
    .select('price_area,avg_spot_ore')
    .eq('year', prev.year)
    .eq('month', prev.month)
    .order('price_area', { ascending: true })

  const prevByArea = new Map<PriceArea, number>()
  ;(prevRows ?? []).forEach((r: { price_area: string; avg_spot_ore: number }) => {
    const a = r.price_area as PriceArea
    if (AREAS.includes(a)) prevByArea.set(a, Number(r.avg_spot_ore))
  })

  // Year list from DB extents (long-term)
  const { data: minAgg } = await supabase.from('gridex_monthly_spot_prices').select('year').order('year', { ascending: true }).limit(1)
  const { data: maxAgg } = await supabase.from('gridex_monthly_spot_prices').select('year').order('year', { ascending: false }).limit(1)
  const years = buildYearList(
    now.getFullYear(),
    (minAgg && minAgg[0]?.year) ?? null,
    (maxAgg && maxAgg[0]?.year) ?? null
  )

  // Publish log (latest 10)
  const { data: publishLog } = await supabase
    .from('gridex_spot_basis_publish_log')
    .select('id,action,active_year,active_month,reason,created_at,created_by')
    .order('created_at', { ascending: false })
    .limit(10)
    .returns<PublishLogRow[]>()

  // ---------- Actions ----------

  async function navigateAction(formData: FormData) {
    'use server'
    const y = Number(formData.get('year'))
    const m = Number(formData.get('month'))
    if (!isValidYM(y, m)) throw new Error('Ogiltigt year/month')
    redirect(`/admin/monthly-spot?year=${y}&month=${m}`)
  }

  async function navQuickAction(formData: FormData) {
    'use server'
    const y = Number(formData.get('year'))
    const m = Number(formData.get('month'))
    const delta = Number(formData.get('delta'))
    if (!isValidYM(y, m) || !Number.isFinite(delta)) throw new Error('Ogiltig navigering')
    const next = shiftMonth({ year: y, month: m }, delta)
    redirect(`/admin/monthly-spot?year=${next.year}&month=${next.month}`)
  }

  async function savePricesAction(formData: FormData) {
    'use server'
    // Write permission: spot.write OR pricing.write
    const { supabase: s, user: u } = await requirePermissionServer('spot.write').catch(async () => {
      return await requirePermissionServer('pricing.write')
    })

    const y = Number(formData.get('year'))
    const m = Number(formData.get('month'))
    if (!isValidYM(y, m)) throw new Error('Ogiltigt year/month')

    const payload: Array<{ price_area: PriceArea; year: number; month: number; avg_spot_ore: number }> = []
    for (const a of AREAS) {
      const v = parseNumber(formData.get(`${a}_avg_spot_ore`))
      if (!Number.isFinite(v)) throw new Error(`Ogiltigt värde för ${a}`)
      payload.push({ price_area: a, year: y, month: m, avg_spot_ore: v })
    }

    const { error } = await s.from('gridex_monthly_spot_prices').upsert(payload, { onConflict: 'price_area,year,month' })
    if (error) throw new Error(error.message)

    await logPermissionAudit({
      actorId: u.id,
      action: 'spot.monthly_prices.upsert',
      metadata: {
        year: y,
        month: m,
        values: payload.map((p) => ({ area: p.price_area, avg_spot_ore: p.avg_spot_ore })),
      },
    })

    revalidatePath('/admin/monthly-spot')
    revalidatePath(`/admin/monthly-spot?year=${y}&month=${m}`)
    revalidatePath('/admin/pricing')
    revalidatePath('/admin/calculator')
    revalidatePath('/avtal')
    revalidatePath('/teckna')
    revalidatePath('/elpris')
    revalidatePath('/api/price')
  }

  async function publishActiveAction(formData: FormData) {
    'use server'
    // Publish permission: spot.publish (admin.access is already bridged by your requirePermissionServer legacy/admin)
    const { supabase: s, user: u } = await requirePermissionServer('spot.publish').catch(async () => {
      return await requirePermissionServer('admin.access')
    })

    const y = Number(formData.get('year'))
    const m = Number(formData.get('month'))
    const reason = String(formData.get('reason') ?? '').trim() || null
    if (!isValidYM(y, m)) throw new Error('Ogiltigt year/month')

    const { error } = await s.rpc('gridex_spot_publish_active_basis', {
      p_year: y,
      p_month: m,
      p_reason: reason,
    })
    if (error) throw new Error(error.message)

    await logPermissionAudit({
      actorId: u.id,
      action: 'spot.basis.publish_active',
      metadata: { year: y, month: m, reason },
    })

    revalidatePath('/admin/monthly-spot')
    revalidatePath(`/admin/monthly-spot?year=${y}&month=${m}`)
    revalidatePath('/admin/pricing')
    revalidatePath('/admin/calculator')
    revalidatePath('/avtal')
    revalidatePath('/teckna')
    revalidatePath('/elpris')
    revalidatePath('/api/price')
  }

  async function rollbackAction(formData: FormData) {
    'use server'
    const { supabase: s, user: u } = await requirePermissionServer('spot.publish').catch(async () => {
      return await requirePermissionServer('admin.access')
    })

    const reason = String(formData.get('reason') ?? '').trim() || null

    const { error } = await s.rpc('gridex_spot_rollback_last_publish', { p_reason: reason })
    if (error) throw new Error(error.message)

    await logPermissionAudit({
      actorId: u.id,
      action: 'spot.basis.rollback',
      metadata: { reason },
    })

    revalidatePath('/admin/monthly-spot')
    revalidatePath('/admin/pricing')
    revalidatePath('/admin/calculator')
    revalidatePath('/avtal')
    revalidatePath('/teckna')
    revalidatePath('/elpris')
    revalidatePath('/api/price')
  }

  // ---------- Calculations for UI (diff + impact) ----------
  const defaultKwh = 2000
  const defaultCustomersPerArea = 250 // 1000 total baseline

  // Render helpers
  const diffFor = (a: PriceArea) => {
    const cur = byArea.get(a)
    const prevV = prevByArea.get(a)
    if (cur == null || prevV == null) return null
    return cur - prevV
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Spot-basis (månadsgenomsnitt)</h1>
          <p className="text-gray-400 max-w-3xl">
            Detta är <span className="text-gray-200 font-semibold">kärn-data</span> för spot/tim-avtal:
            preview + publika beräkningar använder <span className="text-gray-200 font-semibold">Aktiv period</span>.
            Enterprise-flöde: <span className="text-gray-200 font-semibold">Spara</span> (write) →{' '}
            <span className="text-gray-200 font-semibold">Publish aktiv</span> (publish) → snapshot → rollback möjligt.
          </p>
          <div className="text-sm text-gray-400">
            Aktiv period: <span className="text-gray-200 font-semibold">{activeLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

      <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6 space-y-6">
        {/* Selected header + badges */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="text-sm text-gray-400">Vald period</div>
            <div className="flex items-center gap-2">
              <div className="text-xl font-semibold text-gray-100">{selectedLabel}</div>

              {isSelectedActive ? (
                <span className="text-[11px] rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                  AKTIV
                </span>
              ) : (
                <span className="text-[11px] rounded-full border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
                  ej aktiv
                </span>
              )}

              <span
                className={`text-[11px] rounded-full border px-2 py-1 ${
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
              Ange värden i öre/kWh. Du kan skriva <span className="text-gray-300">92,5</span> eller{' '}
              <span className="text-gray-300">92.5</span>.
            </div>
          </div>

          {/* Navigation */}
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
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <select
                name="month"
                className="h-10 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm text-gray-200"
                defaultValue={String(selected.month)}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}
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

        {/* Input grid + diff */}
        <div className="grid gap-3 sm:grid-cols-2">
          {AREAS.map((a) => {
            const updatedAt = updatedAtByArea.get(a)
            const d = diffFor(a)
            return (
              <div key={a} className="border border-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{a}</div>
                  <div className="text-[11px] text-gray-500">
                    {updatedAt ? new Date(updatedAt).toLocaleString('sv-SE') : 'Ej sparad ännu'}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Avg spot (öre/kWh)</label>
                  <input
                    name={`${a}_avg_spot_ore`}
                    form="prices-form"
                    defaultValue={byArea.get(a) ?? ''}
                    className="mt-1 w-full p-2 bg-black border border-gray-800 rounded-lg text-gray-100"
                    placeholder="t.ex 92.5"
                    required
                    inputMode="decimal"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="text-gray-500">
                    Diff vs {ymLabel(prev.year, prev.month)}:
                  </div>
                  <div className={`${d == null ? 'text-gray-500' : d >= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>
                    {d == null ? '—' : `${d >= 0 ? '+' : ''}${d.toFixed(3)} öre`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Save + Publish */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <form id="prices-form" action={savePricesAction} className="flex items-center gap-2">
              <input type="hidden" name="year" value={selected.year} />
              <input type="hidden" name="month" value={selected.month} />
              <button
                className="rounded-xl bg-cyan-500 text-black font-bold px-4 py-2 hover:opacity-95 disabled:opacity-60"
                disabled={!canWrite}
                title={!canWrite ? 'Saknar spot.write / pricing.write' : 'Spara månadspriser'}
              >
                Spara månadspriser
              </button>
            </form>

            <div className="text-xs text-gray-500">
              Spara = write. Publish aktiv = publish + snapshot + rollback.
            </div>
          </div>

          <div className="space-y-2 w-full md:w-[520px]">
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
                title={!canPublish ? 'Saknar spot.publish' : 'Sätt vald period som AKTIV (enterprise publish)'}
              >
                Publish: sätt {selectedLabel} som aktiv
              </button>
              <div className="text-xs text-gray-500">
                Publish validerar att alla 4 områden finns, skapar snapshot i publish_log och uppdaterar aktiv period.
              </div>
            </form>
          </div>
        </div>

        {/* Impact estimator */}
        <div className="rounded-2xl border border-gray-900 bg-black/30 p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-gray-100">Impact estimator (fintech)</div>
              <div className="text-sm text-gray-400">
                Visar påverkan i SEK om spot-basis ändras jämfört med {ymLabel(prev.year, prev.month)}.
                Byggt för beslut: “vad betyder detta för 1000 kunder?”
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Antagande: diff (öre/kWh) × kWh / 100 = SEK
            </div>
          </div>

          <form className="grid gap-3 md:grid-cols-3">
            <div className="border border-gray-900 rounded-lg p-3">
              <div className="text-sm text-gray-400">kWh per kund / månad</div>
              <input
                className="mt-1 w-full rounded-lg border border-gray-800 bg-black/40 p-2 text-gray-100"
                defaultValue={String(defaultKwh)}
                name="kwh"
                disabled
              />
              <div className="text-xs text-gray-500 mt-1">
                (UI-steg: gör detta justerbart senare. Bas = 2000 kWh.)
              </div>
            </div>

            {AREAS.map((a) => (
              <div key={a} className="border border-gray-900 rounded-lg p-3">
                <div className="text-sm text-gray-400">Kunder i {a}</div>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-800 bg-black/40 p-2 text-gray-100"
                  defaultValue={String(defaultCustomersPerArea)}
                  name={`customers_${a}`}
                  disabled
                />
                <div className="text-xs text-gray-500 mt-1">
                  (UI-steg: gör detta justerbart senare. Bas = 250/område.)
                </div>
              </div>
            ))}
          </form>

          <div className="grid gap-2 md:grid-cols-2">
            {AREAS.map((a) => {
              const d = diffFor(a)
              const kwh = defaultKwh
              const customers = defaultCustomersPerArea
              const sekPerCustomer = d == null ? null : (d * kwh) / 100
              const sekTotal = sekPerCustomer == null ? null : sekPerCustomer * customers
              return (
                <div key={a} className="border border-gray-900 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-100">{a}</div>
                    <div className="text-xs text-gray-500">
                      Diff: {d == null ? '—' : `${d >= 0 ? '+' : ''}${d.toFixed(3)} öre/kWh`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-200">
                      {sekTotal == null ? '—' : `${sekTotal >= 0 ? '+' : ''}${Math.round(sekTotal).toLocaleString('sv-SE')} kr/mån`}
                    </div>
                    <div className="text-xs text-gray-500">
                      ({customers} kunder × {kwh} kWh)
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="text-xs text-gray-500">
            Enterprise nästa steg: göra inputs justerbara + spara “scenario presets” + visa total across areas med valfri distribution.
          </div>
        </div>

        {/* Rollback + publish log */}
        <div className="rounded-2xl border border-gray-900 bg-black/30 p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-gray-100">Rollback & Publish log</div>
              <div className="text-sm text-gray-400">
                Snapshot tas vid publish. Rollback sätter aktiv period till föregående logg-entry.
              </div>
            </div>

            <form action={rollbackAction} className="w-full md:w-[420px] space-y-2">
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

          <div className="border border-gray-900 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-gray-500 bg-black/30">
              <div className="col-span-2">Tid</div>
              <div className="col-span-2">Action</div>
              <div className="col-span-2">Period</div>
              <div className="col-span-6">Reason</div>
            </div>

            {(publishLog ?? []).length === 0 ? (
              <div className="p-4 text-sm text-gray-500">Ingen publish-logg ännu.</div>
            ) : (
              (publishLog ?? []).map((r) => (
                <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-t border-gray-900">
                  <div className="col-span-2 text-gray-400">{new Date(r.created_at).toLocaleString('sv-SE')}</div>
                  <div className="col-span-2">
                    <span
                      className={`text-[11px] rounded-full border px-2 py-1 ${
                        r.action === 'publish'
                          ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                      }`}
                    >
                      {r.action.toUpperCase()}
                    </span>
                  </div>
                  <div className="col-span-2 text-gray-200 font-semibold">
                    {ymLabel(r.active_year, r.active_month)}
                  </div>
                  <div className="col-span-6 text-gray-300">{r.reason ?? <span className="text-gray-600">—</span>}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* UX help */}
        <div className="pt-2 border-t border-gray-900 text-sm text-gray-400">
          <div className="font-semibold text-gray-200 mb-1">Enterprise-flöde</div>
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="text-gray-200">spot.write</span>: får spara månadspriser.</li>
            <li><span className="text-gray-200">spot.publish</span>: får publish aktiv period och skapa snapshot (rollback möjligt).</li>
            <li>Pricing-engine läser alltid aktiv period via <span className="text-gray-200">gridex_spot_basis_config</span>.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}