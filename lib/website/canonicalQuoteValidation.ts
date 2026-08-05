import { createHash } from 'node:crypto'
import {
  fetchOpsWebsiteEnergyArea,
  fetchOpsWebsiteQuote,
  validateOpsWebsiteQuote,
  type OpsPriceAreaAssurance,
  type OpsPublicContract,
  type OpsWebsitePriceArea,
  type OpsWebsiteQuoteValidation,
} from '@/lib/ops/client'
import { stockholmCalendarDate } from '@/lib/website/businessDate'
import {
  GRIDEX_FALLBACK_INVOICE_DELIVERY_METHOD,
  GRIDEX_WEBSITE_SITE_COUNT,
  gridexWebsiteSelectedComponentReferences,
  matchesGridexWebsiteCheckoutPolicy,
} from '@/lib/website/checkoutPolicy'
import type { WebsiteCustomerType } from '@/lib/website/customerType'
import {
  issueWebsiteEnergyAreaToken,
  verifyWebsiteEnergyAreaToken,
} from '@/lib/website/energyAreaToken'
import { persistOpsEnergyAreaResolution } from '@/lib/website/energyAreaStore'
import {
  issueWebsitePricingQuote,
  validateWebsitePricingQuote,
  type WebsitePricingQuote,
} from '@/lib/website/pricingQuote'
import {
  markWebsitePricingSnapshotValidated,
  persistWebsitePricingSnapshot,
} from '@/lib/website/pricingSnapshotStore'
import { selectAutomaticPublicContractPriceOption } from '@/lib/website/publicContractContract'

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
  /** True when an internal area/quote record was renewed server-side. */
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

function effectiveStartDate(input: CanonicalQuoteValidationInput): string | null {
  if (input.requestedStartMode === 'specific_date') {
    return input.requestedStartDate ?? null
  }
  // "Så snart som möjligt" is a mode, not a customer-confirmed calendar date.
  return stockholmCalendarDate()
}

function automaticPriceSelection(input: {
  contract: OpsPublicContract
  customerType: WebsiteCustomerType
  priceAreaCode: OpsWebsitePriceArea
  startDate: string
}) {
  return selectAutomaticPublicContractPriceOption({
    options: input.contract.price_options ?? [],
    customer_type: input.customerType,
    price_area_code: input.priceAreaCode,
    start_date: input.startDate,
  })
}

