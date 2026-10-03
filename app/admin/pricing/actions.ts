//app/admin/pricing/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireGlobalAdminActionAccess } from '@/lib/admin/guards'
import { pricingPublishRule } from '@/lib/admin/access'
import { supabaseService } from '@/lib/supabase/service'

export async function publishPricingVersion(
  contractId: string,
  versionId: string
) {
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
  const ctx = await requireGlobalAdminActionAccess(pricingPublishRule(isProd))
  const { error } = await supabaseService.rpc('gridex_web_publish_pricing', {
    p_contract_id: contractId, p_version_id: versionId, p_actor_id: ctx.userId,
    p_reason: isProd ? 'publish_prod' : 'publish',
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
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
  const ctx = await requireGlobalAdminActionAccess(pricingPublishRule(isProd))
  const { error } = await supabaseService.rpc('gridex_web_publish_pricing', {
    p_contract_id: contractId, p_version_id: null, p_actor_id: ctx.userId, p_reason: 'manual unpublish',
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