'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/auth/admin'

type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

type UserRoleRow = {
  role: string
  is_active: boolean | null
}

type ContractInsertResult = {
  id: string
  contract_type: ContractType
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL')
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

/**
 * Enterprise admin check
 * - Prefer permission admin.access (RBAC)
 * - Fallback to legacy admin_users + user_roles
 */
async function assertAdmin(): Promise<{ userId: string }> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr) throw new Error(userErr.message)
  if (!user) throw new Error('Not authenticated')

  // New: permission-based
  const { data: hasPerm } = await supabase.rpc('gridex_has_permission', {
    p_user_id: user.id,
    p_permission: 'admin.access',
  })

  if (hasPerm === true) {
    return { userId: user.id }
  }

  // Legacy: admin_users
  try {
    await requireAdminRole(supabase)
    return { userId: user.id }
  } catch {}

  // Extra fallback: user_roles
  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role,is_active')
    .eq('user_id', user.id)
    .returns<UserRoleRow[]>()

  const roleNames =
    roleRows
      ?.filter((r) => r.is_active !== false)
      .map((r) => r.role) ?? []

  const isAdmin = roleNames.includes('admin') || roleNames.includes('super_admin')
  if (!isAdmin) throw new Error('Unauthorized')

  return { userId: user.id }
}

/**
 * Create contract + auto draft pricing version
 * Ensures:
 * - contract_products row
 * - draft contract_pricing_versions row (is_published=false)
 * - optional: enforce one active per contract_type (via update)
 */
export async function createContract(formData: FormData) {
  const { userId } = await assertAdmin()
  const service = getServiceClient()

  const name = String(formData.get('name') ?? '').trim()
  const slugInput = String(formData.get('slug') ?? '').trim()
  const contractType = String(formData.get('contract_type') ?? 'spot_hourly') as ContractType
  const isActive = formData.get('is_active') ? true : false

  if (!name) throw new Error('Name is required')

  const slug = slugInput ? slugify(slugInput) : slugify(name)
  if (!slug) throw new Error('Slug could not be generated')

  // 1) Insert contract
  const { data: contractRow, error: contractError } = await service
    .from('contract_products')
    .insert({
      name,
      slug,
      contract_type: contractType,
      is_active: isActive,
      created_by: userId,
    })
    .select('id, contract_type')
    .single()
    .returns<ContractInsertResult>()

  if (contractError) throw new Error(contractError.message)
  if (!contractRow) throw new Error('Failed to create contract')

  const contractId = contractRow.id

  // 2) Enforce only one active per type (business rule)
  if (isActive) {
    const { error: deactivateError } = await service
      .from('contract_products')
      .update({ is_active: false })
      .eq('contract_type', contractType)
      .neq('id', contractId)

    if (deactivateError) throw new Error(deactivateError.message)
  }

  // 3) Create initial draft pricing version (NOW as valid_from, unpublished)
  // NOTE: contract_pricing_versions is keyed by contract_id (NOT contract_product_id)
  const { error: pricingError } = await service
    .from('contract_pricing_versions')
    .insert({
      contract_id: contractId,
      version_number: 1,
      valid_from: new Date().toISOString(),
      is_published: false,
    })

  if (pricingError) throw new Error(pricingError.message)

  // 4) Revalidate admin + public routes that depend on contracts/pricing
  revalidatePath('/admin/contracts')
  revalidatePath('/admin/pricing')
  revalidatePath('/avtal')
  revalidatePath('/teckna')
}

/**
 * Toggle active state
 * Ensures only one active per type
 */
export async function setContractActive(formData: FormData) {
  await assertAdmin()
  const service = getServiceClient()

  const id = String(formData.get('id') ?? '').trim()
  const isActiveStr = String(formData.get('is_active') ?? '').trim()

  if (!id) throw new Error('Missing id')

  const isActive =
    isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : null

  if (isActive === null) throw new Error('Invalid is_active value')

  // Get contract type
  const { data: contract } = await service
    .from('contract_products')
    .select('contract_type')
    .eq('id', id)
    .single()

  if (!contract) throw new Error('Contract not found')

  if (isActive) {
    // deactivate others of same type
    const { error: deactivateError } = await service
      .from('contract_products')
      .update({ is_active: false })
      .eq('contract_type', contract.contract_type)
      .neq('id', id)

    if (deactivateError) throw new Error(deactivateError.message)
  }

  const { error } = await service
    .from('contract_products')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/contracts')
  revalidatePath('/admin/pricing')
  revalidatePath('/avtal')
  revalidatePath('/teckna')
}