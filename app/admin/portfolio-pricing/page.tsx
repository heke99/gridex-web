import { revalidatePath } from 'next/cache'
import { requireAdminPageAccess } from '@/lib/admin/guards'
import { requirePermissionServer } from '@/lib/auth/requirePermissionServer'
import { logPermissionAudit } from '@/lib/auth/audit'

type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'
const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

type ContractType = 'portfolio_managed' | 'fixed'

type ContractRow = {
  id: string
  name: string
  slug: string
  contract_type: ContractType
}

function parseNumber(value: FormDataEntryValue | null): number {
  const parsed =
    typeof value === 'string'
      ? Number(value.replace(',', '.').trim())
      : Number.NaN

  return Number.isFinite(parsed) ? parsed : 0
}

export const dynamic = 'force-dynamic'

export default async function AdminPortfolioPricingPage() {
  const ctx = await requireAdminPageAccess({
    anyOf: ['portfolio.read', 'portfolio.write', 'pricing.write', 'admin.access'],
  })

  const supabase = ctx.supabase

  const { data: contracts, error: contractsError } = await supabase
    .from('contract_products')
    .select('id,name,slug,contract_type')
    .in('contract_type', ['portfolio_managed', 'fixed'])
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

    const { supabase, user } = await requirePermissionServer('portfolio.write')

    const payload: Array<{
      contract_id: string
      price_area: PriceArea
      fixed_price_ore: number
      variable_fee_ore: number
      monthly_fee_sek: number
    }> = []

    for (const area of AREAS) {
      payload.push({
        contract_id: contractId,
        price_area: area,
        fixed_price_ore: parseNumber(formData.get(`${area}_fixed_price_ore`)),
        variable_fee_ore: parseNumber(formData.get(`${area}_variable_fee_ore`)),
        monthly_fee_sek: parseNumber(formData.get(`${area}_monthly_fee_sek`)),
      })
    }

    const { error } = await supabase
      .from('gridex_portfolio_area_pricing')
      .upsert(payload, {
        onConflict: 'contract_id,price_area',
      })

    if (error) {
      throw new Error(error.message)
    }

    await logPermissionAudit({
      actorId: user.id,
      action: 'portfolio.write',
      metadata: {
        contractId,
        areas: payload.map((row) => ({
          price_area: row.price_area,
          fixed_price_ore: row.fixed_price_ore,
          variable_fee_ore: row.variable_fee_ore,
          monthly_fee_sek: row.monthly_fee_sek,
        })),
      },
    }).catch(() => null)

    revalidatePath('/admin')
    revalidatePath('/admin/pricing')
    revalidatePath('/admin/portfolio-pricing')
    revalidatePath('/admin/calculator')
    revalidatePath('/admin/customer-spec')
    revalidatePath('/teckna')
    revalidatePath('/avtal')
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-3xl font-bold">Portfölj & fastpris</h1>
        <p className="mt-2 text-sm text-white/60">
          Fast pris per kWh per elområde för aktiva portfölj- och fastprisavtal.
          Dessa värden används i preview, kundspec och prissättning för publika
          flöden.
        </p>
      </div>

      {(contracts ?? []).map((contract) => (
        <form
          key={contract.id}
          action={saveAction}
          className="space-y-4 rounded-3xl border border-gray-800 bg-gray-950 p-6"
        >
          <input type="hidden" name="contract_id" value={contract.id} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xl font-semibold">{contract.name}</div>
              <div className="mt-1 text-sm text-gray-500">
                {contract.slug} • {contract.contract_type}
              </div>
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
                      Fast pris (öre/kWh)
                    </label>
                    <input
                      name={`${area}_fixed_price_ore`}
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
        <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
          Inga aktiva portfölj- eller fastprisavtal hittades.
        </div>
      )}
    </div>
  )
}