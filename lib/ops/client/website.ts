/* eslint-disable @typescript-eslint/no-unused-vars */

import { createHash, randomUUID } from "node:crypto";
import {
  calculationPricingComponentAmount,
  normalizePublicContractApiPayload,
  normalizeProductionPricing,
  publicContractValidationIssues,
  type PublicAreaPricing,
  type PublicContractLegal,
  type PublicContractPriceOption,
  type PublicPortfolioMonthlyPrice,
  type PublicLegalRequirement,
  type PublicPricingComponent,
  type PublicProductionPricing,
} from "@/lib/website/publicContractContract";
import {
  GRIDEX_WEBSITE_API_CONTRACT_VERSION,
  GRIDEX_WEBSITE_OPENAPI_SHA256,
} from '@/lib/ops/contract';
import { OpsError, OpsSchemaError, isOpsError } from '@/lib/ops/errors'
import { isCompatibleAdditiveResponseSchemaError } from '@/lib/ops/schemaCompatibility'
import {
  env,
  getOpsApiBaseUrl,
  getOpsApiKey,
  getOpsTransportStatus,
  opsRequest as transportOpsRequest,
  type OpsHttpResponse,
  type OpsRequestOptions,
} from '@/lib/ops/transport'
import {
  assertCustomerPortalOperationRequest,
  assertCustomerPortalOperationResponse,
  assertWebsiteOperationRequest,
  assertWebsiteOperationResponse,
  assertWebsiteRequest,
  assertWebsiteResponse,
  hasCustomerPortalOperation,
  hasWebsiteOperation,
  websiteSchemaHasProperty,
  websiteSchemaRequiresProperty,
  validateOpenApiSchema,
} from '@/lib/ops/validators/openapi'
import { toOpsCustomerType, type WebsiteCustomerType } from "@/lib/website/customerType";
import { annualToMonthlyKwh } from '@/lib/website/consumptionEstimator'
import type { components as WebsiteApiComponents } from '@/lib/ops/generated/website-api';
import { isStrictCalendarDate, stockholmCalendarDate } from '@/lib/website/businessDate'
import { canonicalSha256 } from '@/lib/ops/canonicalJson'
import { logContractVersionDrift } from '@/lib/ops/contractCompatibility'
import {
  CONTRACT_PARSER_VERSION,
  classifyOpenApiIssue,
  contractIssue,
  isBlockingContractIssue,
  type ContractValidationIssue,
} from '@/lib/website/publicContractPolicy'
import { WEBSITE_PUBLIC_CONTRACTS_CACHE_TAG } from '@/lib/website/publicContractCache'
import {
  readWebsitePublicContractSnapshot,
  storeWebsitePublicContractSnapshot,
} from '@/lib/website/publicContractSnapshotStore'

import type { OpsWebsiteQuoteRequestDto, OpsWebsiteQuoteValidationRequestDto, OpsCurrentMarketPriceResponseDto, OpsCustomerApplicationStatusDto, OpsWebsiteEnergyAreaResolveResponseDto, OpsWebsiteEnergyAreaResolutionDto, OpsSwitchStatusDto, OpsPublicContract, OpsPublicContractDiagnostics, OpsLegalText, OpsWebsitePriceArea, OpsWebsiteEnergyResolutionInput, OpsResolutionBlocker, OpsResolutionSource, OpsPriceAreaAssuranceStatus, OpsPriceAreaAssuranceSource, OpsPriceAreaAssurance, OpsWebsiteEnergyResolution, OpsWebsiteQuoteInput, OpsInvoiceDeliveryMethod, OpsWebsiteQuoteValidationInput, OpsWebsiteQuoteValidation, OpsWebsitePricingPreview, OpsCurrentMarketPrice, OpsWebsitePortfolioPrices, OpsWebsiteApplicationStatus, OpsPublicContractIssue, OpsBlockedPublicContract, OpsPublicContractsSnapshot } from './types'
import type { PublicContractsCacheEntry } from './core'
import { normalizeInteger, normalizeText, recordValue, pickString, opsRequest, observeRuntimeSchemaValidation, opsFetch, extractObject, isOpsWebsitePriceArea, pickStringArray, normalizeQuoteMarketReference, mapOpsWebsiteQuote, publicContractsPath, extractPublicContractDiagnostics, getVerifiedOpsIntegrationContext, verifiedTenantReference, publicationRevisionFromPayload, contractVersionFromPayload, publicContractFeedMetadata, publicContractsCacheKey, parseOpsPublicContractsPayload, publicContractsCache, WEBSITE_OPENAPI_SCHEMA_SHA256 } from './core'
import { isTransientOpsError } from './portal'

export function mapResolutionSource(value: unknown): OpsResolutionSource | null {
  if (typeof value === 'string' && value.trim()) {
    return { provider: value.trim(), raw: { provider: value.trim() } }
  }
  const row = recordValue(value)
  if (!row) return null
  return {
    provider: pickString(row, ['provider', 'name', 'source']),
    reference: pickString(row, ['reference', 'provider_reference', 'providerReference']),
    resolved_by: pickString(row, ['resolved_by', 'resolvedBy', 'method']),
    as_of: pickString(row, ['as_of', 'asOf', 'source_as_of', 'sourceAsOf']),
    metadata: recordValue(row.metadata) ?? null,
    raw: row,
  }
}

export function isPriceAreaAssuranceStatus(value: unknown): value is OpsPriceAreaAssuranceStatus {
  return value === 'verified' || value === 'estimated' || value === 'ambiguous' || value === 'unresolved'
}

export function isPriceAreaAssuranceSource(value: unknown): value is OpsPriceAreaAssuranceSource {
  return value === 'facility_data' ||
    value === 'grid_area_master' ||
    value === 'address_polygon' ||
    value === 'postal_city_consensus' ||
    value === 'postal_consensus'
}

export function mapPriceAreaAssurance(
  value: OpsWebsiteEnergyAreaResolutionDto['price_area_assurance'],
  input: {
    priceArea: OpsWebsitePriceArea | null;
    pricingReady: boolean;
    endpoint: string;
    requestId: string;
  },
): OpsPriceAreaAssurance {
  const assuranceArea = value.price_area
  const source = value.source
  const evidence = recordValue(value.evidence)
  const structurallyValid =
    isPriceAreaAssuranceStatus(value.status) &&
    (assuranceArea === null || isOpsWebsitePriceArea(assuranceArea)) &&
    (source === null || isPriceAreaAssuranceSource(source)) &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    Number.isInteger(value.candidate_count) &&
    value.candidate_count >= 0 &&
    Number.isInteger(value.unique_price_area_count) &&
    value.unique_price_area_count >= 0 &&
    Boolean(evidence)

  const pricingEvidenceValid = !input.pricingReady || (
    (value.status === 'verified' || value.status === 'estimated') &&
    input.priceArea !== null &&
    assuranceArea === input.priceArea &&
    value.unique_price_area_count === 1
  )

  if (!structurallyValid || !pricingEvidenceValid) {
    throw new OpsError('OPS returnerade ett inkonsekvent price_area_assurance-underlag.', 502, {
      code: 'ops_price_area_assurance_invalid',
      endpoint: input.endpoint,
      request_id: input.requestId,
      retryable: false,
    })
  }

  return {
    status: value.status,
    price_area: assuranceArea,
    confidence: value.confidence,
    source,
    candidate_count: value.candidate_count,
    unique_price_area_count: value.unique_price_area_count,
    source_version: value.source_version ?? null,
    evidence: evidence!,
  }
}

