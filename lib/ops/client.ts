//lib/ops/client.ts
import { createHash, randomUUID } from "node:crypto";
import {
  calculationPricingComponentAmount,
  normalizePublicContractApiPayload,
  normalizeProductionPricing,
  type PublicAreaPricing,
  type PublicContractPriceOption,
  type PublicPortfolioMonthlyPrice,
  type PublicLegalRequirement,
  type PublicPricingComponent,
  type PublicProductionPricing,
} from "@/lib/website/publicContractContract";
import {
  GRIDEX_WEBSITE_API_CONTRACT_VERSION,
} from '@/lib/ops/contract';
import { OpsError, isOpsError } from '@/lib/ops/errors'
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
} from '@/lib/ops/validators/openapi'
import { toOpsCustomerType, type WebsiteCustomerType } from "@/lib/website/customerType";
import type { components as WebsiteApiComponents } from '@/lib/ops/generated/website-api';
import { isStrictCalendarDate, stockholmCalendarDate } from '@/lib/website/businessDate'
import { canonicalSha256 } from '@/lib/ops/canonicalJson'
import { logContractVersionDrift } from '@/lib/ops/contractCompatibility'

export { OpsError, isOpsError }
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
type OpsWebsiteQuoteRequestDto = WebsiteApiComponents['schemas']['WebsiteQuoteRequest'];
type OpsCustomerApplicationRequestDto = WebsiteApiComponents['schemas']['CustomerApplicationRequest'];
type OpsWebsiteQuoteValidationRequestDto = WebsiteApiComponents['schemas']['QuoteValidationRequest'];
type OpsLegalAcceptancesDto = WebsiteApiComponents['schemas']['LegalAcceptances'];
type OpsCurrentMarketPriceDto = WebsiteApiComponents['schemas']['CurrentMarketPrice'];
type OpsCurrentMarketPriceResponseDto = WebsiteApiComponents['schemas']['CurrentMarketPriceResponse'];
type OpsCustomerApplicationStatusDto = WebsiteApiComponents['schemas']['CustomerApplicationStatus'];
type OpsWebsiteEnergyAreaResolveResponseDto = WebsiteApiComponents['schemas']['WebsiteEnergyAreaResolveResponse'];
type OpsWebsiteEnergyAreaResolutionDto = WebsiteApiComponents['schemas']['WebsiteEnergyAreaResolution'];
type OpsSwitchStatusDto = WebsiteApiComponents['schemas']['SwitchStatus'];


export type OpsPublicContract = {
  offer_reference: string;
  energy_direction: OpsEnergyDirection;
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

type OpsCustomerBaseInput = {
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
  customer_portal_user_id?: string | null;
  auth_user_id?: string | null;
  powerOfAttorney?: OpsWebsitePowerOfAttorneyInput | null;
  idempotency_key: string;
};

export type OpsWebsiteSupplierSwitchState = WebsiteApiComponents['schemas']['WebsiteSupplierSwitchState'];
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
  application_id?: string | null;
  application_number?: string | null;
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
  correlation_id?: string | null;
  missing_fields: string[];
  blocking_reasons: string[];
  warnings: string[];
  next_step?: string | null;
  message?: string | null;
  raw?: Record<string, unknown>;
};

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
  grid_owner_id?: string | null;
  grid_owner_name?: string | null;
  confidence?: number | null;
  contract_version: string;
  resolver_version?: string | null;
  geodata_version?: string | null;
  conflict_code?: string | null;
  error_code?: string | null;
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
  application_id?: string | null;
};

export type OpsWebsiteQuoteValidation = {
  valid: boolean;
  status: string;
  code: string | null;
  quote_reference: string;
  offer_reference: string;
  resolution_id: string;
  valid_until: string;
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
  contract: {
    slug: string;
    offer_reference?: string | null;
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
  valid_until?: string;
  price_option_reference: string;
  invoice_delivery_method: OpsInvoiceDeliveryMethod;
  selected_component_references: string[];
  mandatory_component_references?: string[];
  conditional_component_references?: string[];
  site_count: number;
  pricing_token?: string;
  pricing_expires_at?: string;
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
  tenant_reference: string;
  company_id?: string | null;
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
    tenant_id_environment_required: false;
    company_id_environment_required: false;
    website_openapi_url: string;
    customer_portal_openapi_url: string;
  };
  capabilities: {
    website_checkout_ready: boolean;
    customer_portal_ready: boolean;
    complete_tenant_website_ready: boolean;
    missing_website_checkout_scopes: string[];
    missing_customer_portal_scopes: string[];
    missing_complete_tenant_website_scopes: string[];
    recommended_missing_scopes: string[];
    required_website_checkout_scopes: string[];
    required_customer_portal_scopes: string[];
  };
  raw: Record<string, unknown>;
};

export type OpsCurrentMarketPrice = OpsCurrentMarketPriceDto & {
  request_id: string;
  contract_schema_version: typeof GRIDEX_WEBSITE_API_CONTRACT_VERSION;
  raw: Record<string, unknown>;
};

export type OpsWebsitePortfolioPrices = {
  method: string | Record<string, unknown>;
  historical_final_prices: Record<string, unknown>[];
  final_billing_rule: 'locked_settlement_only';
  request_id: string;
  contract_schema_version: typeof GRIDEX_WEBSITE_API_CONTRACT_VERSION;
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
  application_id: string;
  application_number?: string | null;
  status: OpsWebsiteApplicationStatusValue;
  stage: string;
  customer_number?: string | null;
  contract_status?: string | null;
  supplier_switch_status?: string | null;
  supply_status?: string | null;
  requested_start_date?: string | null;
  confirmed_start_date?: string | null;
  missing_customer_action: boolean;
  next_step?: string | null;
  blocking_reason?: string | null;
  updated_at: string;
  raw: Record<string, unknown>;
};

export type OpsBlockedPublicContract = {
  offer_reference: string | null;
  reasons: string[];
};

export type OpsPublicContractsSnapshot = {
  contracts: OpsPublicContract[];
  blocked_contracts: OpsBlockedPublicContract[];
  etag: string | null;
  publication_revision: number | null;
  tenant_reference: string;
  contract_version: string | null;
  not_modified: boolean;
  fetched_at: string;
  source: 'live' | 'cache' | 'stale-cache';
  stale: boolean;
  stale_reason: string | null;
};

function opsBaseUrl(): string {
  return getOpsApiBaseUrl()
}

function opsTenantCacheKey(): string {
  const baseUrl = opsBaseUrl()
  const apiKey = getOpsApiKey().value ?? "missing-api-key";
  return createHash("sha256").update(`${baseUrl}|${apiKey}`).digest("hex").slice(0, 24);
}

function tenantReferenceFromPayload(payload: unknown): string | null {
  const root = recordValue(payload);
  const data = recordValue(root?.data);
  const meta = recordValue(root?.meta) ?? recordValue(data?.meta);
  const context = recordValue(root?.context) ?? recordValue(data?.context);
  return pickFromRecords([meta, context, data, root], ["tenant_reference", "tenantReference"]);
}

function assertTenantReference(actual: string | null, source: string): string {
  if (!actual) {
    throw new OpsError("OPS kunde inte verifiera tenant-bindningen från API-nyckeln.", 503, {
      code: "ops_tenant_binding_unverified",
      source,
    });
  }
  return actual;
}

export function getOpsClientStatus(): OpsClientStatus {
  return getOpsTransportStatus()
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
    if (!normalized) return null;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeInteger(value: unknown): number | null {
  const normalized = normalizeNumber(value)
  return normalized !== null && Number.isSafeInteger(normalized) ? normalized : null
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}


function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickFromRecords(
  rows: Array<Record<string, unknown> | null | undefined>,
  keys: string[],
): string | null {
  for (const row of rows) {
    if (!row) continue;
    const picked = pickString(row, keys);
    if (picked) return picked;
  }
  return null;
}

function pickBooleanFromRecords(
  rows: Array<Record<string, unknown> | null | undefined>,
  keys: string[],
): boolean | null {
  for (const row of rows) {
    if (!row) continue;
    const picked = pickBoolean(row, keys);
    if (picked !== null) return picked;
  }
  return null;
}

function amountFromObject(value: unknown): number | null {
  const row = recordValue(value);
  if (!row) return normalizeNumber(value);
  return normalizeNumber(row.amount ?? row.value ?? row.price ?? row.rate);
}

function pickString(
  row: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const picked = normalizeText(row[key]);
    if (picked) return picked;
  }
  return null;
}

function pickBoolean(
  row: Record<string, unknown>,
  keys: string[],
): boolean | null {
  for (const key of keys) {
    if (typeof row[key] === "boolean") return row[key] as boolean;
  }
  return null;
}

type NormalizedOpsPriceComponents = {
  monthly_fee_sek?: number | null;
  invoice_fee_sek?: number | null;
  markup_ore_per_kwh?: number | null;
  variable_markup_ore_per_kwh?: number | null;
  elcert_ore_per_kwh?: number | null;
  fixed_price_ore_per_kwh?: number | null;
  monthly_fixed_price_sek?: number | null;
  portfolio_price_ore_per_kwh?: number | null;
  spot_share?: number | null;
  portfolio_share?: number | null;
  vat_rate?: number | null;
};

const COMPONENT_ARRAY_KEYS = [
  "price_components",
  "priceComponents",
  "pricing_components",
  "pricingComponents",
  "components",
  "price_lines",
  "priceLines",
  "lines",
  "fees",
  "charges",
  "items",
];

function toSearchText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function collectComponentRows(
  input: unknown,
  seen = new Set<unknown>(),
): Record<string, unknown>[] {
  if (!input || typeof input !== "object" || seen.has(input)) return [];
  seen.add(input);

  const row = input as Record<string, unknown>;
  const result: Record<string, unknown>[] = [];

  const areaSpecificParent = hasExplicitComponentPriceArea(row);
  for (const key of COMPONENT_ARRAY_KEYS) {
    const value = row[key];
    if (Array.isArray(value) && !areaSpecificParent) {
      for (const item of value) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          result.push(item as Record<string, unknown>);
        }
      }
    }
  }

  for (const key of [
    "pricing",
    "price",
    "version",
    "price_plan_version",
    "pricePlanVersion",
    "contract",
    "snapshot",
    "specification",
  ]) {
    const nested = row[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      result.push(...collectComponentRows(nested, seen));
    }
  }

  return result;
}

