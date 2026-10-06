//app/admin/pricing/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { supabaseService } from '@/lib/supabase/service'
import { requireAdminActionAccess } from '@/lib/admin/guards'

type PricingVersionRow = {
  id: string
  contract_id: string
  version_number?: number | null
  valid_from: string
  is_published: boolean
  status?: string | null
}

function hasAnyPermission(
  permissions: string[],
  required: string[]
): boolean {
  return required.some((permission) => permissions.includes(permission))
}

export async function publishPricingVersion(
  contractId: string,
  versionId: string
) {
  const ctx = await requireAdminActionAccess({
    anyOf: ['pricing.publish', 'pricing.publish_prod', 'admin.access'],
  })

  const supabase = ctx.supabase

  const isProd =
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production'

  const isAdmin =
    ctx.roles.includes('admin') ||
    ctx.permissions.includes('admin.access')

  const hasPublish = hasAnyPermission(ctx.permissions, [
    'pricing.publish',
    'pricing.publish_prod',
    'admin.access',
  ])

  const hasPublishProd = hasAnyPermission(ctx.permissions, [
    'pricing.publish_prod',
    'admin.access',
  ])

  if (isProd && !isAdmin && !hasPublishProd) {
    throw new Error(
      'Publish not allowed in prod (missing pricing.publish_prod)'
    )
  }

  if (!isAdmin && !hasPublish) {
    throw new Error('Publish not allowed (missing pricing.publish)')
  }

  const { data: version, error: versionError } = await supabase
    .from('contract_pricing_versions')
    .select('id,contract_id,version_number,valid_from,is_published,status')
    .eq('id', versionId)
    .maybeSingle<PricingVersionRow>()

  if (versionError) {
    throw new Error(versionError.message)
  }

  if (!version || version.contract_id !== contractId) {
    throw new Error('Invalid version for contract')
  }

  const { error } = await supabaseService.rpc('gridex_publish_pricing_v1', {
    p_contract_id: contractId, p_version_id: versionId, p_actor: ctx.userId, p_reason: isProd ? 'publish_prod' : 'publish',
  })
  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/admin/pricing')
  revalidatePath(`/admin/pricing`)
  revalidatePath('/')

  revalidatePath('/avtal')
  revalidatePath('/elavtal')
  revalidatePath('/teckna')
  revalidatePath('/teckna-avtal')
  revalidatePath('/kundservice')

  revalidatePath('/elpris')
  revalidatePath('/elpris/se1')
  revalidatePath('/elpris/se2')
  revalidatePath('/elpris/se3')
  revalidatePath('/elpris/se4')
}

export async function unpublishPricingForContract(contractId: string) {
  const ctx = await requireAdminActionAccess({
    anyOf: ['pricing.publish', 'pricing.publish_prod', 'admin.access'],
  })

  const isAdmin =
    ctx.roles.includes('admin') ||
    ctx.permissions.includes('admin.access')

  const hasPublish = hasAnyPermission(ctx.permissions, [
    'pricing.publish',
    'pricing.publish_prod',
    'admin.access',
  ])

  if (!isAdmin && !hasPublish) {
    throw new Error('Unpublish not allowed')
  }

  if ((process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') && !isAdmin && !ctx.permissions.includes('pricing.publish_prod')) throw new Error('Unpublish not allowed in prod (missing pricing.publish_prod)')

  const { error } = await supabaseService.rpc('gridex_publish_pricing_v1', {
    p_contract_id: contractId, p_version_id: null, p_actor: ctx.userId, p_reason: 'manual unpublish',
  })
  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/admin/pricing')
  revalidatePath(`/admin/pricing`)
  revalidatePath('/')

  revalidatePath('/avtal')
  revalidatePath('/elavtal')
  revalidatePath('/teckna')
  revalidatePath('/teckna-avtal')
  revalidatePath('/kundservice')

  revalidatePath('/elpris')
  revalidatePath('/elpris/se1')
  revalidatePath('/elpris/se2')
  revalidatePath('/elpris/se3')
  revalidatePath('/elpris/se4')
}