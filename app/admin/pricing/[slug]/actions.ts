// app/admin/pricing/[slug]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePermissionServer } from '@/lib/auth/requirePermissionServer'
import { logPermissionAudit } from '@/lib/auth/audit'

const AREAS = ['SE1', 'SE2', 'SE3', 'SE4'] as const
type PriceArea = (typeof AREAS)[number]
type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

function isoFromDateInput(dateStr: string): string {
  const s = (dateStr || '').trim()
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) {
    const d0 = new Date(s)
    if (!Number.isNaN(d0.getTime())) return d0.toISOString()
    throw new Error('Invalid valid_from date')
  }
  const d = new Date(`${s}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) throw new Error('Invalid valid_from date')
  return d.toISOString()
}

function num(v: FormDataEntryValue | null): number {
  if (!v) return 0
  const cleaned = String(v).replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

export async function createVersionAction(formData: FormData) {
  const contractId = String(formData.get('contract_id') || '')
  const slug = String(formData.get('slug') || '')
  const validFrom = isoFromDateInput(String(formData.get('valid_from') || ''))

  if (!contractId) throw new Error('Missing contract_id')
  if (!slug) throw new Error('Missing slug')

  const { supabase, user } = await requirePermissionServer('pricing.write')

  const { data: latest, error: latestErr } = await supabase
    .from('contract_pricing_versions')
    .select('version_number')
    .eq('contract_id', contractId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle<{ version_number: number }>()

  if (latestErr) throw new Error(latestErr.message)

  const nextVersion = (latest?.version_number ?? 0) + 1

  const { data: inserted, error } = await supabase
    .from('contract_pricing_versions')
    .insert({
      contract_id: contractId,
      version_number: nextVersion,
      valid_from: validFrom,
      is_published: false,
      status: 'draft',
    })
    .select('id')
    .single<{ id: string }>()

  if (error) throw new Error(error.message)

  await logPermissionAudit({
    actorId: user.id,
    action: 'pricing.version.create',
    metadata: { contractId, nextVersion, validFrom, versionId: inserted.id },
  })

  // ✅ Always force fresh data via redirect
  revalidatePath(`/admin/pricing/${slug}`)
  redirect(`/admin/pricing/${slug}?previewVersionId=${inserted.id}`)
}

export async function savePricingAction(formData: FormData) {
  const pricingVersionId = String(formData.get('pricing_version_id') || '')
  const contractType = String(formData.get('contract_type') || '') as ContractType
  const slug = String(formData.get('slug') || '')

  if (!pricingVersionId) throw new Error('Missing pricing_version_id')
  if (!slug) throw new Error('Missing slug')

  const { supabase, user } = await requirePermissionServer('pricing.write')

  for (const area of AREAS) {
    const monthlyFee = num(formData.get(`${area}_monthly_fee_sek`))
    const variableFee = num(formData.get(`${area}_variable_fee_ore`))
    const elcert = num(formData.get(`${area}_elcert_ore`))

    if (contractType === 'spot_hourly') {
      const markup = num(formData.get(`${area}_markup_ore`))

      const { error } = await supabase.from('contract_area_pricing').upsert(
        {
          pricing_version_id: pricingVersionId,
          price_area: area,
          monthly_fee_sek: monthlyFee,
          markup_ore: markup,
          price_per_kwh_ore: null,
          variable_fee_ore: variableFee,
          elcert_ore: elcert,
        },
        { onConflict: 'pricing_version_id,price_area' }
      )
      if (error) throw new Error(error.message)
    } else {
      const price = num(formData.get(`${area}_price_per_kwh_ore`))

      const { error } = await supabase.from('contract_area_pricing').upsert(
        {
          pricing_version_id: pricingVersionId,
          price_area: area,
          monthly_fee_sek: monthlyFee,
          price_per_kwh_ore: price,
          markup_ore: null,
          variable_fee_ore: variableFee,
          elcert_ore: elcert,
        },
        { onConflict: 'pricing_version_id,price_area' }
      )
      if (error) throw new Error(error.message)
    }
  }

  await logPermissionAudit({
    actorId: user.id,
    action: 'pricing.write',
    metadata: { pricingVersionId },
  })

  revalidatePath(`/admin/pricing/${slug}`)
  redirect(`/admin/pricing/${slug}?previewVersionId=${pricingVersionId}`)
}

export async function publishVersionAction(formData: FormData) {
  const contractId = String(formData.get('contract_id') || '')
  const versionId = String(formData.get('version_id') || '')
  const slug = String(formData.get('slug') || '')
  const reason = String(formData.get('reason') || '').trim()

  if (!contractId) throw new Error('Missing contract_id')
  if (!versionId) throw new Error('Missing version_id')
  if (!slug) throw new Error('Missing slug')
  if (!reason) throw new Error('Audit reason required')

  const { supabase, user } = await requirePermissionServer('pricing.publish')

  // Safety: ensure version belongs to contract
  const { data: v, error: vErr } = await supabase
    .from('contract_pricing_versions')
    .select('id,contract_id')
    .eq('id', versionId)
    .maybeSingle<{ id: string; contract_id: string }>()

  if (vErr) throw new Error(vErr.message)
  if (!v || v.contract_id !== contractId) throw new Error('Invalid version for contract')

  // Enterprise rule: only ONE published version per contract (covers LIVE + SCHEDULED)
  const { error: offErr } = await supabase
    .from('contract_pricing_versions')
    .update({ is_published: false, status: 'draft' })
    .eq('contract_id', contractId)

  if (offErr) throw new Error(offErr.message)

  const { error: onErr } = await supabase
    .from('contract_pricing_versions')
    .update({ is_published: true, status: 'published' })
    .eq('id', versionId)
    .eq('contract_id', contractId)

  if (onErr) throw new Error(onErr.message)

  const { error: aErr } = await supabase.from('pricing_version_audit').insert({
    contract_id: contractId,
    version_id: versionId,
    action: 'publish',
    performed_by: user.id,
    reason,
  })

  if (aErr) throw new Error(aErr.message)

  await logPermissionAudit({
    actorId: user.id,
    action: 'pricing.publish',
    metadata: { contractId, versionId, reason },
  })

  // Revalidate admin + public
  revalidatePath('/admin')
  revalidatePath('/admin/contracts')
  revalidatePath('/admin/pricing')
  revalidatePath(`/admin/pricing/${slug}`)

  revalidatePath('/')
  revalidatePath('/avtal')
  revalidatePath('/teckna')
  revalidatePath('/kundservice')

  revalidatePath('/elpris')
  revalidatePath('/elpris/se1')
  revalidatePath('/elpris/se2')
  revalidatePath('/elpris/se3')
  revalidatePath('/elpris/se4')

  redirect(`/admin/pricing/${slug}?previewVersionId=${versionId}`)
}

export async function cloneVersionAction(formData: FormData) {
  const contractId = String(formData.get('contract_id') || '')
  const sourceVersionId = String(formData.get('source_version_id') || '')
  const slug = String(formData.get('slug') || '')
  const reason = String(formData.get('reason') || '').trim()

  if (!contractId) throw new Error('Missing contract_id')
  if (!sourceVersionId) throw new Error('Missing source_version_id')
  if (!slug) throw new Error('Missing slug')
  if (!reason) throw new Error('Audit reason required')

  const { supabase, user } = await requirePermissionServer('pricing.write')

  const { data: latest, error: latestErr } = await supabase
    .from('contract_pricing_versions')
    .select('version_number')
    .eq('contract_id', contractId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle<{ version_number: number }>()

  if (latestErr) throw new Error(latestErr.message)

  const nextVersion = (latest?.version_number ?? 0) + 1

  const { data: newVersion, error: nvErr } = await supabase
    .from('contract_pricing_versions')
    .insert({
      contract_id: contractId,
      version_number: nextVersion,
      valid_from: new Date().toISOString(),
      is_published: false,
      status: 'draft',
    })
    .select('id')
    .single<{ id: string }>()

  if (nvErr) throw new Error(nvErr.message)

  const { data: oldRows, error: oldErr } = await supabase
    .from('contract_area_pricing')
    .select('price_area,price_per_kwh_ore,markup_ore,variable_fee_ore,elcert_ore,monthly_fee_sek')
    .eq('pricing_version_id', sourceVersionId)
    .returns<
      Array<{
        price_area: PriceArea
        price_per_kwh_ore: number | null
        markup_ore: number | null
        variable_fee_ore: number | null
        elcert_ore: number | null
        monthly_fee_sek: number | null
      }>
    >()

  if (oldErr) throw new Error(oldErr.message)

  if (oldRows?.length) {
    const rowsToInsert = oldRows.map((r) => ({
      pricing_version_id: newVersion.id,
      price_area: r.price_area,
      price_per_kwh_ore: r.price_per_kwh_ore,
      markup_ore: r.markup_ore,
      variable_fee_ore: r.variable_fee_ore,
      elcert_ore: r.elcert_ore,
      monthly_fee_sek: r.monthly_fee_sek,
    }))

    const { error } = await supabase.from('contract_area_pricing').insert(rowsToInsert)
    if (error) throw new Error(error.message)
  }

  const { error: aErr } = await supabase.from('pricing_version_audit').insert({
    contract_id: contractId,
    version_id: newVersion.id,
    action: 'clone',
    performed_by: user.id,
    reason,
  })

  if (aErr) throw new Error(aErr.message)

  await logPermissionAudit({
    actorId: user.id,
    action: 'pricing.clone',
    metadata: { contractId, sourceVersionId, newVersion: newVersion.id },
  })

  revalidatePath(`/admin/pricing/${slug}`)
  redirect(`/admin/pricing/${slug}?previewVersionId=${newVersion.id}`)
}