function classifyComponent(
  row: Record<string, unknown>,
): keyof NormalizedOpsPriceComponents | null {
  const text = toSearchText(
    [
      row.type,
      row.kind,
      row.key,
      row.code,
      row.component_type,
      row.componentType,
      row.name,
      row.label,
      row.title,
      row.description,
      row.unit,
      row.unit_type,
      row.unitType,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (!text) return null;

  if (/elcert|certificate|certifikat/.test(text)) return "elcert_ore_per_kwh";
  if (/monthly_fixed|fixed_monthly|manadspris|månadspris|monthly price|fixed monthly/.test(text)) return "monthly_fixed_price_sek";
  if (/spot_share|rorlig andel|rörlig andel|variable share/.test(text)) return "spot_share";
  if (/portfolio_share|portfoljandel|portföljandel|managed share/.test(text)) return "portfolio_share";
  if (/portfolio_price|portfoliopris|portföljpris|portfolio price|managed price/.test(text)) return "portfolio_price_ore_per_kwh";
  if (/invoice|faktur|billing|aviavgift/.test(text)) return "invoice_fee_sek";
  if (/monthly|manads|manad|month|subscription|abon|grundavgift|fast avgift/.test(text))
    return "monthly_fee_sek";
  if (
    /variable_fee|rorlig_avgift|rorlig avgift|rörlig avgift|variable charge|variable_charge|energy_fee|kwh_fee|balansavgift/.test(
      text,
    )
  ) {
    return "variable_markup_ore_per_kwh";
  }
  if (
    /markup|paslag|påslag|supplier_margin|margin|energy_markup|gridex|elhandelspaslag|forvaltningsavgift/.test(
      text,
    )
  )
    return "markup_ore_per_kwh";
  if (
    /fixed_price|fastpris|fast pris|fixed kwh|price_per_kwh|kwh_price|energy_price|energipris|elpris/.test(
      text,
    )
  )
    return "fixed_price_ore_per_kwh";

  return null;
}

const COMPONENT_AREA_KEYS = [
  "price_area_code",
  "priceAreaCode",
  "price_area",
  "priceArea",
  "electricity_area",
  "electricityArea",
  "market_area",
  "marketArea",
  "area_code",
  "areaCode",
  "area",
  "zone",
];

function hasExplicitComponentPriceArea(row: Record<string, unknown>): boolean {
  for (const key of COMPONENT_AREA_KEYS) {
    const value = row[key];
    if (typeof value !== "string") continue;
    const area = value.trim().toUpperCase();
    if (area === "SE1" || area === "SE2" || area === "SE3" || area === "SE4") {
      return true;
    }
  }
  return false;
}

function pickComponentNumber(row: Record<string, unknown>): number | null {
  const keys = [
    "value",
    "amount",
    "price",
    "rate",
    "amount_ore",
    "amountOre",
    "ore_per_kwh",
    "orePerKwh",
    "price_ore_per_kwh",
    "priceOrePerKwh",
    "sek",
    "amount_sek",
    "amountSek",
    "monthly_fee_sek",
    "monthlyFeeSek",
    "monthly_fixed_price_sek",
    "monthlyFixedPriceSek",
    "monthly_price_sek",
    "monthlyPriceSek",
  ];

  for (const key of keys) {
    const value = amountFromObject(row[key]);
    if (value !== null) return value;
  }

  return null;
}

function extractOpsPriceComponents(
  input: unknown,
): NormalizedOpsPriceComponents {
  const result: NormalizedOpsPriceComponents = {};
  if (!input || typeof input !== "object") return result;

  const row = input as Record<string, unknown>;
  const pricing = recordValue(row.pricing);

  result.monthly_fee_sek = coalesceNumber(
    amountFromObject(pricing?.monthly_fee ?? pricing?.monthlyFee),
    normalizeNumber(
      row.monthly_fee_sek ??
        row.monthlyFeeSek ??
        row.monthly_fee ??
        row.monthlyFee,
    ),
  );
  result.invoice_fee_sek = coalesceNumber(
    amountFromObject(pricing?.invoice_fee ?? pricing?.invoiceFee),
    normalizeNumber(
      row.invoice_fee_sek ??
        row.invoiceFeeSek ??
        row.invoice_fee ??
        row.invoiceFee,
    ),
  );
  result.markup_ore_per_kwh = coalesceNumber(
    amountFromObject(pricing?.markup),
    normalizeNumber(
      row.markup_ore_per_kwh ??
        row.markupOrePerKwh ??
        row.markup_ore ??
        row.markupOre ??
        row.energy_markup_ore_per_kwh ??
        row.energyMarkupOrePerKwh ??
        row.supplier_markup_ore_per_kwh ??
        row.supplierMarkupOrePerKwh,
    ),
  );
  result.variable_markup_ore_per_kwh = normalizeNumber(
    row.variable_markup_ore_per_kwh ??
      row.variableMarkupOrePerKwh ??
      row.variable_fee_ore ??
      row.variableFeeOre ??
      row.variable_fee_ore_per_kwh ??
      row.variableFeeOrePerKwh,
  );
  result.elcert_ore_per_kwh = normalizeNumber(
    row.elcert_ore_per_kwh ??
      row.elcertOrePerKwh ??
      row.elcert_ore ??
      row.elcertOre,
  );
  result.fixed_price_ore_per_kwh = normalizeNumber(
    row.fixed_price_ore_per_kwh ??
      row.fixedPriceOrePerKwh ??
      row.fixed_price_ore ??
      row.fixedPriceOre ??
      row.price_per_kwh_ore ??
      row.pricePerKwhOre,
  );
  result.monthly_fixed_price_sek = coalesceNumber(
    amountFromObject(pricing?.monthly_fixed_price ?? pricing?.monthlyFixedPrice),
    normalizeNumber(
      row.monthly_fixed_price_sek ??
        row.monthlyFixedPriceSek ??
        row.monthly_price_sek ??
        row.monthlyPriceSek ??
        row.fixed_monthly_price_sek ??
        row.fixedMonthlyPriceSek,
    ),
  );
  result.portfolio_price_ore_per_kwh = normalizeNumber(
    row.portfolio_price_ore_per_kwh ??
      row.portfolioPriceOrePerKwh ??
      row.portfolio_price_ore ??
      row.portfolioPriceOre ??
      row.managed_price_ore_per_kwh ??
      row.managedPriceOrePerKwh,
  );
  result.spot_share = normalizeNumber(
    pricing?.spot_share ?? pricing?.spotShare ?? row.spot_share ?? row.spotShare ?? row.variable_share ?? row.variableShare,
  );
  result.portfolio_share = normalizeNumber(
    pricing?.portfolio_share ?? pricing?.portfolioShare ?? row.portfolio_share ?? row.portfolioShare ?? row.managed_share ?? row.managedShare,
  );
  result.vat_rate = normalizeNumber(row.vat_rate ?? row.vatRate ?? row.vat);

  for (const component of collectComponentRows(input)) {
    // Area-specific prices must not leak into the global contract fields.
    // They are resolved later for the customer-selected SE1-SE4 area.
    if (hasExplicitComponentPriceArea(component)) continue;
    const field = classifyComponent(component);
    if (!field) continue;
    const value = pickComponentNumber(component);
    if (value === null) continue;
    if (result[field] === null || result[field] === undefined) {
      result[field] = value;
    }
  }

  return result;
}

function coalesceNumber(
  ...values: Array<number | null | undefined>
): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function mapPublicContract(row: unknown): OpsPublicContract | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const pricing = recordValue(r.pricing);
  const components = extractOpsPriceComponents(r);
  const documented = normalizePublicContractApiPayload(r);
  if (documented) {
    return {
      ...documented,
      contract_type: documented.contract_type,
      type: documented.contract_type,
      price_areas: documented.price_areas,
      area_pricing: documented.area_pricing,
      calculation_components: documented.calculation_components,
      display_components: documented.display_components,
      summary_components: documented.summary_components,
      legal_requirements: documented.legal_requirements,
      short_description: pickString(r, ["short_description", "shortDescription", "public_description"]),
      marketing_description: pickString(r, ["marketing_description", "description", "marketingDescription"]),
      badge_text: pickString(r, ["badge_text", "badgeText"]),
      monthly_fee_sek: coalesceNumber(
        calculationPricingComponentAmount(documented.calculation_components ?? documented.pricing_components, 'monthly_fee_sek'),
        documented.monthly_fee_sek,
        components.monthly_fee_sek,
      ),
      invoice_fee_sek: coalesceNumber(
        calculationPricingComponentAmount(documented.calculation_components ?? documented.pricing_components, 'invoice_fee_sek'),
        documented.invoice_fee_sek,
        components.invoice_fee_sek,
      ),
      markup_ore_per_kwh: coalesceNumber(
        calculationPricingComponentAmount(documented.calculation_components ?? documented.pricing_components, 'markup_ore_per_kwh'),
        documented.markup_ore_per_kwh,
        components.markup_ore_per_kwh,
      ),
      variable_markup_ore_per_kwh: coalesceNumber(
        calculationPricingComponentAmount(documented.calculation_components ?? documented.pricing_components, 'variable_markup_ore_per_kwh'),
        documented.variable_markup_ore_per_kwh,
        components.variable_markup_ore_per_kwh,
      ),
      fixed_price_ore_per_kwh: coalesceNumber(
        calculationPricingComponentAmount(documented.calculation_components ?? documented.pricing_components, 'fixed_price_ore_per_kwh'),
        documented.fixed_price_ore_per_kwh,
        components.fixed_price_ore_per_kwh,
      ),
      monthly_fixed_price_sek: coalesceNumber(
        calculationPricingComponentAmount(documented.calculation_components ?? documented.pricing_components, 'monthly_fixed_price_sek'),
        documented.monthly_fixed_price_sek,
        components.monthly_fixed_price_sek,
      ),
      elcert_ore_per_kwh: coalesceNumber(
        calculationPricingComponentAmount(documented.calculation_components ?? documented.pricing_components, 'elcert_ore_per_kwh'),
        documented.elcert_ore_per_kwh,
        components.elcert_ore_per_kwh,
      ),
      portfolio_price_ore_per_kwh: coalesceNumber(
        calculationPricingComponentAmount(documented.calculation_components ?? documented.pricing_components, 'portfolio_price_ore_per_kwh'),
        documented.portfolio_price_ore_per_kwh,
        components.portfolio_price_ore_per_kwh,
      ),
      vat_rate: coalesceNumber(
        calculationPricingComponentAmount(documented.calculation_components ?? documented.pricing_components, 'vat_rate'),
        documented.vat_rate,
        components.vat_rate,
      ),
      pricing_model:
        documented.pricing_model ??
        pickFromRecords([pricing, r], ["pricing_model", "pricingModel", "price_model", "priceModel"]),
      spot_share: coalesceNumber(
        calculationPricingComponentAmount(documented.calculation_components ?? documented.pricing_components, 'spot_share'),
        documented.spot_share,
        components.spot_share,
      ),
      portfolio_share: coalesceNumber(
        calculationPricingComponentAmount(documented.calculation_components ?? documented.pricing_components, 'portfolio_share'),
        documented.portfolio_share,
        components.portfolio_share,
      ),
      binding_period_months: documented.binding_months ?? normalizeNumber(
        r.binding_period_months ?? r.bindingPeriodMonths ?? r.binding_months,
      ),
      notice_period_months: documented.notice_months ?? normalizeNumber(
        r.notice_period_months ?? r.noticePeriodMonths ?? r.notice_months ?? r.noticeMonths,
      ),
      notice_period_days: normalizeNumber(
        r.notice_period_days ?? r.noticePeriodDays ?? r.notice_days,
      ),
      automatic_renewal: documented.automatic_renewal ?? pickBooleanFromRecords([r], ["automatic_renewal", "automaticRenewal"]),
      included: Array.isArray(r.included)
        ? r.included.map(String).filter(Boolean)
        : pickString(r, ["included"]),
      excluded: Array.isArray(r.excluded)
        ? r.excluded.map(String).filter(Boolean)
        : pickString(r, ["excluded"]),
      start_info: pickString(r, ["start_info", "startInfo"]),
      terms_version_id: documented.terms_version_id,
      terms_url: documented.terms_url,
      privacy_policy_version_id: documented.privacy_policy_version_id,
      privacy_policy_url: documented.privacy_policy_url,
      cancellation_right_version: documented.withdrawal_version,
      withdrawal_version_id: documented.withdrawal_version_id,
      withdrawal_url: documented.withdrawal_url,
      power_of_attorney_version: documented.power_of_attorney_version,
      power_of_attorney_version_id: documented.power_of_attorney_version_id,
      power_of_attorney_url: documented.power_of_attorney_url,
      price_terms_version_id: documented.price_terms_version_id,
      price_terms_url: documented.price_terms_url,
      is_public: null,
      is_active: null,
      sort_order: normalizeNumber(r.sort_order ?? r.sortOrder),
    };
  }

  throw new OpsError('OPS publicerade ett avtal som inte följer det aktuella publika kontraktet.', 502, {
    code: 'ops_public_contract_invalid',
    offer_reference: pickString(r, ['offer_reference', 'offerReference']),
    contract_type: pickString(r, ['contract_type', 'contractType', 'type']),
    energy_direction: pickString(r, ['energy_direction', 'energyDirection']),
  });
}

function extractRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const p = payload as Record<string, unknown>;
  const directKeys = [
    "data",
    "contracts",
    "public_contracts",
    "publicContracts",
    "offers",
    "legal_texts",
    "legalTexts",
    "items",
  ];

  for (const key of directKeys) {
    const value = p[key];
    if (Array.isArray(value)) return value;
  }

  const data = recordValue(p.data);
  if (data) {
    for (const key of directKeys) {
      const value = data[key];
      if (Array.isArray(value)) return value;
    }
  }

  return [];
}

