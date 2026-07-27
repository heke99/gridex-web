//lib/ops/client.ts
import { createHash, randomUUID } from "node:crypto";
import {
  calculationPricingComponentAmount,
  normalizePublicContractApiPayload,
  normalizeProductionPricing,
  isPublicLegalAcceptanceCode,
  type PublicAreaPricing,
  type PublicPortfolioMonthlyPrice,
  type PublicLegalRequirement,
  type PublicPricingComponent,
  type PublicProductionPricing,
} from "@/lib/website/publicContractContract";
import {
  GRIDEX_API_BASE_URL,
  GRIDEX_WEBSITE_API_ACCEPT_VERSION_HEADER,
  GRIDEX_WEBSITE_API_CONTRACT_VERSION,
  GRIDEX_WEBSITE_API_VERSION_HEADER,
} from '@/lib/ops/contract';
import { toOpsCustomerType, type WebsiteCustomerType } from "@/lib/website/customerType";
import type { components as WebsiteApiComponents } from '@/lib/ops/generated/website-api';
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
  street: string;
  street_number?: string | null;
  apartment?: string | null;
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
};

export type OpsMeteringPointInput = {
  metering_point_id: string;
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
  resolution_id: string;
  annual_consumption_kwh: number;
  start_date: string;
  customer: OpsCustomerInput;
  site: OpsSiteInput;
  metering_point?: OpsMeteringPointInput | null;
  contract: OpsContractInput;
  consents: OpsConsentInput;
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
  raw?: Record<string, unknown>;
};

export type OpsWebsitePriceArea = "SE1" | "SE2" | "SE3" | "SE4";

export type OpsWebsiteEnergyResolutionInput = {
  postal_code?: string | null;
  city?: string | null;
  street?: string | null;
  street_number?: string | null;
  address?: string | null;
  apartment?: string | null;
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
};

export type OpsWebsiteQuoteValidationInput = {
  quote_reference: string;
  offer_reference: string;
  resolution_id: string;
  customer_type: WebsiteCustomerType;
  annual_consumption_kwh: number;
  start_date: string;
  price_area?: OpsWebsitePriceArea | null;
  grid_area_code?: string | null;
  postal_code?: string | null;
  application_id?: string | null;
};

