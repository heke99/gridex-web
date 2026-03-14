//app/admin/pricing/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
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
    ctx.isAdmin ||
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

  const { error: unpublishError } = await supabase
    .from('contract_pricing_versions')
    .update({
      is_published: false,
      status: 'draft',
    })
    .eq('contract_id', contractId)

  if (unpublishError) {
    throw new Error(unpublishError.message)
  }

  const { error: publishError } = await supabase
    .from('contract_pricing_versions')
    .update({
      is_published: true,
      status: 'published',
    })
    .eq('id', versionId)
    .eq('contract_id', contractId)

  if (publishError) {
    throw new Error(publishError.message)
  }

  const { error: auditError } = await supabase
    .from('pricing_version_audit')
    .insert({
      contract_id: contractId,
      version_id: versionId,
      action: 'publish',
      performed_by: ctx.userId,
      reason: isProd ? 'publish_prod' : 'publish',
    })

  if (auditError) {
    throw new Error(auditError.message)
  }

  revalidatePath('/admin')
  revalidatePath('/admin/pricing')
  revalidatePath(`/admin/pricing`)
  revalidatePath('/')

  revalidatePath('/avtal')
  revalidatePath('/teckna')
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

  const supabase = ctx.supabase

  const isAdmin =
    ctx.isAdmin ||
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

  const { data: activeVersions, error: activeError } = await supabase
    .from('contract_pricing_versions')
    .select('id,contract_id,version_number,valid_from,is_published,status')
    .eq('contract_id', contractId)
    .or('status.eq.published,is_published.eq.true')
    .order('valid_from', { ascending: false })
    .returns<PricingVersionRow[]>()

  if (activeError) {
    throw new Error(activeError.message)
  }

  const active = (activeVersions ?? [])[0] ?? null

  const { error: unpublishError } = await supabase
    .from('contract_pricing_versions')
    .update({
      is_published: false,
      status: 'draft',
    })
    .eq('contract_id', contractId)
    .or('status.eq.published,is_published.eq.true')

  if (unpublishError) {
    throw new Error(unpublishError.message)
  }

  if (active?.id) {
    const { error: auditError } = await supabase
      .from('pricing_version_audit')
      .insert({
        contract_id: contractId,
        version_id: active.id,
        action: 'unpublish',
        performed_by: ctx.userId,
        reason: 'manual unpublish',
      })

    if (auditError) {
      throw new Error(auditError.message)
    }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/pricing')
  revalidatePath(`/admin/pricing`)
  revalidatePath('/')

  revalidatePath('/avtal')
  revalidatePath('/teckna')
  revalidatePath('/kundservice')

  revalidatePath('/elpris')
  revalidatePath('/elpris/se1')
  revalidatePath('/elpris/se2')
  revalidatePath('/elpris/se3')
  revalidatePath('/elpris/se4')
}