async function opsRequest(
  path: string,
  init?: RequestInit,
  options: OpsRequestOptions = {},
): Promise<OpsHttpResponse> {
  return transportOpsRequest(path, init, options)
}

function jsonRequestBody(init?: RequestInit): unknown {
  if (init?.body == null) return undefined;
  if (typeof init.body !== "string") {
    throw new OpsError("Gridex API-begäran måste använda JSON-text som body.", 500, {
      code: "ops_request_body_not_json_text",
      retryable: false,
    });
  }
  try {
    return JSON.parse(init.body);
  } catch {
    throw new OpsError("Gridex API-begäran innehåller ogiltig JSON.", 500, {
      code: "ops_request_body_invalid_json",
      retryable: false,
    });
  }
}

function observeRuntimeSchemaValidation(input: {
  endpoint: string
  schema: string
  validate: () => void
}): void {
  try {
    input.validate()
  } catch (error) {
    console.warn('[gridex-openapi] runtime response drift detected; endpoint parser remains authoritative', {
      endpoint: input.endpoint,
      schema: input.schema,
      code: isOpsError(error) ? error.code : null,
      status: isOpsError(error) ? error.status : null,
    })
  }
}

async function opsFetch(path: string, init?: RequestInit): Promise<unknown> {
  const method = (init?.method ?? "GET").toLowerCase() as
    | "get" | "post" | "put" | "patch" | "delete" | "head" | "options";
  const websiteOperation = hasWebsiteOperation(path, method)
  const portalOperation = hasCustomerPortalOperation(path, method)
  if (!websiteOperation && !portalOperation) {
    throw new OpsError('OPS-anropet saknar ett incheckat OpenAPI-kontrakt.', 500, {
      code: 'openapi_operation_missing',
      endpoint: path.split('?', 1)[0],
      method: method.toUpperCase(),
      retryable: false,
    })
  }
  const body = jsonRequestBody(init)
  const headers = new Headers(init?.headers)
  if (websiteOperation) assertWebsiteOperationRequest(path, method, body, headers)
  else assertCustomerPortalOperationRequest(path, method, body, headers)

  const response = await opsRequest(path, init)
  observeRuntimeSchemaValidation({
    endpoint: path.split('?', 1)[0],
    schema: websiteOperation ? 'website-operation-response' : 'customer-portal-operation-response',
    validate: () => {
      if (websiteOperation) assertWebsiteOperationResponse(path, method, response.status, response.payload)
      else assertCustomerPortalOperationResponse(path, method, response.status, response.payload)
    },
  })
  return response.payload
}


/**
 * Verifies that the configured API key can pass an endpoint's authorization
 * layer without performing a valid business operation. Readiness callers must
 * send an intentionally invalid payload/identity. A validation or not-found
 * response proves that authorization passed; 401/403 proves that it did not.
 */
export async function probeOpsEndpointAuthorization(
  path: string,
  init?: RequestInit,
): Promise<OpsAuthorizationProbeResult> {
  try {
    const response = await opsRequest(path, init);
    return { ok: true, status: response.status, code: null };
  } catch (error) {
    if (!isOpsError(error)) throw error;
    const code = opsErrorCodeValue(error);
    if (error.status === 401 || error.status === 403) {
      return { ok: false, status: error.status, code };
    }

    const endpointMissing =
      code === "endpoint_not_found" ||
      code === "method_not_supported" ||
      code === "route_not_found";
    if ((error.status === 404 || error.status === 405) && endpointMissing) {
      throw error;
    }

    if (error.status === 404) {
      if (!code) throw error;
      return { ok: true, status: error.status, code };
    }

    if ([400, 409, 422].includes(error.status)) {
      return { ok: true, status: error.status, code };
    }

    throw error;
  }
}

function extractObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return {};
  const p = payload as Record<string, unknown>;
  const data = p.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return p;
}

function isOpsWebsitePriceArea(value: unknown): value is OpsWebsitePriceArea {
  return (
    typeof value === "string" && ["SE1", "SE2", "SE3", "SE4"].includes(value)
  );
}

function pickStringArray(
  row: Record<string, unknown>,
  keys: string[],
): string[] | undefined {
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
  }
  return undefined;
}

function normalizePreviewContractType(
  value: unknown,
): "spot_monthly" | "spot_hourly" | "spot_quarterly" | "portfolio_managed" | "fixed" | "mix" | "monthly_fixed" {
  const type = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (type === "fixed") return "fixed";
  if (type === "monthly_fixed" || type === "fixed_monthly") return "monthly_fixed";
  if (type === "portfolio" || type === "portfolio_managed")
    return "portfolio_managed";
  if (type === "mix" || type === "mixed") return "mix";
  if (/quarter|15[_ -]?min|kvart/.test(type)) return "spot_quarterly";
  if (/hour|tim/.test(type)) return "spot_hourly";
  return "spot_monthly";
}

function normalizeQuoteAssumptions(value: unknown): OpsQuoteAssumption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (typeof item === "string" && item.trim()) return [{ label: item.trim() }];
    const row = recordValue(item);
    if (!row) return [];
    const label = pickString(row, ["label", "name", "title", "assumption", "description"]);
    if (!label) return [];
    const rawValue = row.value ?? row.amount ?? row.input ?? null;
    const safeValue = ["string", "number", "boolean"].includes(typeof rawValue) ? rawValue as string | number | boolean : null;
    return [{
      code: pickString(row, ["code", "key", "id"]) ?? `assumption_${index + 1}`,
      label,
      value: safeValue,
      unit: pickString(row, ["unit"]),
      description: pickString(row, ["description", "details"]),
    }];
  });
}

function normalizeQuoteMarketSources(value: unknown): OpsQuoteMarketSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [{ name: item.trim() }];
    const row = recordValue(item);
    if (!row) return [];
    const name = pickString(row, ["name", "provider", "source", "label"]);
    if (!name) return [];
    return [{
      name,
      period: pickString(row, ["period", "source_period", "sourcePeriod"]),
      resolution: pickString(row, ["resolution", "pricing_interval", "interval"]),
      timestamp: pickString(row, ["timestamp", "market_data_timestamp", "updated_at", "published_at"]),
    }];
  });
}

function quoteSourcePeriod(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  const row = recordValue(value);
  if (!row) return null;
  const label = pickString(row, ["label", "period", "name"]);
  if (label) return label;
  const start = pickString(row, ["start", "from", "period_start", "periodStart"]);
  const end = pickString(row, ["end", "to", "period_end", "periodEnd"]);
  return start && end ? `${start}–${end}` : start ?? end;
}

function quoteSourceWindow(value: unknown): { start: string; end: string } | null {
  const row = recordValue(value);
  if (!row) return null;
  const start = pickString(row, ["start", "from", "period_start", "periodStart"]);
  const end = pickString(row, ["end", "to", "period_end", "periodEnd"]);
  return start && end ? { start, end } : null;
}

function normalizeWebsitePricingSpecification(
  row: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const rawSpecification =
    row.specification &&
    typeof row.specification === "object" &&
    !Array.isArray(row.specification)
      ? (row.specification as Record<string, unknown>)
      : {};

  const rawFees =
    rawSpecification.fees &&
    typeof rawSpecification.fees === "object" &&
    !Array.isArray(rawSpecification.fees)
      ? (rawSpecification.fees as Record<string, unknown>)
      : {};

  const componentValues = extractOpsPriceComponents({
    ...row,
    specification: rawSpecification,
  });
  const fees = {
    ...rawFees,
    markupOre:
      coalesceNumber(
        normalizeNumber(
          rawFees.markupOre ??
            rawFees.markup_ore ??
            rawFees.markup_ore_per_kwh ??
            rawFees.supplier_margin_ore_per_kwh ??
            rawFees.supplierMarginOrePerKwh,
        ),
        componentValues.markup_ore_per_kwh,
      ) ?? undefined,
    variableFeeOre:
      coalesceNumber(
        normalizeNumber(
          rawFees.variableFeeOre ??
            rawFees.variable_fee_ore ??
            rawFees.variable_fee_ore_per_kwh ??
            rawFees.variable_markup_ore_per_kwh ??
            rawFees.variableMarkupOrePerKwh,
        ),
        componentValues.variable_markup_ore_per_kwh,
      ) ?? undefined,
    elcertOre:
      coalesceNumber(
        normalizeNumber(
          rawFees.elcertOre ?? rawFees.elcert_ore ?? rawFees.elcert_ore_per_kwh,
        ),
        componentValues.elcert_ore_per_kwh,
      ) ?? undefined,
    monthlyFeeSek:
      coalesceNumber(
        normalizeNumber(
          rawFees.monthlyFeeSek ??
            rawFees.monthly_fee_sek ??
            rawFees.subscriptionFeeSek ??
            rawFees.subscription_fee_sek,
        ),
        componentValues.monthly_fee_sek,
      ) ?? undefined,
    invoiceFeeSek:
      coalesceNumber(
        normalizeNumber(
          rawFees.invoiceFeeSek ??
            rawFees.invoice_fee_sek ??
            rawFees.billingFeeSek ??
            rawFees.billing_fee_sek,
        ),
        componentValues.invoice_fee_sek,
      ) ?? undefined,
    invoiceFeeIncludedInMonthlyEstimate:
      typeof rawFees.invoiceFeeIncludedInMonthlyEstimate === "boolean"
        ? rawFees.invoiceFeeIncludedInMonthlyEstimate
        : typeof rawFees.invoice_fee_included_in_monthly_estimate === "boolean"
          ? rawFees.invoice_fee_included_in_monthly_estimate
          : typeof rawFees.invoiceFeeIncluded === "boolean"
            ? rawFees.invoiceFeeIncluded
            : typeof rawFees.invoice_fee_included === "boolean"
              ? rawFees.invoice_fee_included
              : undefined,
    billingIntervalMonths:
      normalizeNumber(
        rawFees.billingIntervalMonths ??
          rawFees.billing_interval_months ??
          rawFees.invoiceIntervalMonths ??
          rawFees.invoice_interval_months,
      ) ?? undefined,
  };

  return {
    ...rawSpecification,
    fees,
  };
}

function normalizeCustomerTypeFilter(value?: string | null): WebsiteCustomerType | null {
  return value === "private" || value === "business" ? value : null;
}

function extractQuoteRow(payload: unknown): Record<string, unknown> {
  const root = extractObject(payload);
  const quote = recordValue(root.quote) ?? recordValue(root.pricing_quote) ?? root;
  return quote;
}

function quoteNumber(row: Record<string, unknown>, paths: string[][]): number | null {
  for (const path of paths) {
    let current: unknown = row;
    for (const key of path) current = recordValue(current)?.[key];
    const value = normalizeNumber(current);
    if (value !== null) return value;
  }
  return null;
}

