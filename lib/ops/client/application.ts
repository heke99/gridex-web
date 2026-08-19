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

import type { OpsCustomerApplicationRequestDto, OpsPowerOfAttorneyScope, OpsPowerOfAttorneyMethod, OpsCustomerApplicationInput, OpsWebsiteSupplierSwitchState, OpsPowerOfAttorneyState, OpsCustomerApplicationCommunicationItem, OpsCustomerApplicationCommunication, OpsCustomerApplicationResult, AcceptedOpsCustomerApplicationResult, OpsInvoiceDeliveryMethod } from './types'
import { getOpsClientStatus, normalizeNumber, normalizeText, recordValue, pickString, pickBoolean, observeRuntimeSchemaValidation, opsFetch, getVerifiedOpsIntegrationContext, verifiedOrganizationReference, stringArray } from './core'
import { opsErrorCodeValue } from './portal'

export function buildOpsCustomerApplicationPayload(input: OpsCustomerApplicationInput) {
  const externalCustomerId = normalizeText(input.external_customer_id)
  const offerReference = normalizeText(input.offer_reference)
  const quoteReference = normalizeText(input.quote_reference)
  const resolutionId = normalizeText(input.resolution_id)
  const priceOptionReference = normalizeText(input.price_option_reference)
  const startDate = normalizeText(input.start_date)
  if (!externalCustomerId) {
    throw new OpsError('Ett stabilt externt kund-ID krävs.', 400, {
      code: 'external_customer_id_required',
      field: 'external_customer_id',
    })
  }
  const required: Array<[string, string | null]> = [
    ['offer_reference', offerReference],
    ['quote_reference', quoteReference],
    ['price_option_reference', priceOptionReference],
    ['resolution_id', resolutionId],
    ['start_date', startDate],
  ]
  for (const [field, value] of required) {
    if (!value) {
      throw new OpsError(`Obligatoriskt OPS-fält saknas: ${field}.`, 400, {
        code: `${field}_required`,
        field,
      })
    }
  }
  const validInvoiceDeliveryMethods: OpsInvoiceDeliveryMethod[] = ['email', 'e_invoice', 'paper', 'direct_debit']
  if (!validInvoiceDeliveryMethods.includes(input.invoice_delivery_method)) {
    throw new OpsError('Fakturaleveransmetoden är ogiltig.', 400, {
      code: 'invoice_delivery_method_invalid',
      field: 'invoice_delivery_method',
    })
  }
  if (!Number.isInteger(input.site_count) || input.site_count < 1 || input.site_count > 1_000) {
    throw new OpsError('Antalet anläggningar är ogiltigt.', 400, {
      code: 'site_count_invalid',
      field: 'site_count',
    })
  }
  if (input.site_count !== 1) {
    throw new OpsError('Kundansökan innehåller en anläggning men site_count matchar inte.', 400, {
      code: 'site_count_mismatch',
      field: 'site_count',
    })
  }
  if (
    !Array.isArray(input.selected_component_references) ||
    input.selected_component_references.some((reference) => !/^[a-z0-9][a-z0-9_-]{2,159}$/i.test(reference)) ||
    new Set(input.selected_component_references).size !== input.selected_component_references.length
  ) {
    throw new OpsError('Valda komponentreferenser är ogiltiga.', 400, {
      code: 'selected_component_references_invalid',
      field: 'selected_component_references',
    })
  }
  if (!Number.isFinite(input.annual_consumption_kwh) || input.annual_consumption_kwh <= 0) {
    throw new OpsError('Årsförbrukningen är ogiltig.', 400, {
      code: 'annual_consumption_invalid',
      field: 'annual_consumption_kwh',
    })
  }
  if (!isStrictCalendarDate(startDate)) {
    throw new OpsError('Startdatum är inte ett verkligt kalenderdatum.', 400, {
      code: 'start_date_invalid',
      field: 'start_date',
    })
  }
  const customerPortalUserId = normalizeText(input.customer_portal_user_id)
  const authUserId = normalizeText(input.auth_user_id)
  if (!customerPortalUserId || !authUserId) {
    throw new OpsError('Verifierad portalidentitet krävs innan kundansökan kan skickas.', 400, {
      code: 'customer_portal_identity_required',
      field: !customerPortalUserId ? 'customer_portal_user_id' : 'auth_user_id',
      retryable: false,
    })
  }
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidPattern.test(customerPortalUserId) || !uuidPattern.test(authUserId)) {
    throw new OpsError('Portalidentiteten måste vara ett giltigt användar-UUID.', 400, {
      code: 'customer_portal_identity_invalid',
      field: !uuidPattern.test(customerPortalUserId) ? 'customer_portal_user_id' : 'auth_user_id',
      retryable: false,
    })
  }
  if (customerPortalUserId !== authUserId) {
    throw new OpsError('Portalidentiteten måste innehålla samma verifierade användar-ID i båda fälten.', 400, {
      code: 'customer_portal_identity_mismatch',
      field: 'auth_user_id',
      retryable: false,
    })
  }
  const portalIdentitySupported =
    websiteSchemaHasProperty('CustomerApplicationRequest', 'customer_portal_user_id') &&
    websiteSchemaHasProperty('CustomerApplicationRequest', 'auth_user_id') &&
    websiteSchemaRequiresProperty('CustomerApplicationRequest', 'customer_portal_user_id') &&
    websiteSchemaRequiresProperty('CustomerApplicationRequest', 'auth_user_id')
  if (!portalIdentitySupported) {
    throw new OpsError('OPS OpenAPI saknar stöd för atomisk Mina sidor-koppling i kundansökan.', 503, {
      code: 'ops_customer_application_portal_identity_contract_unsupported',
      endpoint: '/api/v1/website/customer-applications',
      contract_version: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
      retryable: false,
    })
  }
  const customerEmail = normalizeText(input.customer.email)
  const customerPhone = normalizeText(input.customer.phone)
  const personalNumber = normalizeText(input.customer.personal_number)
  if (!customerEmail || !customerPhone) {
    throw new OpsError('Kundens kontaktuppgifter är ofullständiga.', 400, {
      code: 'customer_contact_required',
      field: !customerEmail ? 'customer.email' : 'customer.phone',
    })
  }
  if (!personalNumber) {
    throw new OpsError('Kundens eller firmatecknarens personnummer saknas.', 400, {
      code: 'customer_personal_number_required',
      field: 'customer.personal_number',
    })
  }
  if (input.customer.customer_type === 'business') {
    if (!normalizeText(input.customer.company_name)) {
      throw new OpsError('Företagsnamn saknas.', 400, {
        code: 'customer_company_name_required',
        field: 'customer.company_name',
      })
    }
    if (!normalizeText(input.customer.organization_number)) {
      throw new OpsError('Organisationsnummer saknas.', 400, {
        code: 'customer_organization_number_required',
        field: 'customer.organization_number',
      })
    }
  }

  const legalBundleVersion = normalizeText(input.legal_bundle_version)
  if (!legalBundleVersion || input.legal_acceptances.length === 0) {
    throw new OpsError('Dokumentbundna juridikacceptanser saknas.', 400, {
      code: 'legal_acceptances_required',
      field: 'legal_acceptances',
      retryable: false,
    })
  }
  const legalAcceptances = input.legal_acceptances
  if (
    legalAcceptances.some(
      (acceptance) =>
        acceptance.accepted !== true ||
        !normalizeText(acceptance.requirement_code) ||
        !normalizeText(acceptance.document_reference) ||
        !normalizeText(acceptance.document_version) ||
        !/^[a-f0-9]{64}$/i.test(acceptance.document_hash) ||
        !normalizeText(acceptance.accepted_at),
    )
  ) {
    throw new OpsError('En juridikacceptans saknar exakt dokumentbevis.', 400, {
      code: 'legal_acceptance_document_invalid',
      field: 'legal_acceptances',
      retryable: false,
    })
  }
  if (
    input.site.current_supplier_unknown === true &&
    Boolean(
      normalizeText(input.site.current_supplier_name) ||
      normalizeText(input.site.current_supplier_org_number) ||
      normalizeText(input.site.current_supplier_ediel_id),
    )
  ) {
    throw new OpsError('Okänd leverantör kan inte kombineras med leverantörsuppgifter.', 400, {
      code: 'current_supplier_conflict',
      field: 'site.current_supplier_unknown',
    })
  }

  const signerName = input.powerOfAttorney?.signerName?.trim()
  if (input.powerOfAttorney) {
    if (input.powerOfAttorney.accepted !== true) {
      throw new OpsError('Fullmakten måste vara uttryckligen godkänd.', 400, {
        code: 'power_of_attorney_acceptance_required',
        field: 'powerOfAttorney.accepted',
      })
    }
    if (!signerName) {
      throw new OpsError('Fullmaktens undertecknarnamn saknas.', 400, {
        code: 'power_of_attorney_signer_name_required',
        field: 'powerOfAttorney.signerName',
      })
    }
    const signerIdentityNumber = normalizeText(input.powerOfAttorney.signerIdentityNumber)
    if (!signerIdentityNumber || signerIdentityNumber.length < 6) {
      throw new OpsError('Fullmaktens undertecknaridentitet är ogiltig.', 400, {
        code: 'power_of_attorney_signer_identity_required',
        field: 'powerOfAttorney.signerIdentityNumber',
      })
    }
    const uniqueScopes = new Set(input.powerOfAttorney.scope)
    if (uniqueScopes.size < 1 || uniqueScopes.size !== input.powerOfAttorney.scope.length) {
      throw new OpsError('Fullmaktens behörighetsomfång är ogiltigt.', 400, {
        code: 'power_of_attorney_scope_invalid',
        field: 'powerOfAttorney.scope',
      })
    }
    const validScopes: OpsPowerOfAttorneyScope[] = [
      'supplier_switch',
      'facility_information_lookup',
    ]
    if (input.powerOfAttorney.scope.some((scope) => !validScopes.includes(scope))) {
      throw new OpsError('Fullmakten innehåller ett okänt behörighetsomfång.', 400, {
        code: 'power_of_attorney_scope_invalid',
        field: 'powerOfAttorney.scope',
      })
    }
    const validMethods: OpsPowerOfAttorneyMethod[] = [
      'website_acceptance',
      'bankid',
      'electronic_signature',
      'manual_signature',
    ]
    if (!validMethods.includes(input.powerOfAttorney.method)) {
      throw new OpsError('Fullmaktens signeringsmetod är ogiltig.', 400, {
        code: 'power_of_attorney_method_invalid',
        field: 'powerOfAttorney.method',
      })
    }
    if (!normalizeText(input.powerOfAttorney.textVersionId)) {
      throw new OpsError('Fullmaktens textversion saknas.', 400, {
        code: 'power_of_attorney_text_version_required',
        field: 'powerOfAttorney.textVersionId',
      })
    }
  }

  const payload = {
    external_customer_id: externalCustomerId,
    offer_reference: offerReference!,
    quote_reference: quoteReference!,
    price_option_reference: priceOptionReference!,
    invoice_delivery_method: input.invoice_delivery_method,
    selected_component_references: [...input.selected_component_references],
    site_count: input.site_count,
    resolution_id: resolutionId!,
    annual_consumption_kwh: input.annual_consumption_kwh,
    start_date: startDate!,
    customer_portal_user_id: customerPortalUserId,
    auth_user_id: authUserId,
    customer: {
      customer_type: toOpsCustomerType(input.customer.customer_type),
      ...(normalizeText(input.customer.first_name) ? { first_name: normalizeText(input.customer.first_name)! } : {}),
      ...(normalizeText(input.customer.last_name) ? { last_name: normalizeText(input.customer.last_name)! } : {}),
      ...(input.customer.customer_type === 'business'
        ? {
            company_name: normalizeText(input.customer.company_name)!,
            org_number: normalizeText(input.customer.organization_number)!,
          }
        : {}),
      personal_number: personalNumber,
      email: customerEmail,
      phone: customerPhone,
      ...(normalizeText(input.customer.invoice_email)
        ? { invoice_email: normalizeText(input.customer.invoice_email)! }
        : {}),
      ...(normalizeText(input.customer.billing_street)
        ? { billing_street: normalizeText(input.customer.billing_street)! }
        : {}),
      ...(normalizeText(input.customer.billing_postal_code)
        ? { billing_postal_code: normalizeText(input.customer.billing_postal_code)!.replace(/\s+/g, '') }
        : {}),
      ...(normalizeText(input.customer.billing_city)
        ? { billing_city: normalizeText(input.customer.billing_city)! }
        : {}),
      ...(normalizeText(input.customer.billing_country)
        ? { billing_country: normalizeText(input.customer.billing_country)!.toUpperCase() }
        : {}),
    },
    site: {
      ...(input.site.facility_id ? { facility_id: input.site.facility_id } : {}),
      ...(input.site.site_name ? { site_name: input.site.site_name } : {}),
      ...(input.site.site_type ? { site_type: input.site.site_type } : {}),
      ...(input.site.move_in_date ? { move_in_date: input.site.move_in_date } : {}),
      street: input.site.street,
      postal_code: input.site.postal_code.replace(/\s+/g, ''),
      city: input.site.city,
      country: input.site.country ?? 'SE',
      ...(input.site.price_area_code ? { price_area_code: input.site.price_area_code } : {}),
      ...(input.site.grid_area_code ? { grid_area_code: input.site.grid_area_code } : {}),
      ...(input.site.grid_owner_id ? { grid_owner_id: input.site.grid_owner_id } : {}),
      annual_consumption_kwh: input.annual_consumption_kwh,
      ...(input.site.current_supplier_name ? { current_supplier_name: input.site.current_supplier_name } : {}),
      ...(input.site.current_supplier_org_number ? { current_supplier_org_number: input.site.current_supplier_org_number } : {}),
      ...(input.site.current_supplier_ediel_id ? { current_supplier_ediel_id: input.site.current_supplier_ediel_id } : {}),
      ...(typeof input.site.current_supplier_unknown === 'boolean'
        ? { current_supplier_unknown: input.site.current_supplier_unknown }
        : {}),
    },
    ...(input.metering_point
      ? {
          metering_point: {
            ...(input.metering_point.metering_point_id
              ? { metering_point_id: input.metering_point.metering_point_id }
              : {}),
            ...(input.metering_point.site_facility_id
              ? { site_facility_id: input.metering_point.site_facility_id }
              : {}),
            ...(input.metering_point.reading_frequency
              ? { reading_frequency: input.metering_point.reading_frequency }
              : {}),
            ...(input.metering_point.measurement_type
              ? { measurement_type: input.metering_point.measurement_type }
              : {}),
            ...(input.metering_point.price_area_code
              ? { price_area_code: input.metering_point.price_area_code }
              : {}),
            ...(input.metering_point.grid_area_code
              ? { grid_area_code: input.metering_point.grid_area_code }
              : {}),
            ...(input.metering_point.grid_owner_id
              ? { grid_owner_id: input.metering_point.grid_owner_id }
              : {}),
            ...(input.metering_point.start_date
              ? { start_date: input.metering_point.start_date }
              : {}),
            ...(input.metering_point.installation_date
              ? { installation_date: input.metering_point.installation_date }
              : {}),
          },
        }
      : {}),
    contract: {
      requested_start_mode: input.contract.requested_start_mode,
      ...(input.contract.requested_start_mode === 'specific_date'
        ? { requested_start_date: input.contract.requested_start_date ?? startDate! }
        : input.contract.requested_start_date
          ? { requested_start_date: input.contract.requested_start_date }
          : {}),
    },
    legal_bundle_version: legalBundleVersion,
    legal_acceptances: legalAcceptances,
    ...(input.powerOfAttorney
      ? {
          powerOfAttorney: {
            accepted: true as const,
            scope: input.powerOfAttorney.scope,
            signerName: signerName!,
            signerIdentityNumber: input.powerOfAttorney.signerIdentityNumber.trim(),
            method: input.powerOfAttorney.method,
            ...(input.powerOfAttorney.acceptedAt
              ? { acceptedAt: input.powerOfAttorney.acceptedAt }
              : {}),
            textVersionId: input.powerOfAttorney.textVersionId.trim(),
            ...(input.powerOfAttorney.ipAddress
              ? { ipAddress: input.powerOfAttorney.ipAddress }
              : {}),
            ...(input.powerOfAttorney.userAgent
              ? { userAgent: input.powerOfAttorney.userAgent }
              : {}),
          },
        }
      : {}),
  } as OpsCustomerApplicationRequestDto
  assertWebsiteRequest(
    'CustomerApplicationRequest',
    payload,
    '/api/v1/website/customer-applications',
  )
  return payload
}

