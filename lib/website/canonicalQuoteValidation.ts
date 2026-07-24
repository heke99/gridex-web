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
    gridOwnerId: string | null
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
    priceAreaCode: area.payload.price_area_code,
    estimatedMonthlyKwh: input.estimatedMonthlyKwh,
    annualConsumptionKwh: input.annualConsumptionKwh,
    location: input.location,
  })
  if (!local.ok) return { ok: false, reason: local.reason }

  if (local.quote.resolution_id !== area.payload.resolution_id) {
    return { ok: false, reason: 'quote_resolution_mismatch' }
  }
  const requestedStartDate =
    input.requestedStartMode === 'specific_date'
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
  })
  if (!opsValidation.valid) {
    return { ok: false, reason: opsValidation.code ?? opsValidation.status ?? 'ops_quote_invalid' }
  }
  if (
    local.quote.publication_revision &&
    opsValidation.publication_revision &&
    local.quote.publication_revision !== opsValidation.publication_revision
  ) return { ok: false, reason: 'publication_revision_changed' }
  if (
    local.quote.legal_bundle_version &&
    opsValidation.legal_bundle_version &&
    local.quote.legal_bundle_version !== opsValidation.legal_bundle_version
  ) return { ok: false, reason: 'legal_bundle_changed' }

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
        gridOwnerId: area.payload.grid_owner_id,
        gridOwnerName: area.payload.grid_owner_name,
        confidence: area.payload.confidence,
      },
    },
  }
}
