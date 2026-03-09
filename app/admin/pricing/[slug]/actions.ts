'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePermissionServer } from '@/lib/auth/requirePermissionServer'
import { logPermissionAudit } from '@/lib/auth/audit'

const AREAS = ['SE1', 'SE2', 'SE3', 'SE4'] as const
type PriceArea = (typeof AREAS)[number]
type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

type VersionNumberRow = {
  version_number: number
}

type InsertedVersionRow = {
  id: string
}

type VersionOwnershipRow = {
  id: string
  contract_id: string
}

type AreaPricingCloneRow = {
  price_area: PriceArea
  price_per_kwh_ore: number | null
  markup_ore: number | null
  variable_fee_ore: number | null
  elcert_ore: number | null
  monthly_fee_sek: number | null
}

function isoFromDateInput(dateStr: string): string {
  const value = (dateStr || '').trim()

  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
    throw new Error('Invalid valid_from date')
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid valid_from date')
  }

  return date.toISOString()
}

function num(value: FormDataEntryValue | null): number {
  if (!value) return 0
  const cleaned = String(value).replace(',', '.').trim()
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

function assertContractType(value: string): ContractType {
  if (value === 'spot_hourly' || value === 'portfolio_managed' || value === 'fixed') {
    return value
  }
  throw new Error('Invalid contract_type')
}

export async function createVersionAction(formData: FormData) {
  const contractId = String(formData.get('contract_id') || '').trim()
  const slug = String(formData.get('slug') || '').trim()
  const validFrom = isoFromDateInput(String(formData.get('valid_from') || ''))

  if (!contractId) throw new Error('Missing contract_id')
  if (!slug) throw new Error('Missing slug')

  const { supabase, user } = await requirePermissionServer('pricing.write')

  const { data: latest, error: latestError } = await supabase
    .from('contract_pricing_versions')
    .select('version_number')
    .eq('contract_id', contractId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle<VersionNumberRow>()

  if (latestError) throw new Error(latestError.message)

  const nextVersion = (latest?.version_number ?? 0) + 1

  const { data: inserted, error: insertError } = await supabase
    .from('contract_pricing_versions')
    .insert({
      contract_id: contractId,
      version_number: nextVersion,
      valid_from: validFrom,
      is_published: false,
      status: 'draft',
    })
    .select('id')
    .single<InsertedVersionRow>()

  if (insertError) throw new Error(insertError.message)
  if (!inserted) throw new Error('Failed to create version')

  await logPermissionAudit({
    actorId: user.id,
    action: 'pricing.version.create',
    metadata: {
      contractId,
      nextVersion,
      validFrom,
      versionId: inserted.id,
    },
  }).catch(() => null)

  revalidatePath('/admin')
  revalidatePath('/admin/contracts')
  revalidatePath('/admin/pricing')
  revalidatePath(`/admin/pricing/${slug}`)

  redirect(`/admin/pricing/${slug}?previewVersionId=${inserted.id}`)
}

export async function savePricingAction(formData: FormData) {
  const pricingVersionId = String(formData.get('pricing_version_id') || '').trim()
  const contractType = assertContractType(String(formData.get('contract_type') || '').trim())
  const slug = String(formData.get('slug') || '').trim()

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
  }).catch(() => null)

  revalidatePath('/admin')
  revalidatePath('/admin/pricing')
  revalidatePath(`/admin/pricing/${slug}`)

  redirect(`/admin/pricing/${slug}?previewVersionId=${pricingVersionId}`)
}