function normalizeQuoteMarketReference(value: unknown): OpsQuoteMarketReference | null {
  const row = recordValue(value);
  if (!row) return null;
  const area = pickString(row, ["price_area", "priceArea", "price_area_code", "priceAreaCode"])?.toUpperCase();
  return {
    provider: pickString(row, ["provider", "source", "name"]),
    price_area: isOpsWebsitePriceArea(area) ? area : null,
    reference_type: pickString(row, ["reference_type", "referenceType"]),
    reference_period: pickString(row, ["reference_period", "referencePeriod", "period"]),
    price_sek_per_kwh: normalizeNumber(row.price_sek_per_kwh ?? row.priceSekPerKwh),
    price_ore_per_kwh: normalizeNumber(row.price_ore_per_kwh ?? row.priceOrePerKwh),
    requested_days: normalizeNumber(row.requested_days ?? row.requestedDays),
    included_days: normalizeNumber(row.included_days ?? row.includedDays),
    period_start: pickString(row, ["period_start", "periodStart"]),
    period_end: pickString(row, ["period_end", "periodEnd"]),
    as_of: pickString(row, ["as_of", "asOf", "timestamp"]),
    source_as_of: pickString(row, ["source_as_of", "sourceAsOf"]),
    generated_at: pickString(row, ["generated_at", "generatedAt"]),
    stale_after: pickString(row, ["stale_after", "staleAfter"]),
    effective_stale_at: pickString(row, ["effective_stale_at", "effectiveStaleAt"]),
    unit: pickString(row, ["unit"]),
    includes_vat: pickBoolean(row, ["includes_vat", "includesVat"]),
    includes_supplier_fees: pickBoolean(row, ["includes_supplier_fees", "includesSupplierFees"]),
    includes_grid_fees: pickBoolean(row, ["includes_grid_fees", "includesGridFees"]),
    is_indicative: pickBoolean(row, ["is_indicative", "isIndicative"]),
    is_stale: pickBoolean(row, ["is_stale", "isStale"]),
    fallback_used: pickBoolean(row, ["fallback_used", "fallbackUsed"]),
    fallback_reason: pickString(row, ["fallback_reason", "fallbackReason", "fallback"]),
    freshness: pickString(row, ["freshness", "freshness_status", "freshnessStatus"]),
  };
}

function mapOpsWebsiteQuote(payload: unknown, input: OpsWebsiteQuoteInput): OpsWebsitePricingPreview {
  const row = extractQuoteRow(payload);
  const contract = recordValue(row.contract) ?? recordValue(row.offer) ?? {};
  const totals = recordValue(row.totals) ?? recordValue(row.total) ?? {};
  const estimate = recordValue(row.estimate) ?? {};
  const selectedAreaPrice = recordValue(row.selected_area_price ?? row.selectedAreaPrice) ?? {};
  const quoteInput = recordValue(row.input) ?? recordValue(row.request) ?? {};
  const marketReferenceRow = recordValue(row.market_reference ?? row.marketReference) ?? {};
  const quoteReference = pickString(row, ['quote_reference', 'quoteReference', 'reference']);
  const offerReference = pickString(contract, ['offer_reference', 'offerReference']) ?? pickString(row, ['offer_reference', 'offerReference']);
  const name = pickString(contract, ['name', 'title']) ?? pickString(row, ['contract_name', 'name']) ?? 'Elavtal';
  const rawEnergyDirection = pickString(row, ['energy_direction', 'energyDirection']);
  const energyDirection = rawEnergyDirection === 'consumption' || rawEnergyDirection === 'production'
    ? rawEnergyDirection
    : null;
  const productionPricing = normalizeProductionPricing(row.production_pricing ?? row.productionPricing);
  if (!energyDirection || (energyDirection === 'production' && !productionPricing)) {
    throw new OpsError('OPS-offerten saknar giltig energiriktning eller produktionsprissättning.', 502, {
      code: 'ops_quote_energy_direction_invalid',
      energy_direction: rawEnergyDirection,
      has_production_pricing: Boolean(productionPricing),
    });
  }
  const area = (
    pickString(quoteInput, ['price_area', 'priceArea', 'price_area_code', 'priceAreaCode']) ??
    pickString(selectedAreaPrice, ['price_area', 'priceArea', 'price_area_code', 'priceAreaCode']) ??
    pickString(marketReferenceRow, ['price_area', 'priceArea', 'price_area_code', 'priceAreaCode']) ??
    pickString(row, ['price_area_code', 'priceAreaCode', 'price_area'])
  )?.toUpperCase();
  const annualKwh = quoteNumber(row, [['annual_consumption_kwh'], ['annual_kwh'], ['consumption', 'annual_consumption_kwh']]) ?? input.annual_consumption_kwh;
  const monthlyKwh = quoteNumber(row, [['estimated_monthly_kwh'], ['monthly_kwh'], ['consumption', 'estimated_monthly_kwh']]) ?? annualKwh / 12;
  const pricePerKwh = quoteNumber(row, [
    ['price_per_kwh_ore'],
    ['energy_price_ore_per_kwh'],
    ['pricing', 'price_per_kwh_ore'],
    ['totals', 'price_per_kwh_ore'],
    ['selected_area_price', 'energy_price_ore_per_kwh'],
    ['selectedAreaPrice', 'energyPriceOrePerKwh'],
    ['production_pricing', 'compensation_ore_per_kwh'],
    ['productionPricing', 'compensationOrePerKwh'],
    ['production_pricing', 'fixed_compensation_ore_per_kwh'],
  ]);
  const monthlyExVat = normalizeNumber(
    estimate.monthly_ex_vat ?? estimate.monthly_cost_ex_vat ??
    totals.monthly_ex_vat ?? totals.monthly_cost_ex_vat ??
    row.total_monthly_cost_sek ?? row.monthly_cost_ex_vat,
  );
  const monthlyIncVat = normalizeNumber(
    estimate.monthly_inc_vat ?? estimate.monthly_cost_inc_vat ??
    totals.monthly_inc_vat ?? totals.monthly_cost_inc_vat ??
    row.total_monthly_cost_incl_vat_sek ?? row.monthly_cost_inc_vat,
  );
  const yearly = normalizeNumber(
    estimate.yearly_inc_vat ?? estimate.yearly_cost ??
    totals.yearly_inc_vat ?? totals.yearly_cost ?? row.total_yearly_cost_sek,
  );
  const validUntil = pickString(row, ['valid_until', 'validUntil', 'expires_at', 'expiresAt']);
  const resolutionId =
    pickString(quoteInput, ['resolution_id', 'resolutionId']) ??
    pickString(row, ['resolution_id', 'resolutionId']) ??
    input.resolution_id;
  const startDate =
    pickString(quoteInput, ['start_date', 'startDate']) ??
    pickString(row, ['start_date', 'startDate']) ??
    normalizeText(input.start_date);
  const priceOptionReference =
    pickString(row, ['price_option_reference']) ??
    pickString(quoteInput, ['price_option_reference']);
  const invoiceDeliveryMethod =
    pickString(row, ['invoice_delivery_method']) ??
    pickString(quoteInput, ['invoice_delivery_method']);
  const invoiceMethods = new Set<OpsInvoiceDeliveryMethod>([
    'email',
    'e_invoice',
    'paper',
    'direct_debit',
  ]);
  const normalizedInvoiceDeliveryMethod = invoiceMethods.has(
    invoiceDeliveryMethod as OpsInvoiceDeliveryMethod,
  )
    ? invoiceDeliveryMethod as OpsInvoiceDeliveryMethod
    : null;
  const selectedComponentReferences =
    pickStringArray(row, ['selected_component_references']) ??
    pickStringArray(quoteInput, ['selected_component_references']);
  const mandatoryComponentReferences =
    pickStringArray(row, ['mandatory_component_references', 'mandatoryComponentReferences']) ?? [];
  const conditionalComponentReferences =
    pickStringArray(row, ['conditional_component_references', 'conditionalComponentReferences']) ?? [];
  const siteCount = normalizeInteger(row.site_count ?? quoteInput.site_count);
  if (!quoteReference || !offerReference || !priceOptionReference || !normalizedInvoiceDeliveryMethod || !resolutionId || !startDate || !isOpsWebsitePriceArea(area) || monthlyKwh === null || annualKwh === null || pricePerKwh === null || monthlyExVat === null || monthlyIncVat === null || !validUntil || !selectedComponentReferences || siteCount === null || !Number.isInteger(siteCount) || siteCount < 1) {
    throw new OpsError('OPS returnerade en ofullständig canonical quote.', 502, {
      code: 'ops_quote_contract_invalid',
      quote_reference: quoteReference,
      offer_reference: offerReference,
      price_area_code: area,
      resolution_id: resolutionId,
      start_date: startDate,
    });
  }
  if (
    priceOptionReference !== input.price_option_reference ||
    normalizedInvoiceDeliveryMethod !== input.invoice_delivery_method ||
    siteCount !== input.site_count ||
    JSON.stringify([...selectedComponentReferences].sort()) !==
      JSON.stringify([...new Set(input.selected_component_references)].sort())
  ) {
    throw new OpsError('OPS-offerten matchar inte kundens val.', 409, {
      code: 'ops_quote_selection_mismatch',
      expected: {
        price_option_reference: input.price_option_reference,
        invoice_delivery_method: input.invoice_delivery_method,
        selected_component_references: [...new Set(input.selected_component_references)].sort(),
        site_count: input.site_count,
      },
      received: {
        price_option_reference: priceOptionReference,
        invoice_delivery_method: normalizedInvoiceDeliveryMethod,
        selected_component_references: [...selectedComponentReferences].sort(),
        site_count: siteCount,
      },
      retryable: false,
    });
  }
  const rawHashes = recordValue(row.legal_document_hashes ?? row.document_hashes);
  const hashes = rawHashes ? Object.fromEntries(Object.entries(rawHashes).flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : [])) : undefined;
  const marketReference = normalizeQuoteMarketReference(row.market_reference ?? row.marketReference);
  const marketSources = normalizeQuoteMarketSources(row.market_sources ?? row.marketSources);
  if (marketSources.length === 0 && marketReference?.provider) {
    marketSources.push({
      name: marketReference.provider,
      period: marketReference.reference_period,
      timestamp: marketReference.as_of,
    });
  }
  return {
    resolution_id: resolutionId,
    energy_direction: energyDirection,
    production_pricing: productionPricing,
    start_date: startDate,
    contract: {
      slug: offerReference,
      offer_reference: offerReference,
      name,
      contractType: normalizePreviewContractType(contract.contract_type ?? contract.type ?? row.contract_type),
    },
    priceArea: area,
    price_area_code: area,
    kwh: monthlyKwh,
    annual_consumption_kwh: annualKwh,
    pricePerKwhOre: pricePerKwh,
    totalMonthlyCostSek: monthlyExVat,
    totalMonthlyCostInclVatSek: monthlyIncVat,
    totalYearlyCostSek: yearly ?? undefined,
    specification: normalizeWebsitePricingSpecification(row),
    pricing_snapshot_reference: pickString(row, ['pricing_snapshot_reference', 'pricingSnapshotReference']) ?? quoteReference,
    ops_quote_reference: quoteReference,
    public_contract_etag: pickString(row, ['public_contract_etag', 'publicContractEtag']),
    publication_revision: normalizeInteger(row.publication_revision ?? row.publicationRevision),
    contract_payload_sha256: pickString(row, ['contract_payload_sha256', 'contractPayloadSha256']),
    legal_bundle_version: pickString(row, ['legal_bundle_version', 'legalBundleVersion']),
    legal_document_hashes: hashes,
    pricing_interval: pickString(row, ['pricing_interval', 'pricingInterval', 'interval']) ?? 'month',
    estimate_method: pickString(row, ['estimate_method', 'estimateMethod', 'calculation_method']) ?? 'ops_canonical_quote',
    source_period: quoteSourcePeriod(row.source_period ?? row.sourcePeriod) ?? marketReference?.reference_period ?? undefined,
    source_window: quoteSourceWindow(row.source_window ?? row.sourceWindow),
    market_data_timestamp: pickString(row, ['market_data_timestamp', 'marketDataTimestamp']) ?? marketReference?.as_of ?? undefined,
    is_binding: pickBoolean(row, ['is_binding', 'isBinding']) ?? false,
    assumptions: normalizeQuoteAssumptions(row.assumptions),
    market_sources: marketSources,
    market_reference: marketReference,
    pricing_snapshot_schema_version: pickString(row, ['pricing_snapshot_schema_version', 'schema_version', 'schemaVersion']) ?? GRIDEX_WEBSITE_API_CONTRACT_VERSION,
    valid_until: validUntil,
    price_option_reference: priceOptionReference,
    invoice_delivery_method: normalizedInvoiceDeliveryMethod,
    selected_component_references: selectedComponentReferences,
    mandatory_component_references: mandatoryComponentReferences,
    conditional_component_references: conditionalComponentReferences,
    site_count: siteCount,
    raw: row,
  };
}

