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

export type OpsContractType =
  | 'fixed'
  | 'variable_monthly'
  | 'variable_hourly'
  | 'variable_quarterly'
  | 'portfolio'
  | 'mixed'
  // Presentation-only aliases accepted from historical cached fixtures.
  | 'variable_spot'
  | 'spot_monthly'
  | 'spot_hourly'
  | 'spot_quarterly'
  | 'quarter_hourly'
  | 'portfolio_managed'
  | 'mix'
  | 'monthly_fixed'
  | 'fixed_monthly';

export type OpsEnergyDirection = WebsiteApiComponents['schemas']['EnergyDirection'];
export type OpsProductionPricing = WebsiteApiComponents['schemas']['ProductionPricing'];
export type OpsWebsiteQuoteRequestDto = WebsiteApiComponents['schemas']['WebsiteQuoteRequest'];
export type OpsCustomerApplicationRequestDto = WebsiteApiComponents['schemas']['CustomerApplicationRequest'];
export type OpsWebsiteQuoteValidationRequestDto = WebsiteApiComponents['schemas']['QuoteValidationRequest'];
export type OpsLegalAcceptancesDto = WebsiteApiComponents['schemas']['LegalAcceptances'];
export type OpsCurrentMarketPriceDto = WebsiteApiComponents['schemas']['CurrentMarketPrice'];
export type OpsCurrentMarketPriceResponseDto = WebsiteApiComponents['schemas']['CurrentMarketPriceResponse'];
export type OpsCustomerApplicationStatusDto = WebsiteApiComponents['schemas']['CustomerApplicationStatus'];
export type OpsWebsiteEnergyAreaResolveResponseDto = WebsiteApiComponents['schemas']['WebsiteEnergyAreaResolveResponse'];
export type OpsWebsiteEnergyAreaResolutionDto = WebsiteApiComponents['schemas']['WebsiteEnergyAreaResolution'];
export type OpsSwitchStatusDto = WebsiteApiComponents['schemas']['SwitchStatus'];


export type OpsPublicContract = {
  offer_reference: string;
  energy_direction: OpsEnergyDirection;
  channel: 'website';
  customer_type: 'private' | 'business' | 'both';
  production_pricing: PublicProductionPricing | null;
  product_code?: string | null;
  name: string;
  type: OpsContractType;
  contract_type?: OpsContractType;
  price_areas?: OpsWebsitePriceArea[];
  area_pricing?: PublicAreaPricing[];
  short_description?: string | null;
  marketing_description?: string | null;
  badge_text?: string | null;
  monthly_fee_sek?: number | null;
  invoice_fee_sek?: number | null;
  markup_ore_per_kwh?: number | null;
  variable_markup_ore_per_kwh?: number | null;
  fixed_price_ore_per_kwh?: number | null;
  monthly_fixed_price_sek?: number | null;
  elcert_ore_per_kwh?: number | null;
  portfolio_price_ore_per_kwh?: number | null;
  vat_rate?: number | null;
  pricing_model?: string | null;
  spot_share?: number | null;
  portfolio_share?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  binding_period_months?: number | null;
  notice_period_days?: number | null;
  notice_period_months?: number | null;
  automatic_renewal?: boolean | null;
  included?: string[] | string | null;
  excluded?: string[] | string | null;
  start_info?: string | null;
  customer_types?: string[] | null;
  pricing_visibility?: Record<string, boolean>;
  pricing_components?: PublicPricingComponent[];
  calculation_components?: PublicPricingComponent[];
  display_components?: PublicPricingComponent[];
  summary_components?: PublicPricingComponent[];
  price_options: PublicContractPriceOption[];
  legal_requirements?: PublicLegalRequirement[];
  legal: PublicContractLegal;
  portfolio_monthly_prices?: PublicPortfolioMonthlyPrice[];
  terms_version?: string | null;
  terms_version_id?: string | null;
  terms_url?: string | null;
  privacy_policy_version?: string | null;
  privacy_policy_version_id?: string | null;
  privacy_policy_url?: string | null;
  cancellation_right_version?: string | null;
  withdrawal_version?: string | null;
  withdrawal_version_id?: string | null;
  withdrawal_url?: string | null;
  power_of_attorney_version?: string | null;
  power_of_attorney_version_id?: string | null;
  power_of_attorney_url?: string | null;
  power_of_attorney_required?: boolean | null;
  price_terms_version?: string | null;
  price_terms_version_id?: string | null;
  price_terms_url?: string | null;
  is_public?: boolean | null;
  is_active?: boolean | null;
  sort_order?: number | null;
};

