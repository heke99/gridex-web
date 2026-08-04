import type { WebsiteInvoiceDeliveryMethod } from '@/lib/website/publicApi'

/**
 * Customer-facing checkout policy.
 *
 * Kivra is the primary delivery channel in the downstream billing flow. The
 * current OPS website API does not expose `kivra` as an invoice delivery enum,
 * so the website sends the canonical fallback `e_invoice`. OPS/billing is
 * responsible for attempting Kivra first and falling back to e-invoice.
 */
export const GRIDEX_PRIMARY_INVOICE_CHANNEL = 'kivra' as const
export const GRIDEX_FALLBACK_INVOICE_DELIVERY_METHOD = 'e_invoice' satisfies WebsiteInvoiceDeliveryMethod

/** A website application always represents exactly one electricity site. */
export const GRIDEX_WEBSITE_SITE_COUNT = 1 as const

/** Customer-selectable pricing components are disabled in website checkout. */
export function gridexWebsiteSelectedComponentReferences(): string[] {
  return []
}

/** Reject restored/legacy quote tokens that contain former customer choices. */
export function matchesGridexWebsiteCheckoutPolicy(input: {
  invoice_delivery_method: WebsiteInvoiceDeliveryMethod
  selected_component_references: readonly string[]
  site_count: number
}): boolean {
  return (
    input.invoice_delivery_method === GRIDEX_FALLBACK_INVOICE_DELIVERY_METHOD &&
    input.site_count === GRIDEX_WEBSITE_SITE_COUNT &&
    input.selected_component_references.length === 0
  )
}