export async function fetchOpsWebsiteEnergyArea(
  input: OpsWebsiteEnergyResolutionInput,
): Promise<OpsWebsiteEnergyResolution> {
  const context = await getVerifiedOpsIntegrationContext()
  const postalCode = input.postal_code?.replace(/\s+/g, '') || null
  const requestBody = {
    ...(postalCode ? { postal_code: postalCode } : {}),
    ...(input.city ? { city: input.city } : {}),
    ...(input.street ?? input.address ? { street: input.street ?? input.address } : {}),
    ...(input.street_number ? { street_number: input.street_number } : {}),
    ...(input.country ? { country: input.country } : {}),
    ...(input.grid_area_code ? { grid_area_code: input.grid_area_code } : {}),
    ...(input.facility_id ? { facility_id: input.facility_id } : {}),
    ...(input.metering_point_id ? { metering_point_id: input.metering_point_id } : {}),
    ...(input.requested_start_mode ? { requested_start_mode: input.requested_start_mode } : {}),
    ...(input.requested_start_date ? { requested_start_date: input.requested_start_date } : {}),
  }
  if (Object.keys(requestBody).length === 0) {
    throw new OpsError('Minst en adress- eller anläggningsidentifierare krävs.', 400, {
      code: 'energy_resolution_identifier_required',
      retryable: false,
    })
  }
  if (input.requested_start_date && !isStrictCalendarDate(input.requested_start_date)) {
    throw new OpsError('Önskat startdatum är inte ett verkligt kalenderdatum.', 400, {
      code: 'requested_start_date_invalid',
      field: 'requested_start_date',
      retryable: false,
    })
  }
  const endpoint = '/api/v1/website/energy-area/resolve'
  assertWebsiteRequest('WebsiteEnergyAreaResolveRequest', requestBody, endpoint)
  const payload = await opsFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  })
  observeRuntimeSchemaValidation({ endpoint, schema: 'WebsiteEnergyAreaResolveResponse', validate: () => assertWebsiteResponse('WebsiteEnergyAreaResolveResponse', payload, endpoint) })
  await verifiedTenantReference(payload, endpoint)

  const responseRoot = recordValue(payload)
  const responseData = recordValue(responseRoot?.data)
  if (
    !responseRoot ||
    !responseData ||
    !recordValue(responseData.capabilities) ||
    !recordValue(responseData.blockers) ||
    !recordValue(responseData.price_area_assurance) ||
    !Array.isArray(responseData.warnings)
  ) {
    throw new OpsError('OPS returnerade ett ofullständigt elområdessvar.', 502, {
      code: 'ops_energy_area_contract_invalid',
      endpoint,
      request_id: normalizeText(responseRoot?.request_id),
      retryable: false,
    })
  }
  const response = payload as OpsWebsiteEnergyAreaResolveResponseDto
  const row: OpsWebsiteEnergyAreaResolutionDto = response.data
  const priceArea = row.price_area
  if (priceArea !== null && !isOpsWebsitePriceArea(priceArea)) {
    throw new OpsError('OPS returnerade ett ogiltigt elområde.', 502, {
      code: 'ops_energy_area_invalid',
      endpoint,
      request_id: response.request_id,
      received: priceArea,
      retryable: false,
    })
  }
  const mapBlockers = (items: OpsWebsiteEnergyAreaResolutionDto['blockers']['pricing']): OpsResolutionBlocker[] =>
    items.map((item) => ({ code: item.code, message: item.message, retryable: item.retryable }))
  const source = row.source && typeof row.source === 'object' && !Array.isArray(row.source)
    ? mapResolutionSource(row.source)
    : null
  const priceAreaAssurance = mapPriceAreaAssurance(row.price_area_assurance, {
    priceArea,
    pricingReady: row.capabilities.pricing_ready,
    endpoint,
    requestId: response.request_id,
  })
  const sourceRecord = recordValue(row.source)
  const sourceChain = Array.isArray(sourceRecord?.chain)
    ? sourceRecord.chain.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : []

  return {
    status: row.resolution_status,
    resolution_id: row.resolution_id,
    resolution_reference: row.resolution_id,
    resolution_status: row.resolution_status,
    capabilities: {
      pricing_ready: row.capabilities.pricing_ready,
      quote_ready: row.capabilities.quote_ready,
      facility_lookup_ready: row.capabilities.facility_lookup_ready,
      switch_request_creatable: row.capabilities.switch_request_creatable,
      switch_dispatch_ready: row.capabilities.switch_dispatch_ready,
    },
    blockers: {
      pricing: mapBlockers(row.blockers.pricing),
      quote: mapBlockers(row.blockers.quote),
      facility_lookup: mapBlockers(row.blockers.facility_lookup),
      switch_creation: mapBlockers(row.blockers.switch_creation),
      switch_dispatch: mapBlockers(row.blockers.switch_dispatch),
    },
    retryable: row.retryable,
    next_required_action: row.next_required_action ?? null,
    warnings: [...row.warnings],
    resolved_at: row.resolved_at ?? null,
    valid_until: row.expires_at ?? null,
    price_area_code: priceArea,
    grid_area_code: row.grid_area_code ?? null,
    grid_area_name: row.grid_area_name ?? null,
    grid_owner_name: row.grid_owner_name ?? null,
    confidence: row.confidence,
    contract_version: context.contract_version,
    resolver_version: row.resolver_version ?? null,
    geodata_version: row.geodata_version ?? null,
    conflict_code: row.conflict_code ?? null,
    error_code: row.error_code ?? null,
    price_area_assurance: priceAreaAssurance,
    source,
    source_chain: sourceChain,
    customer_message: null,
    raw: payload as Record<string, unknown>,
  }
}

