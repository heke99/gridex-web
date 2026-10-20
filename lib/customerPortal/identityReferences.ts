/** The local cache may use a legacy customer number as an external ID. */
export function portalCustomerReferences(profile: {
  customer_number?: string | null; contract_customer_ref?: string | null; external_customer_id?: string | null
} | null) {
  const customerNumber = profile?.customer_number ?? profile?.contract_customer_ref ?? null
  const external = profile?.external_customer_id ?? null
  const externalCustomerId = external && external !== customerNumber && !/^DX-\d+$/i.test(external) ? external : null
  return { customerNumber, externalCustomerId }
}
