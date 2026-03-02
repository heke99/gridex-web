// app/admin/pricing/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole, assertCanPublish } from '@/lib/auth/admin'

type PricingVersionRow = {
  id: string
  contract_id: string
  version_number: number
  valid_from: string
  is_published: boolean
  status?: string | null
}

export async function publishPricingVersion(contractId: string, versionId: string) {
  const supabase = await createSupabaseServerClient()

  const { user, role } = await requireAdminRole(supabase)
  assertCanPublish(role)

  // Säkerhetsvalidering: versionen måste tillhöra kontraktet
  const { data: version, error: vErr } = await supabase
    .from('contract_pricing_versions')
    .select('id, contract_id, valid_from, is_published, status')
    .eq('id', versionId)
    .maybeSingle<PricingVersionRow>()

  if (vErr) throw new Error(vErr.message)
  if (!version || version.contract_id !== contractId) {
    throw new Error('Invalid version for contract')
  }

  // 1) Unpublish alla versioner för kontraktet (fail-safe)
  const { error: offErr } = await supabase
    .from('contract_pricing_versions')
    .update({ is_published: false, status: 'draft' })
    .eq('contract_id', contractId)

  if (offErr) throw new Error(offErr.message)

  // 2) Publish vald version
  const { error: onErr } = await supabase
    .from('contract_pricing_versions')
    .update({ is_published: true, status: 'published' })
    .eq('id', versionId)
    .eq('contract_id', contractId)

  if (onErr) throw new Error(onErr.message)

  // 3) Audit log (publish)
  const { error: aErr } = await supabase.from('pricing_version_audit').insert({
    contract_id: contractId,
    version_id: versionId,
    action: 'publish',
    performed_by: user.id,
    reason: 'legacy publish',
  })

  if (aErr) throw new Error(aErr.message)

  // 4) Revalidate (admin + publikt)
  revalidatePath('/admin')
  revalidatePath('/admin/pricing')

  // Publika ytor som använder publish-version
  revalidatePath('/') // Hero
  revalidatePath('/avtal')
  revalidatePath('/teckna')
  revalidatePath('/kundservice')

  // Kalkylator / programmatic SEO (om du har dem)
  revalidatePath('/elpris')
  revalidatePath('/elpris/se1')
  revalidatePath('/elpris/se2')
  revalidatePath('/elpris/se3')
  revalidatePath('/elpris/se4')
}

export async function unpublishPricingForContract(contractId: string) {
  const supabase = await createSupabaseServerClient()

  const { user, role } = await requireAdminRole(supabase)
  assertCanPublish(role)

  // hitta published version för audit
  const { data: active, error: a1Err } = await supabase
    .from('contract_pricing_versions')
    .select('id')
    .eq('contract_id', contractId)
    .or('status.eq.published,is_published.eq.true')
    .maybeSingle<{ id: string }>()

  if (a1Err) throw new Error(a1Err.message)

  const { error: offErr } = await supabase
    .from('contract_pricing_versions')
    .update({ is_published: false, status: 'draft' })
    .eq('contract_id', contractId)
    .or('status.eq.published,is_published.eq.true')

  if (offErr) throw new Error(offErr.message)

  // audit: om det fanns en aktiv version logga vilken som blev avpublicerad
  if (active?.id) {
    const { error: aErr } = await supabase.from('pricing_version_audit').insert({
      contract_id: contractId,
      version_id: active.id,
      action: 'unpublish',
      performed_by: user.id,
      reason: 'legacy unpublish',
    })
    if (aErr) throw new Error(aErr.message)
  }

  revalidatePath('/admin')
  revalidatePath('/admin/pricing')

  // Publika ytor
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