function deterministicRenewalAttemptId(seed: string): string {
  const chars = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('')
  chars[12] = '4'
  chars[16] = ['8', '9', 'a', 'b'][Number.parseInt(chars[16] ?? '0', 16) % 4]
  const hex = chars.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
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

async function refreshCanonicalQuote(input: {
  request: CanonicalQuoteValidationInput
  area: CanonicalArea
  displayedQuote: WebsitePricingQuote
  startDate: string
}): Promise<{ ok: true; quote: WebsitePricingQuote; token: string } | { ok: false; reason: string }> {
  const selection = automaticPriceSelection({
    contract: input.request.contract,
    customerType: input.request.customerType,
    priceAreaCode: input.area.price_area_code,
    startDate: input.startDate,
  })
  if (selection.status !== 'selected') {
    return {
      ok: false,
      reason: selection.status === 'selection_required'
        ? 'price_option_default_missing'
        : 'price_option_invalid',
    }
  }

  const selectedComponents = gridexWebsiteSelectedComponentReferences()
  const displayedQuoteAttemptId = input.displayedQuote.quote_attempt_id
  if (!displayedQuoteAttemptId) return { ok: false, reason: 'quote_attempt_id_missing' }
  // A renewal must not reuse the original OPS idempotency key, because that
  // would replay the expired quote. The derived UUID is stable for retries of
  // this quote generation and changes when a renewed quote later expires.
  const quoteAttemptId = deterministicRenewalAttemptId(JSON.stringify({
    displayed_quote_attempt_id: displayedQuoteAttemptId,
    displayed_valid_until: input.displayedQuote.valid_until,
    resolution_id: input.area.resolution_id,
    offer_reference: input.request.contract.offer_reference,
    customer_type: input.request.customerType,
    annual_consumption_kwh: input.request.annualConsumptionKwh,
    requested_start_mode: input.request.requestedStartMode,
    start_date: input.startDate,
    price_option_reference: selection.option.price_option_reference,
  }))
  const refreshedPreview = await fetchOpsWebsiteQuote({
    resolution_id: input.area.resolution_id,
    offer_reference: input.request.contract.offer_reference,
    annual_consumption_kwh: input.request.annualConsumptionKwh,
    customer_type: input.request.customerType,
    start_date: input.startDate,
    quote_attempt_id: quoteAttemptId,
    requested_start_mode: input.request.requestedStartMode,
    price_option_reference: selection.option.price_option_reference,
    invoice_delivery_method: GRIDEX_FALLBACK_INVOICE_DELIVERY_METHOD,
    selected_component_references: selectedComponents,
    site_count: GRIDEX_WEBSITE_SITE_COUNT,
  })

  const selectedAreaPriceReference = selection.area_price?.area_price_reference ?? null
  if (
    refreshedPreview.contract.offer_reference !== input.request.contract.offer_reference ||
    refreshedPreview.resolution_id !== input.area.resolution_id ||
    refreshedPreview.start_date !== input.startDate ||
    refreshedPreview.priceArea !== input.area.price_area_code ||
    refreshedPreview.area_price_reference !== selectedAreaPriceReference ||
    Math.abs((refreshedPreview.annual_consumption_kwh ?? 0) - input.request.annualConsumptionKwh) > 0.001
  ) {
    return { ok: false, reason: 'refreshed_quote_context_mismatch' }
  }

  const enrichedPreview = {
    ...refreshedPreview,
    public_contract_etag:
      refreshedPreview.public_contract_etag ?? input.displayedQuote.public_contract_etag,
    publication_revision:
      refreshedPreview.publication_revision ?? input.displayedQuote.publication_revision,
    contract_payload_sha256:
      refreshedPreview.contract_payload_sha256 ?? input.displayedQuote.contract_payload_sha256,
    legal_bundle_version:
      refreshedPreview.legal_bundle_version ?? input.displayedQuote.legal_bundle_version,
    legal_document_hashes:
      refreshedPreview.legal_document_hashes ?? input.displayedQuote.legal_document_hashes,
  }
  const renewalFingerprint = createHash('sha256')
    .update(JSON.stringify({
      quote_attempt_id: quoteAttemptId,
      ops_quote_reference: enrichedPreview.ops_quote_reference,
      resolution_id: enrichedPreview.resolution_id,
      offer_reference: input.request.contract.offer_reference,
      customer_type: input.request.customerType,
      annual_consumption_kwh: input.request.annualConsumptionKwh,
      requested_start_mode: input.request.requestedStartMode,
      start_date: input.startDate,
      price_area_code: input.area.price_area_code,
      price_option_reference: selection.option.price_option_reference,
      area_price_reference: selectedAreaPriceReference,
      invoice_delivery_method: GRIDEX_FALLBACK_INVOICE_DELIVERY_METHOD,
      selected_component_references: selectedComponents,
      site_count: GRIDEX_WEBSITE_SITE_COUNT,
      valid_until: enrichedPreview.valid_until,
    }))
    .digest('hex')
  const deterministicSnapshotReference = `wps_auto_${renewalFingerprint.slice(0, 32)}`
  const pricingSnapshotReference = await persistWebsitePricingSnapshot({
    preview: {
      ...enrichedPreview,
      pricing_snapshot_reference: deterministicSnapshotReference,
    },
    contract: input.request.contract,
    customerType: input.request.customerType,
    idempotent: true,
  })
  const lockedPreview = {
    ...enrichedPreview,
    pricing_snapshot_reference: pricingSnapshotReference,
  }
  const refreshedQuote = issueWebsitePricingQuote({
    preview: lockedPreview,
    contract: input.request.contract,
    customerType: input.request.customerType,
    requestedStartMode: input.request.requestedStartMode,
    quoteAttemptId,
    location: input.request.location,
    // Keep renewal signatures deterministic for retry-safe submissions while
    // retaining the original browser quote as the customer-visible evidence.
    now: new Date(input.displayedQuote.issued_at),
  })
  if (!refreshedQuote) return { ok: false, reason: 'refreshed_quote_lock_failed' }
  return { ok: true, quote: refreshedQuote.quote, token: refreshedQuote.token }
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

  // The browser token remains a tamper-proof record of what the customer saw.
  // Its OPS valid_until is lifecycle metadata, not a reason to force the customer
  // back through the calculator. Expired records are renewed server-side below.
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

  const startDate = effectiveStartDate(input)
  if (!startDate) return { ok: false, reason: 'quote_start_date_missing' }

  const selection = automaticPriceSelection({
    contract: input.contract,
    customerType: input.customerType,
    priceAreaCode: area.price_area_code,
    startDate,
  })
  if (selection.status !== 'selected') {
    return {
      ok: false,
      reason: selection.status === 'selection_required'
        ? 'price_option_default_missing'
        : 'price_option_invalid',
    }
  }

  const expectedAreaPriceReference = selection.area_price?.area_price_reference ?? null
  const quoteExpired = Date.parse(displayedQuote.valid_until) <= Date.now()
  const startDateChanged = displayedQuote.start_date !== startDate
  const resolutionChanged = displayedQuote.resolution_id !== area.resolution_id
  const priceSelectionChanged =
    displayedQuote.price_option_reference !== selection.option.price_option_reference ||
    displayedQuote.area_price_reference !== expectedAreaPriceReference
  const policyChanged = !matchesGridexWebsiteCheckoutPolicy(displayedQuote)
  const shouldRefresh =
    areaExpired || quoteExpired || startDateChanged || resolutionChanged || priceSelectionChanged || policyChanged

  let effectiveQuote = displayedQuote
  let effectivePricingToken = input.pricingToken as string
  if (shouldRefresh) {
    const refreshed = await refreshCanonicalQuote({
      request: input,
      area,
      displayedQuote,
      startDate,
    })
    if (!refreshed.ok) return refreshed
    effectiveQuote = refreshed.quote
    effectivePricingToken = refreshed.token
  }

  const opsValidation = await validateOpsWebsiteQuote({
    quote_reference: effectiveQuote.ops_quote_reference,
    offer_reference: input.contract.offer_reference,
    customer_type: input.customerType,
    resolution_id: area.resolution_id,
    annual_consumption_kwh: input.annualConsumptionKwh,
    start_date: effectiveQuote.start_date,
    price_option_reference: effectiveQuote.price_option_reference,
    invoice_delivery_method: effectiveQuote.invoice_delivery_method,
    selected_component_references: effectiveQuote.selected_component_references,
    site_count: effectiveQuote.site_count,
    price_area: area.price_area_code,
    grid_area_code: area.grid_area_code,
    postal_code: input.location.postalCode,
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
  if (opsValidation.valid_until !== effectiveQuote.valid_until) {
    return { ok: false, reason: 'quote_valid_until_changed' }
  }
  if (Date.parse(opsValidation.valid_until) <= Date.now()) {
    return { ok: false, reason: 'quote_expired' }
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
      refreshed: shouldRefresh,
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
