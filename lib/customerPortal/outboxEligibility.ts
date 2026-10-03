import type { SupabaseClient, User } from '@supabase/supabase-js'
import { OpsError } from '@/lib/ops/errors'
import { assertCustomerAccountActive } from '@/lib/customerPortal/accountAccess'
import type { OpsPortalIdentity } from '@/lib/ops/client'

function rejected(code: string): never {
  throw new OpsError('Kundkontot kan inte användas för den köade åtgärden.', 403, {
    code, retryable: false,
  })
}

export function assertPortalAuthUserEligibility(userId: string, authUser: User | null, requireConfirmation = true): void {
  const user = authUser as (User & { banned_until?: string | null; deleted_at?: string | null }) | null
  if (!user || user.id !== userId || user.deleted_at) rejected('portal_outbox_auth_user_missing')
  if (user.banned_until && (!Number.isFinite(Date.parse(user.banned_until)) || Date.parse(user.banned_until) > Date.now())) {
    rejected('portal_outbox_auth_user_banned')
  }
  if (requireConfirmation && !user.email_confirmed_at && !user.confirmed_at) rejected('portal_outbox_auth_user_unconfirmed')
}

/** Check current eligibility before creating fresh signed assertions for an old job. */
export async function verifyPortalOutboxEligibility(
  supabase: SupabaseClient,
  userId: string,
  identity: OpsPortalIdentity,
): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) || identity.userId !== userId) {
    rejected('portal_outbox_identity_invalid')
  }
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) {
    if (error.status === 404) rejected('portal_outbox_auth_user_missing')
    throw new OpsError('Kundinloggningen kunde inte verifieras för den köade åtgärden.', 503, {
      code: 'portal_outbox_auth_verification_unavailable', retryable: true,
    })
  }
  assertPortalAuthUserEligibility(userId, data.user)

  // A session SELECT hides disabled rows through RLS. Read the current account
  // projection through the worker's server client instead of using old JWT claims.
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('user_status')
    .or(`user_id.eq.${userId},id.eq.${userId}`)
    .maybeSingle<{ user_status: string | null }>()
  if (profileError) {
    throw new OpsError('Kontots behörighet kunde inte verifieras för den köade åtgärden.', 503, {
      code: 'portal_outbox_account_verification_unavailable', retryable: true,
    })
  }
  assertCustomerAccountActive(profile?.user_status)
}