function publicContractsPath(
  customerType?: string | null,
  diagnostics = false,
): string {
  const query = new URLSearchParams();
  const normalizedCustomerType = normalizeCustomerTypeFilter(customerType);
  if (normalizedCustomerType) query.set("customer_type", toOpsCustomerType(normalizedCustomerType));
  const suffix = query.toString();
  const pathname = diagnostics
    ? "/api/v1/website/public-contracts/diagnostics"
    : "/api/v1/website/public-contracts";
  return `${pathname}${suffix ? `?${suffix}` : ""}`;
}

function diagnosticBlockers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      const row = recordValue(item);
      if (!row) return "";
      return (
        pickString(row, ["message", "label", "code", "reason", "blocker"]) ??
        JSON.stringify(row)
      );
    })
    .filter(Boolean);
}

function mapPublicContractDiagnostic(
  value: unknown,
  visibleFallback: boolean | null,
): OpsPublicContractDiagnostic | null {
  const row = recordValue(value);
  if (!row) return null;
  const explicitVisible = pickBoolean(row, ["visible", "is_visible", "isVisible"]);
  const blockers = diagnosticBlockers(
    row.blockers ?? row.blocking_reasons ?? row.blockingReasons ?? row.reasons,
  );
  return {
    offer_reference: pickString(row, ["offer_reference", "offerReference"]),
    name: pickString(row, ["name", "title", "contract_name", "contractName"]),
    visible: explicitVisible ?? visibleFallback,
    blockers,
    raw: row,
  };
}