export async function publishVersionAction(formData: FormData) {
  const contractId = String(formData.get('contract_id') || '').trim()
  const versionId = String(formData.get('version_id') || '').trim()
  const slug = String(formData.get('slug') || '').trim()
  const reason = String(formData.get('reason') || '').trim()

  if (!contractId) throw new Error('Missing contract_id')
  if (!versionId) throw new Error('Missing version_id')
  if (!slug) throw new Error('Missing slug')
  if (!reason) throw new Error('Audit reason required')

  const { supabase, user } = await requirePermissionServer('pricing.publish')

  const { data: version, error: versionError } = await supabase
    .from('contract_pricing_versions')
    .select('id,contract_id')
    .eq('id', versionId)
    .maybeSingle<VersionOwnershipRow>()

  if (versionError) throw new Error(versionError.message)
  if (!version || version.contract_id !== contractId) {
    throw new Error('Invalid version for contract')
  }

  const { error: unpublishError } = await supabase
    .from('contract_pricing_versions')
    .update({ is_published: false, status: 'draft' })
    .eq('contract_id', contractId)

  if (unpublishError) throw new Error(unpublishError.message)

  const { error: publishError } = await supabase
    .from('contract_pricing_versions')
    .update({ is_published: true, status: 'published' })
    .eq('id', versionId)
    .eq('contract_id', contractId)

  if (publishError) throw new Error(publishError.message)

  const { error: auditError } = await supabase.from('pricing_version_audit').insert({
    contract_id: contractId,
    version_id: versionId,
    action: 'publish',
    performed_by: user.id,
    reason,
  })

  if (auditError) throw new Error(auditError.message)

  await logPermissionAudit({
    actorId: user.id,
    action: 'pricing.publish',
    metadata: { contractId, versionId, reason },
  }).catch(() => null)

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
  const contractId = String(formData.get('contract_id') || '').trim()
  const sourceVersionId = String(formData.get('source_version_id') || '').trim()
  const slug = String(formData.get('slug') || '').trim()
  const reason = String(formData.get('reason') || '').trim()

  if (!contractId) throw new Error('Missing contract_id')
  if (!sourceVersionId) throw new Error('Missing source_version_id')
  if (!slug) throw new Error('Missing slug')
  if (!reason) throw new Error('Audit reason required')

  const { supabase, user } = await requirePermissionServer('pricing.write')

  const { data: latest, error: latestError } = await supabase
    .from('contract_pricing_versions')
    .select('version_number')
    .eq('contract_id', contractId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle<VersionNumberRow>()

  if (latestError) throw new Error(latestError.message)

  const nextVersion = (latest?.version_number ?? 0) + 1

  const { data: newVersion, error: newVersionError } = await supabase
    .from('contract_pricing_versions')
    .insert({
      contract_id: contractId,
      version_number: nextVersion,
      valid_from: new Date().toISOString(),
      is_published: false,
      status: 'draft',
    })
    .select('id')
    .single<InsertedVersionRow>()

  if (newVersionError) throw new Error(newVersionError.message)
  if (!newVersion) throw new Error('Failed to clone version')

  const { data: oldRows, error: oldRowsError } = await supabase
    .from('contract_area_pricing')
    .select(
      'price_area,price_per_kwh_ore,markup_ore,variable_fee_ore,elcert_ore,monthly_fee_sek'
    )
    .eq('pricing_version_id', sourceVersionId)
    .returns<AreaPricingCloneRow[]>()

  if (oldRowsError) throw new Error(oldRowsError.message)

  if (oldRows?.length) {
    const rowsToInsert = oldRows.map((row) => ({
      pricing_version_id: newVersion.id,
      price_area: row.price_area,
      price_per_kwh_ore: row.price_per_kwh_ore,
      markup_ore: row.markup_ore,
      variable_fee_ore: row.variable_fee_ore,
      elcert_ore: row.elcert_ore,
      monthly_fee_sek: row.monthly_fee_sek,
    }))

    const { error } = await supabase
      .from('contract_area_pricing')
      .insert(rowsToInsert)

    if (error) throw new Error(error.message)
  }

  const { error: auditError } = await supabase.from('pricing_version_audit').insert({
    contract_id: contractId,
    version_id: newVersion.id,
    action: 'clone',
    performed_by: user.id,
    reason,
  })

  if (auditError) throw new Error(auditError.message)

  await logPermissionAudit({
    actorId: user.id,
    action: 'pricing.clone',
    metadata: {
      contractId,
      sourceVersionId,
      newVersionId: newVersion.id,
      reason,
    },
  }).catch(() => null)

  revalidatePath('/admin')
  revalidatePath('/admin/pricing')
  revalidatePath(`/admin/pricing/${slug}`)

  redirect(`/admin/pricing/${slug}?previewVersionId=${newVersion.id}`)
}