export function mapCustomerApplicationCommunicationItem(
  value: unknown,
): OpsCustomerApplicationCommunicationItem | null {
  const row = recordValue(value)
  if (!row) return null
  const item: OpsCustomerApplicationCommunicationItem = {
    ...(pickString(row, ['event_type']) ? { event_type: pickString(row, ['event_type'])! } : {}),
    ...(pickString(row, ['code']) ? { code: pickString(row, ['code'])! } : {}),
    ...(pickString(row, ['status']) ? { status: pickString(row, ['status'])! } : {}),
    ...(pickString(row, ['message']) ? { message: pickString(row, ['message'])! } : {}),
    ...(pickString(row, ['occurred_at']) ? { occurred_at: pickString(row, ['occurred_at'])! } : {}),
  }
  return Object.keys(item).length > 0 ? item : null
}

export function mapCommunicationItems(
  row: Record<string, unknown>,
  key: 'triggered' | 'queued' | 'sent' | 'failed',
): OpsCustomerApplicationCommunicationItem[] {
  const value = row[key]
  if (!Array.isArray(value)) {
    throw new OpsError('OPS kommunikationsresultat följer inte API-kontraktet.', 502, {
      code: 'ops_application_communication_invalid',
      field: `communication.${key}`,
    })
  }
  return value
    .map(mapCustomerApplicationCommunicationItem)
    .filter((item): item is OpsCustomerApplicationCommunicationItem => item !== null)
}