function extractPublicContractDiagnostics(payload: unknown): OpsPublicContractDiagnostic[] {
  const root = extractObject(payload);
  const diagnostics = recordValue(root.diagnostics) ?? root;
  const result: OpsPublicContractDiagnostic[] = [];

  const append = (value: unknown, visible: boolean | null) => {
    if (!Array.isArray(value)) return;
    for (const row of value) {
      const mapped = mapPublicContractDiagnostic(row, visible);
      if (mapped) result.push(mapped);
    }
  };

  append(diagnostics.visible, true);
  append(diagnostics.hidden, false);
  append(diagnostics.items, null);
  append(diagnostics.offers, null);
  append(diagnostics.contracts, null);

  if (result.length === 0) {
    append(extractRows(payload), null);
  }

  const deduped = new Map<string, OpsPublicContractDiagnostic>();
  result.forEach((item, index) => {
    const key = item.offer_reference ?? `${item.name ?? "diagnostic"}:${index}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, item);
      return;
    }
    deduped.set(key, {
      ...existing,
      visible: item.visible ?? existing.visible,
      blockers: Array.from(new Set([...existing.blockers, ...item.blockers])),
      raw: { ...existing.raw, ...item.raw },
    });
  });
  return [...deduped.values()];
}

let integrationContextCache: {
  key: string;
  expiresAt: number;
  value: OpsIntegrationContext;
} | null = null;

function integrationContextFromPayload(payload: unknown): OpsIntegrationContext {
  const root = recordValue(payload) ?? {}
  const data = recordValue(root.data)
  const context = recordValue(root.context) ?? recordValue(data?.context) ?? data ?? root
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    throw new OpsError('OPS integration context har ogiltigt format.', 502, {
      code: 'ops_integration_context_invalid',
      endpoint: '/api/v1/integration/context',
      retryable: false,
    })
  }
  const meta = recordValue(root.meta) ?? recordValue(data?.meta)
  const configuration =
    recordValue(context.configuration) ??
    recordValue(data?.configuration) ??
    recordValue(root.configuration) ??
    {}
  const capabilities =
    recordValue(context.capabilities) ??
    recordValue(data?.capabilities) ??
    recordValue(root.capabilities) ??
    {}
  const authentication =
    recordValue(configuration.authentication) ??
    recordValue(context.authentication) ??
    recordValue(data?.authentication) ??
    recordValue(root.authentication) ??
    null
  const authoritativeIdentity =
    pickFromRecords([context, data, root], ['authoritative_identity', 'authoritativeIdentity']) ??
    recordValue(context.authoritative_identity) ??
    recordValue(context.authoritativeIdentity) ??
    null
  const tenantReference = pickFromRecords(
    [context, meta, data, root],
    ['tenant_reference', 'tenantReference'],
  )
  const verifiedTenantReference = assertTenantReference(
    tenantReference,
    '/api/v1/integration/context',
  )
  const contractVersion =
    pickFromRecords([context, meta, data, root], ['contract_version', 'contractVersion'])
  const requiredEnvironmentVariables =
    pickStringArray(configuration, ['required_environment_variables', 'requiredEnvironmentVariables']) ?? []
  const websiteMissing =
    pickStringArray(capabilities, [
      'missing_website_checkout_scopes',
      'missingWebsiteCheckoutScopes',
      'missing_website_scopes',
      'missingWebsiteScopes',
    ]) ?? []
  const portalMissing =
    pickStringArray(capabilities, ['missing_customer_portal_scopes', 'missingCustomerPortalScopes']) ?? []
  const completeMissing =
    pickStringArray(capabilities, ['missing_complete_tenant_website_scopes', 'missingCompleteTenantWebsiteScopes']) ??
    [...new Set([...websiteMissing, ...portalMissing])]
  const recommendedMissing =
    pickStringArray(capabilities, ['missing_recommended_scopes', 'missingRecommendedScopes', 'recommended_missing_scopes', 'recommendedMissingScopes']) ?? []
  const requiredWebsiteScopes =
    pickStringArray(capabilities, ['required_website_checkout_scopes', 'requiredWebsiteCheckoutScopes', 'required_website_scopes', 'requiredWebsiteScopes']) ?? []
  const requiredPortalScopes =
    pickStringArray(capabilities, ['required_customer_portal_scopes', 'requiredCustomerPortalScopes']) ?? []
  const applicationReferenceLocation =
    pickString(configuration, ['application_reference_location', 'applicationReferenceLocation'])
  const apiClientReference = pickFromRecords([context, meta, data, root], ['api_client_reference', 'apiClientReference'])
  const authoritativeIdentityValue = typeof authoritativeIdentity === 'string' ? authoritativeIdentity : null
  const authHeader = pickString(authentication ?? {}, ['header'])
  const authScheme = pickString(authentication ?? {}, ['scheme'])
  const authServerSideOnly = pickBoolean(authentication ?? {}, ['server_side_only', 'serverSideOnly'])
  const websiteOpenapiUrl = pickString(configuration, ['openapi_url', 'openapiUrl', 'website_openapi_url', 'websiteOpenapiUrl', 'website_integration_openapi_url', 'websiteIntegrationOpenapiUrl'])
  const customerPortalOpenapiUrl = pickString(configuration, ['customer_portal_openapi_url', 'customerPortalOpenapiUrl'])
  const tenantIdEnvironmentRequired = pickBoolean(configuration, ['tenant_id_environment_required', 'tenantIdEnvironmentRequired'])
  const companyIdEnvironmentRequired = pickBoolean(configuration, ['company_id_environment_required', 'companyIdEnvironmentRequired'])
  const value: OpsIntegrationContext = {
    tenant_reference: verifiedTenantReference,
    company_id: pickFromRecords([context, meta, data, root], ['company_id', 'companyId']),
    api_client_reference: apiClientReference ?? '',
    authoritative_identity: 'api_key',
    authentication: { header: 'Authorization', scheme: 'Bearer', server_side_only: true },
    environment: pickFromRecords([context, meta, data, root], ['environment', 'api_environment']) ?? 'production',
    channel: pickFromRecords([context, meta, data, root], ['channel']) ?? 'website',
    api_version: pickFromRecords([context, meta, data, root], ['api_version', 'apiVersion']) ?? 'v1',
    contract_version: contractVersion ?? '',
    active_scopes:
      pickStringArray(context, ['active_scopes', 'activeScopes', 'scopes']) ??
      pickStringArray(authentication ?? {}, ['active_scopes', 'activeScopes', 'scopes']) ??
      [],
    configuration: {
      required_environment_variables: requiredEnvironmentVariables,
      api_base_url: pickString(configuration, ['api_base_url', 'apiBaseUrl']) ?? '',
      application_reference_location: 'top_level',
      authentication: { header: 'Authorization', scheme: 'Bearer', server_side_only: true },
      tenant_id_environment_required: false,
      company_id_environment_required: false,
      website_openapi_url: websiteOpenapiUrl ?? '',
      customer_portal_openapi_url: customerPortalOpenapiUrl ?? '',
    },
    capabilities: {
      website_checkout_ready:
        pickBoolean(capabilities, ['website_checkout_ready', 'websiteCheckoutReady']) ?? websiteMissing.length === 0,
      customer_portal_ready:
        pickBoolean(capabilities, ['customer_portal_ready', 'customerPortalReady']) ?? portalMissing.length === 0,
      complete_tenant_website_ready:
        pickBoolean(capabilities, ['complete_tenant_website_ready', 'completeTenantWebsiteReady']) ?? completeMissing.length === 0,
      missing_website_checkout_scopes: websiteMissing,
      missing_customer_portal_scopes: portalMissing,
      missing_complete_tenant_website_scopes: completeMissing,
      recommended_missing_scopes: recommendedMissing,
      required_website_checkout_scopes: requiredWebsiteScopes,
      required_customer_portal_scopes: requiredPortalScopes,
    },
    raw: root,
  }
  const integrationWarnings: Array<Record<string, unknown>> = []
  if (!contractVersion) {
    integrationWarnings.push({ code: 'contract_version_missing' })
  }
  if (requiredEnvironmentVariables.length !== 1 || requiredEnvironmentVariables[0] !== 'GRIDEX_API_KEY') {
    integrationWarnings.push({
      code: 'required_environment_variables_drift',
      received: requiredEnvironmentVariables,
    })
  }
  const expectedApiBaseUrl = opsBaseUrl()
  const expectedWebsiteOpenapiUrl = `${expectedApiBaseUrl}/openapi/website-integration-v1.json`
  const expectedCustomerPortalOpenapiUrl = `${expectedApiBaseUrl}/openapi/customer-portal-v1.json`
  if (value.configuration.api_base_url !== expectedApiBaseUrl) {
    integrationWarnings.push({ code: 'api_base_url_drift', received: value.configuration.api_base_url || null })
  }
  if (!apiClientReference || authoritativeIdentityValue !== 'api_key') {
    throw new OpsError('OPS integration context saknar auktoritativ API-nyckelidentitet.', 502, {
      code: 'ops_authoritative_identity_mismatch',
      expected: 'api_key',
      received: authoritativeIdentityValue,
      api_client_reference_present: Boolean(apiClientReference),
      endpoint: '/api/v1/integration/context',
      retryable: false,
    })
  }
  if (authHeader !== 'Authorization' || authScheme !== 'Bearer' || authServerSideOnly !== true) {
    throw new OpsError('OPS integration context annonserar en okänd autentiseringsmodell.', 502, {
      code: 'ops_authentication_configuration_mismatch',
      expected: { header: 'Authorization', scheme: 'Bearer', server_side_only: true },
      received: { header: authHeader, scheme: authScheme, server_side_only: authServerSideOnly },
      endpoint: '/api/v1/integration/context',
      retryable: false,
    })
  }
  if (tenantIdEnvironmentRequired !== false || companyIdEnvironmentRequired !== false) {
    integrationWarnings.push({
      code: 'tenant_environment_requirement_drift',
      tenant_id_environment_required: tenantIdEnvironmentRequired,
      company_id_environment_required: companyIdEnvironmentRequired,
    })
  }
  if (websiteOpenapiUrl !== expectedWebsiteOpenapiUrl || customerPortalOpenapiUrl !== expectedCustomerPortalOpenapiUrl) {
    integrationWarnings.push({
      code: 'openapi_url_drift',
      website: websiteOpenapiUrl,
      customer_portal: customerPortalOpenapiUrl,
    })
  }
  if (integrationWarnings.length > 0) {
    console.warn('[gridex-integration-context] compatible configuration drift detected', {
      endpoint: '/api/v1/integration/context',
      warnings: integrationWarnings,
    })
  }
  if (applicationReferenceLocation && applicationReferenceLocation !== 'top_level') {
    throw new OpsError('OPS kräver en okänd placering av ansökningsreferenser.', 502, {
      code: 'ops_application_reference_location_mismatch',
      expected: 'top_level',
      received: applicationReferenceLocation,
      endpoint: '/api/v1/integration/context',
      retryable: false,
    })
  }
  logContractVersionDrift({
    endpoint: '/api/v1/integration/context',
    localVersion: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
    receivedVersion: value.contract_version || null,
  })
  return value
}

export async function getVerifiedOpsIntegrationContext(forceFresh = false): Promise<OpsIntegrationContext> {
  const key = opsTenantCacheKey();
  const now = Date.now();
  if (!forceFresh && integrationContextCache?.key === key && integrationContextCache.expiresAt > now) {
    return integrationContextCache.value;
  }
  const payload = await opsFetch("/api/v1/integration/context");
  const value = integrationContextFromPayload(payload);
  integrationContextCache = { key, expiresAt: now + 60_000, value };
  return value;
}

export const fetchOpsIntegrationContext = getVerifiedOpsIntegrationContext;

async function verifiedTenantReference(payload: unknown, source: string): Promise<string> {
  const context = await getVerifiedOpsIntegrationContext();
  const direct = tenantReferenceFromPayload(payload);
  if (direct && direct !== context.tenant_reference) {
    throw new OpsError("OPS-svaret tillhör fel tenant.", 503, {
      code: "ops_tenant_mismatch",
      expected_tenant_reference: context.tenant_reference,
      actual_tenant_reference: direct,
      source,
    });
  }
  return context.tenant_reference;
}

function publicationRevisionFromPayload(payload: unknown): number | null {
  const root = recordValue(payload);
  const data = recordValue(root?.data);
  const meta = recordValue(root?.meta) ?? recordValue(data?.meta);
  const value =
    meta?.publication_revision ??
    meta?.publicationRevision ??
    data?.publication_revision ??
    data?.publicationRevision ??
    root?.publication_revision ??
    root?.publicationRevision;
  return normalizeInteger(value)
}

function contractVersionFromPayload(payload: unknown): string | null {
  const root = recordValue(payload)
  const data = recordValue(root?.data)
  const meta = recordValue(root?.meta) ?? recordValue(data?.meta)
  return pickFromRecords(
    [meta, data, root],
    ['contract_schema_version', 'contractSchemaVersion', 'contract_version', 'contractVersion'],
  )
}

type PublicContractsCacheEntry = OpsPublicContractsSnapshot & { cache_key: string };
const publicContractsCache = new Map<string, PublicContractsCacheEntry>();

function publicContractsCacheKey(customerType?: WebsiteCustomerType | null): string {
  return `${opsTenantCacheKey()}|website|public-contracts|${GRIDEX_WEBSITE_API_CONTRACT_VERSION}|${customerType ? toOpsCustomerType(customerType) : "all"}`;
}

function publicContractReference(value: unknown): string | null {
  const row = recordValue(value)
  return row ? pickString(row, ['offer_reference', 'offerReference']) : null
}

function publicContractParseReasons(value: unknown): string[] {
  const row = recordValue(value)
  if (!row) return ['invalid_contract_object']
  const reasons: string[] = []
  if (!pickString(row, ['offer_reference', 'offerReference'])) reasons.push('missing_offer_reference')
  if (!pickString(row, ['name'])) reasons.push('missing_name')
  const contractType = pickString(row, ['contract_type', 'contractType', 'type'])
  if (!contractType) reasons.push('missing_contract_type')
  else if (!['fixed', 'variable_monthly', 'variable_hourly', 'variable_quarterly', 'portfolio', 'mixed'].includes(contractType)) {
    reasons.push('unsupported_contract_type')
  }
  const pricing = recordValue(row.pricing)
  if (!pricing) reasons.push('pricing_incomplete')
  const direction = pickString(row, ['energy_direction', 'energyDirection']) ?? pickString(pricing ?? {}, ['energy_direction', 'energyDirection'])
  if (direction !== 'consumption' && direction !== 'production') reasons.push('invalid_energy_direction')
  return reasons.length > 0 ? reasons : ['invalid_public_contract']
}

function sortedPublicContracts(payload: unknown): {
  contracts: OpsPublicContract[]
  blockedContracts: OpsBlockedPublicContract[]
} {
  const root = recordValue(payload)
  const rows = extractRows(payload)
  if (!root || !Array.isArray(root.data)) {
    throw new OpsError('OPS public-contracts saknar en giltig data-array.', 502, {
      code: 'ops_public_contracts_response_invalid',
      endpoint: '/api/v1/website/public-contracts',
      retryable: false,
    })
  }

  const contracts: OpsPublicContract[] = []
  const blockedContracts: OpsBlockedPublicContract[] = []
  for (const row of rows) {
    const mapped = mapPublicContract(row)
    if (mapped) contracts.push(mapped)
    else blockedContracts.push({
      offer_reference: publicContractReference(row),
      reasons: publicContractParseReasons(row),
    })
  }

  contracts.sort((a, b) => {
    const sa = a.sort_order ?? 10_000
    const sb = b.sort_order ?? 10_000
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name, 'sv')
  })
  return { contracts, blockedContracts }
}

export function invalidateOpsPublicContractsCache(input?: {
  tenantReference?: string | null;
  channel?: string | null;
  publicationRevision?: number | null;
}): void {
  if (input?.channel && input.channel !== "website") return;
  if (input?.tenantReference) {
    for (const [key, value] of publicContractsCache.entries()) {
      if (value.tenant_reference === input.tenantReference) publicContractsCache.delete(key);
    }
    return;
  }
  publicContractsCache.clear();
}

function mapResolutionSource(value: unknown): OpsResolutionSource | null {
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
  if (!responseRoot || !responseData || !recordValue(responseData.capabilities) || !recordValue(responseData.blockers) || !Array.isArray(responseData.warnings)) {
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
  if (!isOpsWebsitePriceArea(priceArea)) {
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
    source,
    source_chain: [],
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
      'Idempotency-Key': `website-quote:${canonicalSha256(requestBody)}`,
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
    ...(input.application_id ? { application_id: input.application_id } : {}),
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
  logContractVersionDrift({
    endpoint,
    localVersion: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
    receivedVersion: normalizeText(response.contract_schema_version),
    requestId: response.request_id,
  })
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
  applicationId: string,
): Promise<OpsWebsiteApplicationStatus> {
  const normalized = normalizeText(applicationId)
  if (!normalized) {
    throw new OpsError('Application ID krävs.', 400, {
      code: 'application_id_required',
      field: 'application_id',
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
  if (value.application_id !== normalized) {
    throw new OpsError('OPS returnerade status för en annan ansökan.', 502, {
      code: 'ops_application_status_identity_mismatch',
      endpoint,
      expected_application_id: normalized,
      received_application_id: value.application_id,
      retryable: false,
    })
  }
  return {
    application_id: value.application_id,
    application_number: value.application_number ?? null,
    status: value.status,
    stage: value.stage,
    customer_number: value.customer_number ?? null,
    contract_status: value.contract_status ?? null,
    supplier_switch_status: value.supplier_switch_status ?? null,
    supply_status: value.supply_status ?? null,
    requested_start_date: value.requested_start_date ?? null,
    confirmed_start_date: value.confirmed_start_date ?? null,
    missing_customer_action: value.missing_customer_action,
    next_step: value.next_step ?? null,
    blocking_reason: value.blocking_reason ?? null,
    updated_at: value.updated_at,
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

  logContractVersionDrift({
    endpoint: '/api/v1/website/portfolio-prices',
    localVersion: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
    receivedVersion: contractVersion,
    requestId,
  })

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
    contract_schema_version: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
    raw: root,
  }
}

export async function fetchOpsPublicContractsSnapshot(
  customerType?: WebsiteCustomerType | null,
  options: { forceFresh?: boolean } = {},
): Promise<OpsPublicContractsSnapshot> {
  const cacheKey = publicContractsCacheKey(customerType);
  const cached = publicContractsCache.get(cacheKey);
  const headers = new Headers();
  if (!options.forceFresh && cached?.etag) headers.set("If-None-Match", cached.etag);

  let response: OpsHttpResponse;
  try {
    response = await opsRequest(
      publicContractsPath(customerType),
      { method: "GET", headers },
      {
        allowNotModified: true,
        // The public product feed is safe to cache server-side. Next's data
        // cache survives serverless instance rotation and keys the response by
        // URL + request headers, including the tenant API key.
        cache: options.forceFresh ? "no-store" : "force-cache",
        revalidateSeconds: options.forceFresh ? undefined : 60,
      },
    );
  } catch (error) {
    if (!options.forceFresh && cached && isTransientOpsError(error)) {
      return {
        contracts: cached.contracts,
        blocked_contracts: cached.blocked_contracts,
        etag: cached.etag,
        publication_revision: cached.publication_revision,
        tenant_reference: cached.tenant_reference,
        contract_version: cached.contract_version,
        not_modified: true,
        fetched_at: cached.fetched_at,
        source: 'stale-cache',
        stale: true,
        stale_reason: isOpsError(error) ? error.code ?? `http_${error.status}` : "ops_transport_error",
      };
    }
    throw error;
  }

  if (response.status === 304) {
    if (!cached) {
      throw new OpsError("OPS svarade 304 utan en lokal avtalsrevision.", 502, {
        code: "ops_public_contracts_304_without_cache",
      });
    }
    return {
      contracts: cached.contracts,
      blocked_contracts: cached.blocked_contracts,
      etag: cached.etag,
      publication_revision: cached.publication_revision,
      tenant_reference: cached.tenant_reference,
      contract_version: cached.contract_version,
      not_modified: true,
      fetched_at: cached.fetched_at,
      source: 'cache',
      stale: false,
      stale_reason: null,
    };
  }

  const tenantReference = await verifiedTenantReference(
    response.payload,
    "/api/v1/website/public-contracts",
  );
  const parsed = sortedPublicContracts(response.payload)
  const responseContractVersion = response.contractVersion ?? contractVersionFromPayload(response.payload)
  const responseRevision = publicationRevisionFromPayload(response.payload)
  if (
    !options.forceFresh &&
    cached &&
    cached.contracts.length > 0 &&
    parsed.contracts.length === 0 &&
    (responseRevision === null || responseRevision === cached.publication_revision)
  ) {
    console.warn('[gridex-public-contracts] empty feed rejected because no newer publication revision was supplied', {
      cached_publication_revision: cached.publication_revision,
      response_publication_revision: responseRevision,
    })
    return {
      contracts: cached.contracts,
      blocked_contracts: [...cached.blocked_contracts, ...parsed.blockedContracts],
      etag: cached.etag,
      publication_revision: cached.publication_revision,
      tenant_reference: cached.tenant_reference,
      contract_version: responseContractVersion ?? cached.contract_version,
      not_modified: true,
      fetched_at: cached.fetched_at,
      source: 'stale-cache',
      stale: true,
      stale_reason: 'empty_feed_without_new_publication_revision',
    }
  }
  const snapshot: PublicContractsCacheEntry = {
    cache_key: cacheKey,
    contracts: parsed.contracts,
    blocked_contracts: parsed.blockedContracts,
    etag: response.headers.get('etag'),
    publication_revision: responseRevision,
    tenant_reference: tenantReference,
    contract_version: responseContractVersion,
    not_modified: false,
    fetched_at: new Date().toISOString(),
    source: 'live',
    stale: false,
    stale_reason: null,
  };
  publicContractsCache.set(cacheKey, snapshot);
  return snapshot;
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

function mapLegalText(row: unknown): OpsLegalText | null {
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
    requirement_code: string;
    title: string;
    description: string;
    required: true;
    document_reference: string;
    document_version: string;
    document_hash: string;
    document_url: string;
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
  const requirements = Array.isArray(raw.requirements)
    ? raw.requirements.flatMap((value) => {
        const requirement = recordValue(value)
        const requirementCode = normalizeText(requirement?.requirement_code)
        const title = normalizeText(requirement?.title)
        const description = normalizeText(requirement?.description)
        const documentReference = normalizeText(
          requirement?.document_reference ?? requirement?.document_id,
        )
        const documentVersion = normalizeText(requirement?.document_version)
        const documentHash = normalizeText(requirement?.document_hash)
        const documentUrl = normalizeText(requirement?.document_url)
        if (
          !requirementCode ||
          !title ||
          !description ||
          requirement?.required !== true ||
          !documentReference ||
          !documentVersion ||
          !documentHash ||
          !/^[a-f0-9]{64}$/i.test(documentHash) ||
          !documentUrl
        ) {
          return []
        }
        return [{
          requirement_code: requirementCode,
          title,
          description,
          required: true as const,
          document_reference: documentReference,
          document_version: documentVersion,
          document_hash: documentHash,
          document_url: documentUrl,
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
  if (Boolean(customerPortalUserId) !== Boolean(authUserId) || customerPortalUserId !== authUserId) {
    throw new OpsError('Portalidentiteten måste innehålla samma verifierade användar-ID i båda fälten.', 400, {
      code: 'customer_portal_identity_mismatch',
      field: !customerPortalUserId ? 'customer_portal_user_id' : 'auth_user_id',
      retryable: false,
    })
  }
  const portalIdentitySupported =
    websiteSchemaHasProperty('CustomerApplicationRequest', 'customer_portal_user_id') &&
    websiteSchemaHasProperty('CustomerApplicationRequest', 'auth_user_id')
  if (customerPortalUserId && !portalIdentitySupported) {
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
    ...(customerPortalUserId
      ? {
          customer_portal_user_id: customerPortalUserId,
          auth_user_id: authUserId!,
        }
      : {}),
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

function mapCustomerApplicationCommunicationItem(
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

function mapCommunicationItems(
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

function mapCustomerApplicationCommunication(
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
): Promise<OpsCustomerApplicationResult> {
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
    await verifiedTenantReference(payload, "/api/v1/website/customer-applications");
  } catch (error) {
    if (!isOpsError(error) || error.status !== 409) throw error;
    const code = opsErrorCodeValue(error) ?? "";
    if (code !== 'duplicate_application') throw error;
    const recovered = recoverCustomerApplicationConflict(error.details);
    if (!recovered) throw error;
    payload = recovered;
  }

  return mapOpsCustomerApplicationResult(payload);
}

function recoverCustomerApplicationConflict(value: unknown): unknown | null {
  const queue: unknown[] = [value];
  const visited = new Set<object>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || Array.isArray(current)) continue;
    if (visited.has(current)) continue;
    visited.add(current);
    const row = current as Record<string, unknown>;
    const hasStableResult = Boolean(
      pickString(row, ["application_id", "applicationId", "application_number", "applicationNumber"]) &&
        pickString(row, ["customer_id", "customerId", "customer_number", "customerNumber", "external_customer_id", "externalCustomerId"]),
    );
    if (hasStableResult) return row;
    for (const key of ["data", "application", "existing_application", "existingApplication", "result", "details", "error"]) {
      if (row[key]) queue.push(row[key]);
    }
  }
  return null;
}

function mapWebsiteSupplierSwitchState(value: unknown): OpsWebsiteSupplierSwitchState {
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
    request_id: pickString(row, ['request_id']),
    status,
    can_create_request: canCreateRequest,
    can_dispatch: canDispatch,
    blockers,
    next_action: nextAction as OpsWebsiteSupplierSwitchState['next_action'],
  }
}

function mapApplicationPowerOfAttorney(value: unknown): OpsPowerOfAttorneyState | null {
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

  return {
    status: pickString(row, ['status']) ?? 'application_received',
    customer_id: pickString(row, ['customer_id']),
    customer_number: pickString(row, ['customer_number']),
    application_id: pickString(row, ['application_id']),
    application_number: pickString(row, ['application_number']),
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
    correlation_id: pickFromRecords([root], ['correlation_id', 'request_id']),
    missing_fields: stringArray('missing_fields'),
    blocking_reasons: stringArray('blocking_reasons'),
    warnings: stringArray('warnings'),
    next_step: pickString(row, ['next_step']),
    message: pickString(row, ['message']),
    raw: row,
  }
}

export type OpsPortalIdentity = {
  userId: string;
  email?: string | null;
  customerNumber?: string | null;
  externalCustomerId?: string | null;
};

export type OpsCustomerSyncInput = {
  identity: OpsPortalIdentity;
  idempotencyKey?: string | null;
  powerOfAttorney?: Record<string, unknown> | null;
  legalAcceptances?: Record<string, unknown>[] | null;
  documents?: Record<string, unknown>[] | null;
  facilityData?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type OpsCustomerSyncResult = {
  ok: boolean;
  status?: string | null;
  synced?: Record<string, unknown> | null;
  warnings: string[];
  raw?: Record<string, unknown>;
};

export type OpsCustomerProfileUpdateInput = {
  identity: OpsPortalIdentity;
  idempotencyKey?: string | null;
  profile: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
};

export type OpsCustomerMoveOutInput = {
  identity: OpsPortalIdentity;
  idempotencyKey?: string | null;
  moveOut: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
};

export type OpsCustomerWriteResult = {
  ok: boolean;
  status?: string | null;
  data?: Record<string, unknown> | null;
  warnings: string[];
  raw?: Record<string, unknown>;
};

export type OpsCustomerEventType =
  | "customer.opened_document"
  | "customer.downloaded_document";

export const OPS_CUSTOMER_EVENT_TYPES = new Set<string>([
  "customer.opened_document",
  "customer.downloaded_document",
]);

export function isOpsCustomerEventType(value: string): value is OpsCustomerEventType {
  return OPS_CUSTOMER_EVENT_TYPES.has(value);
}

export type OpsPortalBundle = {
  profile: Record<string, unknown> | null;
  customerStatus: Record<string, unknown> | null;
  dataQuality: Record<string, unknown> | null;
  contracts: Record<string, unknown>[];
  sites: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  legalAcceptances: Record<string, unknown>[];
  powersOfAttorney: Record<string, unknown>[];
  switchStatus: Record<string, unknown> | null;
  events: Record<string, unknown>[];
  meteringValues: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
};

function stableExternalCustomerId(identity: OpsPortalIdentity): string | null {
  const value = normalizeText(identity.externalCustomerId);
  const customerNumber = normalizeText(identity.customerNumber);
  if (!value || value === customerNumber || /^DX-\d+$/i.test(value)) return null;
  return value;
}

function portalHeaders(identity: OpsPortalIdentity): Headers {
  const headers = new Headers();
  const externalCustomerId = stableExternalCustomerId(identity);

  headers.set("x-gridex-customer-portal-user-id", identity.userId);
  headers.set("x-gridex-auth-user-id", identity.userId);

  if (externalCustomerId) headers.set("x-gridex-external-customer-id", externalCustomerId);
  if (identity.customerNumber) headers.set("x-gridex-customer-number", identity.customerNumber);
  if (identity.email) headers.set("x-gridex-customer-email", identity.email);

  return headers;
}

function portalIdentityPayload(identity: OpsPortalIdentity): Record<string, string> {
  const email = normalizeText(identity.email)?.toLowerCase() ?? null;
  const customerNumber = normalizeText(identity.customerNumber);
  const externalCustomerId = stableExternalCustomerId(identity);
  return {
    ...(email ? { email } : {}),
    ...(customerNumber ? { customer_number: customerNumber } : {}),
    ...(externalCustomerId ? { external_customer_id: externalCustomerId } : {}),
  };
}

async function opsCustomerFetch(
  path: string,
  identity: OpsPortalIdentity,
  init?: RequestInit,
): Promise<unknown> {
  const headers = new Headers(init?.headers)
  portalHeaders(identity).forEach((value, key) => headers.set(key, value))
  const requestInit = { ...init, headers }
  const method = (requestInit.method ?? 'GET').toLowerCase() as
    | 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'
  if (!hasCustomerPortalOperation(path, method)) {
    throw new OpsError('Customer Portal-anropet saknar ett incheckat OpenAPI-kontrakt.', 500, {
      code: 'openapi_operation_missing',
      endpoint: path.split('?', 1)[0],
      method: method.toUpperCase(),
      retryable: false,
    })
  }
  assertCustomerPortalOperationRequest(path, method, jsonRequestBody(requestInit), headers)
  const response = await opsRequest(path, requestInit)
  observeRuntimeSchemaValidation({
    endpoint: path.split('?', 1)[0],
    schema: 'customer-portal-operation-response',
    validate: () => assertCustomerPortalOperationResponse(path, method, response.status, response.payload),
  })
  return response.payload
}

export type OpsCustomerReadResource =
  | "me"
  | "contracts"
  | "sites"
  | "invoices"
  | "documents"
  | "legal-acceptances"
  | "powers-of-attorney"
  | "events"
  | "metering-values"
  | "notifications";

const OPS_CUSTOMER_READ_PATHS: Readonly<Record<OpsCustomerReadResource, string>> = {
  me: "/api/v1/customer/me",
  contracts: "/api/v1/customer/contracts",
  sites: "/api/v1/customer/sites",
  invoices: "/api/v1/customer/invoices",
  documents: "/api/v1/customer/documents",
  "legal-acceptances": "/api/v1/customer/legal-acceptances",
  "powers-of-attorney": "/api/v1/customer/powers-of-attorney",
  events: "/api/v1/customer/events",
  "metering-values": "/api/v1/customer/metering-values",
  notifications: "/api/v1/customer/notifications",
};

/**
 * Executes one canonical customer read. This intentionally never calls portal-bundle:
 * granular BFF routes must preserve upstream authorization, status and entity identity.
 */
export async function fetchOpsCustomerResource(
  identity: OpsPortalIdentity,
  resource: OpsCustomerReadResource,
  opaqueId?: string | null,
): Promise<unknown> {
  const basePath = OPS_CUSTOMER_READ_PATHS[resource];
  if (opaqueId !== undefined && opaqueId !== null) {
    const id = opaqueId.trim();
    if (resource !== "invoices" || !id || id.length > 240 || /[/\\?#]/.test(id)) {
      throw new OpsError("Ogiltigt canonicalt OPS-resurs-id.", 400, {
        code: "invalid_ops_resource_id",
        resource,
      });
    }
    return opsCustomerFetch(`${basePath}/${encodeURIComponent(id)}`, identity);
  }
  return opsCustomerFetch(basePath, identity);
}

function rowsAsObjects(payload: unknown): Record<string, unknown>[] {
  return extractRows(payload).filter((item): item is Record<string, unknown> =>
    Boolean(item && typeof item === "object" && !Array.isArray(item)),
  );
}

function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object" && !Array.isArray(item)),
      )
    : [];
}

function nestedArray(row: Record<string, unknown>, keys: string[]): Record<string, unknown>[] {
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value)) return objectArray(value);
  }
  return [];
}

function normalizePortalBundle(payload: unknown): OpsPortalBundle {
  const root = extractObject(payload);
  const data = recordValue(root.data) ?? root;
  const profile = recordValue(data.profile);

  return {
    profile,
    customerStatus:
      recordValue(data.customer_status),
    dataQuality:
      recordValue(data.data_quality),
    contracts: nestedArray(data, ["contracts"]),
    sites: nestedArray(data, ["sites"]),
    invoices: nestedArray(data, ["invoices"]),
    documents: nestedArray(data, ["documents"]),
    legalAcceptances: nestedArray(data, ["legal_acceptances"]),
    powersOfAttorney: nestedArray(data, ["powers_of_attorney"]),
    switchStatus: recordValue(data.switch_status),
    events: nestedArray(data, ["events"]),
    meteringValues: nestedArray(data, ["metering_values"]),
    notifications: nestedArray(data, ["notifications"]),
  };
}

function opsErrorCodeValue(error: OpsError): string | null {
  const details = recordValue(error.details);
  const nested = recordValue(details?.error);
  return normalizeText(nested?.code ?? details?.code);
}

export async function fetchOpsCustomerPortalBundle(
  identity: OpsPortalIdentity,
): Promise<OpsPortalBundle> {
  return normalizePortalBundle(
    await opsCustomerFetch("/api/v1/customer/portal-bundle", identity, {
      method: "POST",
      body: JSON.stringify(portalIdentityPayload(identity)),
    }),
  );
}

export async function markOpsCustomerNotificationsRead(
  identity: OpsPortalIdentity,
  input: { notificationIds: string[]; operationId: string },
): Promise<void> {
  const ids = [...new Set(input.notificationIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    throw new OpsError("Minst en notis måste anges.", 400, {
      code: "validation_error",
      field: "notification_ids",
    });
  }
  const headers = portalHeaders(identity);
  headers.set(
    "Idempotency-Key",
    `notification-read:${identity.userId}:${input.operationId}`,
  );

  await opsCustomerFetch("/api/v1/customer/notifications/read", identity, {
    method: "POST",
    headers,
    body: JSON.stringify({ notification_ids: ids }),
  });
}

function normalizeWarnings(row: Record<string, unknown>): string[] {
  const warnings = row.warnings;
  return Array.isArray(warnings) ? warnings.map(String).filter(Boolean) : [];
}

function responseObject(payload: unknown): Record<string, unknown> {
  const row = extractObject(payload);
  return row && typeof row === "object" ? row : {};
}

export async function submitOpsCustomerSync(
  input: OpsCustomerSyncInput,
): Promise<OpsCustomerSyncResult> {
  const headers = portalHeaders(input.identity);
  const body = {
    ...portalIdentityPayload(input.identity),
    ...(input.facilityData ? { facility_data: input.facilityData } : {}),
    ...(input.profile ? { profile: input.profile } : {}),
    data: {
      ...(input.powerOfAttorney ? { power_of_attorney: input.powerOfAttorney } : {}),
      ...(input.legalAcceptances?.length ? { legal_acceptances: input.legalAcceptances } : {}),
      ...(input.documents?.length ? { documents: input.documents } : {}),
    },
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  const operationId =
    normalizeText(input.idempotencyKey) ??
    canonicalSha256({ scope: 'customer_sync', user: input.identity.userId, body });
  headers.set(
    "Idempotency-Key",
    `customer-sync:${input.identity.userId}:${operationId}`,
  );

  const payload = await opsCustomerFetch("/api/v1/customer/sync", input.identity, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const row = responseObject(payload);
  return {
    ok: row.ok === false ? false : true,
    status: pickString(row, ["status"]),
    synced: recordValue(row.synced) ?? recordValue(row.data),
    warnings: normalizeWarnings(row),
    raw: row,
  };
}

export async function submitOpsCustomerPortalSync(
  input: {
    identity: OpsPortalIdentity;
    idempotencyKey: string;
    customerNumber?: string | null;
    externalCustomerId?: string | null;
    email?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<OpsCustomerSyncResult> {
  const headers = portalHeaders(input.identity);
  const externalCustomerId =
    normalizeText(input.externalCustomerId) ??
    stableExternalCustomerId(input.identity)
  if (!externalCustomerId) {
    throw new OpsError('Portal recovery kräver external_customer_id.', 400, {
      code: 'external_customer_id_required',
      field: 'external_customer_id',
      retryable: false,
    })
  }
  const body = {
    ...portalIdentityPayload(input.identity),
    external_customer_id: externalCustomerId,
    customer_portal_user_id: input.identity.userId,
    auth_user_id: input.identity.userId,
    ...(input.customerNumber ? { customer_number: input.customerNumber } : {}),
    ...(input.email ? { email: input.email } : {}),
    metadata: input.metadata ?? { source: "tenant_website_customer_portal_sync" },
  };
  headers.set(
    "Idempotency-Key",
    `customer-portal-sync:${input.identity.userId}:${input.idempotencyKey}`,
  );
  const payload = await opsCustomerFetch("/api/v1/customer-portal/sync", input.identity, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const row = responseObject(payload);
  return {
    ok: row.ok === false ? false : true,
    status: pickString(row, ["status"]),
    synced: recordValue(row.synced) ?? recordValue(row.data),
    warnings: normalizeWarnings(row),
    raw: row,
  };
}

function customerWriteIdempotencyKey(
  scope: string,
  input: { identity: OpsPortalIdentity; idempotencyKey?: string | null },
  body: Record<string, unknown>,
): string {
  const value =
    normalizeText(input.idempotencyKey) ??
    canonicalSha256({ scope, user: input.identity.userId, body });
  return `${scope}:${input.identity.userId}:${value}`;
}

function mapCustomerWriteResult(payload: unknown): OpsCustomerWriteResult {
  const row = responseObject(payload);
  return {
    ok: row.ok === false ? false : true,
    status: pickString(row, ["status"]),
    data: recordValue(row.data) ?? row,
    warnings: normalizeWarnings(row),
    raw: row,
  };
}

export async function submitOpsCustomerProfileUpdate(
  input: OpsCustomerProfileUpdateInput,
): Promise<OpsCustomerWriteResult> {
  const headers = portalHeaders(input.identity);
  const body = {
    ...portalIdentityPayload(input.identity),
    profile: input.profile,
    metadata: input.metadata ?? {},
  };

  headers.set("Idempotency-Key", customerWriteIdempotencyKey("profile-update", input, body));

  const payload = await opsCustomerFetch("/api/v1/customer/profile-update", input.identity, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return mapCustomerWriteResult(payload);
}

export async function submitOpsCustomerMoveOut(
  input: OpsCustomerMoveOutInput,
): Promise<OpsCustomerWriteResult> {
  const headers = portalHeaders(input.identity);
  const requestedMoveOutDate = normalizeText(
    input.moveOut.requested_move_out_date ?? input.moveOut.move_out_date,
  );
  if (!requestedMoveOutDate || !isStrictCalendarDate(requestedMoveOutDate)) {
    throw new OpsError('Utflyttningsdatum är inte ett verkligt kalenderdatum.', 400, {
      code: 'requested_move_out_date_invalid',
      field: 'requested_move_out_date',
      retryable: false,
    });
  }
  const reason = normalizeText(input.moveOut.reason);
  const moveOutData = Object.fromEntries(
    Object.entries(input.moveOut).filter(
      ([key, value]) =>
        !['requested_move_out_date', 'move_out_date', 'reason'].includes(key) &&
        value !== undefined &&
        value !== null,
    ),
  );
  const body = {
    ...portalIdentityPayload(input.identity),
    requested_move_out_date: requestedMoveOutDate,
    ...(reason ? { reason } : {}),
    ...(Object.keys(moveOutData).length ? { data: moveOutData } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  headers.set("Idempotency-Key", customerWriteIdempotencyKey("move-out", input, body));

  const payload = await opsCustomerFetch("/api/v1/customer/move-out", input.identity, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return mapCustomerWriteResult(payload);
}

function createCustomerEventIdempotencyKey(
  identity: OpsPortalIdentity,
  event: {
    event_type: string;
    entity_type?: string | null;
    entity_id?: string | null;
    metadata?: Record<string, unknown>;
  },
): string {
  const bucket = Math.floor(Date.now() / 60_000);
  return canonicalSha256({
    scope: 'customer_event',
    user: identity.userId,
    customer_number: identity.customerNumber ?? null,
    external_customer_id: stableExternalCustomerId(identity),
    event_type: event.event_type,
    entity_type: event.entity_type ?? null,
    entity_id: event.entity_id ?? null,
    metadata: event.metadata ?? {},
    bucket,
  });
}

export async function sendOpsCustomerEvent(
  identity: OpsPortalIdentity,
  event: {
    event_type: string;
    source: "gridex_website";
    entity_type?: string | null;
    entity_id?: string | null;
    idempotency_key?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  if (!isOpsCustomerEventType(event.event_type)) {
    throw new OpsError("Kundhändelsen stöds inte av OPS-kontraktet.", 400, {
      event_type: event.event_type,
    });
  }

  const headers = portalHeaders(identity);
  const operationId =
    normalizeText(event.idempotency_key) ??
    createCustomerEventIdempotencyKey(identity, event);
  headers.set(
    "Idempotency-Key",
    `customer-event:${identity.userId}:${operationId}`,
  );

  await opsFetch("/api/v1/website/customer-events", {
    method: "POST",
    headers,
    body: JSON.stringify({
      event_type: event.event_type,
      event_reference: operationId,
      occurred_at: new Date().toISOString(),
      customer: {
        ...portalIdentityPayload(identity),
        customer_portal_user_id: identity.userId,
        auth_user_id: identity.userId,
      },
      subject: {
        type: normalizeText(event.entity_type) ?? 'customer',
        ...(normalizeText(event.entity_id)
          ? { reference: normalizeText(event.entity_id)! }
          : {}),
      },
      data: event.metadata ?? {},
    }),
  });
}

export async function fetchOpsTenantEvents(): Promise<Record<string, unknown>[]> {
  // The current Customer Portal OpenAPI does not define query filters for this endpoint.
  // Do not silently send legacy parameters that the machine contract cannot validate.
  const payload = await opsFetch('/api/v1/events')
  return rowsAsObjects(payload)
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const pepper =
    env("GRIDEX_WEBSITE_HASH_PEPPER") ?? env("PII_HASH_PEPPER") ?? "";
  return createHash("sha256").update(`${pepper}:${ip}`).digest("hex");
}

export function createApplicationIdempotencyKey(parts: string[]): string {
  return createHash("sha256")
    .update(parts.map((p) => p.trim().toLowerCase()).join("|"))
    .digest("hex");
}

export function createExternalCustomerId(parts: string[]): string {
  const prefix = env("GRIDEX_WEBSITE_CUSTOMER_PREFIX") ?? "GRIDEX-WEB-CUSTOMER";
  const stable = parts
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join("|");
  if (!stable) throw new OpsError("Stable customer identity input is missing.", 422);
  const pepper = env("GRIDEX_WEBSITE_HASH_PEPPER") ?? env("PII_HASH_PEPPER");
  if (!pepper) {
    throw new OpsError("Website customer identity hash secret is not configured.", 503);
  }
  const digest = createHash("sha256")
    .update(`${pepper}:${stable}`)
    .digest("hex")
    .slice(0, 24);
  return `${prefix}-${digest}`;
}

export function createExternalApplicationId(submissionAttemptId?: string | null): string {
  const prefix = env("GRIDEX_WEBSITE_APPLICATION_PREFIX") ?? "GRIDEX-WEB";
  const stableAttempt = normalizeText(submissionAttemptId);
  if (stableAttempt) return `${prefix}-${stableAttempt}`;
  return `${prefix}-${stockholmCalendarDate().replace(/-/g, "")}-${randomUUID()}`;
}

export function isTransientOpsError(error: unknown): boolean {
  if (isOpsError(error)) {
    // Contract, tenant and response-schema failures are explicitly non-retryable
    // even when represented as a 5xx. Never hide them behind a local portal fallback.
    return error.retryable && (
      error.status === 408 ||
      error.status === 425 ||
      error.status === 429 ||
      error.status >= 500
    );
  }
  // Native fetch reports transport/DNS/TLS failures as TypeError. Abort and
  // timeout errors are also retryable. Unknown application/programming errors
  // must not be hidden behind stale local fallback or an outbox success.
  if (error instanceof TypeError) return true;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return true;
  }
  return false;
}
