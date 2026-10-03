import { requireGlobalAdminPageAccess } from '@/lib/admin/guards'
import { bulkPasteAction, upsertSingleAction } from './actions'

type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'
const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

export default async function AdminPostalAreasPage() {
  const ctx = await requireGlobalAdminPageAccess({ anyOf: ['pricing.read', 'pricing.write'] })
  const supabase = ctx.supabase

  const { data: recent } = await supabase
    .from('gridex_postal_code_price_area')
    .select('postal_code,price_area,source,updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)

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
