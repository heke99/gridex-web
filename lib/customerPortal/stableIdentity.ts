import { OpsError } from '@/lib/ops/errors'

type SupabaseServiceClient = Awaited<typeof import('@/lib/supabase/service')>['supabaseService']

type StablePortalIdentity = {
  external_customer_id?: string | null
  customer_number?: string | null
  contract_customer_ref?: string | null
}

function value(input: string | null | undefined): string | null {
  return input?.trim() || null
}

function comparableIdentifiers(profile: StablePortalIdentity, application: StablePortalIdentity) {
  const legacy = value(profile.contract_customer_ref)
  const number = value(profile.customer_number) ??
    (legacy !== value(profile.external_customer_id) ? legacy : null)
  return [
    [value(profile.external_customer_id), value(application.external_customer_id)],
    [number, value(application.customer_number)],
  ].filter(([left, right]) => left && right)
}

export function stablePortalCustomerIdentityConflicts(
  profile: StablePortalIdentity,
  application: StablePortalIdentity,
): boolean {
  return comparableIdentifiers(profile, application).some(([left, right]) => left !== right)
}

/** At least one stable identifier must match; no known identifier may disagree. */
export function stablePortalCustomerIdentityMatches(
  profile: StablePortalIdentity,
  application: StablePortalIdentity,
): boolean {
  const comparable = comparableIdentifiers(profile, application)
  return comparable.length > 0 && comparable.every(([left, right]) => left === right)
}

/** A concurrent profile must never acquire a different customer through upsert. */
export async function writePortalProfileWithStableIdentity(
  supabase: SupabaseServiceClient,
  userId: string,
  application: StablePortalIdentity,
  payload: Record<string, unknown>,
  assertClaim: () => Promise<void>,
): Promise<void> {
  const { data: profile, error: readError } = await supabase
    .from('customer_profiles')
    .select('external_customer_id,customer_number,contract_customer_ref')
    .eq('user_id', userId)
    .maybeSingle<StablePortalIdentity>()
  if (readError) throw new Error('Portal profile identity read failed: ' + readError.message)
  if (profile && stablePortalCustomerIdentityConflicts(profile, application)) {
    throw new OpsError('Kundkopplingen behöver verifieras av kundservice.', 409, {
      code: 'portal_onboarding_stable_identity_conflict', retryable: false,
    })
  }

  // The identity read is an await boundary: check the processing token afterwards.
  await assertClaim()
  let write
  if (profile) {
    let update = supabase.from('customer_profiles').update(payload).eq('user_id', userId)
    for (const key of ['external_customer_id', 'customer_number', 'contract_customer_ref'] as const) {
      const expected = profile[key] ?? null
      update = expected === null ? update.is(key, null) : update.eq(key, expected)
    }
    write = update.select('user_id').maybeSingle<{ user_id: string }>()
  } else {
    // A concurrent INSERT wins without being overwritten, even if its identity conflicts.
    write = supabase.from('customer_profiles')
      .upsert([payload], { onConflict: 'user_id', ignoreDuplicates: true, defaultToNull: false })
      .select('user_id').maybeSingle<{ user_id: string }>()
  }
  const { data, error } = await write
  if (error) throw new Error('Portal profile conditional write failed: ' + error.message)
  if (!data) {
    throw new OpsError('Kundkopplingen ändrades och behöver verifieras igen.', 409, {
      code: 'portal_onboarding_profile_changed', retryable: false,
    })
  }
}
