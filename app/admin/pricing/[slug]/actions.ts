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
      'gridex_my_has_permission_v1',
      {
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
  revalidatePath('/elavtal')
  revalidatePath('/teckna')
  revalidatePath('/teckna-avtal')
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

  const { error } = await service.rpc('gridex_create_pricing_version_v1', {
    p_contract_id: contractId, p_actor: userId, p_valid_from: validFrom.slice(0,10), p_reason: 'Create draft',
  })
  if (error) throw new Error(error.message)

  revalidatePricingPaths(slug ?? contract.slug)
}

export async function savePricingAction(formData: FormData) {
  const { userId } = await assertAdmin()
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

  const { error } = await service.rpc('gridex_save_pricing_rows_v1', {
    p_version_id: pricingVersionId, p_actor: userId, p_rows: rows,
  })
  if (error) throw new Error(error.message)

  revalidatePricingPaths(slug)
}

export async function publishVersionAction(formData: FormData) {
  const { userId } = await assertAdmin()
  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    const supabase = await createSupabaseServerClient()
    const { data: canPublish, error } = await supabase.rpc('gridex_my_has_permission_v1', { p_permission: 'pricing.publish_prod' })
    const { data: canAdmin, error: adminError } = await supabase.rpc('gridex_my_has_permission_v1', { p_permission: 'admin.access' })
    const legacy = await requireAdminRole(supabase).catch(() => null)
    if (legacy?.role !== 'admin' && (error || adminError || (canPublish !== true && canAdmin !== true))) throw new Error('Publish not allowed in prod')
  }
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

  const { error } = await service.rpc('gridex_publish_pricing_v1', {
    p_contract_id: contractId, p_version_id: versionId, p_actor: userId, p_reason: reason,
  })
  if (error) throw new Error(error.message)

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

  const { error } = await service.rpc('gridex_create_pricing_version_v1', {
    p_contract_id: contractId, p_actor: userId, p_valid_from: null, p_source_id: sourceVersionId, p_reason: reason,
  })
  if (error) throw new Error(error.message)

  revalidatePricingPaths(slug ?? contract.slug)
}