export function mapCustomerApplicationCommunication(
  value: unknown,
): OpsCustomerApplicationCommunication | null {
  if (value === null || value === undefined) return null
  const row = recordValue(value)
  if (!row) {
    throw new OpsError('OPS kommunikationsresultat följer inte API-kontraktet.', 502, {
      code: 'ops_application_communication_invalid',
    })
  }
  const pending = pickBoolean(row, ['pending'])
  const sourceOfTruth = pickString(row, ['source_of_truth'])
  if (pending === null || sourceOfTruth !== 'communication_logs') {
    throw new OpsError('OPS kommunikationsresultat saknar obligatoriska fält.', 502, {
      code: 'ops_application_communication_invalid',
      pending,
      source_of_truth: sourceOfTruth,
    })
  }
  return {
    pending,
    source_of_truth: 'communication_logs',
    triggered: mapCommunicationItems(row, 'triggered'),
    queued: mapCommunicationItems(row, 'queued'),
    sent: mapCommunicationItems(row, 'sent'),
    failed: mapCommunicationItems(row, 'failed'),
    raw: row,
  }
}

export async function submitOpsCustomerApplication(
  input: OpsCustomerApplicationInput,
): Promise<AcceptedOpsCustomerApplicationResult> {
  if (!getOpsClientStatus().liveSignupEnabled) {
    throw new OpsError("Live-teckning är avstängd för hemsidan.", 503);
  }

  await getVerifiedOpsIntegrationContext();

  const applicationPayload = buildOpsCustomerApplicationPayload(input);

  let payload: unknown;
  try {
    payload = await opsFetch("/api/v1/website/customer-applications", {
      method: "POST",
      headers: { "Idempotency-Key": input.idempotency_key },
      body: JSON.stringify(applicationPayload),
    });
    observeRuntimeSchemaValidation({
      endpoint: '/api/v1/website/customer-applications',
      schema: 'WebsiteCustomerApplicationResponse',
      validate: () => assertWebsiteResponse('WebsiteCustomerApplicationResponse', payload, '/api/v1/website/customer-applications'),
    })
    await verifiedOrganizationReference(payload, "/api/v1/website/customer-applications");
  } catch (error) {
    if (!isOpsError(error) || error.status !== 409) throw error;
    const code = opsErrorCodeValue(error) ?? "";
    if (code !== 'duplicate_application') throw error;
    const recovered = recoverCustomerApplicationConflict(error.details);
    if (!recovered) throw error;
    payload = recovered;
  }

  const result = mapOpsCustomerApplicationResult(payload);
  assertAcceptedApplication(result);
  return result;
}

