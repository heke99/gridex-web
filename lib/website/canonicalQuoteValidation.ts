import {
  fetchOpsWebsiteEnergyArea,
  validateOpsWebsiteQuote,
  type OpsPriceAreaAssurance,
  type OpsPublicContract,
  type OpsWebsitePriceArea,
  type OpsWebsiteQuoteValidation,
} from '@/lib/ops/client'
import { matchesGridexWebsiteCheckoutPolicy } from '@/lib/website/checkoutPolicy'
import type { WebsiteCustomerType } from '@/lib/website/customerType'
import {
  issueWebsiteEnergyAreaToken,
  verifyWebsiteEnergyAreaToken,
} from '@/lib/website/energyAreaToken'
import { persistOpsEnergyAreaResolution } from '@/lib/website/energyAreaStore'
import {
  validateWebsitePricingQuote,
  type WebsitePricingQuote,
} from '@/lib/website/pricingQuote'
import { markWebsitePricingSnapshotValidated } from '@/lib/website/pricingSnapshotStore'

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
  /** Effective canonical quote used when the application is registered. */
  quote: WebsitePricingQuote
  /** Token matching the effective canonical quote. */
  pricingToken: string
  /** Token matching the effective price-area resolution. */
  resolutionToken: string
  /** Exact signed quote snapshot that was shown in the browser. */
  displayedQuote: WebsitePricingQuote
  /** True only when location/price-area evidence was refreshed; the accepted quote is never repriced. */
  refreshed: boolean
  opsValidation: OpsWebsiteQuoteValidation
  area: {
    priceAreaCode: OpsWebsitePriceArea
    resolutionId: string
    gridAreaCode: string | null
    gridOwnerName: string | null
    confidence: number | null
    resolutionStatus: string
    priceAreaAssurance: Omit<OpsPriceAreaAssurance, 'evidence'>
  }
}

type CanonicalArea = {
  price_area_code: OpsWebsitePriceArea
  resolution_id: string
  grid_area_code: string | null
  grid_owner_name: string | null
  confidence: number | null
  resolution_status: string
  price_area_assurance: Omit<OpsPriceAreaAssurance, 'evidence'>
  quote_ready: boolean
  expires_at: string
}

function sameCanonicalTimestamp(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const leftTimestamp = typeof left === 'string' ? Date.parse(left) : Number.NaN
  const rightTimestamp = typeof right === 'string' ? Date.parse(right) : Number.NaN
  return (
    Number.isFinite(leftTimestamp) &&
    Number.isFinite(rightTimestamp) &&
    leftTimestamp === rightTimestamp
  )
}

async function refreshCanonicalArea(input: {
  request: CanonicalQuoteValidationInput
  expectedPriceArea: OpsWebsitePriceArea
}): Promise<{ ok: true; area: CanonicalArea; token: string } | { ok: false; reason: string }> {
  const resolution = await fetchOpsWebsiteEnergyArea({
    postal_code: input.request.location.postalCode,
    city: input.request.location.city,
    address: input.request.location.address,
    street: input.request.location.address,
    country: 'SE',
    requested_start_mode: input.request.requestedStartMode,
    requested_start_date:
      input.request.requestedStartMode === 'specific_date'
        ? input.request.requestedStartDate ?? null
        : null,
  })
  const assurance = resolution.price_area_assurance
  const validUntil = resolution.valid_until
  const priceArea = resolution.price_area_code
  const resolutionId = resolution.resolution_id
  if (
    !priceArea ||
    !resolutionId ||
    !validUntil ||
    !Number.isFinite(Date.parse(validUntil)) ||
    Date.parse(validUntil) <= Date.now() ||
    resolution.capabilities.pricing_ready !== true ||
    resolution.capabilities.quote_ready !== true ||
    assurance.price_area !== priceArea ||
    assurance.unique_price_area_count !== 1 ||
    (assurance.status !== 'verified' && assurance.status !== 'estimated')
  ) {
    return { ok: false, reason: 'energy_area_refresh_not_ready' }
  }
  if (priceArea !== input.expectedPriceArea) {
    return { ok: false, reason: 'area_changed' }
  }

  await persistOpsEnergyAreaResolution({
    resolution,
    location: input.request.location,
  })
  const renewedToken = issueWebsiteEnergyAreaToken({
    resolution,
    location: input.request.location,
  })
  if (!renewedToken) return { ok: false, reason: 'energy_area_refresh_lock_failed' }

  return {
    ok: true,
    token: renewedToken.token,
    area: {
      price_area_code: priceArea,
      resolution_id: resolutionId,
      grid_area_code: resolution.grid_area_code ?? null,
      grid_owner_name: resolution.grid_owner_name ?? null,
      confidence: assurance.confidence,
      resolution_status: resolution.resolution_status ?? resolution.status,
      price_area_assurance: {
        status: assurance.status,
        price_area: assurance.price_area,
        confidence: assurance.confidence,
        source: assurance.source,
        candidate_count: assurance.candidate_count,
        unique_price_area_count: assurance.unique_price_area_count,
        source_version: assurance.source_version,
      },
      quote_ready: true,
      expires_at: validUntil,
    },
  }
}