export type OpsPowerOfAttorneyScope =
  | "supplier_switch"
  | "facility_information_lookup";

export type OpsPowerOfAttorneyMethod =
  | "website_acceptance"
  | "bankid"
  | "electronic_signature"
  | "manual_signature";

export type OpsWebsitePowerOfAttorneyInput = {
  accepted: true;
  scope: OpsPowerOfAttorneyScope[];
  signerName: string;
  signerIdentityNumber: string;
  method: OpsPowerOfAttorneyMethod;
  acceptedAt?: string | null;
  textVersionId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type OpsCustomerBaseInput = {
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  phone: string;
  invoice_email?: string | null;
  billing_street?: string | null;
  billing_postal_code?: string | null;
  billing_city?: string | null;
  billing_country?: string | null;
};

export type OpsPrivateCustomerInput = OpsCustomerBaseInput & {
  customer_type: "private";
  personal_number: string;
  organization_number?: never;
  company_name?: never;
};

export type OpsBusinessCustomerInput = OpsCustomerBaseInput & {
  customer_type: "business";
  company_name: string;
  organization_number: string;
  personal_number: string;
};

export type OpsCustomerInput =
  | OpsPrivateCustomerInput
  | OpsBusinessCustomerInput;

export type OpsSiteInput = {
  facility_id?: string | null;
  site_name?: string | null;
  site_type?: string | null;
  street: string;
  postal_code: string;
  city: string;
  country?: string | null;
  price_area_code?: OpsWebsitePriceArea | null;
  grid_area_code?: string | null;
  grid_owner_id?: string | null;
  grid_owner_name?: string | null;
  move_in_date?: string | null;
  current_supplier_name?: string | null;
  current_supplier_org_number?: string | null;
  current_supplier_ediel_id?: string | null;
  current_supplier_unknown?: boolean | null;
};

export type OpsMeteringPointInput = {
  metering_point_id?: string | null;
  site_facility_id?: string | null;
  reading_frequency?: string | null;
  measurement_type?: string | null;
  price_area_code?: OpsWebsitePriceArea | null;
  grid_area_code?: string | null;
  grid_owner_id?: string | null;
  start_date?: string | null;
  installation_date?: string | null;
};

export type OpsContractInput = {
  requested_start_mode: "earliest_possible" | "specific_date";
  requested_start_date?: string | null;
};

export type OpsConsentInput = OpsLegalAcceptancesDto;

export type OpsCustomerApplicationInput = {
  external_customer_id: string;
  offer_reference: string;
  quote_reference: string;
  price_option_reference: string;
  invoice_delivery_method: OpsInvoiceDeliveryMethod;
  selected_component_references: string[];
  site_count: number;
  resolution_id: string;
  annual_consumption_kwh: number;
  start_date: string;
  customer: OpsCustomerInput;
  site: OpsSiteInput;
  metering_point?: OpsMeteringPointInput | null;
  contract: OpsContractInput;
  legal_bundle_version: string;
  legal_acceptances: OpsConsentInput;
  customer_portal_user_id: string;
  auth_user_id: string;
  powerOfAttorney?: OpsWebsitePowerOfAttorneyInput | null;
  idempotency_key: string;
};

export type OpsWebsiteSupplierSwitchState = {
  request_reference: string | null
  status: 'not_created' | 'created'
  can_create_request: boolean
  can_dispatch: boolean
  blockers: string[]
  next_action: string
};
export type OpsPowerOfAttorneyState = { status: 'signed' | 'missing' };
export type OpsCustomerApplicationCommunicationItem = WebsiteApiComponents['schemas']['WebsiteApplicationCommunicationItem'];

export type OpsCustomerApplicationCommunication = {
  pending: boolean;
  source_of_truth: 'communication_logs';
  triggered: OpsCustomerApplicationCommunicationItem[];
  queued: OpsCustomerApplicationCommunicationItem[];
  sent: OpsCustomerApplicationCommunicationItem[];
  failed: OpsCustomerApplicationCommunicationItem[];
  raw?: Record<string, unknown>;
};

export type OpsCustomerApplicationResult = {
  status: string;
  application_number?: string | null;
  customer_reference?: string | null;
  application_reference?: string | null;
  facility_reference?: string | null;
  metering_point_reference?: string | null;
  contract_reference?: string | null;
  customer_id?: string | null;
  customer_number?: string | null;
  external_customer_id?: string | null;
  external_customer_reference?: string | null;
  customer_site_id?: string | null;
  site_id?: string | null;
  metering_point_id?: string | null;
  contract_id?: string | null;
  contract_number?: string | null;
  contract_status?: string | null;
  offer_reference?: string | null;
  quote_reference?: string | null;
  quote_valid_until?: string | null;
  quote_bound?: boolean | null;
  created_customer?: boolean | null;
  requested_start_date?: string | null;
  confirmed_start_date?: string | null;
  actual_start_date?: string | null;
  requested_start_mode?: string | null;
  calculated_earliest_start_date?: string | null;
  grid_area_code?: string | null;
  price_area_code?: string | null;
  resolution_id?: string | null;
  resolution_status?: string | null;
  resolution_confidence?: number | null;
  grid_owner_verification_status?: string | null;
  grid_owner_verification_issues: string[];
  can_request_grid_owner_information?: boolean | null;
  can_send_agreement_confirmation?: boolean | null;
  can_activate_customer?: boolean | null;
  signed_at?: string | null;
  withdrawal_deadline_at?: string | null;
  signature_snapshot_sha256?: string | null;
  workflow_id?: string | null;
  continuation_job_id?: string | null;
  workflow_state?: string | null;
  energy_direction?: OpsEnergyDirection | null;
  supplier_switch: OpsWebsiteSupplierSwitchState;
  power_of_attorney?: OpsPowerOfAttorneyState | null;
  nextAction?: Record<string, unknown> | null;
  communication?: OpsCustomerApplicationCommunication | null;
  request_id?: string | null;
  correlation_id?: string | null;
  trace_id?: string | null;
  contract_schema_version?: string | null;
  missing_fields: string[];
  blocking_reasons: string[];
  warnings: string[];
  next_step?: string | null;
  message?: string | null;
  raw?: Record<string, unknown>;
};


export type AcceptedOpsCustomerApplicationResult = OpsCustomerApplicationResult & {
  status: 'accepted'
  application_number: string
  customer_number: string
  contract_status: 'signed'
  signed_at: string
  signature_snapshot_sha256: string
  workflow_state: 'canonical_data_committed'
  communication: OpsCustomerApplicationCommunication
}

export type OpsAuthorizationProbeResult = {
  ok: boolean;
  status: number;
  code: string | null;
};

export type OpsPublicContractDiagnostic = {
  offer_reference: string | null;
  name: string | null;
  visible: boolean | null;
  blockers: string[];
  raw: Record<string, unknown>;
};

export type OpsPublicContractDiagnostics = {
  items: OpsPublicContractDiagnostic[];
  raw: Record<string, unknown>;
};

export type OpsLegalText = {
  type:
    | "terms"
    | "privacy_policy"
    | "withdrawal"
    | "power_of_attorney"
    | "price_terms"
    | string;
  version: string;
  title: string;
  body?: string | null;
  id?: string | null;
  url?: string | null;
  offer_reference?: string | null;
  published_at?: string | null;
  content_sha256?: string | null;
  legal_bundle_version_id?: string | null;
  raw?: Record<string, unknown>;
};

export type OpsWebsitePriceArea = "SE1" | "SE2" | "SE3" | "SE4";

export type OpsWebsiteEnergyResolutionInput = {
  postal_code?: string | null;
  city?: string | null;
  street?: string | null;
  street_number?: string | null;
  address?: string | null;
  country?: string | null;
  grid_area_code?: string | null;
  facility_id?: string | null;
  metering_point_id?: string | null;
  requested_start_mode?: "earliest_possible" | "specific_date" | null;
  requested_start_date?: string | null;
};

export type OpsResolutionBlocker = {
  code: string;
  message?: string | null;
  field?: string | null;
  retryable?: boolean | null;
  details?: Record<string, unknown> | null;
};

export type OpsResolutionCapabilities = {
  pricing_ready: boolean;
  quote_ready: boolean;
  facility_lookup_ready: boolean;
  switch_request_creatable: boolean;
  switch_dispatch_ready: boolean;
};

export type OpsResolutionBlockers = {
  pricing: OpsResolutionBlocker[];
  quote: OpsResolutionBlocker[];
  facility_lookup: OpsResolutionBlocker[];
  switch_creation: OpsResolutionBlocker[];
  switch_dispatch: OpsResolutionBlocker[];
};

export type OpsResolutionSource = {
  provider?: string | null;
  reference?: string | null;
  resolved_by?: string | null;
  as_of?: string | null;
  metadata?: Record<string, unknown> | null;
  raw: Record<string, unknown>;
};

export type OpsPriceAreaAssuranceStatus = 'verified' | 'estimated' | 'ambiguous' | 'unresolved';

export type OpsPriceAreaAssuranceSource =
  | 'facility_data'
  | 'grid_area_master'
  | 'address_polygon'
  | 'postal_city_consensus'
  | 'postal_consensus';

export type OpsPriceAreaAssurance = {
  status: OpsPriceAreaAssuranceStatus;
  price_area: OpsWebsitePriceArea | null;
  confidence: number;
  source: OpsPriceAreaAssuranceSource | null;
  candidate_count: number;
  unique_price_area_count: number;
  source_version: string | null;
  evidence: Record<string, unknown>;
};

export type OpsWebsiteEnergyResolution = {
  status: string;
  resolution_id?: string | null;
  resolution_reference?: string | null;
  resolution_status?: string | null;
  capabilities: OpsResolutionCapabilities;
  blockers: OpsResolutionBlockers;
  retryable: boolean;
  next_required_action?: string | null;
  warnings: string[];
  resolved_at?: string | null;
  valid_until?: string | null;
  price_area_code: OpsWebsitePriceArea | null;
  grid_area_code?: string | null;
  grid_area_name?: string | null;
  grid_owner_name?: string | null;
  confidence?: number | null;
  contract_version: string;
  resolver_version?: string | null;
  geodata_version?: string | null;
  conflict_code?: string | null;
  error_code?: string | null;
  price_area_assurance: OpsPriceAreaAssurance;
  source?: OpsResolutionSource | null;
  source_chain?: string[];
  customer_message?: string | null;
  raw?: Record<string, unknown>;
};

export type OpsWebsiteQuoteInput = {
  resolution_id: string;
  offer_reference: string;
  annual_consumption_kwh: number;
  customer_type: WebsiteCustomerType;
  start_date: string;
  quote_attempt_id: string;
  requested_start_mode: 'earliest_possible' | 'specific_date';
  price_option_reference: string;
  invoice_delivery_method: OpsInvoiceDeliveryMethod;
  selected_component_references: string[];
  site_count: number;
};

export type OpsInvoiceDeliveryMethod = 'email' | 'e_invoice' | 'paper' | 'direct_debit';

export type OpsWebsiteQuoteValidationInput = {
  quote_reference: string;
  offer_reference: string;
  resolution_id: string;
  customer_type: WebsiteCustomerType;
  annual_consumption_kwh: number;
  start_date: string;
  price_option_reference: string;
  invoice_delivery_method: OpsInvoiceDeliveryMethod;
  selected_component_references: string[];
  site_count: number;
  price_area?: OpsWebsitePriceArea | null;
  grid_area_code?: string | null;
  postal_code?: string | null;
  application_number?: string | null;
};

export type OpsWebsiteQuoteValidation = {
  valid: boolean;
  status: string;
  code: string | null;
  quote_reference: string;
  offer_reference: string;
  resolution_id: string;
  valid_until: string;
  resolver_version: string | null;
  geodata_version: string | null;
  market_reference: OpsQuoteMarketReference;
  energy_direction: OpsEnergyDirection;
  selected_area_price: Record<string, unknown> | null;
  price_option_reference: string;
  area_price_reference: string | null;
  invoice_delivery_method: OpsInvoiceDeliveryMethod;
  selected_component_references: string[];
  mandatory_component_references: string[];
  conditional_component_references: string[];
  site_count: number;
  publication_revision?: number | null;
  legal_bundle_version?: string | null;
  raw: Record<string, unknown>;
};

export type OpsQuoteAssumption = {
  code?: string | null;
  label: string;
  value?: string | number | boolean | null;
  unit?: string | null;
  description?: string | null;
};

export type OpsQuoteMarketSource = {
  name: string;
  period?: string | null;
  resolution?: string | null;
  timestamp?: string | null;
};

export type OpsQuoteMarketReference = {
  provider: string | null;
  price_area: OpsWebsitePriceArea | null;
  reference_type: string | null;
  reference_period: string | null;
  price_sek_per_kwh: number | null;
  price_ore_per_kwh: number | null;
  requested_days: number | null;
  included_days: number | null;
  period_start: string | null;
  period_end: string | null;
  as_of: string | null;
  source_as_of: string | null;
  generated_at: string | null;
  stale_after: string | null;
  effective_stale_at: string | null;
  unit: string | null;
  includes_vat: boolean | null;
  includes_supplier_fees: boolean | null;
  includes_grid_fees: boolean | null;
  is_indicative: boolean | null;
  is_stale: boolean | null;
  fallback_used: boolean | null;
  fallback_reason: string | null;
  freshness: string | null;
};

export type OpsWebsitePricingPreview = {
  resolution_id: string;
  energy_direction: OpsEnergyDirection;
  production_pricing: PublicProductionPricing | null;
  start_date: string;
  requested_start_mode: 'earliest_possible' | 'specific_date';
  customer_type: WebsiteCustomerType;
  contract: {
    slug: string;
    offer_reference?: string | null;
    contract_reference?: string | null;
    product_code?: string | null;
    name: string;
    contractType: "spot_monthly" | "spot_hourly" | "spot_quarterly" | "portfolio_managed" | "fixed" | "mix" | "monthly_fixed";
  };
  priceArea: OpsWebsitePriceArea;
  price_area_code?: OpsWebsitePriceArea;
  kwh: number;
  annual_consumption_kwh?: number;
  pricePerKwhOre: number;
  totalMonthlyCostSek: number;
  totalMonthlyCostInclVatSek?: number;
  totalYearlyCostSek?: number;
  customerNotice?: string;
  legalText?: string;
  specification?: Record<string, unknown>;
  pricing_snapshot_reference?: string;
  ops_quote_reference?: string;
  public_contract_etag?: string | null;
  publication_revision?: number | null;
  contract_payload_sha256?: string | null;
  legal_bundle_version?: string | null;
  legal_document_hashes?: Record<string, string>;
  pricing_interval?: string;
  estimate_method?: string;
  source_period?: string;
  source_window?: { start: string; end: string } | null;
  market_data_timestamp?: string;
  is_binding?: boolean;
  assumptions?: OpsQuoteAssumption[];
  market_sources?: OpsQuoteMarketSource[];
  market_reference?: OpsQuoteMarketReference | null;
  pricing_snapshot_schema_version?: string;
  valid_until: string;
  price_option_reference: string;
  area_price_reference: string | null;
  invoice_delivery_method: OpsInvoiceDeliveryMethod;
  selected_component_references: string[];
  mandatory_component_references?: string[];
  conditional_component_references?: string[];
  site_count: number;
  pricing_token?: string;
  pricing_expires_at?: string | null;
  raw?: Record<string, unknown>;
};

export type OpsCustomerDocument = Record<string, unknown>;
export type OpsCustomerLegalAcceptance = Record<string, unknown>;
export type OpsCustomerPowerOfAttorney = Record<string, unknown>;
export type OpsCustomerSwitchStatus = Record<string, unknown> | null;

export type OpsClientStatus = {
  configured: boolean;
  liveSignupEnabled: boolean;
  missing: string[];
};

export type OpsIntegrationContext = {
  organization_reference: string;
  api_client_reference: string;
  authoritative_identity: 'api_key';
  authentication: { header: 'Authorization'; scheme: 'Bearer'; server_side_only: true };
  environment: string;
  channel: string;
  api_version: string;
  contract_version: string;
  active_scopes: string[];
  configuration: {
    required_environment_variables: string[];
    api_base_url: string;
    application_reference_location: "top_level";
    authentication: { header: 'Authorization'; scheme: 'Bearer'; server_side_only: true };
    openapi_url: string;
    customer_portal_openapi_url: string;
  };
  capabilities: {
    website_checkout_ready: boolean;
    customer_portal_ready: boolean;
    complete_integration_ready: boolean;
    missing_website_scopes: string[];
    missing_customer_portal_scopes: string[];
    missing_recommended_scopes: string[];
    required_website_scopes: string[];
    required_customer_portal_scopes: string[];
  };
  raw: Record<string, unknown>;
};

export type OpsCurrentMarketPrice = OpsCurrentMarketPriceDto & {
  request_id: string;
  /**
   * The published OPS OpenAPI currently versions this endpoint independently
   * from the website contract release. Preserve the received value and rely on
   * logContractVersionDrift instead of pretending it equals the feed version.
   */
  contract_schema_version: string;
  raw: Record<string, unknown>;
};

export type OpsWebsitePortfolioPrices = {
  method: string | Record<string, unknown>;
  historical_final_prices: Record<string, unknown>[];
  final_billing_rule: 'locked_settlement_only';
  request_id: string;
  contract_schema_version: string;
  raw: Record<string, unknown>;
};

export type OpsWebsiteApplicationStatusValue =
  | "accepted"
  | "processing"
  | "needs_customer_information"
  | "completed"
  | "rejected"
  | "failed";

export type OpsWebsiteApplicationStatus = {
  application_number: string;
  status: OpsWebsiteApplicationStatusValue;
  stage: string;
  customer_number?: string | null;
  contract_status?: string | null;
  supplier_switch_status: string;
  supply_status?: string | null;
  requested_start_date?: string | null;
  confirmed_start_date?: string | null;
  missing_customer_action: boolean;
  next_step?: string | null;
  blocking_reason?: string | null;
  updated_at: string | null;
  raw: Record<string, unknown>;
};

export type OpsPublicContractIssue = ContractValidationIssue & {
  offer_reference: string | null;
};

export type OpsBlockedPublicContract = {
  offer_reference: string | null;
  reasons: string[];
  issues?: ContractValidationIssue[];
};

export type OpsPublicContractFeedState = 'contracts_present' | 'canonical_empty'
export type OpsEmptyFeedAuthorizationReason =
  | 'no_canonical_publications'
  | 'canonical_unpublished_or_archived'
  | 'publication_validity_ended'
  | 'canonical_no_visible_contracts'

export type OpsEmptyFeedAuthorization = {
  authorized: true
  reason: OpsEmptyFeedAuthorizationReason
  publication_revision: number
  canonical_source: 'canonical_public_contract_delivery_readiness_v'
  affected_offer_references: string[]
  blockers: string[]
}

export type OpsPublicContractsSnapshot = {
  contracts: OpsPublicContract[];
  blocked_contracts: OpsBlockedPublicContract[];
  feed_state: OpsPublicContractFeedState;
  empty_feed_authorization: OpsEmptyFeedAuthorization | null;
  warnings: OpsPublicContractIssue[];
  compatibility_issues: OpsPublicContractIssue[];
  parser_version: string;
  schema_sha256: string;
  etag: string | null;
  publication_revision: number | null;
  organization_reference: string;
  contract_version: string | null;
  not_modified: boolean;
  fetched_at: string;
  source: 'live' | 'cache' | 'stale-cache';
  stale: boolean;
  stale_reason: string | null;
  upstream_status: number;
  upstream_request_id: string | null;
  upstream_correlation_id: string | null;
};