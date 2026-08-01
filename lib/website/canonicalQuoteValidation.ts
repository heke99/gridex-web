import {
  validateOpsWebsiteQuote,
  type OpsPublicContract,
  type OpsWebsitePriceArea,
  type OpsWebsiteQuoteValidation,
} from '@/lib/ops/client'
import type { WebsiteCustomerType } from '@/lib/website/customerType'
import { verifyWebsiteEnergyAreaToken } from '@/lib/website/energyAreaToken'
import { markWebsitePricingSnapshotValidated } from '@/lib/website/pricingSnapshotStore'
import {
  validateWebsitePricingQuote,
  type WebsitePricingQuote,
} from '@/lib/website/pricingQuote'

export type CanonicalQuoteValidationInput = {
  pricingToken: string | null | undefined
  pricingSnapshotReference?: string | null
  resolutionToken: string | null | undefined
  contract: OpsPublicContract
  customerType: WebsiteCustomerType
  estimatedMonthlyKwh: number
  annualConsumptionKwh: number
  requestedStartMode: 'earliest_possible' | 'specific_date'
  requestedStartDate?: string | null
  location: { postalCode: string; city: string; address: string }
}

export type CanonicalQuoteValidationSuccess = {
  quote: WebsitePricingQuote
  opsValidation: OpsWebsiteQuoteValidation
  area: {
    priceAreaCode: OpsWebsitePriceArea
    resolutionId: string
    gridAreaCode: string | null
    gridOwnerName: string | null
    confidence: number | null
  }
}

export async function validateCanonicalWebsiteQuote(
  input: CanonicalQuoteValidationInput,
): Promise<{ ok: true; value: CanonicalQuoteValidationSuccess } | { ok: false; reason: string }> {
  const area = verifyWebsiteEnergyAreaToken({
    token: input.resolutionToken,
    location: input.location,
  })
  if (!area.ok) return { ok: false, reason: `energy_area_${area.reason}` }

  const local = validateWebsitePricingQuote({
    token: input.pricingToken,
    pricingSnapshotReference: input.pricingSnapshotReference,
    contract: input.contract,
    customerType: input.customerType,
    priceAreaCode: area.payload.price_area_code,
    estimatedMonthlyKwh: input.estimatedMonthlyKwh,
    annualConsumptionKwh: input.annualConsumptionKwh,
    location: input.location,
  })
  if (!local.ok) return { ok: false, reason: local.reason }

  if (local.quote.resolution_id !== area.payload.resolution_id) {
    return { ok: false, reason: 'quote_resolution_mismatch' }
  }
  if (local.quote.requested_start_mode !== input.requestedStartMode) {
    return { ok: false, reason: 'quote_start_mode_mismatch' }
  }
  const requestedStartDate = input.requestedStartMode === 'specific_date'
    ? input.requestedStartDate ?? null
    : local.quote.start_date
  if (!requestedStartDate || local.quote.start_date !== requestedStartDate) {
    return { ok: false, reason: 'quote_start_date_mismatch' }
  }

  const opsValidation = await validateOpsWebsiteQuote({
    quote_reference: local.quote.ops_quote_reference,
    offer_reference: input.contract.offer_reference,
    customer_type: input.customerType,
    resolution_id: area.payload.resolution_id,
    annual_consumption_kwh: input.annualConsumptionKwh,
    start_date: requestedStartDate,
    price_option_reference: local.quote.price_option_reference,
    invoice_delivery_method: local.quote.invoice_delivery_method,
    selected_component_references: local.quote.selected_component_references,
    site_count: local.quote.site_count,
    price_area: area.payload.price_area_code,
    grid_area_code: area.payload.grid_area_code,
    postal_code: input.location.postalCode,
  })
  if (!opsValidation.valid) {
    return { ok: false, reason: opsValidation.code ?? opsValidation.status ?? 'ops_quote_invalid' }
  }
  if (opsValidation.price_option_reference !== local.quote.price_option_reference) {
    return { ok: false, reason: 'price_option_reference_changed' }
  }
  if (opsValidation.area_price_reference !== local.quote.area_price_reference) {
    return { ok: false, reason: 'area_price_reference_changed' }
  }
  // A later publication or legal revision does not invalidate an immutable quote.
  // OPS remains authoritative for explicit revocation/orderability failures.


  await markWebsitePricingSnapshotValidated({
    pricingSnapshotReference: local.quote.pricing_snapshot_reference,
    quoteReference: local.quote.ops_quote_reference,
    status: 'valid',
  })

  return {
    ok: true,
    value: {
      quote: local.quote,
      opsValidation,
      area: {
        priceAreaCode: area.payload.price_area_code,
        resolutionId: area.payload.resolution_id,
        gridAreaCode: area.payload.grid_area_code,
        gridOwnerName: area.payload.grid_owner_name,
        confidence: area.payload.confidence,
      },
    },
  }
}