export async function fetchOpsWebsiteQuote(
  input: OpsWebsiteQuoteInput,
): Promise<OpsWebsitePricingPreview> {
  await getVerifiedOpsIntegrationContext()
  // The canonical quote request is bound only by resolution_id; price_area is
  // resolved and enforced by OPS and is not accepted as a client field.
  const requestBody = {
    resolution_id: input.resolution_id,
    offer_reference: input.offer_reference,
    annual_consumption_kwh: input.annual_consumption_kwh,
    customer_type: toOpsCustomerType(input.customer_type),
    start_date: input.start_date,
    price_option_reference: input.price_option_reference,
    invoice_delivery_method: input.invoice_delivery_method,
    selected_component_references: [...new Set(input.selected_component_references)],
    site_count: input.site_count,
  } satisfies OpsWebsiteQuoteRequestDto
  assertWebsiteRequest(
    'WebsiteQuoteRequest',
    requestBody,
    '/api/v1/website/quote',
  )
  const payload = await opsFetch('/api/v1/website/quote', {
    method: 'POST',
    headers: {
      'Idempotency-Key': ['website-quote', input.quote_attempt_id, canonicalSha256(requestBody)].join(':'),
    },
    body: JSON.stringify(requestBody),
  })
  observeRuntimeSchemaValidation({
    endpoint: '/api/v1/website/quote',
    schema: 'WebsiteQuoteResponse',
    validate: () => assertWebsiteResponse('WebsiteQuoteResponse', payload, '/api/v1/website/quote'),
  })
  await verifiedTenantReference(payload, '/api/v1/website/quote')
  return mapOpsWebsiteQuote(payload, input)
}

export async function validateOpsWebsiteQuote(
  input: OpsWebsiteQuoteValidationInput,
): Promise<OpsWebsiteQuoteValidation> {
  await getVerifiedOpsIntegrationContext()
  const selectedComponentReferences = [...new Set(input.selected_component_references)]
  const requestBody = {
    quote_reference: input.quote_reference,
    offer_reference: input.offer_reference,
    customer_type: toOpsCustomerType(input.customer_type),
    resolution_id: input.resolution_id,
    annual_consumption_kwh: input.annual_consumption_kwh,
    start_date: input.start_date,
    price_option_reference: input.price_option_reference,
    invoice_delivery_method: input.invoice_delivery_method,
    selected_component_references: selectedComponentReferences,
    site_count: input.site_count,
    ...(input.price_area ? { price_area: input.price_area } : {}),
    ...(input.grid_area_code ? { grid_area_code: input.grid_area_code } : {}),
    ...(input.postal_code ? { postal_code: input.postal_code.replace(/\s+/g, '') } : {}),
    ...(input.application_number ? { application_number: input.application_number } : {}),
  } satisfies OpsWebsiteQuoteValidationRequestDto
  assertWebsiteRequest(
    'QuoteValidationRequest',
    requestBody,
    '/api/v1/website/quote/validate',
  )
  const payload = await opsFetch('/api/v1/website/quote/validate', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  })
  await verifiedTenantReference(payload, '/api/v1/website/quote/validate')
  const root = recordValue(payload)
  const row = recordValue(root?.data)
  const status = normalizeText(row?.status)
  const explicitValid = row?.valid
  const quoteReference = normalizeText(row?.quote_reference)
  const offerReference = normalizeText(row?.offer_reference)
  const resolutionId = normalizeText(row?.resolution_id)
  const validUntil = normalizeText(row?.valid_until)
  const resolverVersion = row && Object.hasOwn(row, 'resolver_version')
    ? normalizeText(row.resolver_version)
    : undefined
  const geodataVersion = row && Object.hasOwn(row, 'geodata_version')
    ? normalizeText(row.geodata_version)
    : undefined
  const marketReference = normalizeQuoteMarketReference(row?.market_reference)
  const rawEnergyDirection = normalizeText(row?.energy_direction)
  const energyDirection = rawEnergyDirection === 'consumption' || rawEnergyDirection === 'production'
    ? rawEnergyDirection
    : null
  const selectedAreaPricePresent = Boolean(row && Object.hasOwn(row, 'selected_area_price'))
  const selectedAreaPrice = row?.selected_area_price === null
    ? null
    : recordValue(row?.selected_area_price)
  const priceOptionReference = normalizeText(row?.price_option_reference)
  const areaPriceReference = normalizeText(row?.area_price_reference)
  const invoiceDeliveryMethod = normalizeText(row?.invoice_delivery_method)
  const responseSelectedComponents = pickStringArray(row ?? {}, ['selected_component_references'])
  const mandatoryComponentReferences = pickStringArray(row ?? {}, ['mandatory_component_references'])
  const conditionalComponentReferences = pickStringArray(row ?? {}, ['conditional_component_references'])
  const siteCount = normalizeInteger(row?.site_count)
  const validInvoiceDeliveryMethods = new Set<OpsInvoiceDeliveryMethod>([
    'email',
    'e_invoice',
    'paper',
    'direct_debit',
  ])
  const normalizedInvoiceDeliveryMethod = validInvoiceDeliveryMethods.has(
    invoiceDeliveryMethod as OpsInvoiceDeliveryMethod,
  )
    ? invoiceDeliveryMethod as OpsInvoiceDeliveryMethod
    : null

  if (
    !root ||
    !row ||
    explicitValid !== true ||
    !status ||
    !quoteReference ||
    !offerReference ||
    !resolutionId ||
    !validUntil ||
    !Number.isFinite(Date.parse(validUntil)) ||
    resolverVersion === undefined ||
    geodataVersion === undefined ||
    !marketReference ||
    !energyDirection ||
    !selectedAreaPricePresent ||
    (row?.selected_area_price !== null && !selectedAreaPrice) ||
    !priceOptionReference ||
    !normalizedInvoiceDeliveryMethod ||
    !responseSelectedComponents ||
    !mandatoryComponentReferences ||
    !conditionalComponentReferences ||
    siteCount === null ||
    !Number.isInteger(siteCount) ||
    siteCount < 1
  ) {
    throw new OpsError('OPS returnerade ett ofullständigt offertvalideringssvar.', 502, {
      code: 'ops_quote_validation_contract_invalid',
      endpoint: '/api/v1/website/quote/validate',
      request_id: normalizeText(root?.request_id),
      valid: explicitValid,
      quote_reference: quoteReference,
      offer_reference: offerReference,
      resolution_id: resolutionId,
      price_option_reference: priceOptionReference,
      invoice_delivery_method: invoiceDeliveryMethod,
      site_count: siteCount,
      retryable: false,
    })
  }
  if (
    quoteReference !== input.quote_reference ||
    offerReference !== input.offer_reference ||
    resolutionId !== input.resolution_id
  ) {
    throw new OpsError('Offerten är inte bunden till valt avtal och vald elområdesresolution.', 409, {
      code: 'ops_quote_binding_mismatch',
      expected_quote_reference: input.quote_reference,
      received_quote_reference: quoteReference,
      expected_offer_reference: input.offer_reference,
      received_offer_reference: offerReference,
      expected_resolution_id: input.resolution_id,
      received_resolution_id: resolutionId,
      retryable: false,
    })
  }
  if (
    priceOptionReference !== input.price_option_reference ||
    normalizedInvoiceDeliveryMethod !== input.invoice_delivery_method ||
    siteCount !== input.site_count ||
    JSON.stringify([...responseSelectedComponents].sort()) !==
      JSON.stringify([...selectedComponentReferences].sort())
  ) {
    throw new OpsError('Offertvalideringen matchar inte kundens signerade val.', 409, {
      code: 'ops_quote_validation_selection_mismatch',
      expected: {
        price_option_reference: input.price_option_reference,
        invoice_delivery_method: input.invoice_delivery_method,
        selected_component_references: [...selectedComponentReferences].sort(),
        site_count: input.site_count,
      },
      received: {
        price_option_reference: priceOptionReference,
        invoice_delivery_method: normalizedInvoiceDeliveryMethod,
        selected_component_references: [...responseSelectedComponents].sort(),
        site_count: siteCount,
      },
      retryable: false,
    })
  }
  return {
    valid: true,
    status,
    code: normalizeText(row.code),
    quote_reference: quoteReference,
    offer_reference: offerReference,
    resolution_id: resolutionId,
    valid_until: validUntil,
    resolver_version: resolverVersion,
    geodata_version: geodataVersion,
    market_reference: marketReference,
    energy_direction: energyDirection,
    selected_area_price: selectedAreaPrice,
    price_option_reference: priceOptionReference,
    area_price_reference: areaPriceReference,
    invoice_delivery_method: normalizedInvoiceDeliveryMethod,
    selected_component_references: responseSelectedComponents,
    mandatory_component_references: mandatoryComponentReferences,
    conditional_component_references: conditionalComponentReferences,
    site_count: siteCount,
    publication_revision: normalizeInteger(row.publication_revision),
    legal_bundle_version: normalizeText(row.legal_bundle_version),
    raw: row,
  }
}

