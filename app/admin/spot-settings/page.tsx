// app/admin/spot-settings/page.tsx
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'
const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

type ContractRow = {
  id: string
  name: string
  slug: string
  contract_type: string
}

export default async function AdminSpotSettingsPage() {
  const supabase = await createSupabaseServerClient()

  const { data: contracts } = await supabase
    .from('contract_products')
    .select('id,name,slug,contract_type')
    .eq('contract_type', 'spot_hourly')
    .eq('is_active', true)
    .order('name', { ascending: true })

  async function saveAction(formData: FormData) {
    'use server'
    const supabase = await createSupabaseServerClient()
    const contractId = String(formData.get('contract_id') ?? '')

    const payload: Array<{
      contract_id: string
      price_area: PriceArea
      markup_ore: number
      variable_fee_ore: number
      monthly_fee_sek: number
    }> = []

    for (const a of AREAS) {
      const markup = Number(formData.get(`${a}_markup_ore`) ?? 0)
      const variable = Number(formData.get(`${a}_variable_fee_ore`) ?? 0)
      const monthly = Number(formData.get(`${a}_monthly_fee_sek`) ?? 0)
      payload.push({
        contract_id: contractId,
        price_area: a,
        markup_ore: markup,
        variable_fee_ore: variable,
        monthly_fee_sek: monthly,
      })
    }

    const { error } = await supabase
      .from('gridex_spot_area_settings')
      .upsert(payload, { onConflict: 'contract_id,price_area' })

    if (error) throw new Error(error.message)
    revalidatePath('/admin/spot-settings')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Tim/Spot-inställningar</h1>
        <p className="text-gray-400">
          Påslag + rörliga avgifter + månadsavgift per elområde. Visas i kundens specifikation.
        </p>
      </div>

      {(contracts as ContractRow[] | null)?.map((c) => (
        <form
          key={c.id}
          action={saveAction}
          className="rounded-xl border border-gray-800 bg-gray-950 p-6 space-y-4"
        >
          <input type="hidden" name="contract_id" value={c.id} />

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-semibold">{c.name}</div>
              <div className="text-sm text-gray-500">{c.slug}</div>
            </div>
            <button className="bg-cyan-500 text-black font-bold px-4 py-2 rounded-lg">
              Spara
            </button>
          </div>

          <div className="grid gap-3">
            {AREAS.map((a) => (
              <div key={a} className="border border-gray-800 rounded-lg p-4">
                <div className="font-semibold mb-3">{a}</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-sm text-gray-400">Påslag (öre/kWh)</label>
                    <input
                      name={`${a}_markup_ore`}
                      defaultValue={0}
                      className="mt-1 w-full p-2 bg-black border border-gray-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Rörlig avgift (öre/kWh)</label>
                    <input
                      name={`${a}_variable_fee_ore`}
                      defaultValue={0}
                      className="mt-1 w-full p-2 bg-black border border-gray-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Månadsavgift (SEK)</label>
                    <input
                      name={`${a}_monthly_fee_sek`}
                      defaultValue={0}
                      className="mt-1 w-full p-2 bg-black border border-gray-800 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </form>
      ))}
    </div>
  )
}