export type OpsWebsiteQuoteValidation = {
  valid: boolean;
  status: string | null;
  code: string | null;
  quote_reference: string;
  offer_reference: string;
  valid_until?: string | null;
  publication_revision?: string | null;
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
  publication_revision?: string | null;
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

export type OpsCurrentMarketPrice = {
  provider: string;
  provider_reference?: string | null;
  resolution_id: string;
  price_area: OpsWebsitePriceArea;
  reference_type: string;
  resolution: string;
  selected_resolution: string;
  available_resolutions: string[];
  interval_start: string;
  interval_end: string;
  price_sek_per_kwh: number;
  price_ore_per_kwh: number;
  price_ex_vat_sek_per_kwh?: number | null;
  price_ex_vat_ore_per_kwh?: number | null;
  price_inc_vat_sek_per_kwh?: number | null;
  price_inc_vat_ore_per_kwh?: number | null;
  unit: string;
  includes_vat: boolean;
  includes_supplier_fees: boolean;
  includes_grid_fees: boolean;
  is_indicative: boolean;
  is_stale: boolean;
  fallback_used: boolean;
  fallback_reason?: string | null;
  freshness?: string | null;
  as_of: string;
  source_as_of?: string | null;
  stale_after: string;
  next_update_at?: string | null;
  contract_version?: string | null;
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

export type OpsPublicContractsSnapshot = {
  contracts: OpsPublicContract[];
  etag: string | null;
  publication_revision: string | null;
  tenant_reference: string;
  not_modified: boolean;
  fetched_at: string;
  stale: boolean;
  stale_reason: string | null;
};

export class OpsError extends Error {
  status: number;
  details?: unknown;
  code: string | null;
  requestId: string | null;
  correlationId: string | null;
  retryable: boolean;
  endpoint: string | null;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "OpsError";
    this.status = status;
    this.details = details;
    const row = recordValue(details);
    const nested = recordValue(row?.error);
    this.code = pickFromRecords([nested, row], ["code", "error_code"]);
    this.requestId = pickFromRecords([nested, row], ["request_id", "requestId"]);
    this.correlationId = pickFromRecords([nested, row], ["correlation_id", "correlationId"]);
    this.retryable = pickBooleanFromRecords([nested, row], ["retryable"]) ?? (status === 429 || status >= 500);
    this.endpoint = pickFromRecords([nested, row], ["endpoint", "path"]);
  }
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function normalizeOpsApiBase(value: string): string {
  const normalized = value.replace(/\/+$/, "");
  return normalized.endsWith("/api/v1") ? normalized : `${normalized}/api/v1`;
}

function opsBaseUrl(): string {
  return normalizeOpsApiBase(env("GRIDEX_API_BASE_URL") ?? GRIDEX_API_BASE_URL);
}

function opsRelativePath(path: string): string {
  const [pathname, query = ""] = path.split("?", 2);
  const relative = pathname.replace(/^\/api\/v1(?=\/|$)/, "") || "/";
  return `${relative}${query ? `?${query}` : ""}`;
}

const OPS_API_KEY_FULL_SECRET_NOT_PREFIX = "OPS_API_KEY_FULL_SECRET_NOT_PREFIX";

function opsTenantCacheKey(): string {
  const baseUrl = opsBaseUrl() ?? "unconfigured";
  const apiKey = opsApiKey().value ?? "missing-api-key";
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

function opsApiKey(): { value?: string; source?: string; invalidReason?: string } {
  const name = "GRIDEX_API_KEY" as const;
  const value = env(name);
  if (!value) return {};

  const prefixOnly = /^gdxp_[a-z0-9]+$/i.test(value) && value.length <= 18;
  if (prefixOnly) {
    return {
      source: name,
      invalidReason: `${OPS_API_KEY_FULL_SECRET_NOT_PREFIX}: ${name} innehåller bara API-nyckelns prefix, inte hela token.`,
    };
  }

  return { value, source: name };
}

export function getOpsClientStatus(): OpsClientStatus {
  const apiKey = opsApiKey();
  const missing = apiKey.value
    ? []
    : [apiKey.invalidReason ?? "GRIDEX_API_KEY"];
  const liveSignupEnabled = env("GRIDEX_DISABLE_LIVE_SIGNUP") !== "true";
  return {
    configured: missing.length === 0,
    liveSignupEnabled,
    missing,
  };
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

function looksLikeRedirectOrHtml(value: unknown): boolean {
  const text =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? String(
            (value as Record<string, unknown>).message ??
              (value as Record<string, unknown>).error ??
              "",
          )
        : "";

  return /NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|<html|<!doctype|text\/html|login|logga in|redirect/i.test(
    text,
  );
}

function upstreamOpsErrorCode(payload: unknown): string | null {
  const row = recordValue(payload)
  if (!row) return null
  const nested = recordValue(row.error)
  const value = nested?.code ?? row.code
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function rateLimitErrorDetails(payload: unknown, status: number, headers: Headers, path: string): unknown {
  const upstreamCode = upstreamOpsErrorCode(payload)
  const row = recordValue(payload)
  const responseIds = {
    request_id: headers.get('x-request-id'),
    correlation_id: headers.get('x-correlation-id'),
  }
  const base = row
    ? { ...responseIds, ...row, endpoint: path }
    : { ...responseIds, endpoint: path, upstream: payload }
  let code: string | null = null
  if (status === 429) code = 'ops_rate_limited'
  else if (upstreamCode === 'api_rate_limiter_unavailable') code = 'ops_rate_limiter_unavailable'
  else if (upstreamCode === 'api_rate_limit_invalid') code = 'ops_rate_limit_configuration_error'
  if (!code) return base
  return {
    ...base,
    code,
    upstream_code: upstreamCode,
    retry_after: headers.get('retry-after'),
  }
}

function customerSafeOpsMessage(payload: unknown, fallback: string): string {
  if (looksLikeRedirectOrHtml(payload)) return fallback;

  const row = recordValue(payload)
  const nested = recordValue(row?.error)
  const raw = pickFromRecords(
    [nested, row],
    ["customer_message", "customerMessage", "message"],
  )
  if (raw) return looksLikeRedirectOrHtml(raw) ? fallback : raw

  if (typeof row?.error === "string" && row.error.trim()) {
    const trimmed = row.error.trim()
    return looksLikeRedirectOrHtml(trimmed) ? fallback : trimmed
  }

  if (typeof payload === "string" && payload.trim()) {
    const trimmed = payload.trim();
    return looksLikeRedirectOrHtml(trimmed) ? fallback : trimmed;
  }

  return fallback;
}

const DEFAULT_OPS_TIMEOUT_MS = 12_000;
const MIN_OPS_TIMEOUT_MS = 1_000;
const MAX_OPS_TIMEOUT_MS = 60_000;

function opsTimeoutMs(): number {
  const configured = Number(env("GRIDEX_OPS_TIMEOUT_MS") ?? DEFAULT_OPS_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_OPS_TIMEOUT_MS;
  return Math.min(MAX_OPS_TIMEOUT_MS, Math.max(MIN_OPS_TIMEOUT_MS, Math.trunc(configured)));
}

function timeoutSignal(parentSignal?: AbortSignal | null): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutMs = opsTimeoutMs();
  const timer = setTimeout(() => {
    const error = new Error(`OPS request timed out after ${timeoutMs} ms.`);
    error.name = "TimeoutError";
    controller.abort(error);
  }, timeoutMs);

  const forwardAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal) {
    if (parentSignal.aborted) forwardAbort();
    else parentSignal.addEventListener("abort", forwardAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", forwardAbort);
    },
  };
}

function isSafeOpsCanonicalRedirect(
  requestUrl: string,
  location: string | null,
  status: number,
): string | null {
  if (!location || (status !== 307 && status !== 308)) return null;
  try {
    const current = new URL(requestUrl);
    const redirected = new URL(location, current);
    const canonicalPath = (value: string) => value.replace(/\/+$/, "") || "/";
    if (
      redirected.origin !== current.origin ||
      canonicalPath(redirected.pathname) !== canonicalPath(current.pathname) ||
      redirected.search !== current.search ||
      /\/(?:login|logga-in|signin|auth)(?:\/|$)/i.test(redirected.pathname)
    ) return null;
    return redirected.toString();
  } catch {
    return null;
  }
}

type OpsHttpResponse = {
  status: number;
  headers: Headers;
  payload: unknown;
};

type OpsRequestOptions = {
  allowNotModified?: boolean;
  cache?: RequestCache;
  revalidateSeconds?: number;
};

async function opsRequest(
  path: string,
  init?: RequestInit,
  options: OpsRequestOptions = {},
): Promise<OpsHttpResponse> {
  const baseUrl = opsBaseUrl();
  const apiKey = opsApiKey();
  const fallbackMessage = "Tjänsten kunde inte slutföra åtgärden just nu.";

  if (!baseUrl || !apiKey.value) {
    throw new OpsError("Tjänsten är inte tillgänglig just nu.", 503, {
      missing: getOpsClientStatus().missing,
      key_source: apiKey.source ?? null,
      invalid_reason: apiKey.invalidReason ?? null,
    });
  }

  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set(GRIDEX_WEBSITE_API_ACCEPT_VERSION_HEADER, GRIDEX_WEBSITE_API_CONTRACT_VERSION);
  headers.set("Authorization", `Bearer ${apiKey.value}`);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const requestUrl = `${baseUrl}${opsRelativePath(path)}`;
  const request = (url: string, signal: AbortSignal) => {
    const requestInit: RequestInit = {
      ...init,
      headers,
      signal,
      cache: options.cache ?? "no-store",
      redirect: "manual",
    };
    if (options.revalidateSeconds !== undefined) {
      requestInit.next = { revalidate: options.revalidateSeconds };
    }
    return fetch(url, requestInit);
  };
  const method = (init?.method ?? 'GET').toUpperCase();
  const canRetry = method === 'GET' || method === 'HEAD' || headers.has('Idempotency-Key');
  const maxAttempts = canRetry ? 3 : 1;
  const startedAt = Date.now();
  let attempt = 0;
  let res: Response;
  let finalTimeout: ReturnType<typeof timeoutSignal> | null = null;

  const waitBeforeRetry = async (response?: Response) => {
    const rawRetryAfter = response?.headers.get('retry-after') ?? null;
    const retryAfterSeconds = rawRetryAfter && /^\d+$/.test(rawRetryAfter) ? Number(rawRetryAfter) : null;
    const retryAfterDate = rawRetryAfter && retryAfterSeconds === null ? Date.parse(rawRetryAfter) : Number.NaN;
    const exponential = 250 * 2 ** Math.max(0, attempt - 1);
    const waitMs = retryAfterSeconds !== null
      ? retryAfterSeconds * 1_000
      : Number.isFinite(retryAfterDate)
        ? Math.max(0, retryAfterDate - Date.now())
        : exponential;
    const jitter = Math.floor(Math.random() * 125);
    await new Promise((resolve) => setTimeout(resolve, Math.min(10_000, waitMs + jitter)));
  };

  while (true) {
    attempt += 1;
    const timeout = timeoutSignal(init?.signal);
    try {
      res = await request(requestUrl, timeout.signal);
      const canonicalRedirect = isSafeOpsCanonicalRedirect(
        requestUrl,
        res.headers.get("location"),
        res.status,
      );
      if (canonicalRedirect) res = await request(canonicalRedirect, timeout.signal);
      const retryableStatus = [429, 502, 503, 504].includes(res.status);
      if (canRetry && retryableStatus && attempt < maxAttempts) {
        timeout.cleanup();
        await waitBeforeRetry(res);
        continue;
      }
      finalTimeout = timeout;
      break;
    } catch (error) {
      const timedOut = timeout.signal.aborted && !init?.signal?.aborted;
      timeout.cleanup();
      if (init?.signal?.aborted) throw error;
      const networkFailure = error instanceof TypeError || timedOut;
      if (canRetry && networkFailure && attempt < maxAttempts) {
        await waitBeforeRetry();
        continue;
      }
      if (timedOut) {
        throw new OpsError("Tjänsten svarade inte i tid.", 504, {
          code: "ops_request_timeout",
          path,
          endpoint: path,
          timeout_ms: opsTimeoutMs(),
          retry_count: attempt - 1,
          duration_ms: Date.now() - startedAt,
        });
      }
      if (error instanceof TypeError) {
        throw new OpsError("Tjänsten kunde inte nås just nu.", 503, {
          code: "ops_network_error",
          path,
          endpoint: path,
          retry_count: attempt - 1,
          duration_ms: Date.now() - startedAt,
        });
      }
      throw error;
    }
  }

  try {
    const contentType = res.headers.get("content-type") ?? "";
    const location = res.headers.get("location");
    const responseContractVersion = res.headers.get(GRIDEX_WEBSITE_API_VERSION_HEADER);
    if (!responseContractVersion && process.env.NODE_ENV === 'production') {
      throw new OpsError('OPS-svaret saknar obligatorisk kontraktsversionsheader.', 502, {
        code: 'ops_contract_version_header_missing',
        expected: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
        received: null,
        endpoint: path,
        request_id: res.headers.get('x-request-id'),
        correlation_id: res.headers.get('x-correlation-id'),
        retry_count: attempt - 1,
        duration_ms: Date.now() - startedAt,
        retryable: false,
      });
    }
    if (responseContractVersion && responseContractVersion !== GRIDEX_WEBSITE_API_CONTRACT_VERSION) {
      throw new OpsError('OPS API-kontraktets version matchar inte Gridex Web.', 502, {
        code: 'ops_contract_version_mismatch',
        expected: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
        received: responseContractVersion,
        endpoint: path,
        request_id: res.headers.get('x-request-id'),
        correlation_id: res.headers.get('x-correlation-id'),
        retry_count: attempt - 1,
        duration_ms: Date.now() - startedAt,
        retryable: false,
      });
    }

    if (res.status >= 300 && res.status < 400 && !(options.allowNotModified && res.status === 304)) {
      throw new OpsError(fallbackMessage, 502, {
        redirected: true,
        status: res.status,
        location,
        path,
      });
    }

    if (options.allowNotModified && res.status === 304) {
      return { status: res.status, headers: new Headers(res.headers), payload: null };
    }

    let payload: unknown = null;
    if (contentType.includes("application/json")) {
      payload = await res.json().catch(() => null);
    } else {
      const text = await res.text().catch(() => "");
      payload = text ? { message: text, content_type: contentType } : null;
    }

    if (contentType.includes("text/html") || looksLikeRedirectOrHtml(payload)) {
      throw new OpsError(fallbackMessage, res.ok ? 502 : res.status || 502, {
        path,
        status: res.status,
        content_type: contentType,
      });
    }

    if (!res.ok) {
      throw new OpsError(
        customerSafeOpsMessage(payload, fallbackMessage),
        res.status,
        {
          ...recordValue(rateLimitErrorDetails(payload, res.status, res.headers, path)),
          retry_count: attempt - 1,
          duration_ms: Date.now() - startedAt,
        },
      );
    }

    return { status: res.status, headers: new Headers(res.headers), payload };
  } catch (error) {
    if (finalTimeout?.signal.aborted && !init?.signal?.aborted && !isOpsError(error)) {
      throw new OpsError("Tjänsten svarade inte i tid.", 504, {
        code: "ops_request_timeout",
        path,
        timeout_ms: opsTimeoutMs(),
      });
    }
    throw error;
  } finally {
    finalTimeout?.cleanup();
  }
}

async function opsFetch(path: string, init?: RequestInit): Promise<unknown> {
  return (await opsRequest(path, init)).payload;
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
    await opsFetch(path, init);
    return { ok: true, status: 200, code: null };
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
  if (!quoteReference || !offerReference || !resolutionId || !startDate || !isOpsWebsitePriceArea(area) || monthlyKwh === null || annualKwh === null || pricePerKwh === null || monthlyExVat === null || monthlyIncVat === null || !validUntil) {
    throw new OpsError('OPS returnerade en ofullständig canonical quote.', 502, {
      code: 'ops_quote_contract_invalid',
      quote_reference: quoteReference,
      offer_reference: offerReference,
      price_area_code: area,
      resolution_id: resolutionId,
      start_date: startDate,
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
    publication_revision: pickString(row, ['publication_revision', 'publicationRevision']),
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
  if (!contractVersion) {
    throw new OpsError('OPS integration context saknar kontraktsversion.', 502, {
      code: 'ops_contract_version_mismatch',
      expected: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
      received: null,
      endpoint: '/api/v1/integration/context',
      retryable: false,
    })
  }
  if (requiredEnvironmentVariables.length !== 1 || requiredEnvironmentVariables[0] !== 'GRIDEX_API_KEY') {
    throw new OpsError('OPS integration context annonserar en ogiltig tenantkonfiguration.', 502, {
      code: 'ops_integration_configuration_mismatch',
      expected: ['GRIDEX_API_KEY'],
      received: requiredEnvironmentVariables,
      endpoint: '/api/v1/integration/context',
      retryable: false,
    })
  }
  const expectedApiBaseUrl = opsBaseUrl()
  const expectedWebsiteOpenapiUrl = `${expectedApiBaseUrl}/openapi/website-integration-v1.json`
  const expectedCustomerPortalOpenapiUrl = `${expectedApiBaseUrl}/openapi/customer-portal-v1.json`
  if (value.configuration.api_base_url !== expectedApiBaseUrl) {
    throw new OpsError('OPS integration context annonserar fel API-bas.', 502, {
      code: 'ops_api_base_url_mismatch',
      expected: expectedApiBaseUrl,
      received: value.configuration.api_base_url || null,
      endpoint: '/api/v1/integration/context',
      retryable: false,
    })
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
    throw new OpsError('OPS integration context kräver otillåtna tenantvariabler.', 502, {
      code: 'ops_tenant_environment_requirement_mismatch',
      expected: { tenant_id_environment_required: false, company_id_environment_required: false },
      received: { tenant_id_environment_required: tenantIdEnvironmentRequired, company_id_environment_required: companyIdEnvironmentRequired },
      endpoint: '/api/v1/integration/context',
      retryable: false,
    })
  }
  if (websiteOpenapiUrl !== expectedWebsiteOpenapiUrl || customerPortalOpenapiUrl !== expectedCustomerPortalOpenapiUrl) {
    throw new OpsError('OPS integration context annonserar fel OpenAPI-adresser.', 502, {
      code: 'ops_openapi_url_mismatch',
      expected: { website: expectedWebsiteOpenapiUrl, customer_portal: expectedCustomerPortalOpenapiUrl },
      received: { website: websiteOpenapiUrl, customer_portal: customerPortalOpenapiUrl },
      endpoint: '/api/v1/integration/context',
      retryable: false,
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
  if (value.contract_version !== GRIDEX_WEBSITE_API_CONTRACT_VERSION) {
    throw new OpsError('OPS API-kontraktets version matchar inte Gridex Web.', 502, {
      code: 'ops_contract_version_mismatch',
      expected: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
      received: value.contract_version,
      endpoint: '/api/v1/integration/context',
      retryable: false,
    })
  }
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

function publicationRevisionFromPayload(payload: unknown): string | null {
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
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

type PublicContractsCacheEntry = OpsPublicContractsSnapshot & { cache_key: string };
const publicContractsCache = new Map<string, PublicContractsCacheEntry>();

function publicContractsCacheKey(customerType?: WebsiteCustomerType | null): string {
  return `${opsTenantCacheKey()}|website|${customerType ? toOpsCustomerType(customerType) : "all"}`;
}

function sortedPublicContracts(payload: unknown): OpsPublicContract[] {
  return extractRows(payload)
    .map(mapPublicContract)
    .filter((item): item is OpsPublicContract => item !== null)
    .sort((a, b) => {
      const sa = a.sort_order ?? 10_000;
      const sb = b.sort_order ?? 10_000;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name, "sv");
    });
}

export function invalidateOpsPublicContractsCache(input?: {
  tenantReference?: string | null;
  channel?: string | null;
  publicationRevision?: string | null;
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

function mapResolutionBlocker(value: unknown): OpsResolutionBlocker | null {
  const row = recordValue(value)
  if (!row) return null
  const code = pickString(row, ['code', 'blocker_code', 'blockerCode'])
  if (!code) return null
  return {
    code,
    message: pickString(row, ['message', 'customer_message', 'customerMessage']),
    field: pickString(row, ['field', 'path']),
    retryable: pickBoolean(row, ['retryable', 'is_retryable', 'isRetryable']),
    details: recordValue(row.details) ?? null,
  }
}

function mapResolutionBlockerList(container: Record<string, unknown>, keys: string[]): OpsResolutionBlocker[] {
  for (const key of keys) {
    const value = container[key]
    if (!Array.isArray(value)) continue
    return value.map(mapResolutionBlocker).filter((item): item is OpsResolutionBlocker => item !== null)
  }
  return []
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
    })
  }
  const payload = await opsFetch('/api/v1/website/energy-area/resolve', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  })
  await verifiedTenantReference(payload, '/api/v1/website/energy-area/resolve')
  const row = extractObject(payload)
  const areaValue = pickString(row, ['price_area_code', 'priceAreaCode', 'price_area'])?.toUpperCase()
  const resolutionStatus = pickString(row, ['resolution_status', 'resolutionStatus', 'status'])
  const capabilitiesRow = recordValue(row.capabilities) ?? {}
  const blockersRow = recordValue(row.blockers) ?? {}
  const pricingBlockers = mapResolutionBlockerList(blockersRow, ['pricing'])
  const quoteBlockers = mapResolutionBlockerList(blockersRow, ['quote'])
  const facilityLookupBlockers = mapResolutionBlockerList(blockersRow, ['facility_lookup', 'facilityLookup'])
  const switchCreationBlockers = mapResolutionBlockerList(blockersRow, ['switch_creation', 'switchCreation', 'switch_request', 'switchRequest'])
  const switchDispatchBlockers = mapResolutionBlockerList(blockersRow, ['switch_dispatch', 'switchDispatch'])
  return {
    status: resolutionStatus ?? (isOpsWebsitePriceArea(areaValue) ? 'resolved' : 'unresolved'),
    resolution_id: pickString(row, ['resolution_id', 'resolutionId', 'resolution_reference', 'resolutionReference', 'reference']),
    resolution_reference: pickString(row, ['resolution_reference', 'resolutionReference', 'resolution_id', 'resolutionId', 'reference']),
    resolution_status: resolutionStatus,
    capabilities: {
      pricing_ready: pickBoolean(capabilitiesRow, ['pricing_ready', 'pricingReady']) ?? false,
      quote_ready: pickBoolean(capabilitiesRow, ['quote_ready', 'quoteReady']) ?? false,
      facility_lookup_ready: pickBoolean(capabilitiesRow, ['facility_lookup_ready', 'facilityLookupReady']) ?? false,
      switch_request_creatable: pickBoolean(capabilitiesRow, ['switch_request_creatable', 'switchRequestCreatable']) ?? false,
      switch_dispatch_ready: pickBoolean(capabilitiesRow, ['switch_dispatch_ready', 'switchDispatchReady']) ?? false,
    },
    blockers: {
      pricing: pricingBlockers,
      quote: quoteBlockers,
      facility_lookup: facilityLookupBlockers,
      switch_creation: switchCreationBlockers,
      switch_dispatch: switchDispatchBlockers,
    },
    retryable: pickBoolean(row, ['retryable', 'is_retryable', 'isRetryable']) ??
      [...pricingBlockers, ...quoteBlockers].some((blocker) => blocker.retryable === true),
    next_required_action: pickString(row, ['next_required_action', 'nextRequiredAction']),
    warnings: pickStringArray(row, ['warnings']) ?? [],
    resolved_at: pickString(row, ['resolved_at', 'resolvedAt']),
    valid_until: pickString(row, ['expires_at', 'expiresAt', 'valid_until', 'validUntil']),
    price_area_code: isOpsWebsitePriceArea(areaValue) ? areaValue : null,
    grid_area_code: pickString(row, ['grid_area_code', 'gridAreaCode']),
    grid_area_name: pickString(row, ['grid_area_name', 'gridAreaName']),
    grid_owner_id: pickString(row, ['grid_owner_id', 'gridOwnerId']),
    grid_owner_name: pickString(row, ['grid_owner_name', 'gridOwnerName']),
    confidence: normalizeNumber(row.confidence),
    contract_version: pickString(row, ['contract_version', 'contractVersion']) ?? context.contract_version,
    resolver_version: pickString(row, ['resolver_version', 'resolverVersion']),
    geodata_version: pickString(row, ['geodata_version', 'geodataVersion']),
    conflict_code: pickString(row, ['conflict_code', 'conflictCode']),
    error_code: pickString(row, ['error_code', 'errorCode']),
    source: mapResolutionSource(row.source ?? row.resolver_source ?? row.resolverSource),
    source_chain: pickStringArray(row, ['source_chain', 'sourceChain']) ?? [],
    customer_message: pickString(row, ['customer_message', 'customerMessage', 'message']),
    raw: row,
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
  } satisfies OpsWebsiteQuoteRequestDto
  const payload = await opsFetch('/api/v1/website/quote', {
    method: 'POST',
    headers: { 'Idempotency-Key': `website-quote:${randomUUID()}` },
    body: JSON.stringify(requestBody),
  })
  await verifiedTenantReference(payload, '/api/v1/website/quote')
  return mapOpsWebsiteQuote(payload, input)
}

export async function validateOpsWebsiteQuote(
  input: OpsWebsiteQuoteValidationInput,
): Promise<OpsWebsiteQuoteValidation> {
  await getVerifiedOpsIntegrationContext()
  const requestBody = {
    quote_reference: input.quote_reference,
    offer_reference: input.offer_reference,
    customer_type: toOpsCustomerType(input.customer_type),
    resolution_id: input.resolution_id,
    annual_consumption_kwh: input.annual_consumption_kwh,
    start_date: input.start_date,
    ...(input.price_area ? { price_area: input.price_area } : {}),
    ...(input.grid_area_code ? { grid_area_code: input.grid_area_code } : {}),
    ...(input.postal_code ? { postal_code: input.postal_code.replace(/\s+/g, '') } : {}),
    ...(input.application_id ? { application_id: input.application_id } : {}),
  } satisfies OpsWebsiteQuoteValidationRequestDto
  const payload = await opsFetch('/api/v1/website/quote/validate', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  })
  await verifiedTenantReference(payload, '/api/v1/website/quote/validate')
  const row = extractObject(payload)
  const status = pickString(row, ['status', 'validation_status', 'validationStatus'])
  const explicitValid = pickBoolean(row, ['valid'])
  const quoteReference = pickString(row, ['quote_reference'])
  const offerReference = pickString(row, ['offer_reference'])
  if (explicitValid !== true || !quoteReference || !offerReference) {
    throw new OpsError('OPS returnerade ett ofullständigt offertvalideringssvar.', 502, {
      code: 'ops_quote_validation_contract_invalid',
      valid: explicitValid,
      quote_reference: quoteReference,
      offer_reference: offerReference,
    })
  }
  if (quoteReference !== input.quote_reference || offerReference !== input.offer_reference) {
    throw new OpsError('Offerten är inte bunden till valt avtal.', 409, {
      code: 'ops_quote_binding_mismatch',
      expected_quote_reference: input.quote_reference,
      received_quote_reference: quoteReference,
      expected_offer_reference: input.offer_reference,
      received_offer_reference: offerReference,
    })
  }
  return {
    valid: true,
    status,
    code: pickString(row, ['code', 'validation_code', 'validationCode']),
    quote_reference: quoteReference,
    offer_reference: offerReference,
    valid_until: pickString(row, ['valid_until', 'validUntil']),
    publication_revision: pickString(row, ['publication_revision', 'publicationRevision']),
    legal_bundle_version: pickString(row, ['legal_bundle_version', 'legalBundleVersion']),
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
    })
  }
  const context = await getVerifiedOpsIntegrationContext()
  const requestBody = { resolution_id: normalized }
  const payload = await opsFetch('/api/v1/website/market-price/current', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  })
  await verifiedTenantReference(payload, '/api/v1/website/market-price/current')
  const row = extractObject(payload)
  const area = pickString(row, ['price_area', 'priceArea', 'price_area_code', 'priceAreaCode'])?.toUpperCase()
  if (!isOpsWebsitePriceArea(area)) {
    throw new OpsError('OPS returnerade ett ogiltigt elområde.', 502, {
      code: 'ops_market_price_contract_invalid',
    })
  }
  const source = recordValue(row.source)
  const selectedResolution = pickString(row, ['selected_resolution', 'selectedResolution', 'resolution', 'interval']) ?? 'current'
  const availableResolutions = pickStringArray(row, ['available_resolutions', 'availableResolutions']) ?? [selectedResolution]
  const result: OpsCurrentMarketPrice = {
    provider: pickString(row, ['provider']) ?? pickString(source ?? {}, ['provider', 'name']) ?? 'OPS',
    provider_reference: pickString(row, ['provider_reference', 'providerReference']) ?? pickString(source ?? {}, ['reference', 'provider_reference', 'providerReference']),
    resolution_id: pickString(row, ['resolution_id', 'resolutionId']) ?? normalized,
    price_area: area,
    reference_type: pickString(row, ['reference_type', 'referenceType']) ?? 'current',
    resolution: pickString(row, ['resolution', 'interval']) ?? selectedResolution,
    selected_resolution: selectedResolution,
    available_resolutions: availableResolutions,
    interval_start: pickString(row, ['interval_start', 'intervalStart', 'time_start', 'timeStart']) ?? '',
    interval_end: pickString(row, ['interval_end', 'intervalEnd', 'time_end', 'timeEnd']) ?? '',
    price_sek_per_kwh: normalizeNumber(row.price_sek_per_kwh ?? row.priceSekPerKwh ?? row.price_inc_vat_sek_per_kwh ?? row.priceIncVatSekPerKwh) ?? Number.NaN,
    price_ore_per_kwh: normalizeNumber(row.price_ore_per_kwh ?? row.priceOrePerKwh ?? row.price_inc_vat_ore_per_kwh ?? row.priceIncVatOrePerKwh) ?? Number.NaN,
    price_ex_vat_sek_per_kwh: normalizeNumber(row.price_ex_vat_sek_per_kwh ?? row.priceExVatSekPerKwh),
    price_ex_vat_ore_per_kwh: normalizeNumber(row.price_ex_vat_ore_per_kwh ?? row.priceExVatOrePerKwh),
    price_inc_vat_sek_per_kwh: normalizeNumber(row.price_inc_vat_sek_per_kwh ?? row.priceIncVatSekPerKwh),
    price_inc_vat_ore_per_kwh: normalizeNumber(row.price_inc_vat_ore_per_kwh ?? row.priceIncVatOrePerKwh),
    unit: pickString(row, ['unit']) ?? 'sek_per_kwh',
    includes_vat: pickBoolean(row, ['includes_vat', 'includesVat']) ?? false,
    includes_supplier_fees: pickBoolean(row, ['includes_supplier_fees', 'includesSupplierFees']) ?? false,
    includes_grid_fees: pickBoolean(row, ['includes_grid_fees', 'includesGridFees']) ?? false,
    is_indicative: pickBoolean(row, ['is_indicative', 'isIndicative']) ?? false,
    is_stale: pickBoolean(row, ['is_stale', 'isStale']) ?? false,
    fallback_used: pickBoolean(row, ['fallback_used', 'fallbackUsed']) ?? false,
    fallback_reason: pickString(row, ['fallback_reason', 'fallbackReason']),
    freshness: pickString(row, ['freshness']),
    as_of: pickString(row, ['as_of', 'asOf', 'source_as_of', 'sourceAsOf']) ?? '',
    source_as_of: pickString(row, ['source_as_of', 'sourceAsOf']) ?? pickString(source ?? {}, ['as_of', 'asOf']),
    stale_after: pickString(row, ['stale_after', 'staleAfter', 'next_update_at', 'nextUpdateAt']) ?? '',
    next_update_at: pickString(row, ['next_update_at', 'nextUpdateAt']),
    contract_version: pickString(row, ['contract_version', 'contractVersion']) ?? context.contract_version,
    raw: row,
  }
  if (
    result.resolution_id !== normalized ||
    !result.interval_start ||
    !result.interval_end ||
    !Number.isFinite(result.price_sek_per_kwh) ||
    !Number.isFinite(result.price_ore_per_kwh) ||
    !result.as_of ||
    !result.stale_after
  ) {
    throw new OpsError('OPS returnerade ett ofullständigt aktuellt marknadspris.', 502, {
      code: 'ops_market_price_contract_invalid',
      endpoint: '/api/v1/website/market-price/current',
      resolution_id: normalized,
    })
  }
  return result
}

export async function fetchOpsWebsiteApplicationStatus(
  applicationId: string,
): Promise<OpsWebsiteApplicationStatus> {
  const normalized = normalizeText(applicationId);
  if (!normalized) {
    throw new OpsError("Application ID krävs.", 400, {
      code: "application_id_required",
      field: "application_id",
    });
  }
  await getVerifiedOpsIntegrationContext();
  const endpoint = `/api/v1/website/customer-applications/${encodeURIComponent(normalized)}`;
  const payload = await opsFetch(endpoint);
  await verifiedTenantReference(payload, endpoint);
  const row = extractObject(payload);
  const status = pickString(row, ["status", "application_status", "applicationStatus"]);
  const allowed = new Set<OpsWebsiteApplicationStatusValue>([
    "accepted",
    "processing",
    "needs_customer_information",
    "completed",
    "rejected",
    "failed",
  ]);
  if (!status || !allowed.has(status as OpsWebsiteApplicationStatusValue)) {
    throw new OpsError("OPS returnerade en okänd ansökningsstatus.", 502, {
      code: "ops_application_status_contract_invalid",
      endpoint,
      received: status,
    });
  }
  return {
    application_id: pickString(row, ["application_id", "applicationId"]) ?? normalized,
    application_number: pickString(row, ["application_number", "applicationNumber"]),
    status: status as OpsWebsiteApplicationStatusValue,
    stage: pickString(row, ["stage", "workflow_state", "workflowState"]) ?? status,
    customer_number: pickString(row, ["customer_number", "customerNumber"]),
    contract_status: pickString(row, ["contract_status", "contractStatus"]),
    supplier_switch_status: pickString(row, ["supplier_switch_status", "supplierSwitchStatus"]),
    supply_status: pickString(row, ["supply_status", "supplyStatus"]),
    requested_start_date: pickString(row, ["requested_start_date", "requestedStartDate"]),
    confirmed_start_date: pickString(row, ["confirmed_start_date", "confirmedStartDate"]),
    missing_customer_action: pickBoolean(row, ["missing_customer_action", "missingCustomerAction"]) ?? false,
    next_step: pickString(row, ["next_step", "nextStep"]),
    blocking_reason: pickString(row, ["blocking_reason", "blockingReason"]),
    updated_at: pickString(row, ["updated_at", "updatedAt"]) ?? new Date().toISOString(),
    raw: row,
  };
}

export async function fetchOpsWebsiteSwitchStatus(
  applicationNumber: string,
): Promise<Record<string, unknown> | null> {
  const normalized = normalizeText(applicationNumber);
  if (!normalized) throw new OpsError('Application number is required.', 400);
  const payload = await opsFetch(`/api/v1/website/switch-status?application_number=${encodeURIComponent(normalized)}`);
  await verifiedTenantReference(payload, '/api/v1/website/switch-status');
  const row = extractObject(payload);
  return Object.keys(row).length ? row : null;
}

export async function fetchOpsWebsitePortfolioPrices(input: {
  offerReference: string;
  priceArea?: OpsWebsitePriceArea | null;
}): Promise<Record<string, unknown>[]> {
  const query = new URLSearchParams({ offer_reference: input.offerReference });
  if (input.priceArea) query.set('price_area', input.priceArea);
  const payload = await opsFetch(`/api/v1/website/portfolio-prices?${query.toString()}`);
  await verifiedTenantReference(payload, '/api/v1/website/portfolio-prices');
  return extractRows(payload).flatMap((item) => recordValue(item) ? [recordValue(item)!] : []);
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
        etag: cached.etag,
        publication_revision: cached.publication_revision,
        tenant_reference: cached.tenant_reference,
        not_modified: true,
        fetched_at: cached.fetched_at,
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
      etag: cached.etag,
      publication_revision: cached.publication_revision,
      tenant_reference: cached.tenant_reference,
      not_modified: true,
      fetched_at: cached.fetched_at,
      stale: false,
      stale_reason: null,
    };
  }

  const tenantReference = await verifiedTenantReference(
    response.payload,
    "/api/v1/website/public-contracts",
  );
  const snapshot: PublicContractsCacheEntry = {
    cache_key: cacheKey,
    contracts: sortedPublicContracts(response.payload),
    etag: response.headers.get("etag"),
    publication_revision: publicationRevisionFromPayload(response.payload),
    tenant_reference: tenantReference,
    not_modified: false,
    fetched_at: new Date().toISOString(),
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
  const type = pickString(r, ["type", "text_type", "legal_type"]);
  const version = pickString(r, ["version", "version_key", "legal_version"]);
  const title = pickString(r, ["title", "name"]);
  const body = pickString(r, ["body", "content", "text", "markdown"]);
  const url = pickString(r, ["url", "href", "public_url", "publicUrl"]);

  if (!type || !version || !title || (!body && !url)) return null;

  return {
    type,
    version,
    title,
    body: body ?? null,
    id: pickString(r, ["id", "version_id", "versionId", "text_version_id"]),
    url,
    offer_reference: pickString(r, ["offer_reference", "offerReference"]),
    published_at: pickString(r, ["published_at", "publishedAt"]),
    raw: r,
  };
}

export type OpsWebsiteLegalBundle = {
  texts: OpsLegalText[];
  raw: Record<string, unknown>;
};

function extractLegalBundleRows(payload: unknown): unknown[] {
  const root = extractObject(payload);
  const data = recordValue(root.data) ?? root;
  const rows: unknown[] = [];
  const keys = [
    "texts",
    "legal_texts",
    "legalTexts",
    "documents",
    "items",
    "terms",
    "privacy_policy",
    "withdrawal",
    "power_of_attorney",
    "price_terms",
  ];

  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) {
      rows.push(...value);
    } else if (value && typeof value === "object") {
      const row = { ...(value as Record<string, unknown>) };
      if (!row.type && !row.text_type && !row.legal_type) row.type = key;
      rows.push(row);
    }
  }

  return rows.length > 0 ? rows : extractRows(payload);
}

export async function fetchOpsWebsiteLegalBundle(): Promise<OpsWebsiteLegalBundle> {
  const payload = await opsFetch("/api/v1/website/legal-bundle");
  const raw = extractObject(payload);
  const rows = extractLegalBundleRows(payload);
  return {
    texts: rows.map(mapLegalText).filter((item): item is OpsLegalText => item !== null),
    raw,
  };
}

export function buildOpsCustomerApplicationPayload(input: OpsCustomerApplicationInput) {
  const externalCustomerId = normalizeText(input.external_customer_id)
  const offerReference = normalizeText(input.offer_reference)
  const quoteReference = normalizeText(input.quote_reference)
  const resolutionId = normalizeText(input.resolution_id)
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
  if (!Number.isFinite(input.annual_consumption_kwh) || input.annual_consumption_kwh <= 0) {
    throw new OpsError('Årsförbrukningen är ogiltig.', 400, {
      code: 'annual_consumption_invalid',
      field: 'annual_consumption_kwh',
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

  const rawConsentKeys = Object.keys(input.consents as Record<string, unknown>)
  const unsupportedConsentKeys = rawConsentKeys.filter((key) => !isPublicLegalAcceptanceCode(key))
  if (unsupportedConsentKeys.length > 0) {
    throw new OpsError('Juridiska godkännanden innehåller fält som OpenAPI inte tillåter.', 400, {
      code: 'legal_acceptances_schema_mismatch',
      unsupported_fields: unsupportedConsentKeys,
      field: 'legal_acceptances',
    })
  }
  const legalAcceptances: OpsLegalAcceptancesDto = {
    ...(typeof input.consents.terms === 'boolean' ? { terms: input.consents.terms } : {}),
    ...(typeof input.consents.privacy_policy === 'boolean' ? { privacy_policy: input.consents.privacy_policy } : {}),
    ...(typeof input.consents.withdrawal === 'boolean' ? { withdrawal: input.consents.withdrawal } : {}),
    ...(typeof input.consents.power_of_attorney === 'boolean' ? { power_of_attorney: input.consents.power_of_attorney } : {}),
    ...(typeof input.consents.price_terms === 'boolean' ? { price_terms: input.consents.price_terms } : {}),
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

  const payload: OpsCustomerApplicationRequestDto = {
    external_customer_id: externalCustomerId,
    offer_reference: offerReference!,
    quote_reference: quoteReference!,
    resolution_id: resolutionId!,
    annual_consumption_kwh: input.annual_consumption_kwh,
    start_date: startDate!,
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
    },
    site: {
      ...(input.site.facility_id ? { facility_id: input.site.facility_id } : {}),
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
    },
    ...(input.metering_point?.metering_point_id
      ? { metering_point: { metering_point_id: input.metering_point.metering_point_id } }
      : {}),
    contract: {
      requested_start_mode: input.contract.requested_start_mode,
      ...(input.contract.requested_start_mode === 'specific_date'
        ? { requested_start_date: input.contract.requested_start_date ?? startDate! }
        : input.contract.requested_start_date
          ? { requested_start_date: input.contract.requested_start_date }
          : {}),
    },
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
  }
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
    await verifiedTenantReference(payload, "/api/v1/website/customer-applications");
  } catch (error) {
    if (!isOpsError(error) || error.status !== 409) throw error;
    const code = opsErrorCodeValue(error) ?? "";
    if (!/duplicate_application|application_business_conflict/i.test(code)) throw error;
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

function portalIdentityPayload(identity: OpsPortalIdentity): Record<string, string | null> {
  return {
    email: normalizeText(identity.email),
    customer_number: normalizeText(identity.customerNumber),
    external_customer_id: stableExternalCustomerId(identity),
  };
}

async function opsCustomerFetch(
  path: string,
  identity: OpsPortalIdentity,
  init?: RequestInit,
): Promise<unknown> {
  const headers = new Headers(init?.headers);
  portalHeaders(identity).forEach((value, key) => headers.set(key, value));
  return opsFetch(path, { ...init, headers });
}

function firstObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const data = p.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    return data[0] as Record<string, unknown>;
  }
  return p;
}

function rowsAsObjects(payload: unknown): Record<string, unknown>[] {
  return extractRows(payload).filter((item): item is Record<string, unknown> =>
    Boolean(item && typeof item === "object" && !Array.isArray(item)),
  );
}

async function customerRows(
  path: string,
  identity: OpsPortalIdentity,
): Promise<Record<string, unknown>[]> {
  try {
    return await opsCustomerFetch(path, identity).then(rowsAsObjects);
  } catch (error) {
    if (isOpsError(error) && error.status === 404) return [];
    throw error;
  }
}

async function customerObject(
  path: string,
  identity: OpsPortalIdentity,
): Promise<Record<string, unknown> | null> {
  try {
    return await opsCustomerFetch(path, identity).then(firstObject);
  } catch (error) {
    if (isOpsError(error) && error.status === 404) return null;
    throw error;
  }
}

async function optionalCustomerRows(
  path: string,
  identity: OpsPortalIdentity,
): Promise<Record<string, unknown>[]> {
  try {
    return await customerRows(path, identity);
  } catch (error) {
    if (isOpsError(error) && error.status === 404) return [];
    throw error;
  }
}

async function optionalCustomerObject(
  path: string,
  identity: OpsPortalIdentity,
): Promise<Record<string, unknown> | null> {
  try {
    return await customerObject(path, identity);
  } catch (error) {
    if (isOpsError(error) && error.status === 404) return null;
    throw error;
  }
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
  const data =
    recordValue(root.data) ??
    recordValue(root.bundle) ??
    recordValue(root.portal_bundle) ??
    recordValue(root.portalBundle) ??
    recordValue(root.overview) ??
    root;
  const customer =
    recordValue(data.customer) ??
    recordValue(data.profile) ??
    recordValue(data.me) ??
    recordValue(data.customer_profile) ??
    recordValue(data.customerProfile);

  return {
    profile: customer,
    customerStatus:
      recordValue(data.customer_status) ?? recordValue(data.customerStatus),
    dataQuality:
      recordValue(data.data_quality) ?? recordValue(data.dataQuality),
    contracts: nestedArray(data, ["contracts", "customer_contracts", "customerContracts"]),
    sites: nestedArray(data, [
      "sites",
      "customer_sites",
      "customerSites",
      "facilities",
      "delivery_points",
      "deliveryPoints",
    ]),
    invoices: nestedArray(data, ["invoices", "customer_invoices", "customerInvoices"]),
    documents: nestedArray(data, ["documents", "customer_documents", "customerDocuments"]),
    legalAcceptances: nestedArray(data, [
      "legalAcceptances",
      "legal_acceptances",
      "customer_legal_acceptances",
      "customerLegalAcceptances",
    ]),
    powersOfAttorney: nestedArray(data, [
      "powersOfAttorney",
      "powers_of_attorney",
      "power_of_attorney",
      "customer_power_of_attorney",
    ]),
    switchStatus:
      recordValue(data.switchStatus) ??
      recordValue(data.switch_status) ??
      recordValue(data.supplier_switch_status),
    events: nestedArray(data, ["events", "customer_events", "portal_events"]),
    meteringValues: nestedArray(data, [
      "meteringValues",
      "metering_values",
      "normalized_metering_values",
    ]),
    notifications: nestedArray(data, [
      "notifications",
      "customer_notifications",
      "customerNotifications",
    ]),
  };
}

async function fetchLegacyCustomerPortalBundle(
  identity: OpsPortalIdentity,
): Promise<OpsPortalBundle> {
  const [profile, contracts, sites] = await Promise.all([
    optionalCustomerObject("/api/v1/customer/me", identity),
    optionalCustomerRows("/api/v1/customer/contracts", identity),
    optionalCustomerRows("/api/v1/customer/sites", identity),
  ]);

  const [
    invoices,
    documents,
    legalAcceptances,
    powersOfAttorney,
    switchStatus,
    events,
    meteringValues,
    notifications,
  ] = await Promise.all([
    optionalCustomerRows("/api/v1/customer/invoices", identity),
    optionalCustomerRows("/api/v1/customer/documents", identity),
    optionalCustomerRows("/api/v1/customer/legal-acceptances", identity),
    optionalCustomerRows("/api/v1/customer/powers-of-attorney", identity),
    optionalCustomerObject("/api/v1/customer/switch-status", identity),
    optionalCustomerRows("/api/v1/customer/events", identity),
    optionalCustomerRows("/api/v1/customer/metering-values", identity),
    optionalCustomerRows("/api/v1/customer/notifications", identity),
  ]);

  return {
    profile,
    customerStatus: null,
    dataQuality: null,
    contracts,
    sites,
    invoices,
    documents,
    legalAcceptances,
    powersOfAttorney,
    switchStatus,
    events,
    meteringValues,
    notifications,
  };
}

function opsErrorCodeValue(error: OpsError): string | null {
  const details = recordValue(error.details);
  const nested = recordValue(details?.error);
  return normalizeText(nested?.code ?? details?.code);
}

function mayUseLegacyPortalBundleFallback(error: unknown): boolean {
  if (env("GRIDEX_ENABLE_LEGACY_PORTAL_BUNDLE_COMPATIBILITY") !== "true") return false;
  if (!isOpsError(error)) return false;
  const code = opsErrorCodeValue(error);
  return code === "endpoint_not_found" || code === "method_not_supported";
}

export async function fetchOpsCustomerPortalBundle(
  identity: OpsPortalIdentity,
): Promise<OpsPortalBundle> {
  try {
    return normalizePortalBundle(
      await opsCustomerFetch("/api/v1/customer/portal-bundle", identity, {
        method: "POST",
        body: JSON.stringify(portalIdentityPayload(identity)),
      }),
    );
  } catch (error) {
    if (mayUseLegacyPortalBundleFallback(error)) {
      return fetchLegacyCustomerPortalBundle(identity);
    }

    console.warn("[ops customer portal] portal-bundle failed", {
      status: isOpsError(error) ? error.status : null,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
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
    power_of_attorney: input.powerOfAttorney ?? null,
    legal_acceptances: input.legalAcceptances ?? [],
    documents: input.documents ?? [],
    facility_data: input.facilityData ?? null,
    profile: input.profile ?? null,
    metadata: input.metadata ?? {},
  };

  const operationId =
    normalizeText(input.idempotencyKey) ??
    createHash("sha256")
      .update(JSON.stringify({ scope: "customer_sync", user: input.identity.userId, body }))
      .digest("hex");
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
  const body = {
    ...portalIdentityPayload(input.identity),
    ...(input.customerNumber ? { customer_number: input.customerNumber } : {}),
    ...(input.externalCustomerId ? { external_customer_id: input.externalCustomerId } : {}),
    ...(input.email ? { email: input.email } : {}),
    metadata: input.metadata ?? { source: "gridex_web_customer_portal_sync" },
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
    createHash("sha256")
      .update(JSON.stringify({ scope, user: input.identity.userId, body }))
      .digest("hex");
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
  const body = {
    ...portalIdentityPayload(input.identity),
    move_out: input.moveOut,
    metadata: input.metadata ?? {},
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
  return createHash("sha256")
    .update(
      JSON.stringify({
        scope: "customer_event",
        user: identity.userId,
        customer_number: identity.customerNumber ?? null,
        external_customer_id: stableExternalCustomerId(identity),
        event_type: event.event_type,
        entity_type: event.entity_type ?? null,
        entity_id: event.entity_id ?? null,
        metadata: event.metadata ?? {},
        bucket,
      }),
    )
    .digest("hex");
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
      ...event,
      ...portalIdentityPayload(identity),
      customer_email: identity.email ?? null,
      portal_user_id: identity.userId,
      auth_user_id: identity.userId,
    }),
  });
}

export async function fetchOpsTenantEvents(
  params: URLSearchParams | Record<string, string | null | undefined> = {},
): Promise<Record<string, unknown>[]> {
  const input = params instanceof URLSearchParams ? params : new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) => (value ? [[key, value]] : [])),
  )
  const allowed = new Set(['event_type', 'type', 'customer_number', 'external_customer_id', 'limit', 'cursor', 'after', 'before'])
  const query = new URLSearchParams()
  input.forEach((value, key) => {
    if (allowed.has(key) && value.trim()) query.set(key, value.trim())
  })

  const queryString = query.toString()
  const payload = await opsFetch(`/api/v1/events${queryString ? `?${queryString}` : ''}`)
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
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID()}`;
}

export function isTransientOpsError(error: unknown): boolean {
  if (isOpsError(error)) {
    return error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
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

export function isOpsError(err: unknown): err is OpsError {
  return err instanceof OpsError;
}