export function recoverCustomerApplicationConflict(value: unknown): unknown | null {
  const queue: unknown[] = [value];
  const visited = new Set<object>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || Array.isArray(current)) continue;
    if (visited.has(current)) continue;
    visited.add(current);
    const row = current as Record<string, unknown>;
    const hasStableResult = Boolean(
      pickString(row, ["application_number", "applicationNumber"]) &&
        pickString(row, ["customer_id", "customerId", "customer_number", "customerNumber", "external_customer_id", "externalCustomerId"]),
    );
    if (hasStableResult) return row;
    for (const key of ["data", "application", "existing_application", "existingApplication", "result", "details", "error"]) {
      if (row[key]) queue.push(row[key]);
    }
  }
  return null;
}

export function mapWebsiteSupplierSwitchState(value: unknown): OpsWebsiteSupplierSwitchState {
  const row = recordValue(value)
  if (!row) {
    throw new OpsError('OPS kundansökan saknar supplier_switch.', 502, {
      code: 'ops_application_supplier_switch_invalid',
    })
  }
  const status = pickString(row, ['status'])
  const canCreateRequest = pickBoolean(row, ['can_create_request'])
  const canDispatch = pickBoolean(row, ['can_dispatch'])
  const nextAction = pickString(row, ['next_action'])
  const blockers = Array.isArray(row.blockers) ? row.blockers.map(String) : null
  if (
    (status !== 'not_created' && status !== 'created') ||
    canCreateRequest === null ||
    canDispatch === null ||
    blockers === null ||
    !nextAction ||
    !['create_supplier_switch_request', 'await_supplier_switch_processing', 'resolve_switch_blockers'].includes(nextAction)
  ) {
    throw new OpsError('OPS supplier_switch följer inte API-kontraktet.', 502, {
      code: 'ops_application_supplier_switch_invalid',
      status,
      can_create_request: canCreateRequest,
      can_dispatch: canDispatch,
      next_action: nextAction,
    })
  }
  return {
    request_reference: pickString(row, ['request_reference', 'request_id']),
    status,
    can_create_request: canCreateRequest,
    can_dispatch: canDispatch,
    blockers,
    next_action: nextAction as OpsWebsiteSupplierSwitchState['next_action'],
  }
}

