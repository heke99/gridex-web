type StablePortalProfile = {
  external_customer_id?: string | null
  customer_number?: string | null
  contract_customer_ref?: string | null
}

type StableApplicationIdentity = {
  external_customer_id?: string | null
  customer_number?: string | null
}

function value(input: string | null | undefined): string | null {
  return input?.trim() || null
}

/** At least one stable identifier must match and no known identifier may disagree. */
export function stablePortalCustomerIdentityMatches(
  profile: StablePortalProfile,
  application: StableApplicationIdentity,
): boolean {
  const legacyCustomerNumber = value(profile.contract_customer_ref)
  const profileCustomerNumber = value(profile.customer_number) ??
    (legacyCustomerNumber !== value(profile.external_customer_id) ? legacyCustomerNumber : null)
  const pairs = [
    [value(profile.external_customer_id), value(application.external_customer_id)],
    [profileCustomerNumber, value(application.customer_number)],
  ]
  const comparable = pairs.filter(([left, right]) => left && right)
  return comparable.length > 0 && comparable.every(([left, right]) => left === right)
}
