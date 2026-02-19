// app/admin/pricing/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole, assertCanPublish } from '@/lib/auth/admin'

export async function publishPricingVersion(contractId: string, versionId: string) {
  const supabase = await createSupabaseServerClient()

  const { user, role } = await requireAdminRole(supabase)
  assertCanPublish(role)

  // 1) Unpublish alla versioner för kontraktet (fail-safe)
  const { error: offErr } = await supabase
    .from('contract_pricing_versions')
    .update({ is_active: false })
    .eq('contract_id', contractId)

  if (offErr) throw new Error(offErr.message)

  // 2) Publicera vald version
  const { error: onErr } = await supabase
    .from('contract_pricing_versions')
    .update({ is_active: true })
    .eq('id', versionId)
    .eq('contract_id', contractId)

  if (onErr) throw new Error(onErr.message)

  // 3) Audit log (publish)
  const { error: aErr } = await supabase.from('pricing_version_audit').insert({
    contract_id: contractId,
    version_id: versionId,
    action: 'publish',
    performed_by: user.id,
  })

  if (aErr) throw new Error(aErr.message)

  revalidatePath('/admin')
  revalidatePath('/admin/pricing')
  revalidatePath(`/admin/pricing`)
}

export async function unpublishPricingForContract(contractId: string) {
  const supabase = await createSupabaseServerClient()

  const { user, role } = await requireAdminRole(supabase)
  assertCanPublish(role)

  // hitta aktiv version för audit
  const { data: active, error: a1Err } = await supabase
    .from('contract_pricing_versions')
    .select('id')
    .eq('contract_id', contractId)
    .eq('is_active', true)
    .maybeSingle()

  if (a1Err) throw new Error(a1Err.message)

  const { error: offErr } = await supabase
    .from('contract_pricing_versions')
    .update({ is_active: false })
    .eq('contract_id', contractId)
    .eq('is_active', true)

  if (offErr) throw new Error(offErr.message)

  // audit: om det fanns en aktiv version logga vilken som blev avpublicerad
  if (active?.id) {
    const { error: aErr } = await supabase.from('pricing_version_audit').insert({
      contract_id: contractId,
      version_id: active.id,
      action: 'unpublish',
      performed_by: user.id,
    })
    if (aErr) throw new Error(aErr.message)
  }

  revalidatePath('/admin')
  revalidatePath('/admin/pricing')
}