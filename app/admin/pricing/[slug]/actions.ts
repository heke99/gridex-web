'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/auth/admin'
import { requireAdminActionAccess } from '@/lib/admin/guards'

type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'
type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'

type UserRoleRow = {
  role: string
  is_active: boolean | null
}

type ContractLookupRow = {
  id: string
  slug: string
  contract_type: ContractType
}

type VersionLookupRow = {
  id: string
  contract_id: string
  version_number: number
  valid_from: string
  is_published: boolean | null
  status?: string | null
}

const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL'
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

function normalizeDateInput(value: string): string {
  const v = value.trim()
  if (!v) throw new Error('valid_from is required')

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return `${v}T00:00:00.000Z`
  }

  const d = new Date(v)
  if (!Number.isFinite(d.getTime())) {
    throw new Error('Invalid valid_from date')
  }

  return d.toISOString()
}

function parseNumberField(
  formData: FormData,
  key: string,
  fallback = 0
): number {
  const raw = String(formData.get(key) ?? '').trim()
  if (!raw) return fallback

  const normalized = raw.replace(',', '.')
  const parsed = Number(normalized)

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${key}`)
  }

  return parsed
}

async function assertAdmin(): Promise<{ userId: string }> {
  try {
    const ctx = await requireAdminActionAccess({
      anyOf: [
        'pricing.write',
        'pricing.publish',
        'pricing.publish_prod',
        'admin.access',
      ],
    })

    return { userId: ctx.userId }
  } catch {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr) throw new Error(userErr.message)
    if (!user) throw new Error('Not authenticated')

    const { data: hasPerm, error: permError } = await supabase.rpc(
      'gridex_has_permission',
      {
        p_user_id: user.id,
        p_permission: 'admin.access',
      }
    )

    if (permError) {
      throw new Error(permError.message)
    }

    if (hasPerm === true) {
      return { userId: user.id }
    }

    try {
      await requireAdminRole(supabase)
      return { userId: user.id }
    } catch {}

    const { data: roleRows, error: roleError } = await supabase
      .from('user_roles')
      .select('role,is_active')
      .eq('user_id', user.id)
      .returns<UserRoleRow[]>()

    if (roleError) {
      throw new Error(roleError.message)
    }

    const roleNames =
      roleRows
        ?.filter((row) => row.is_active !== false)
        .map((row) => row.role) ?? []

    const isAdmin =
      roleNames.includes('admin') || roleNames.includes('super_admin')

    if (!isAdmin) {
      throw new Error('Unauthorized')
    }

    return { userId: user.id }
  }
}

function revalidatePricingPaths(slug?: string | null) {
  revalidatePath('/')
  revalidatePath('/avtal')
  revalidatePath('/teckna')
  revalidatePath('/admin')
  revalidatePath('/admin/pricing')
  revalidatePath('/admin/contracts')
  revalidatePath('/kundservice')
  revalidatePath('/elpris')
  revalidatePath('/elpris/se1')
  revalidatePath('/elpris/se2')
  revalidatePath('/elpris/se3')
  revalidatePath('/elpris/se4')

  if (slug) {
    revalidatePath(`/admin/pricing/${slug}`)
  }
}

async function getContractOrThrow(
  service: ReturnType<typeof getServiceClient>,
  contractId: string
): Promise<ContractLookupRow> {
  const { data, error } = await service
    .from('contract_products')
    .select('id,slug,contract_type')
    .eq('id', contractId)
    .maybeSingle<ContractLookupRow>()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Contract not found')

  return data
}

async function getVersionOrThrow(
  service: ReturnType<typeof getServiceClient>,
  versionId: string
): Promise<VersionLookupRow> {
  const { data, error } = await service
    .from('contract_pricing_versions')
    .select('id,contract_id,version_number,valid_from,is_published,status')
    .eq('id', versionId)
    .maybeSingle<VersionLookupRow>()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Version not found')

  return data
}

export async function createVersionAction(formData: FormData) {
  const { userId } = await assertAdmin()
  const service = getServiceClient()

  const contractId = String(formData.get('contract_id') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim() || null
  const validFrom = normalizeDateInput(String(formData.get('valid_from') ?? ''))

  if (!contractId) throw new Error('contract_id is required')

  const contract = await getContractOrThrow(service, contractId)

  const { data: latestVersion, error: latestError } = await service
    .from('contract_pricing_versions')
    .select('version_number')
    .eq('contract_id', contractId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle<{ version_number: number }>()

  if (latestError) throw new Error(latestError.message)

  const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1

  const { error: insertError } = await service
    .from('contract_pricing_versions')
    .insert({
      contract_id: contractId,
      version_number: nextVersionNumber,
      valid_from: validFrom,
      is_published: false,
      status: 'draft',
      created_by: userId,
    })

  if (insertError) throw new Error(insertError.message)

  revalidatePricingPaths(slug ?? contract.slug)
}

export async function savePricingAction(formData: FormData) {
  await assertAdmin()
  const service = getServiceClient()

  const pricingVersionId = String(formData.get('pricing_version_id') ?? '').trim()
  const contractType = String(formData.get('contract_type') ?? '').trim() as ContractType
  const slug = String(formData.get('slug') ?? '').trim() || null

  if (!pricingVersionId) throw new Error('pricing_version_id is required')

  if (!['spot_hourly', 'portfolio_managed', 'fixed'].includes(contractType)) {
    throw new Error('Invalid contract_type')
  }

  const rows = AREAS.map((area) => {
    const common = {
      pricing_version_id: pricingVersionId,
      price_area: area,
      variable_fee_ore: parseNumberField(formData, `${area}_variable_fee_ore`, 0),
      elcert_ore: parseNumberField(formData, `${area}_elcert_ore`, 0),
      monthly_fee_sek: parseNumberField(formData, `${area}_monthly_fee_sek`, 0),
    }

    if (contractType === 'spot_hourly') {
      return {
        ...common,
        price_per_kwh_ore: 0,
        markup_ore: parseNumberField(formData, `${area}_markup_ore`, 0),
      }
    }

    return {
      ...common,
      price_per_kwh_ore: parseNumberField(
        formData,
        `${area}_price_per_kwh_ore`,
        0
      ),
      markup_ore: 0,
    }
  })

  const { error: deleteError } = await service
    .from('contract_area_pricing')
    .delete()
    .eq('pricing_version_id', pricingVersionId)

  if (deleteError) throw new Error(deleteError.message)

  const { error: insertError } = await service
    .from('contract_area_pricing')
    .insert(rows)

  if (insertError) throw new Error(insertError.message)

  revalidatePricingPaths(slug)
}

export async function publishVersionAction(formData: FormData) {
  const { userId } = await assertAdmin()
  const service = getServiceClient()

  const contractId = String(formData.get('contract_id') ?? '').trim()
  const versionId = String(formData.get('version_id') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim() || null

  if (!contractId) throw new Error('contract_id is required')
  if (!versionId) throw new Error('version_id is required')
  if (!reason) throw new Error('reason is required')

  const contract = await getContractOrThrow(service, contractId)
  const version = await getVersionOrThrow(service, versionId)

  if (version.contract_id !== contractId) {
    throw new Error('Version does not belong to contract')
  }

  const { error: unpublishError } = await service
    .from('contract_pricing_versions')
    .update({
      is_published: false,
      status: 'draft',
      published_at: null,
      published_by: null,
    })
    .eq('contract_id', contractId)
    .or('is_published.eq.true,status.eq.published')

  if (unpublishError) throw new Error(unpublishError.message)

  const { error: publishError } = await service
    .from('contract_pricing_versions')
    .update({
      is_published: true,
      status: 'published',
      published_at: new Date().toISOString(),
      published_by: userId,
    })
    .eq('id', versionId)

  if (publishError) throw new Error(publishError.message)

  const { error: auditError } = await service
    .from('pricing_version_audit')
    .insert({
      contract_id: contractId,
      version_id: versionId,
      action: 'publish',
      reason,
      performed_by: userId,
      performed_at: new Date().toISOString(),
    })

  if (auditError) {
    const fallbackAudit = await service.from('pricing_version_audit').insert({
      contract_id: contractId,
      version_id: versionId,
      reason,
      performed_by: userId,
      performed_at: new Date().toISOString(),
    })

    if (fallbackAudit.error) throw new Error(fallbackAudit.error.message)
  }

  revalidatePricingPaths(slug ?? contract.slug)
}

export async function cloneVersionAction(formData: FormData) {
  const { userId } = await assertAdmin()
  const service = getServiceClient()

  const contractId = String(formData.get('contract_id') ?? '').trim()
  const sourceVersionId = String(formData.get('source_version_id') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim() || null

  if (!contractId) throw new Error('contract_id is required')
  if (!sourceVersionId) throw new Error('source_version_id is required')
  if (!reason) throw new Error('reason is required')

  const contract = await getContractOrThrow(service, contractId)
  const sourceVersion = await getVersionOrThrow(service, sourceVersionId)

  if (sourceVersion.contract_id !== contractId) {
    throw new Error('Source version does not belong to contract')
  }

  const { data: latestVersion, error: latestError } = await service
    .from('contract_pricing_versions')
    .select('version_number')
    .eq('contract_id', contractId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle<{ version_number: number }>()

  if (latestError) throw new Error(latestError.message)

  const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1

  const { data: createdVersion, error: createError } = await service
    .from('contract_pricing_versions')
    .insert({
      contract_id: contractId,
      version_number: nextVersionNumber,
      valid_from: sourceVersion.valid_from,
      is_published: false,
      status: 'draft',
      created_by: userId,
    })
    .select('id')
    .single<{ id: string }>()

  if (createError) throw new Error(createError.message)
  if (!createdVersion) throw new Error('Failed to create cloned version')

  const { data: sourceRows, error: sourceRowsError } = await service
    .from('contract_area_pricing')
    .select(
      'price_area,price_per_kwh_ore,markup_ore,variable_fee_ore,elcert_ore,monthly_fee_sek'
    )
    .eq('pricing_version_id', sourceVersionId)

  if (sourceRowsError) throw new Error(sourceRowsError.message)

  if ((sourceRows ?? []).length > 0) {
    const clonedRows = (sourceRows ?? []).map((row) => ({
      pricing_version_id: createdVersion.id,
      price_area: row.price_area,
      price_per_kwh_ore: row.price_per_kwh_ore ?? 0,
      markup_ore: row.markup_ore ?? 0,
      variable_fee_ore: row.variable_fee_ore ?? 0,
      elcert_ore: row.elcert_ore ?? 0,
      monthly_fee_sek: row.monthly_fee_sek ?? 0,
    }))

    const { error: insertRowsError } = await service
      .from('contract_area_pricing')
      .insert(clonedRows)

    if (insertRowsError) throw new Error(insertRowsError.message)
  }

  const { error: auditError } = await service
    .from('pricing_version_audit')
    .insert({
      contract_id: contractId,
      version_id: createdVersion.id,
      action: 'clone',
      reason,
      performed_by: userId,
      performed_at: new Date().toISOString(),
    })

  if (auditError) {
    const fallbackAudit = await service.from('pricing_version_audit').insert({
      contract_id: contractId,
      version_id: createdVersion.id,
      reason,
      performed_by: userId,
      performed_at: new Date().toISOString(),
    })

    if (fallbackAudit.error) throw new Error(fallbackAudit.error.message)
  }

  revalidatePricingPaths(slug ?? contract.slug)
}