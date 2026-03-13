'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/auth/admin'
import { requireAdminActionAccess } from '@/lib/admin/guards'

type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

type UserRoleRow = {
  role: string
  is_active: boolean | null
}

type ContractInsertResult = {
  id: string
  contract_type: ContractType
}

type ContractTypeLookupRow = {
  contract_type: ContractType
}

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

function toNullableText(value: FormDataEntryValue | null): string | null {
  const out = String(value ?? '').trim()
  return out.length > 0 ? out : null
}

function toNullableInteger(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const parsed = Number(raw)
  if (!Number.isInteger(parsed)) {
    throw new Error('Sort order must be an integer')
  }

  return parsed
}

async function assertAdmin(): Promise<{ userId: string }> {
  try {
    const ctx = await requireAdminActionAccess({
      anyOf: ['contracts.write', 'admin.access'],
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

function revalidateContractPaths() {
  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/admin/contracts')
  revalidatePath('/admin/pricing')
  revalidatePath('/avtal')
  revalidatePath('/teckna')
}

export async function createContract(formData: FormData) {
  const { userId } = await assertAdmin()
  const service = getServiceClient()

  const name = String(formData.get('name') ?? '').trim()
  const slugInput = String(formData.get('slug') ?? '').trim()
  const contractType = String(
    formData.get('contract_type') ?? 'spot_hourly'
  ) as ContractType
  const isActive = formData.get('is_active') ? true : false
  const shortDescription = toNullableText(formData.get('short_description'))
  const badgeText = toNullableText(formData.get('badge_text'))
  const sortOrder = toNullableInteger(formData.get('sort_order'))
  const isFeatured = formData.get('is_featured') ? true : false

  if (!name) throw new Error('Name is required')

  if (!['spot_hourly', 'portfolio_managed', 'fixed'].includes(contractType)) {
    throw new Error('Invalid contract_type')
  }

  const slug = slugInput ? slugify(slugInput) : slugify(name)

  if (!slug) {
    throw new Error('Slug could not be generated')
  }

  const { data: contractRow, error: contractError } = await service
    .from('contract_products')
    .insert({
      name,
      slug,
      contract_type: contractType,
      is_active: isActive,
      created_by: userId,
      short_description: shortDescription,
      badge_text: badgeText,
      sort_order: sortOrder,
      is_featured: isFeatured,
    })
    .select('id,contract_type')
    .single()
    .returns<ContractInsertResult>()

  if (contractError) throw new Error(contractError.message)
  if (!contractRow) throw new Error('Failed to create contract')

  const contractId = contractRow.id

  if (isActive) {
    const { error: deactivateError } = await service
      .from('contract_products')
      .update({ is_active: false })
      .eq('contract_type', contractType)
      .neq('id', contractId)

    if (deactivateError) throw new Error(deactivateError.message)
  }

  const { error: pricingError } = await service
    .from('contract_pricing_versions')
    .insert({
      contract_id: contractId,
      version_number: 1,
      valid_from: new Date().toISOString(),
      is_published: false,
      status: 'draft',
    })

  if (pricingError) throw new Error(pricingError.message)

  revalidateContractPaths()
}

export async function updateContractMetadata(formData: FormData) {
  await assertAdmin()
  const service = getServiceClient()

  const id = String(formData.get('id') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const slugInput = String(formData.get('slug') ?? '').trim()
  const shortDescription = toNullableText(formData.get('short_description'))
  const badgeText = toNullableText(formData.get('badge_text'))
  const sortOrder = toNullableInteger(formData.get('sort_order'))
  const isFeatured = formData.get('is_featured') ? true : false

  if (!id) throw new Error('Missing id')
  if (!name) throw new Error('Name is required')

  const slug = slugify(slugInput || name)
  if (!slug) throw new Error('Slug could not be generated')

  const { error } = await service
    .from('contract_products')
    .update({
      name,
      slug,
      short_description: shortDescription,
      badge_text: badgeText,
      sort_order: sortOrder,
      is_featured: isFeatured,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidateContractPaths()
}

export async function setContractActive(formData: FormData) {
  await assertAdmin()
  const service = getServiceClient()

  const id = String(formData.get('id') ?? '').trim()
  const isActiveStr = String(formData.get('is_active') ?? '').trim()

  if (!id) {
    throw new Error('Missing id')
  }

  const isActive =
    isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : null

  if (isActive === null) {
    throw new Error('Invalid is_active value')
  }

  const { data: contract, error: contractError } = await service
    .from('contract_products')
    .select('contract_type')
    .eq('id', id)
    .maybeSingle<ContractTypeLookupRow>()

  if (contractError) {
    throw new Error(contractError.message)
  }

  if (!contract) {
    throw new Error('Contract not found')
  }

  if (isActive) {
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

  revalidateContractPaths()
}