export function mapApplicationPowerOfAttorney(value: unknown): OpsPowerOfAttorneyState | null {
  if (value === null || value === undefined) return null
  const row = recordValue(value)
  const status = row ? pickString(row, ['status']) : null
  if (status !== 'signed' && status !== 'missing') {
    throw new OpsError('OPS fullmaktsstatus följer inte API-kontraktet.', 502, {
      code: 'ops_application_power_of_attorney_invalid',
      status,
    })
  }
  return { status }
}

export function mapOpsCustomerApplicationResult(
  payload: unknown,
): OpsCustomerApplicationResult {
  const root = recordValue(payload) ?? {}
  const row = recordValue(root.data) ?? root
  const stringArray = (key: string): string[] => {
    const value = row[key]
    if (!Array.isArray(value)) {
      throw new OpsError('OPS kundansökningssvar saknar obligatorisk lista.', 502, {
        code: 'ops_application_contract_invalid',
        field: key,
      })
    }
    return value.map(String)
  }
  const rawDirection = pickString(row, ['energy_direction'])
  const energyDirection = rawDirection === null
    ? null
    : rawDirection === 'consumption' || rawDirection === 'production'
      ? rawDirection
      : null
  if (rawDirection && !energyDirection) {
    throw new OpsError('OPS kundansökan innehåller okänd energiriktning.', 502, {
      code: 'ops_application_energy_direction_invalid',
      energy_direction: rawDirection,
    })
  }

  const status = pickString(row, ['status'])
  if (!status) {
    throw new OpsError('OPS kundansökan saknar obligatorisk status.', 502, {
      code: 'ops_application_status_missing',
      field: 'status',
      retryable: false,
    })
  }

  return {
    status,
    customer_id: pickString(row, ['customer_id']),
    customer_number: pickString(row, ['customer_number']),
    application_number: pickString(row, ['application_number']),
    customer_reference: pickString(row, ['customer_reference']),
    application_reference: pickString(row, ['application_reference']),
    facility_reference: pickString(row, ['facility_reference']),
    metering_point_reference: pickString(row, ['metering_point_reference']),
    contract_reference: pickString(row, ['contract_reference']),
    external_customer_id: pickString(row, ['external_customer_id']),
    external_customer_reference: pickString(row, ['external_customer_reference']),
    customer_site_id: pickString(row, ['customer_site_id']),
    site_id: pickString(row, ['site_id']),
    metering_point_id: pickString(row, ['metering_point_id']),
    contract_id: pickString(row, ['contract_id']),
    contract_number: pickString(row, ['contract_number']),
    contract_status: pickString(row, ['contract_status']),
    offer_reference: pickString(row, ['offer_reference']),
    quote_reference: pickString(row, ['quote_reference']),
    quote_valid_until: pickString(row, ['quote_valid_until']),
    quote_bound: pickBoolean(row, ['quote_bound']),
    created_customer: pickBoolean(row, ['created_customer']),
    requested_start_date: pickString(row, ['requested_start_date']),
    confirmed_start_date: pickString(row, ['confirmed_start_date']),
    actual_start_date: pickString(row, ['actual_start_date']),
    requested_start_mode: pickString(row, ['requested_start_mode']),
    calculated_earliest_start_date: pickString(row, ['calculated_earliest_start_date']),
    grid_area_code: pickString(row, ['grid_area_code']),
    price_area_code: pickString(row, ['price_area_code']),
    resolution_id: pickString(row, ['resolution_id']),
    resolution_status: pickString(row, ['resolution_status']),
    resolution_confidence: normalizeNumber(row.resolution_confidence),
    grid_owner_verification_status: pickString(row, ['grid_owner_verification_status']),
    grid_owner_verification_issues: stringArray('grid_owner_verification_issues'),
    can_request_grid_owner_information: pickBoolean(row, ['can_request_grid_owner_information']),
    can_send_agreement_confirmation: pickBoolean(row, ['can_send_agreement_confirmation']),
    can_activate_customer: pickBoolean(row, ['can_activate_customer']),
    signed_at: pickString(row, ['signed_at']),
    withdrawal_deadline_at: pickString(row, ['withdrawal_deadline_at']),
    signature_snapshot_sha256: pickString(row, ['signature_snapshot_sha256']),
    workflow_id: pickString(row, ['workflow_id']),
    continuation_job_id: pickString(row, ['continuation_job_id']),
    workflow_state: pickString(row, ['workflow_state']),
    energy_direction: energyDirection,
    supplier_switch: mapWebsiteSupplierSwitchState(row.supplier_switch),
    power_of_attorney: mapApplicationPowerOfAttorney(row.power_of_attorney),
    nextAction: recordValue(row.next_action),
    communication: mapCustomerApplicationCommunication(row.communication),
    request_id: pickString(root, ['request_id']),
    correlation_id: pickString(root, ['correlation_id']),
    trace_id: pickString(root, ['trace_id']),
    contract_schema_version: pickString(root, ['contract_schema_version']),
    missing_fields: stringArray('missing_fields'),
    blocking_reasons: stringArray('blocking_reasons'),
    warnings: stringArray('warnings'),
    next_step: pickString(row, ['next_step']),
    message: pickString(row, ['message']),
    raw: row,
  }
}