export async function fetchOpsCurrentMarketPrice(
  resolutionId: string,
): Promise<OpsCurrentMarketPrice> {
  const normalized = normalizeText(resolutionId)
  if (!normalized) {
    throw new OpsError('Resolution ID krävs för aktuellt marknadspris.', 400, {
      code: 'resolution_required',
      field: 'resolution_id',
      retryable: false,
    })
  }

  await getVerifiedOpsIntegrationContext()
  const endpoint = '/api/v1/website/market-price/current'
  const requestBody = { resolution_id: normalized }
  assertWebsiteRequest('CurrentMarketPriceRequest', requestBody, endpoint)

  const payload = await opsFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  })
  await verifiedTenantReference(payload, endpoint)
  observeRuntimeSchemaValidation({ endpoint, schema: 'CurrentMarketPriceResponse', validate: () => assertWebsiteResponse('CurrentMarketPriceResponse', payload, endpoint) })

  const marketRoot = recordValue(payload)
  const marketData = recordValue(marketRoot?.data)
  if (!marketRoot || !marketData) {
    throw new OpsError('OPS returnerade ett ofullständigt marknadsprissvar.', 502, {
      code: 'ops_market_price_contract_invalid',
      endpoint,
      retryable: false,
    })
  }
  const response = payload as OpsCurrentMarketPriceResponseDto
  if (response.data.resolution_id !== normalized) {
    throw new OpsError('OPS returnerade marknadspris för en annan resolution.', 502, {
      code: 'ops_market_price_resolution_mismatch',
      endpoint,
      expected_resolution_id: normalized,
      received_resolution_id: response.data.resolution_id,
      request_id: response.request_id,
      retryable: false,
    })
  }
  if (normalizeText(response.contract_schema_version) !== GRIDEX_WEBSITE_API_CONTRACT_VERSION) {
    throw new OpsError('OPS marknadspris använder en annan kontraktsversion än Gridex Web.', 502, {
      code: 'ops_market_price_contract_version_mismatch',
      endpoint,
      expected: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
      received: normalizeText(response.contract_schema_version),
      request_id: response.request_id,
      retryable: false,
    })
  }
  if (response.data.is_stale) {
    throw new OpsError('OPS returnerade ett föråldrat aktuellt marknadspris.', 503, {
      code: 'market_price_stale',
      endpoint,
      resolution_id: normalized,
      source_as_of: response.data.source_as_of,
      next_update_at: response.data.next_update_at,
      request_id: response.request_id,
      retryable: true,
    })
  }

  return {
    ...response.data,
    request_id: response.request_id,
    contract_schema_version: response.contract_schema_version,
    raw: payload as Record<string, unknown>,
  }
}

export async function fetchOpsWebsiteApplicationStatus(
  applicationNumber: string,
): Promise<OpsWebsiteApplicationStatus> {
  const normalized = normalizeText(applicationNumber)
  if (!normalized) {
    throw new OpsError('Ansökningsnummer krävs.', 400, {
      code: 'application_number_required',
      field: 'application_number',
      retryable: false,
    })
  }
  await getVerifiedOpsIntegrationContext()
  const endpoint = `/api/v1/website/customer-applications/${encodeURIComponent(normalized)}`
  const payload = await opsFetch(endpoint)
  await verifiedTenantReference(payload, endpoint)
  const root = recordValue(payload)
  const row = recordValue(root?.data)
  if (!row) {
    throw new OpsError('OPS returnerade ett ogiltigt statussvar.', 502, {
      code: 'ops_application_status_contract_invalid',
      endpoint,
      retryable: false,
    })
  }
  const value = row as OpsCustomerApplicationStatusDto
  if (value.application_number !== normalized) {
    throw new OpsError('OPS returnerade status för en annan ansökan.', 502, {
      code: 'ops_application_status_identity_mismatch',
      endpoint,
      expected_application_number: normalized,
      received_application_number: value.application_number,
      retryable: false,
    })
  }
  return {
    application_number: value.application_number,
    status: value.status,
    stage: value.stage,
    customer_number: value.customer_number ?? null,
    contract_status: value.contract_status ?? null,
    supplier_switch_status: value.supplier_switch_status,
    supply_status: value.supply_status ?? null,
    requested_start_date: value.requested_start_date ?? null,
    confirmed_start_date: value.confirmed_start_date ?? null,
    missing_customer_action: value.missing_customer_action,
    next_step: value.next_step ?? null,
    blocking_reason: value.blocking_reason ?? null,
    updated_at: value.updated_at ?? null,
    raw: row,
  }
}

export async function fetchOpsWebsiteSwitchStatus(
  applicationNumber: string,
): Promise<OpsSwitchStatusDto> {
  const normalized = normalizeText(applicationNumber)
  if (!normalized) {
    throw new OpsError('Application number is required.', 400, {
      code: 'application_number_required',
      field: 'application_number',
      retryable: false,
    })
  }
  const endpoint = `/api/v1/website/switch-status?application_number=${encodeURIComponent(normalized)}`
  const payload = await opsFetch(endpoint)
  await verifiedTenantReference(payload, '/api/v1/website/switch-status')
  const root = recordValue(payload)
  const row = recordValue(root?.data)
  if (!row) {
    throw new OpsError('OPS returnerade ett ogiltigt bytesstatussvar.', 502, {
      code: 'ops_switch_status_contract_invalid',
      endpoint: '/api/v1/website/switch-status',
      retryable: false,
    })
  }
  observeRuntimeSchemaValidation({ endpoint: '/api/v1/website/switch-status', schema: 'SwitchStatus', validate: () => assertWebsiteResponse('SwitchStatus', row, '/api/v1/website/switch-status') })
  const value = row as OpsSwitchStatusDto
  if (value.application_number !== normalized) {
    throw new OpsError('OPS returnerade bytesstatus för en annan ansökan.', 502, {
      code: 'ops_switch_status_identity_mismatch',
      expected_application_number: normalized,
      received_application_number: value.application_number,
      retryable: false,
    })
  }
  return value
}

