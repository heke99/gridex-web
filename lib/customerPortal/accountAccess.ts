import { cache } from 'react'
import { supabaseService } from '@/lib/supabase/service'
import { OpsError } from '@/lib/ops/errors'

export function assertCustomerAccountActive(status: string | null | undefined): void {
  // Missing projections are valid while a verified auth-only account is being
  // onboarded. An existing disabled/suspended status must never use an old JWT.
  if (status !== null && status !== undefined && status !== 'active') {
    throw new OpsError('Ditt konto är inte aktivt. Kontakta kundservice.', 403, {
      code: 'customer_account_disabled', retryable: false,
    })
  }
}

export const verifyCustomerAccountAccess = cache(async (verifiedUserId: string): Promise<void> => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(verifiedUserId)) {
    throw new OpsError('Kundinloggningen saknar en verifierad användaridentitet.', 401, {
      code: 'unauthorized', retryable: false,
    })
  }
  // Use the server client: RLS intentionally hides disabled rows from their
  // session, so an authenticated SELECT could mistake a disabled account for
  // an account whose local profile has not yet been created.
  const { data, error } = await supabaseService
    .from('user_profiles')
    .select('user_status')
    .or(`user_id.eq.${verifiedUserId},id.eq.${verifiedUserId}`)
    .maybeSingle<{ user_status: string | null }>()
  if (error) {
    throw new OpsError('Kontots behörighet kunde inte verifieras just nu.', 503, {
      code: 'customer_account_verification_unavailable', retryable: true,
    })
  }
  assertCustomerAccountActive(data?.user_status)
})
