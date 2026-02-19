// app/admin/pricing/[slug]/page.tsx
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'
const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

type Contract = {
  id: string
  name: string
  slug: string
  contract_type: 'spot_hourly' | 'portfolio_managed' | 'fixed'
}

type Version = {
  id: string
  contract_id: string
  version_number: number
  valid_from: string
  is_active: boolean
}

type AreaPricing = {
  id: string
  pricing_version_id: string
  price_area: PriceArea
  price_per_kwh_ore: number | null
  markup_ore: number | null
  monthly_fee_sek: number
}

export default async function AdminPricingContractPage({
  params,
}: {
  params: { slug: string }
}) {
  const supabase = await createSupabaseServerClient()

  const { data: contract, error: contractError } = await supabase
    .from('contract_products')
    .select('id,name,slug,contract_type')
    .eq('slug', params.slug)
    .single()

  if (contractError || !contract) {
    redirect('/admin/pricing')
  }

  const typedContract = contract as Contract

  const { data: versions } = await supabase
    .from('contract_pricing_versions')
    .select('id,contract_id,version_number,valid_from,is_active')
    .eq('contract_id', typedContract.id)
    .order('version_number', { ascending: false })

  const typedVersions = (versions ?? []) as Version[]

  const activeVersion =
    typedVersions.find((v) => v.is_active) ?? typedVersions[0] ?? null

  const { data: areaRows } = activeVersion
    ? await supabase
        .from('contract_area_pricing')
        .select(
          'id,pricing_version_id,price_area,price_per_kwh_ore,markup_ore,monthly_fee_sek'
        )
        .eq('pricing_version_id', activeVersion.id)
    : { data: null }

  const areaMap = new Map<PriceArea, AreaPricing>()
  ;(areaRows as AreaPricing[] | null)?.forEach((row) =>
    areaMap.set(row.price_area, row)
  )

  // ===============================
  // CREATE VERSION
  // ===============================
  async function createVersionAction(formData: FormData) {
    'use server'

    const supabase = await createSupabaseServerClient()

    const contractId = String(formData.get('contract_id'))
    const validFrom = String(formData.get('valid_from'))

    const { data: latest } = await supabase
      .from('contract_pricing_versions')
      .select('version_number')
      .eq('contract_id', contractId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = (latest?.version_number ?? 0) + 1

    const { error } = await supabase.from('contract_pricing_versions').insert({
      contract_id: contractId,
      version_number: nextVersion,
      valid_from: validFrom,
      is_active: false,
    })

    if (error) throw new Error(error.message)

    revalidatePath(`/admin/pricing/${params.slug}`)
  }

  // ===============================
  // SAVE PRICES
  // ===============================
  async function savePricingAction(formData: FormData) {
    'use server'

    const supabase = await createSupabaseServerClient()

    const pricingVersionId = String(formData.get('pricing_version_id'))
    const contractType = String(formData.get('contract_type'))

    for (const area of AREAS) {
      const monthlyFee = Number(
        formData.get(`${area}_monthly_fee_sek`) ?? 0
      )

      if (contractType === 'spot_hourly') {
        const markup = Number(
          formData.get(`${area}_markup_ore`) ?? 0
        )

        const payload = {
          pricing_version_id: pricingVersionId,
          price_area: area,
          monthly_fee_sek: monthlyFee,
          markup_ore: markup,
          price_per_kwh_ore: null,
        }

        const { error } = await supabase
          .from('contract_area_pricing')
          .upsert(payload, {
            onConflict: 'pricing_version_id,price_area',
          })

        if (error) throw new Error(error.message)
      } else {
        const price = Number(
          formData.get(`${area}_price_per_kwh_ore`) ?? 0
        )

        const payload = {
          pricing_version_id: pricingVersionId,
          price_area: area,
          monthly_fee_sek: monthlyFee,
          price_per_kwh_ore: price,
          markup_ore: null,
        }

        const { error } = await supabase
          .from('contract_area_pricing')
          .upsert(payload, {
            onConflict: 'pricing_version_id,price_area',
          })

        if (error) throw new Error(error.message)
      }
    }

    revalidatePath(`/admin/pricing/${params.slug}`)
  }

  // ===============================
  // ACTIVATE VERSION
  // ===============================
  async function activateVersionAction(formData: FormData) {
    'use server'

    const supabase = await createSupabaseServerClient()

    const contractId = String(formData.get('contract_id'))
    const versionId = String(formData.get('version_id'))

    const { error } = await supabase.rpc(
      'activate_pricing_version',
      {
        p_contract_id: contractId,
        p_version_id: versionId,
      }
    )

    if (error) throw new Error(error.message)

    revalidatePath(`/admin/pricing/${params.slug}`)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          {typedContract.name}
        </h1>
        <p className="text-gray-400">
          Typ: {typedContract.contract_type}
        </p>
      </div>

      {/* CREATE VERSION */}
      <div className="bg-gray-950 p-6 rounded-xl border border-gray-800">
        <h2 className="font-semibold mb-4">
          Skapa ny prisversion
        </h2>

        <form action={createVersionAction} className="space-y-4">
          <input
            type="hidden"
            name="contract_id"
            value={typedContract.id}
          />

          <input
            name="valid_from"
            required
            placeholder="YYYY-MM-DD"
            className="w-full p-2 bg-black border border-gray-800 rounded-lg"
          />

          <button className="bg-cyan-500 text-black px-4 py-2 rounded-lg font-bold">
            Skapa
          </button>
        </form>
      </div>

      {/* VERSION LIST */}
      <div className="bg-gray-950 p-6 rounded-xl border border-gray-800">
        <h2 className="font-semibold mb-4">
          Versioner
        </h2>

        {typedVersions.map((v) => (
          <div
            key={v.id}
            className="flex justify-between items-center border border-gray-800 p-3 rounded-lg mb-3"
          >
            <div>
              v{v.version_number}{' '}
              {v.is_active && (
                <span className="text-cyan-400">
                  (Aktiv)
                </span>
              )}
            </div>

            {!v.is_active && (
              <form action={activateVersionAction}>
                <input
                  type="hidden"
                  name="contract_id"
                  value={typedContract.id}
                />
                <input
                  type="hidden"
                  name="version_id"
                  value={v.id}
                />
                <button className="border border-cyan-500 px-3 py-1 rounded-lg">
                  Aktivera
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      {/* PRICING EDITOR */}
      {activeVersion && (
        <div className="bg-gray-950 p-6 rounded-xl border border-gray-800">
          <h2 className="font-semibold mb-4">
            Pris per område
          </h2>

          <form action={savePricingAction} className="space-y-6">
            <input
              type="hidden"
              name="pricing_version_id"
              value={activeVersion.id}
            />
            <input
              type="hidden"
              name="contract_type"
              value={typedContract.contract_type}
            />

            {AREAS.map((area) => {
              const row = areaMap.get(area)

              return (
                <div
                  key={area}
                  className="border border-gray-800 p-4 rounded-lg"
                >
                  <div className="font-semibold mb-3">
                    {area}
                  </div>

                  {typedContract.contract_type ===
                  'spot_hourly' ? (
                    <input
                      name={`${area}_markup_ore`}
                      defaultValue={
                        row?.markup_ore ?? 0
                      }
                      placeholder="Påslag (öre/kWh)"
                      className="w-full p-2 bg-black border border-gray-800 rounded-lg mb-3"
                    />
                  ) : (
                    <input
                      name={`${area}_price_per_kwh_ore`}
                      defaultValue={
                        row?.price_per_kwh_ore ?? 0
                      }
                      placeholder="Pris (öre/kWh)"
                      className="w-full p-2 bg-black border border-gray-800 rounded-lg mb-3"
                    />
                  )}

                  <input
                    name={`${area}_monthly_fee_sek`}
                    defaultValue={
                      row?.monthly_fee_sek ?? 0
                    }
                    placeholder="Månadsavgift (SEK)"
                    className="w-full p-2 bg-black border border-gray-800 rounded-lg"
                  />
                </div>
              )
            })}

            <button className="bg-cyan-500 text-black px-4 py-2 rounded-lg font-bold">
              Spara priser
            </button>
          </form>
        </div>
      )}
    </div>
  )
}