export async function fetchOpsWebsitePortfolioPrices(input: {
  offerReference: string;
  priceArea?: OpsWebsitePriceArea | null;
}): Promise<OpsWebsitePortfolioPrices> {
  const offerReference = normalizeText(input.offerReference)
  if (!offerReference) {
    throw new OpsError('Offer reference krävs för portfoliohistorik.', 400, {
      code: 'offer_reference_required',
      field: 'offer_reference',
      retryable: false,
    })
  }
  const query = new URLSearchParams({ offer_reference: offerReference })
  if (input.priceArea) query.set('price_area', input.priceArea)
  const endpoint = `/api/v1/website/portfolio-prices?${query.toString()}`
  const payload = await opsFetch(endpoint)
  await verifiedTenantReference(payload, '/api/v1/website/portfolio-prices')

  const root = recordValue(payload)
  const data = recordValue(root?.data)
  const method = data?.method
  const history = data?.historical_final_prices
  const finalBillingRule = normalizeText(data?.final_billing_rule)
  const requestId = normalizeText(root?.request_id)
  const contractVersion = normalizeText(root?.contract_schema_version)

  if (
    !root ||
    !data ||
    !(typeof method === 'string' || recordValue(method)) ||
    !Array.isArray(history) ||
    finalBillingRule !== 'locked_settlement_only' ||
    !requestId
  ) {
    throw new OpsError('OPS portfoliorespons följer inte det dokumenterade kontraktet.', 502, {
      code: 'ops_portfolio_contract_invalid',
      endpoint: '/api/v1/website/portfolio-prices',
      request_id: requestId,
      received_contract_version: contractVersion,
      final_billing_rule: finalBillingRule,
      retryable: false,
    })
  }

  if (contractVersion !== GRIDEX_WEBSITE_API_CONTRACT_VERSION) {
    throw new OpsError('OPS portfoliorespons använder en annan kontraktsversion än Gridex Web.', 502, {
      code: 'ops_portfolio_contract_version_mismatch',
      endpoint: '/api/v1/website/portfolio-prices',
      expected: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
      received: contractVersion,
      request_id: requestId,
      retryable: false,
    })
  }

  const rows = history.map((item, index) => {
    const row = recordValue(item)
    if (!row) {
      throw new OpsError('OPS portfoliohistorik innehåller en ogiltig rad.', 502, {
        code: 'ops_portfolio_history_row_invalid',
        endpoint: '/api/v1/website/portfolio-prices',
        index,
        request_id: requestId,
        retryable: false,
      })
    }
    const forbiddenKeys = [
      'company_id',
      'tenant_id',
      'contract_offer_id',
      'price_plan_id',
      'price_plan_version_id',
      'portfolio_id',
      'portfolio_version_id',
    ]
    const leaked = forbiddenKeys.find((key) => Object.hasOwn(row, key))
    if (leaked) {
      throw new OpsError('OPS portfoliohistorik exponerar ett internt identifierarfält.', 502, {
        code: 'ops_portfolio_internal_identifier_leak',
        endpoint: '/api/v1/website/portfolio-prices',
        field: leaked,
        index,
        request_id: requestId,
        retryable: false,
      })
    }
    return row
  })

  return {
    method: typeof method === 'string' ? method : recordValue(method)!,
    historical_final_prices: rows,
    final_billing_rule: 'locked_settlement_only',
    request_id: requestId,
    contract_schema_version: contractVersion,
    raw: root,
  }
}

export function publicContractsCustomerTypeKey(customerType?: WebsiteCustomerType | null): 'all' | 'private' | 'business' {
  return customerType ? toOpsCustomerType(customerType) : 'all'
}

export function snapshotFromCacheEntry(
  cached: PublicContractsCacheEntry,
  input: {
    source: 'cache' | 'stale-cache'
    stale: boolean
    staleReason: string | null
    upstreamStatus?: number
    upstreamRequestId?: string | null
    upstreamCorrelationId?: string | null
    blockedContracts?: OpsBlockedPublicContract[]
    warnings?: OpsPublicContractIssue[]
    compatibilityIssues?: OpsPublicContractIssue[]
  },
): OpsPublicContractsSnapshot {
  return {
    contracts: cached.contracts,
    blocked_contracts: input.blockedContracts ?? cached.blocked_contracts,
    feed_state: cached.feed_state,
    empty_feed_authorization: cached.empty_feed_authorization,
    warnings: input.warnings ?? cached.warnings,
    compatibility_issues: input.compatibilityIssues ?? cached.compatibility_issues,
    parser_version: cached.parser_version,
    schema_sha256: cached.schema_sha256,
    etag: cached.etag,
    publication_revision: cached.publication_revision,
    tenant_reference: cached.tenant_reference,
    contract_version: cached.contract_version,
    not_modified: true,
    fetched_at: cached.fetched_at,
    source: input.source,
    stale: input.stale,
    stale_reason: input.staleReason,
    upstream_status: input.upstreamStatus ?? cached.upstream_status,
    upstream_request_id: input.upstreamRequestId ?? cached.upstream_request_id,
    upstream_correlation_id: input.upstreamCorrelationId ?? cached.upstream_correlation_id,
  }
}

export function publicContractsFallbackEligible(error: unknown): boolean {
  if (!isOpsError(error)) return false
  if (['ops_tenant_mismatch', 'ops_tenant_binding_unverified'].includes(error.code ?? '')) return false
  if ([401, 403, 410, 423].includes(error.status)) return false

  // Schema-readiness outages are deployment failures, not evidence that the
  // previously verified tenant-bound feed is invalid. The cache key is bound
  // to API base URL + API key, while the stored snapshot is still checked
  // against contract version, parser version and the exact OpenAPI checksum.
  if (error.code === 'platform_schema_not_ready' && error.status === 503) return true

  // Invalid/partial public-contract payloads must never replace the durable
  // last-known-good snapshot. A schema or canonical metadata failure is safe
  // to serve from LKG even though retryable=false correctly prevents blind
  // request retries against the same malformed release.
  if ((error.code ?? '').startsWith('ops_public_contracts_') && error.status >= 500) return true
  return isTransientOpsError(error)
}

export function integrationContextSnapshotFallbackEligible(error: unknown): boolean {
  if (!isOpsError(error)) return false
  if (['ops_tenant_mismatch', 'ops_tenant_binding_unverified'].includes(error.code ?? '')) return false
  if ([401, 403, 410, 423].includes(error.status)) return false
  return error.status >= 500
}

