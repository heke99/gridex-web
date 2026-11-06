import type { SupabaseClient } from '@supabase/supabase-js'
import type { OpsPortalIdentity } from '@/lib/ops/client'
import { OpsError } from '@/lib/ops/errors'
import { createOpsCustomerSupportCase } from '@/lib/ops/client/customerSupport'
import { privacySupportInput } from './privacyRules'
import { portalCustomerReferences } from './identityReferences'

function rejected(code: string): never {
  throw new OpsError('Integritetsbegäran behöver kontrolleras av kundservice.', 409, { code, retryable: false })
}

export async function dispatchPrivacyRequest(row: {
  user_id: string; identity: OpsPortalIdentity; idempotency_key: string; payload: Record<string, unknown>
}, supabase: SupabaseClient): Promise<string> {
  const { kind, privacy_request_id: requestId } = row.payload
  if ((kind !== 'access' && kind !== 'erasure') || typeof requestId !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(requestId) || row.identity.userId !== row.user_id) rejected('privacy_queue_invalid')

  // A queued snapshot is not proof of a still-active account. Never silently
  // retarget a customer's request after an email or customer-link change.
  const { data, error } = await supabase.auth.admin.getUserById(row.user_id)
  if (error) {
    if (error.status === 404) rejected('privacy_identity_unavailable')
    throw new OpsError('Kontoidentiteten kunde inte kontrolleras.', 503, { code: 'privacy_identity_check_failed', retryable: true })
  }
  const user = data.user as (typeof data.user & { banned_until?: string; deleted_at?: string })
  if (!user || !user.email_confirmed_at || !user.email || user.deleted_at ||
    (user.banned_until && Date.parse(user.banned_until) > Date.now()) ||
    user.email.toLowerCase() !== row.identity.email?.toLowerCase()) rejected('privacy_identity_changed')
  const { data: profile, error: profileError } = await supabase.from('customer_profiles')
    .select('customer_number,contract_customer_ref,external_customer_id').eq('user_id', row.user_id).maybeSingle()
  if (profileError) throw new Error('Privacy customer link check unavailable.')
  const currentReferences = portalCustomerReferences(profile)
  if ((row.identity.customerNumber ?? null) !== currentReferences.customerNumber ||
    (row.identity.externalCustomerId ?? null) !== currentReferences.externalCustomerId) rejected('privacy_customer_link_changed')
  const result = await createOpsCustomerSupportCase(row.identity, privacySupportInput(kind, requestId), row.idempotency_key)
  const reference = result.data?.case_reference
  if (typeof reference !== 'string' || !/^[a-z][a-z0-9_]{1,31}_[A-Za-z0-9_-]{20,64}$/.test(reference)) {
    // An ambiguous upstream response is retried with the ORIGINAL key.
    throw new Error('OPS privacy case receipt unavailable.')
  }
  return reference
}
