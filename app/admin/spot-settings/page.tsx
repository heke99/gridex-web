import { revalidatePath } from 'next/cache'
import { requireAdminPageAccess } from '@/lib/admin/guards'
import { requirePermissionServer } from '@/lib/auth/requirePermissionServer'
import { logPermissionAudit } from '@/lib/auth/audit'

type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'
const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

type ContractRow = {
  id: string
  name: string
  slug: string
  contract_type: string
}

export const dynamic = 'force-dynamic'

function parseNumber(value: FormDataEntryValue | null): number {
  const parsed =
    typeof value === 'string'
      ? Number(value.replace(',', '.').trim())
      : Number.NaN

  return Number.isFinite(parsed) ? parsed : 0
}

export default async function AdminSpotSettingsPage() {
  const ctx = await requireAdminPageAccess({
    anyOf: [
      'spot.read',
      'spot.write',
      'spot.publish',
      'pricing.write',
      'admin.access',
    ],
  })

  const supabase = ctx.supabase

  const { data: contracts, error: contractsError } = await supabase
    .from('contract_products')
    .select('id,name,slug,contract_type')
    .eq('contract_type', 'spot_hourly')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .returns<ContractRow[]>()

  if (contractsError) {
    throw new Error(contractsError.message)
  }

  async function saveAction(formData: FormData) {
    'use server'

    const contractId = String(formData.get('contract_id') ?? '').trim()

    if (!contractId) {
      throw new Error('Missing contract_id')
    }

    const { supabase, user } = await requirePermissionServer('spot.write')

    const payload: Array<{
      contract_id: string
      price_area: PriceArea
      markup_ore: number
      variable_fee_ore: number
      monthly_fee_sek: number
    }> = []

    for (const area of AREAS) {
      payload.push({
        contract_id: contractId,
        price_area: area,
        markup_ore: parseNumber(formData.get(`${area}_markup_ore`)),
        variable_fee_ore: parseNumber(formData.get(`${area}_variable_fee_ore`)),
        monthly_fee_sek: parseNumber(formData.get(`${area}_monthly_fee_sek`)),
      })
    }

    const { error } = await supabase
      .from('gridex_spot_area_settings')
      .upsert(payload, {
        onConflict: 'contract_id,price_area',
      })

    if (error) {
      throw new Error(error.message)
    }

    await logPermissionAudit({
      actorId: user.id,
      action: 'spot.write',
      metadata: {
        contractId,
        areas: payload.map((row) => ({
          price_area: row.price_area,
          markup_ore: row.markup_ore,
          variable_fee_ore: row.variable_fee_ore,
          monthly_fee_sek: row.monthly_fee_sek,
        })),
      },
    }).catch(() => null)

    revalidatePath('/admin')
    revalidatePath('/admin/spot-settings')
    revalidatePath('/admin/calculator')
    revalidatePath('/teckna')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Tim/Spot-inställningar</h1>
        <p className="text-gray-400">
          Påslag, rörliga avgifter och månadsavgift per elområde. Används i
          kundspec och kalkylator.
        </p>
      </div>

      {(contracts ?? []).map((contract) => (
        <form
          key={contract.id}
          action={saveAction}
          className="space-y-4 rounded-xl border border-gray-800 bg-gray-950 p-6"
        >
          <input type="hidden" name="contract_id" value={contract.id} />

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xl font-semibold">{contract.name}</div>
              <div className="text-sm text-gray-500">{contract.slug}</div>
            </div>

            <button className="rounded-lg bg-cyan-500 px-4 py-2 font-bold text-black">
              Spara
            </button>
          </div>

          <div className="grid gap-3">
            {AREAS.map((area) => (
              <div
                key={area}
                className="rounded-lg border border-gray-800 p-4"
              >
                <div className="mb-3 font-semibold">{area}</div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-sm text-gray-400">
                      Påslag (öre/kWh)
                    </label>
                    <input
                      name={`${area}_markup_ore`}
                      defaultValue={0}
                      className="mt-1 w-full rounded-lg border border-gray-800 bg-black p-2"
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-400">
                      Rörlig avgift (öre/kWh)
                    </label>
                    <input
                      name={`${area}_variable_fee_ore`}
                      defaultValue={0}
                      className="mt-1 w-full rounded-lg border border-gray-800 bg-black p-2"
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-400">
                      Månadsavgift (SEK)
                    </label>
                    <input
                      name={`${area}_monthly_fee_sek`}
                      defaultValue={0}
                      className="mt-1 w-full rounded-lg border border-gray-800 bg-black p-2"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </form>
      ))}

      {(!contracts || contracts.length === 0) && (
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
          Inga aktiva spot-avtal hittades (contract_type=spot_hourly).
        </div>
      )}
    </div>
  )
}