export async function persistentPublicContractsCacheEntry(
  cacheKey: string,
): Promise<PublicContractsCacheEntry | null> {
  let tenantReference: string | null = null
  try {
    tenantReference = (await getVerifiedOpsIntegrationContext()).tenant_reference
  } catch (error) {
    if (!integrationContextSnapshotFallbackEligible(error)) {
      console.error('[gridex-public-contracts] integration context verification failed before snapshot read', {
        status: isOpsError(error) ? error.status : null,
        code: isOpsError(error) ? error.code : null,
        message: error instanceof Error ? error.message : String(error),
      })
      return null
    }
    console.warn('[gridex-public-contracts] integration context unavailable; trying API-key-bound snapshot', {
      status: isOpsError(error) ? error.status : null,
      code: isOpsError(error) ? error.code : null,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  try {
    const snapshot = await readWebsitePublicContractSnapshot(cacheKey, {
      tenantReference,
      contractVersion: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
      parserVersion: CONTRACT_PARSER_VERSION,
      schemaSha256: WEBSITE_OPENAPI_SCHEMA_SHA256,
    })
    if (!snapshot) return null
    const entry: PublicContractsCacheEntry = { ...snapshot, cache_key: cacheKey }
    publicContractsCache.set(cacheKey, entry)
    return entry
  } catch (error) {
    console.error('[gridex-public-contracts] persistent snapshot database read failed', {
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function fetchOpsPublicContractsSnapshot(
  customerType?: WebsiteCustomerType | null,
  options: { forceFresh?: boolean } = {},
): Promise<OpsPublicContractsSnapshot> {
  const cacheKey = publicContractsCacheKey(customerType)
  let cached = options.forceFresh ? undefined : publicContractsCache.get(cacheKey)
  if (!options.forceFresh && !cached) {
    cached = (await persistentPublicContractsCacheEntry(cacheKey)) ?? undefined
  }

  const headers = new Headers()
  if (!options.forceFresh && cached?.etag) headers.set('If-None-Match', cached.etag)

  let response: OpsHttpResponse
  try {
    response = await opsRequest(
      publicContractsPath(customerType),
      { method: 'GET', headers },
      {
        allowNotModified: true,
        // Contract publication is consistency-sensitive. Never let Next's data
        // cache persist a transient empty or schema-invalid OPS response.
        cache: 'no-store',
        tags: [WEBSITE_PUBLIC_CONTRACTS_CACHE_TAG],
      },
    )
  } catch (error) {
    if (!options.forceFresh && cached && publicContractsFallbackEligible(error)) {
      return snapshotFromCacheEntry(cached, {
        source: 'stale-cache',
        stale: true,
        staleReason: isOpsError(error) ? error.code ?? `http_${error.status}` : 'ops_transport_error',
      })
    }
    throw error
  }

  if (response.status === 304) {
    if (!cached) {
      throw new OpsError('OPS svarade 304 utan en lokal eller persistent avtalsrevision.', 502, {
        code: 'ops_public_contracts_304_without_cache',
      })
    }
    return snapshotFromCacheEntry(cached, {
      source: 'cache',
      stale: false,
      staleReason: null,
      upstreamStatus: response.status,
      upstreamRequestId: response.headers.get('x-request-id') ?? cached.upstream_request_id,
      upstreamCorrelationId: response.headers.get('x-correlation-id') ?? cached.upstream_correlation_id,
    })
  }

  let tenantReference: string
  let parsed: ReturnType<typeof parseOpsPublicContractsPayload>
  let responseContractVersion: string | null
  let responseRevision: number | null
  let feedMetadata: ReturnType<typeof publicContractFeedMetadata>
  try {
    tenantReference = await verifiedTenantReference(
      response.payload,
      '/api/v1/website/public-contracts',
    )
    parsed = parseOpsPublicContractsPayload(response.payload)
    const payloadContractVersion = contractVersionFromPayload(response.payload)
    if (
      response.contractVersion &&
      payloadContractVersion &&
      response.contractVersion !== payloadContractVersion
    ) {
      throw new OpsError('OPS public-contracts header- och payloadversion matchar inte.', 502, {
        code: 'ops_public_contracts_contract_version_sources_mismatch',
        endpoint: '/api/v1/website/public-contracts',
        header_version: response.contractVersion,
        payload_version: payloadContractVersion,
        retryable: false,
      })
    }
    responseContractVersion = response.contractVersion ?? payloadContractVersion
    responseRevision = publicationRevisionFromPayload(response.payload)
    if (!responseContractVersion) {
      throw new OpsError('OPS public-contracts saknar kontraktsversion.', 502, {
        code: 'ops_public_contracts_contract_version_missing',
        endpoint: '/api/v1/website/public-contracts',
        retryable: false,
      })
    }
    if (responseContractVersion !== GRIDEX_WEBSITE_API_CONTRACT_VERSION) {
      throw new OpsError('OPS public-contracts använder en annan kontraktsversion än Gridex Web.', 502, {
        code: 'ops_public_contracts_contract_version_mismatch',
        endpoint: '/api/v1/website/public-contracts',
        expected: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
        received: responseContractVersion,
        retryable: false,
      })
    }
    if (responseRevision === null || responseRevision < 0) {
      throw new OpsError('OPS public-contracts saknar en giltig publiceringsrevision.', 502, {
        code: 'ops_public_contracts_publication_revision_missing',
        endpoint: '/api/v1/website/public-contracts',
        retryable: false,
      })
    }
    feedMetadata = publicContractFeedMetadata(response.payload, responseRevision)
  } catch (error) {
    if (!options.forceFresh && cached && publicContractsFallbackEligible(error)) {
      return snapshotFromCacheEntry(cached, {
        source: 'stale-cache',
        stale: true,
        staleReason: isOpsError(error) ? error.code ?? 'ops_public_contracts_invalid' : 'ops_public_contracts_invalid',
        upstreamStatus: response.status,
        upstreamRequestId: response.headers.get('x-request-id') ?? cached.upstream_request_id,
        upstreamCorrelationId: response.headers.get('x-correlation-id') ?? cached.upstream_correlation_id,
      })
    }
    throw error
  }

  const allBlocked = parsed.contracts.length === 0 && parsed.blockedContracts.length > 0
  if (allBlocked) {
    if (!options.forceFresh && cached) {
      return snapshotFromCacheEntry(cached, {
        source: 'stale-cache',
        stale: true,
        staleReason: 'ops_public_contracts_all_blocked',
        upstreamStatus: response.status,
        upstreamRequestId: response.headers.get('x-request-id') ?? cached.upstream_request_id,
        upstreamCorrelationId: response.headers.get('x-correlation-id') ?? cached.upstream_correlation_id,
        blockedContracts: [...cached.blocked_contracts, ...parsed.blockedContracts],
        warnings: [...cached.warnings, ...parsed.warnings],
        compatibilityIssues: [...cached.compatibility_issues, ...parsed.compatibilityIssues],
      })
    }
    throw new OpsError('Alla avtal i OPS public-contracts blockerades av canonical validering.', 502, {
      code: 'ops_public_contracts_all_blocked',
      response_publication_revision: responseRevision,
      accepted_count: 0,
      blocked_count: parsed.blockedContracts.length,
      blockers: parsed.blockedContracts,
      request_id: response.headers.get('x-request-id'),
      correlation_id: response.headers.get('x-correlation-id'),
      endpoint: '/api/v1/website/public-contracts',
      retryable: false,
    })
  }


  const snapshot: PublicContractsCacheEntry = {
    cache_key: cacheKey,
    contracts: parsed.contracts,
    blocked_contracts: parsed.blockedContracts,
    feed_state: feedMetadata.feedState,
    empty_feed_authorization: feedMetadata.emptyFeedAuthorization,
    warnings: parsed.warnings,
    compatibility_issues: parsed.compatibilityIssues,
    parser_version: CONTRACT_PARSER_VERSION,
    schema_sha256: WEBSITE_OPENAPI_SCHEMA_SHA256,
    etag: response.headers.get('etag'),
    publication_revision: responseRevision,
    tenant_reference: tenantReference,
    contract_version: responseContractVersion,
    not_modified: false,
    fetched_at: new Date().toISOString(),
    source: 'live',
    stale: false,
    stale_reason: null,
    upstream_status: response.status,
    upstream_request_id: response.headers.get('x-request-id'),
    upstream_correlation_id: response.headers.get('x-correlation-id'),
  }

  let persistenceResult: Awaited<ReturnType<typeof storeWebsitePublicContractSnapshot>> | null = null
  let persistenceFailed = false
  try {
    persistenceResult = await storeWebsitePublicContractSnapshot({
      cacheKey,
      customerType: publicContractsCustomerTypeKey(customerType),
      snapshot,
    })
  } catch (error) {
    persistenceFailed = true
    console.error('[gridex-public-contracts] persistent snapshot write failed', {
      publication_revision: responseRevision,
      accepted_count: parsed.contracts.length,
      blocked_count: parsed.blockedContracts.length,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  if (
    !options.forceFresh &&
    cached &&
    feedMetadata.feedState === 'canonical_empty' &&
    (persistenceFailed || persistenceResult?.stored !== true)
  ) {
    const reason = persistenceFailed
      ? 'persistent_snapshot_write_failed_for_empty_feed'
      : persistenceResult?.result ?? 'empty_feed_not_persisted'
    console.warn('[gridex-public-contracts] retained last-known-good snapshot', {
      cached_publication_revision: cached.publication_revision,
      response_publication_revision: responseRevision,
      reason,
    })
    return snapshotFromCacheEntry(cached, {
      source: 'stale-cache',
      stale: true,
      staleReason: reason,
      upstreamStatus: response.status,
      upstreamRequestId: response.headers.get('x-request-id') ?? cached.upstream_request_id,
      upstreamCorrelationId: response.headers.get('x-correlation-id') ?? cached.upstream_correlation_id,
      blockedContracts: [...cached.blocked_contracts, ...parsed.blockedContracts],
      warnings: [...cached.warnings, ...parsed.warnings],
      compatibilityIssues: [...cached.compatibility_issues, ...parsed.compatibilityIssues],
    })
  }

  if (persistenceResult && !persistenceResult.stored) {
    if (!options.forceFresh) {
      const latest = await persistentPublicContractsCacheEntry(cacheKey)
      if (latest) {
        return snapshotFromCacheEntry(latest, {
          source: 'stale-cache',
          stale: true,
          staleReason: persistenceResult.result,
          upstreamStatus: response.status,
          upstreamRequestId: response.headers.get('x-request-id') ?? latest.upstream_request_id,
          upstreamCorrelationId: response.headers.get('x-correlation-id') ?? latest.upstream_correlation_id,
          blockedContracts: [...latest.blocked_contracts, ...parsed.blockedContracts],
          warnings: [...latest.warnings, ...parsed.warnings],
          compatibilityIssues: [...latest.compatibility_issues, ...parsed.compatibilityIssues],
        })
      }
    }

    const unverifiedEmpty = feedMetadata.feedState === 'canonical_empty'
    throw new OpsError(
      unverifiedEmpty
          ? 'OPS returnerade en tom avtalsfeed som inte kunde verifieras som en avpublicering.'
          : 'OPS public-contracts var äldre än den verifierade publiceringsrevisionen.',
      503,
      {
        code: unverifiedEmpty
          ? 'ops_public_contracts_empty_unverified'
          : 'ops_public_contracts_stale_revision',
        persistence_result: persistenceResult.result,
        response_publication_revision: responseRevision,
        stored_publication_revision: persistenceResult.stored_revision,
        accepted_count: parsed.contracts.length,
        blocked_count: parsed.blockedContracts.length,
        blockers: parsed.blockedContracts,
        request_id: response.headers.get('x-request-id'),
        correlation_id: response.headers.get('x-correlation-id'),
        endpoint: '/api/v1/website/public-contracts',
        retryable: true,
      },
    )
  }

  if (persistenceFailed && feedMetadata.feedState === 'canonical_empty') {
    // Without the durable publication guard, data: [] is ambiguous. It may be
    // a legitimate full unpublish or a transient OPS/database failure. Never
    // turn that ambiguity into a customer-visible empty feed.
    throw new OpsError('En tom OPS-avtalsfeed kunde inte verifieras mot den durabla publiceringsrevisionen.', 503, {
      code: 'ops_public_contracts_empty_verification_unavailable',
      response_publication_revision: responseRevision,
      accepted_count: 0,
      blocked_count: 0,
      request_id: response.headers.get('x-request-id'),
      correlation_id: response.headers.get('x-correlation-id'),
      endpoint: '/api/v1/website/public-contracts',
      retryable: true,
    })
  }

  const mayCacheInMemory = persistenceResult?.stored === true || (persistenceFailed && feedMetadata.feedState === 'contracts_present')
  if (mayCacheInMemory) {
    publicContractsCache.set(cacheKey, snapshot)
  }
  return snapshot
}

export async function fetchOpsPublicContracts(
  customerType?: WebsiteCustomerType | null,
): Promise<OpsPublicContract[]> {
  return (await fetchOpsPublicContractsSnapshot(customerType)).contracts;
}

export async function fetchOpsPublicContractsFresh(
  customerType?: WebsiteCustomerType | null,
): Promise<OpsPublicContract[]> {
  return (await fetchOpsPublicContractsSnapshot(customerType, { forceFresh: true })).contracts;
}

export async function fetchOpsPublicContractDiagnostics(
  customerType?: WebsiteCustomerType | null,
): Promise<OpsPublicContractDiagnostics> {
  const payload = await opsFetch(publicContractsPath(customerType, true));
  await verifiedTenantReference(payload, "/api/v1/website/public-contracts/diagnostics");
  return {
    items: extractPublicContractDiagnostics(payload),
    raw: extractObject(payload),
  };
}

export function mapLegalText(row: unknown): OpsLegalText | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const type = pickString(r, ["type"]);
  const version = pickString(r, ["version"]);
  const title = pickString(r, ["title"]);
  const body = pickString(r, ["body"]);
  const url = pickString(r, ["url"]);

  if (!type || !version || !title || (!body && !url)) return null;

  return {
    type,
    version,
    title,
    body: body ?? null,
    id: pickString(r, ["id"]),
    url,
    offer_reference: pickString(r, ["offer_reference"]),
    published_at: pickString(r, ["published_at"]),
    content_sha256: pickString(r, ["content_sha256"]),
    legal_bundle_version_id: pickString(r, ["legal_bundle_version_id"]),
    raw: r,
  };
}

export type OpsWebsiteLegalBundle = {
  offer_reference: string;
  bundle_version: string;
  required_types: string[];
  present_types: string[];
  complete: boolean;
  missing_types: string[];
  requirements: Array<{
    requirement_code: 'agreement' | 'power_of_attorney' | 'withdrawal';
    document_type: 'agreement' | 'power_of_attorney' | 'withdrawal';
    title: string;
    description: string;
    required: true;
    acceptance_mode: 'accept' | 'acknowledge';
    document_reference: string;
    document_version: string;
    document_hash: string;
    document_url: string | null;
    legal_bundle_version_id: string;
    module_keys: string[];
    source_document_ids: string[];
    primary_document_id: string | null;
    sort_order: number;
  }>;
  texts: OpsLegalText[];
  raw: Record<string, unknown>;
};

export async function fetchOpsWebsiteLegalBundle(
  offerReference: string,
): Promise<OpsWebsiteLegalBundle> {
  const normalized = normalizeText(offerReference)
  if (!normalized) {
    throw new OpsError('offer_reference krävs för juridikpaketet.', 400, {
      code: 'offer_reference_required',
      field: 'offer_reference',
    })
  }
  const endpoint = `/api/v1/website/legal-bundle?offer_reference=${encodeURIComponent(normalized)}`
  const payload = await opsFetch(endpoint)
  observeRuntimeSchemaValidation({ endpoint, schema: 'WebsiteLegalBundleResponse', validate: () => assertWebsiteResponse('WebsiteLegalBundleResponse', payload, endpoint) })
  await verifiedTenantReference(payload, '/api/v1/website/legal-bundle')
  const raw = extractObject(payload)
  const legal = recordValue(raw.legal) ?? {}
  const rows = Array.isArray(legal.module_versions)
    ? legal.module_versions.map((value) => {
        const row = recordValue(value) ?? {}
        return {
          type: row.module_key,
          version: row.version,
          title: row.title,
          id: row.id,
          url: row.url,
          published_at: row.published_at,
          offer_reference: raw.offer_reference,
          content_sha256: row.content_sha256,
          legal_bundle_version_id: row.legal_bundle_version_id,
        }
      })
    : []
  const requiredTypes = Array.isArray(raw.required_types)
    ? raw.required_types.map(String)
    : []
  const requirements: OpsWebsiteLegalBundle['requirements'] = Array.isArray(raw.requirements)
    ? raw.requirements.flatMap<OpsWebsiteLegalBundle['requirements'][number]>((value) => {
        const requirement = recordValue(value)
        const requirementCode = normalizeText(requirement?.requirement_code)
        const documentType = normalizeText(requirement?.document_type)
        const title = normalizeText(requirement?.title)
        const description = normalizeText(requirement?.description)
        const acceptanceMode = normalizeText(requirement?.acceptance_mode)
        const documentReference = normalizeText(
          requirement?.document_reference ?? requirement?.document_id,
        )
        const documentVersion = normalizeText(requirement?.document_version)
        const documentHash = normalizeText(requirement?.document_hash)
        const documentUrl = normalizeText(requirement?.document_url)
        const legalBundleVersionId = normalizeText(requirement?.legal_bundle_version_id)
        const moduleKeys = Array.isArray(requirement?.module_keys)
          ? requirement.module_keys.map(String).map((value) => value.trim()).filter(Boolean)
          : []
        const sourceDocumentIds = Array.isArray(requirement?.source_document_ids)
          ? requirement.source_document_ids.map(String).map((value) => value.trim()).filter(Boolean)
          : []
        const primaryDocumentId = normalizeText(requirement?.primary_document_id)
        const sortOrder = typeof requirement?.sort_order === 'number' && Number.isInteger(requirement.sort_order)
          ? requirement.sort_order
          : null
        if (
          (requirementCode !== 'agreement' &&
            requirementCode !== 'power_of_attorney' &&
            requirementCode !== 'withdrawal') ||
          documentType !== requirementCode ||
          !title ||
          !description ||
          requirement?.required !== true ||
          (acceptanceMode !== 'accept' && acceptanceMode !== 'acknowledge') ||
          !documentReference ||
          !documentVersion ||
          !documentHash ||
          !/^[a-f0-9]{64}$/i.test(documentHash) ||
          !legalBundleVersionId ||
          moduleKeys.length === 0 ||
          new Set(moduleKeys).size !== moduleKeys.length ||
          sourceDocumentIds.length === 0 ||
          new Set(sourceDocumentIds).size !== sourceDocumentIds.length ||
          (primaryDocumentId !== null && !sourceDocumentIds.includes(primaryDocumentId)) ||
          sortOrder === null ||
          sortOrder < 0
        ) {
          return []
        }
        return [{
          requirement_code: requirementCode,
          document_type: requirementCode,
          title,
          description,
          required: true as const,
          acceptance_mode: acceptanceMode,
          document_reference: documentReference,
          document_version: documentVersion,
          document_hash: documentHash,
          document_url: documentUrl,
          legal_bundle_version_id: legalBundleVersionId,
          module_keys: moduleKeys,
          source_document_ids: sourceDocumentIds,
          primary_document_id: primaryDocumentId,
          sort_order: sortOrder,
        }]
      })
    : []
  const offer = normalizeText(raw.offer_reference)
  const bundleVersion = normalizeText(raw.bundle_version)
  if (offer !== normalized || !bundleVersion) {
    throw new OpsError('Juridikpaketet matchar inte valt erbjudande.', 502, {
      code: 'ops_legal_bundle_binding_invalid',
      expected_offer_reference: normalized,
      received_offer_reference: offer,
    })
  }
  return {
    offer_reference: offer,
    bundle_version: bundleVersion,
    required_types: requiredTypes,
    present_types: Array.isArray(raw.present_types) ? raw.present_types.map(String) : [],
    complete: raw.complete === true,
    missing_types: Array.isArray(raw.missing_types) ? raw.missing_types.map(String) : [],
    requirements,
    texts: rows.map(mapLegalText).filter((item): item is OpsLegalText => item !== null),
    raw,
  };
}