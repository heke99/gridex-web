// app/admin/portfolio-pricing/page.tsx
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

export default async function AdminPortfolioPricingPage() {
  const ctx = await requireAdminPageAccess({ anyOf: ['admin.access'] })
  const supabase = ctx.supabase

  const { data: contracts, error: cErr } = await supabase
    .from('contract_products')
    .select('id,name,slug,contract_type')
    .in('contract_type', ['portfolio_managed', 'fixed'])
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (cErr) throw new Error(cErr.message)

  async function saveAction(formData: FormData) {
    'use server'

    const contractId = String(formData.get('contract_id') ?? '').trim()
    if (!contractId) throw new Error('Missing contract_id')

    // ✅ Step B: enforce permission
    const { supabase, user } = await requirePermissionServer('portfolio.write')

    const payload: Array<{
      contract_id: string
      price_area: PriceArea
      fixed_price_ore: number
      variable_fee_ore: number
      monthly_fee_sek: number
    }> = []

    for (const a of AREAS) {
      const fixed = Number(formData.get(`${a}_fixed_price_ore`) ?? 0)
      const variable = Number(formData.get(`${a}_variable_fee_ore`) ?? 0)
      const monthly = Number(formData.get(`${a}_monthly_fee_sek`) ?? 0)

      payload.push({
        contract_id: contractId,
        price_area: a,
        fixed_price_ore: Number.isFinite(fixed) ? fixed : 0,
        variable_fee_ore: Number.isFinite(variable) ? variable : 0,
        monthly_fee_sek: Number.isFinite(monthly) ? monthly : 0,
      })
    }

    const { error } = await supabase
      .from('gridex_portfolio_area_pricing')
      .upsert(payload, { onConflict: 'contract_id,price_area' })

    if (error) throw new Error(error.message)

    // ✅ Step B: audit log
    await logPermissionAudit({
      actorId: user.id,
      action: 'portfolio.write',
      metadata: {
        contractId,
        areas: payload.map((p) => ({
          price_area: p.price_area,
          fixed_price_ore: p.fixed_price_ore,
          variable_fee_ore: p.variable_fee_ore,
          monthly_fee_sek: p.monthly_fee_sek,
        })),
      },
    })

    revalidatePath('/admin/portfolio-pricing')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Portfölj & Fastpris</h1>
        <p className="text-gray-400">
          Fast pris per kWh per elområde. Visas i kundens specifikation.
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
                    <label className="text-sm text-gray-400">Fast pris (öre/kWh)</label>
                    <input
                      name={`${a}_fixed_price_ore`}
                      defaultValue={0}
                      className="mt-1 w-full p-2 bg-black border border-gray-800 rounded-lg"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Rörlig avgift (öre/kWh)</label>
                    <input
                      name={`${a}_variable_fee_ore`}
                      defaultValue={0}
                      className="mt-1 w-full p-2 bg-black border border-gray-800 rounded-lg"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Månadsavgift (SEK)</label>
                    <input
                      name={`${a}_monthly_fee_sek`}
                      defaultValue={0}
                      className="mt-1 w-full p-2 bg-black border border-gray-800 rounded-lg"
                      inputMode="numeric"
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
          Inga aktiva portfölj/fastpris-avtal hittades.
        </div>
      )}
    </div>
  )
}