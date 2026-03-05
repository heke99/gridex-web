'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminActionAccess } from '@/lib/admin/guards'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type PricingVersionRow = {
  id: string
  contract_id: string
  version_number: number
  valid_from: string
  is_published: boolean
  status?: string | null
}

export async function publishPricingVersion(contractId: string, versionId: string) {
  const ctx = await requireAdminActionAccess({
    anyOf: ['pricing.publish', 'pricing.publish_prod'],
  })

  const supabase = ctx.supabase

  // --------------------------------------------------
  // Enterprise RBAC compatibility layer
  // --------------------------------------------------
  const legacy = {
    allowed: ctx.isAdmin || ctx.permissions.includes('admin.access'),
    role: ctx.roles.includes('admin') ? 'admin' : 'user',
  }

  const isLegacyAdmin = legacy.allowed && legacy.role === 'admin'

  const isProd =
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production'

  const hasPublish =
    ctx.permissions.includes('pricing.publish') ||
    ctx.permissions.includes('pricing.publish_prod')

  const hasPublishProd =
    ctx.permissions.includes('pricing.publish_prod')

  if (isProd && !isLegacyAdmin && !hasPublishProd) {
    throw new Error('Publish not allowed in prod (missing pricing.publish_prod)')
  }

  if (!isLegacyAdmin && !hasPublish) {
    throw new Error('Publish not allowed (missing pricing.publish)')
  }

  // Validate version belongs to contract
  const { data: version, error: vErr } = await supabase
    .from('contract_pricing_versions')
    .select('id, contract_id, valid_from, is_published, status')
    .eq('id', versionId)
    .maybeSingle<PricingVersionRow>()

  if (vErr) throw new Error(vErr.message)

  if (!version || version.contract_id !== contractId) {
    throw new Error('Invalid version for contract')
  }

  // Unpublish all versions
  const { error: offErr } = await supabase
    .from('contract_pricing_versions')
    .update({ is_published: false, status: 'draft' })
    .eq('contract_id', contractId)

  if (offErr) throw new Error(offErr.message)

  // Publish selected version
  const { error: onErr } = await supabase
    .from('contract_pricing_versions')
    .update({ is_published: true, status: 'published' })
    .eq('id', versionId)
    .eq('contract_id', contractId)

  if (onErr) throw new Error(onErr.message)

  // Audit
  const { error: aErr } = await supabase.from('pricing_version_audit').insert({
    contract_id: contractId,
    version_id: versionId,
    action: 'publish',
    performed_by: ctx.userId,
    reason: isProd ? 'publish_prod' : 'publish',
  })

  if (aErr) throw new Error(aErr.message)

  // Revalidate admin
  revalidatePath('/admin')
  revalidatePath('/admin/pricing')

  // Revalidate public
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
    anyOf: ['pricing.publish', 'pricing.publish_prod'],
  })

  const supabase = ctx.supabase

  // --------------------------------------------------
  // Enterprise RBAC compatibility layer
  // --------------------------------------------------
  const legacy = {
    allowed: ctx.isAdmin || ctx.permissions.includes('admin.access'),
    role: ctx.roles.includes('admin') ? 'admin' : 'user',
  }

  const isLegacyAdmin = legacy.allowed && legacy.role === 'admin'

  const hasPublish =
    ctx.permissions.includes('pricing.publish') ||
    ctx.permissions.includes('pricing.publish_prod')

  if (!isLegacyAdmin && !hasPublish) {
    throw new Error('Unpublish not allowed')
  }

  // find active version
  const { data: active, error: a1Err } = await supabase
    .from('contract_pricing_versions')
    .select('id')
    .eq('contract_id', contractId)
    .or('status.eq.published,is_published.eq.true')
    .maybeSingle<{ id: string }>()

  if (a1Err) throw new Error(a1Err.message)

  // unpublish
  const { error: offErr } = await supabase
    .from('contract_pricing_versions')
    .update({ is_published: false, status: 'draft' })
    .eq('contract_id', contractId)
    .or('status.eq.published,is_published.eq.true')

  if (offErr) throw new Error(offErr.message)

  // audit
  if (active?.id) {
    const { error: aErr } = await supabase.from('pricing_version_audit').insert({
      contract_id: contractId,
      version_id: active.id,
      action: 'unpublish',
      performed_by: ctx.userId,
      reason: 'manual unpublish',
    })

    if (aErr) throw new Error(aErr.message)
  }

  revalidatePath('/admin')
  revalidatePath('/admin/pricing')

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