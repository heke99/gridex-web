// app/admin/monthly-spot/page.tsx
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'
const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

function prevYearMonth(now: Date): { year: number; month: number } {
  const m = now.getMonth() + 1
  if (m === 1) return { year: now.getFullYear() - 1, month: 12 }
  return { year: now.getFullYear(), month: m - 1 }
}

export default async function AdminMonthlySpotPage() {
  const supabase = await createSupabaseServerClient()
  const { year, month } = prevYearMonth(new Date())

  const { data: rows } = await supabase
    .from('gridex_monthly_spot_prices')
    .select('price_area,year,month,avg_spot_ore')
    .eq('year', year)
    .eq('month', month)
    .order('price_area', { ascending: true })

  const byArea = new Map<PriceArea, number>()
  ;(rows ?? []).forEach((r) => byArea.set(r.price_area as PriceArea, Number(r.avg_spot_ore)))

  async function saveAction(formData: FormData) {
    'use server'
    const supabase = await createSupabaseServerClient()
    const y = Number(formData.get('year'))
    const m = Number(formData.get('month'))

    const payload: Array<{ price_area: PriceArea; year: number; month: number; avg_spot_ore: number }> = []

    for (const a of AREAS) {
      const v = Number(formData.get(`${a}_avg_spot_ore`) ?? NaN)
      if (!Number.isFinite(v)) throw new Error(`Ogiltigt värde för ${a}`)
      payload.push({ price_area: a, year: y, month: m, avg_spot_ore: v })
    }

    const { error } = await supabase
      .from('gridex_monthly_spot_prices')
      .upsert(payload, { onConflict: 'price_area,year,month' })

    if (error) throw new Error(error.message)
    revalidatePath('/admin/monthly-spot')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Månadspris (Spot genomsnitt)</h1>
        <p className="text-gray-400">
          Tim/rörligt baseras på föregående månads genomsnittliga spotpris per elområde.
        </p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
        <h2 className="font-semibold mb-4">
          Föregående månad: {year}-{String(month).padStart(2, '0')}
        </h2>

        <form action={saveAction} className="space-y-4">
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />

          <div className="grid gap-3 sm:grid-cols-2">
            {AREAS.map((a) => (
              <div key={a} className="border border-gray-800 rounded-lg p-4">
                <div className="font-semibold mb-2">{a}</div>
                <label className="text-sm text-gray-400">Avg spot (öre/kWh)</label>
                <input
                  name={`${a}_avg_spot_ore`}
                  defaultValue={byArea.get(a) ?? ''}
                  className="mt-1 w-full p-2 bg-black border border-gray-800 rounded-lg"
                  placeholder="t.ex 92.5"
                  required
                />
              </div>
            ))}
          </div>

          <button className="bg-cyan-500 text-black font-bold px-4 py-2 rounded-lg">
            Spara månadspriser
          </button>
        </form>
      </div>
    </div>
  )
}