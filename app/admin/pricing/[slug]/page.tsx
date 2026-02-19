// app/admin/pricing/[slug]/page.tsx
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole, assertCanPublish } from '@/lib/auth/admin'

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
  is_published: boolean
}

type AreaPricing = {
  id: string
  pricing_version_id: string
  price_area: PriceArea
  price_per_kwh_ore: number | null
  markup_ore: number | null
  monthly_fee_sek: number
}

function toDateInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoFromDateInput(dateStr: string): string {
  const s = (dateStr || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d0 = new Date(s)
    if (!Number.isNaN(d0.getTime())) return d0.toISOString()
    throw new Error('Invalid valid_from date')
  }
  const d = new Date(`${s}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) throw new Error('Invalid valid_from date')
  return d.toISOString()
}

function classify(nowIso: string, v: Version): 'LIVE' | 'SCHEDULED' | 'DRAFT' {
  if (!v.is_published) return 'DRAFT'
  if (v.valid_from > nowIso) return 'SCHEDULED'
  return 'LIVE'
}

export default async function AdminPricingContractPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams?: { previewVersionId?: string; kwh?: string }
}) {
  const supabase = await createSupabaseServerClient()
  await requireAdminRole(supabase)

  const { data: contract } = await supabase
    .from('contract_products')
    .select('id,name,slug,contract_type')
    .eq('slug', params.slug)
    .single()

  if (!contract) redirect('/admin/pricing')

  const typedContract = contract as Contract

  const { data: versions } = await supabase
    .from('contract_pricing_versions')
    .select('id,contract_id,version_number,valid_from,is_published')
    .eq('contract_id', typedContract.id)
    .order('version_number', { ascending: false })

  const typedVersions = (versions ?? []) as Version[]
  const nowIso = new Date().toISOString()

  const live = typedVersions
    .filter((v) => v.is_published && v.valid_from <= nowIso)
    .sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0]

  const scheduled = typedVersions
    .filter((v) => v.is_published && v.valid_from > nowIso)
    .sort((a, b) => (a.valid_from > b.valid_from ? 1 : -1))[0]

  const activeVersion = live ?? scheduled ?? typedVersions[0] ?? null

  const { data: areaRows } = activeVersion
    ? await supabase
        .from('contract_area_pricing')
        .select('*')
        .eq('pricing_version_id', activeVersion.id)
        .returns<AreaPricing[]>()
    : { data: null }

  const areaMap = new Map<PriceArea, AreaPricing>()
  areaRows?.forEach((r) => areaMap.set(r.price_area, r))

  /* =======================================================
     CREATE VERSION (UNCHANGED)
  ======================================================= */
  async function createVersionAction(formData: FormData) {
    'use server'
    const supabase = await createSupabaseServerClient()
    await requireAdminRole(supabase)

    const contractId = String(formData.get('contract_id'))
    const validFrom = isoFromDateInput(String(formData.get('valid_from')))

    const { data: latest } = await supabase
      .from('contract_pricing_versions')
      .select('version_number')
      .eq('contract_id', contractId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle<{ version_number: number }>()

    const nextVersion = (latest?.version_number ?? 0) + 1

    await supabase.from('contract_pricing_versions').insert({
      contract_id: contractId,
      version_number: nextVersion,
      valid_from: validFrom,
      is_published: false,
    })

    revalidatePath(`/admin/pricing/${params.slug}`)
  }

  /* =======================================================
     SAVE PRICES (UNCHANGED)
  ======================================================= */
  async function savePricingAction(formData: FormData) {
    'use server'
    const supabase = await createSupabaseServerClient()
    await requireAdminRole(supabase)

    const pricingVersionId = String(formData.get('pricing_version_id'))
    const contractType = String(formData.get('contract_type'))

    for (const area of AREAS) {
      const monthlyFee = Number(formData.get(`${area}_monthly_fee_sek`) ?? 0)

      if (contractType === 'spot_hourly') {
        const markup = Number(formData.get(`${area}_markup_ore`) ?? 0)
        await supabase.from('contract_area_pricing').upsert(
          {
            pricing_version_id: pricingVersionId,
            price_area: area,
            monthly_fee_sek: monthlyFee,
            markup_ore: markup,
            price_per_kwh_ore: null,
          },
          { onConflict: 'pricing_version_id,price_area' }
        )
      } else {
        const price = Number(formData.get(`${area}_price_per_kwh_ore`) ?? 0)
        await supabase.from('contract_area_pricing').upsert(
          {
            pricing_version_id: pricingVersionId,
            price_area: area,
            monthly_fee_sek: monthlyFee,
            price_per_kwh_ore: price,
            markup_ore: null,
          },
          { onConflict: 'pricing_version_id,price_area' }
        )
      }
    }

    revalidatePath(`/admin/pricing/${params.slug}`)
  }

  /* =======================================================
     ACTIVATE (UNCHANGED)
  ======================================================= */
  async function activateVersionAction(formData: FormData) {
    'use server'
    const supabase = await createSupabaseServerClient()

    const { user, role } = await requireAdminRole(supabase)
    assertCanPublish(role)

    const contractId = String(formData.get('contract_id'))
    const versionId = String(formData.get('version_id'))
    const reason = String(formData.get('reason') || '').trim()

    if (!reason) throw new Error('Audit reason required')

    await supabase
      .from('contract_pricing_versions')
      .update({ is_published: false })
      .eq('contract_id', contractId)

    await supabase
      .from('contract_pricing_versions')
      .update({ is_published: true })
      .eq('id', versionId)

    await supabase.from('pricing_version_audit').insert({
      contract_id: contractId,
      version_id: versionId,
      action: 'publish',
      performed_by: user.id,
      reason,
    })

    revalidatePath('/')
    revalidatePath(`/admin/pricing/${params.slug}`)
  }

  /* =======================================================
     CLONE VERSION (ONLY TYPE FIXED)
  ======================================================= */
  async function cloneVersionAction(formData: FormData) {
    'use server'
    const supabase = await createSupabaseServerClient()
    const { user } = await requireAdminRole(supabase)

    const contractId = String(formData.get('contract_id'))
    const sourceVersionId = String(formData.get('source_version_id'))
    const reason = String(formData.get('reason') || '')

    if (!reason) throw new Error('Audit reason required')

    const { data: latest } = await supabase
      .from('contract_pricing_versions')
      .select('version_number')
      .eq('contract_id', contractId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle<{ version_number: number }>()

    const nextVersion = (latest?.version_number ?? 0) + 1

    const { data: newVersion } = await supabase
      .from('contract_pricing_versions')
      .insert({
        contract_id: contractId,
        version_number: nextVersion,
        valid_from: new Date().toISOString(),
        is_published: false,
      })
      .select()
      .single<Version>()

    if (!newVersion) throw new Error('Clone failed')

    const { data: oldRows } = await supabase
      .from('contract_area_pricing')
      .select('*')
      .eq('pricing_version_id', sourceVersionId)
      .returns<AreaPricing[]>()

    if (oldRows) {
      for (const r of oldRows) {
        await supabase.from('contract_area_pricing').insert({
          pricing_version_id: newVersion.id,
          price_area: r.price_area,
          price_per_kwh_ore: r.price_per_kwh_ore,
          markup_ore: r.markup_ore,
          monthly_fee_sek: r.monthly_fee_sek,
        })
      }
    }

    await supabase.from('pricing_version_audit').insert({
      contract_id: contractId,
      version_id: newVersion.id,
      action: 'clone',
      performed_by: user.id,
      reason,
    })

    revalidatePath(`/admin/pricing/${params.slug}`)
  }

  /* ======================================================= */

  const previewVersionId = searchParams?.previewVersionId ?? activeVersion?.id
  const previewKwh = Number(searchParams?.kwh ?? 2000)

  const previewVersion =
    typedVersions.find((v) => v.id === previewVersionId) ?? activeVersion

  const { data: previewRows } = previewVersion
    ? await supabase
        .from('contract_area_pricing')
        .select('*')
        .eq('pricing_version_id', previewVersion.id)
        .returns<AreaPricing[]>()
    : { data: null }

  const previewMap = new Map<PriceArea, AreaPricing>()
  previewRows?.forEach((r) => previewMap.set(r.price_area, r))

  function preview(area: PriceArea) {
    const row = previewMap.get(area)
    if (!row) return 'Ingen data'

    const monthly = row.monthly_fee_sek
    const energyOre =
      typedContract.contract_type === 'spot_hourly'
        ? (row.markup_ore ?? 0) * previewKwh
        : (row.price_per_kwh_ore ?? 0) * previewKwh

    return `${(energyOre / 100 + monthly).toFixed(2)} SEK`
  }

  return (
    <div className="space-y-8">
      {typedVersions.map((v) => (
        <div key={v.id} className="border p-3 rounded-lg">
          v{v.version_number} ({classify(nowIso, v)})
        </div>
      ))}

      <form action={cloneVersionAction} className="space-y-2">
        <input type="hidden" name="contract_id" value={typedContract.id} />
        <select name="source_version_id">
          {typedVersions.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.version_number}
            </option>
          ))}
        </select>
        <input name="reason" placeholder="Anledning till clone" required />
        <button>Klona version</button>
      </form>

      <div>
        <h3>Preview (kWh = {previewKwh})</h3>
        {AREAS.map((area) => (
          <div key={area}>
            {area}: {preview(area)}
          </div>
        ))}
      </div>
    </div>
  )
}