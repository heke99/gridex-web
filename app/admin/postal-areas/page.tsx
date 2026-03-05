import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminActionAccess, requireAdminPageAccess } from '@/lib/admin/guards'

type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'
const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

function normalizePostal(input: string): string {
  return input.replace(/\s/g, '').trim()
}

export default async function AdminPostalAreasPage() {
  const ctx = await requireAdminPageAccess({ anyOf: ['admin.access'] })
  const supabase = ctx.supabase

  const { data: recent } = await supabase
    .from('gridex_postal_code_price_area')
    .select('postal_code,price_area,source,updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)

  async function upsertSingleAction(formData: FormData) {
    'use server'
    await requireAdminActionAccess({ anyOf: ['admin.access'] })
    const supabase = await createSupabaseServerClient()

    const postal = normalizePostal(String(formData.get('postal_code') ?? ''))
    const area = String(formData.get('price_area') ?? '') as PriceArea

    if (postal.length !== 5) throw new Error('Postnummer måste vara 5 siffror.')
    if (!AREAS.includes(area)) throw new Error('Ogiltigt elområde.')

    const { error } = await supabase
      .from('gridex_postal_code_price_area')
      .upsert(
        { postal_code: postal, price_area: area, source: 'admin' },
        { onConflict: 'postal_code' }
      )

    if (error) throw new Error(error.message)
    revalidatePath('/admin/postal-areas')
  }

  async function bulkPasteAction(formData: FormData) {
    'use server'
    const supabase = await createSupabaseServerClient()

    const raw = String(formData.get('bulk') ?? '').trim()
    if (!raw) throw new Error('Klistra in rader först.')

    // Format per rad: 11122,SE3
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)

    const payload: Array<{ postal_code: string; price_area: PriceArea; source: string }> = []

    for (const line of lines) {
      const [p0, a0] = line.split(',').map((x) => x?.trim())
      if (!p0 || !a0) continue
      const postal = normalizePostal(p0)
      const area = a0 as PriceArea
      if (postal.length !== 5) continue
      if (!AREAS.includes(area)) continue
      payload.push({ postal_code: postal, price_area: area, source: 'admin' })
    }

    if (payload.length === 0) throw new Error('Inga giltiga rader. Format: 11122,SE3')

    const { error } = await supabase
      .from('gridex_postal_code_price_area')
      .upsert(payload, { onConflict: 'postal_code' })

    if (error) throw new Error(error.message)
    revalidatePath('/admin/postal-areas')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Postnummer → Elområde</h1>
        <p className="text-gray-400">
          När tabellen är tom kan du fylla senare — API kopplas automatiskt när data finns.
          (Men kalkylatorn visar inte pris för postnummer som saknas.)
        </p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
        <h2 className="font-semibold mb-4">Lägg till / uppdatera</h2>
        <form action={upsertSingleAction} className="grid gap-3 sm:grid-cols-3">
          <input
            name="postal_code"
            placeholder="11122"
            className="p-2 bg-black border border-gray-800 rounded-lg"
            required
          />
          <select
            name="price_area"
            className="p-2 bg-black border border-gray-800 rounded-lg"
            defaultValue="SE3"
          >
            {AREAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button className="bg-cyan-500 text-black font-bold px-4 py-2 rounded-lg">
            Spara
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
        <h2 className="font-semibold mb-2">Bulk</h2>
        <p className="text-sm text-gray-400 mb-4">Format: <span className="text-gray-200">11122,SE3</span></p>
        <form action={bulkPasteAction} className="space-y-3">
          <textarea
            name="bulk"
            rows={8}
            className="w-full p-3 bg-black border border-gray-800 rounded-lg"
            placeholder={`11122,SE3\n21100,SE4\n90300,SE2\n97100,SE1`}
          />
          <button className="border border-cyan-500 px-4 py-2 rounded-lg">
            Importera
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
        <h2 className="font-semibold mb-4">Senast ändrade</h2>
        <div className="space-y-2">
          {(recent ?? []).map((r) => (
            <div key={r.postal_code} className="flex items-center justify-between border border-gray-800 rounded-lg p-3">
              <div className="font-mono">{r.postal_code}</div>
              <div className="text-gray-300">{r.price_area}</div>
              <div className="text-sm text-gray-500">{r.source}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}