export function assertAcceptedApplication(
  result: OpsCustomerApplicationResult,
): asserts result is AcceptedOpsCustomerApplicationResult {
  const fail = (code: string, field: string, received?: unknown): never => {
    throw new OpsError('OPS accepterade inte kundansökan enligt det canonicala kontraktet.', 502, {
      code,
      field,
      received: received ?? null,
      application_number: result.application_number ?? null,
      request_id: result.request_id ?? null,
      retryable: false,
    })
  }

  if (result.status !== 'accepted') fail('ops_application_not_accepted', 'status', result.status)
  if (!result.application_number?.trim()) fail('ops_application_number_missing', 'application_number')
  if (!result.customer_number?.trim()) fail('ops_customer_number_missing', 'customer_number')
  if (result.contract_status !== 'signed') fail('ops_contract_not_signed', 'contract_status', result.contract_status)
  if (!result.signed_at || Number.isNaN(Date.parse(result.signed_at))) {
    fail('ops_signed_at_missing', 'signed_at', result.signed_at)
  }
  if (!/^[a-f0-9]{64}$/i.test(result.signature_snapshot_sha256 ?? '')) {
    fail('ops_signature_evidence_invalid', 'signature_snapshot_sha256', result.signature_snapshot_sha256)
  }
  if (result.workflow_state !== 'canonical_data_committed') {
    fail('ops_workflow_not_committed', 'workflow_state', result.workflow_state)
  }
  // The current immutable Website OpenAPI does not expose a continuation_job_id.
  // Its documented accepted status is therefore the public proof that the
  // idempotent signature/workflow/continuation stages completed. Do not invent
  // a non-contractual required field here.
  if (!result.communication || result.communication.source_of_truth !== 'communication_logs') {
    fail('ops_communication_contract_invalid', 'communication', result.communication)
  }
}