export async function validateCanonicalWebsiteQuote(
  input: CanonicalQuoteValidationInput,
): Promise<{ ok: true; value: CanonicalQuoteValidationSuccess } | { ok: false; reason: string }> {
  const tokenArea = verifyWebsiteEnergyAreaToken({
    token: input.resolutionToken,
    location: input.location,
    allowExpired: true,
  })
  if (!tokenArea.ok) return { ok: false, reason: `energy_area_${tokenArea.reason}` }

  // The browser token is the tamper-proof record of exactly what the customer accepted.
  // valid_until is compatibility/audit metadata and must never trigger silent repricing.
  const local = validateWebsitePricingQuote({
    token: input.pricingToken,
    pricingSnapshotReference: input.pricingSnapshotReference,
    contract: input.contract,
    customerType: input.customerType,
    priceAreaCode: tokenArea.payload.price_area_code,
    estimatedMonthlyKwh: input.estimatedMonthlyKwh,
    annualConsumptionKwh: input.annualConsumptionKwh,
    location: input.location,
    allowExpired: true,
  })
  if (!local.ok) return { ok: false, reason: local.reason }

  const displayedQuote = local.quote
  if (displayedQuote.resolution_id !== tokenArea.payload.resolution_id) {
    return { ok: false, reason: 'quote_resolution_mismatch' }
  }
  if (displayedQuote.requested_start_mode !== input.requestedStartMode) {
    return { ok: false, reason: 'quote_start_mode_mismatch' }
  }
  if (
    input.requestedStartMode === 'specific_date' &&
    (!input.requestedStartDate || displayedQuote.start_date !== input.requestedStartDate)
  ) {
    return { ok: false, reason: 'quote_start_date_mismatch' }
  }

  let area: CanonicalArea = {
    price_area_code: tokenArea.payload.price_area_code,
    resolution_id: tokenArea.payload.resolution_id,
    grid_area_code: tokenArea.payload.grid_area_code,
    grid_owner_name: tokenArea.payload.grid_owner_name,
    confidence: tokenArea.payload.confidence,
    resolution_status: tokenArea.payload.resolution_status,
    price_area_assurance: tokenArea.payload.price_area_assurance,
    quote_ready: tokenArea.payload.quote_ready,
    expires_at: tokenArea.payload.expires_at,
  }
  let effectiveResolutionToken = input.resolutionToken as string
  const areaExpired = Date.parse(area.expires_at) <= Date.now()
  if (areaExpired) {
    const refreshedArea = await refreshCanonicalArea({
      request: input,
      expectedPriceArea: displayedQuote.price_area_code,
    })
    if (!refreshedArea.ok) return refreshedArea
    area = refreshedArea.area
    effectiveResolutionToken = refreshedArea.token
  }
  if (!area.quote_ready) return { ok: false, reason: 'resolution_quote_not_ready' }

  // Do not regenerate or reprice the quote when time passes, when the calendar
  // date changes for earliest_possible, or when a newer catalogue version exists.
  // The exact signed quote is the accepted commercial evidence; OPS decides whether
  // that immutable offer/quote has been explicitly revoked or is otherwise invalid.
  if (!matchesGridexWebsiteCheckoutPolicy(displayedQuote)) {
    return { ok: false, reason: 'checkout_policy_mismatch' }
  }

  const effectiveQuote = displayedQuote
  const effectivePricingToken = input.pricingToken as string

  // Revalidate the exact immutable tuple from the signed quote. The browser
  // inputs have already been checked against this snapshot above, but they must
  // never become a second source of truth for the OPS integrity check.
  const opsValidation = await validateOpsWebsiteQuote({
    quote_reference: effectiveQuote.ops_quote_reference,
    offer_reference: effectiveQuote.contract.offer_reference,
    customer_type: effectiveQuote.customer_type,
    resolution_id: effectiveQuote.resolution_id,
    annual_consumption_kwh: effectiveQuote.annual_consumption_kwh,
    start_date: effectiveQuote.start_date,
    price_option_reference: effectiveQuote.price_option_reference,
    invoice_delivery_method: effectiveQuote.invoice_delivery_method,
    selected_component_references: effectiveQuote.selected_component_references,
    site_count: effectiveQuote.site_count,
  })
  if (!opsValidation.valid) {
    return { ok: false, reason: opsValidation.code ?? opsValidation.status ?? 'ops_quote_invalid' }
  }
  if (opsValidation.price_option_reference !== effectiveQuote.price_option_reference) {
    return { ok: false, reason: 'price_option_reference_changed' }
  }
  if (opsValidation.area_price_reference !== effectiveQuote.area_price_reference) {
    return { ok: false, reason: 'area_price_reference_changed' }
  }
  // PostgREST can serialize the same UTC timestamptz with +00:00 while the signed
  // browser quote carries Z. Compare the represented instant, not the wire spelling.
  if (!sameCanonicalTimestamp(opsValidation.valid_until, effectiveQuote.valid_until)) {
    return { ok: false, reason: 'quote_valid_until_changed' }
  }

  await markWebsitePricingSnapshotValidated({
    pricingSnapshotReference: effectiveQuote.pricing_snapshot_reference,
    quoteReference: effectiveQuote.ops_quote_reference,
    status: 'valid',
  })

  return {
    ok: true,
    value: {
      quote: effectiveQuote,
      pricingToken: effectivePricingToken,
      resolutionToken: effectiveResolutionToken,
      displayedQuote,
      refreshed: areaExpired,
      opsValidation,
      area: {
        priceAreaCode: area.price_area_code,
        resolutionId: area.resolution_id,
        gridAreaCode: area.grid_area_code,
        gridOwnerName: area.grid_owner_name,
        confidence: area.confidence,
        resolutionStatus: area.resolution_status,
        priceAreaAssurance: area.price_area_assurance,
      },
    },
  }
}
