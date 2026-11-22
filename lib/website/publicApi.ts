import type { WebsiteConsumptionProfile } from '@/lib/website/consumptionEstimator'
import type { PublicEnergyDirection, PublicProductionPricing } from '@/lib/website/publicContractContract'
import type { components as WebsiteApiComponents } from '@/lib/ops/generated/website-api'

export const WEBSITE_PRICE_AREAS = ["SE1", "SE2", "SE3", "SE4"] as const;

export type WebsitePriceArea = (typeof WEBSITE_PRICE_AREAS)[number];
export type WebsiteInvoiceDeliveryMethod = "email" | "e_invoice" | "paper" | "direct_debit";
export type WebsiteQuoteSettlement = WebsiteApiComponents['schemas']['WebsiteQuoteSettlement'];

export type WebsitePriceAreaAssurance = {
  status: 'verified' | 'estimated' | 'ambiguous' | 'unresolved';
  price_area: WebsitePriceArea | null;
  confidence: number;
  source: 'facility_data' | 'grid_area_master' | 'address_polygon' | 'postal_city_consensus' | 'postal_consensus' | null;
  candidate_count: number;
  unique_price_area_count: number;
  source_version: string | null;
};

export type WebsiteEnergyResolution = {
  status: string;
  resolution_status?: string | null;
  resolution_id?: string | null;
  resolution_token?: string;
  valid_until?: string | null;
  price_area_code: WebsitePriceArea | null;
  grid_area_code?: string | null;
  grid_owner_name?: string | null;
  confidence?: number | null;
  price_area_assurance?: WebsitePriceAreaAssurance;
  assurance_level?: WebsitePriceAreaAssurance['status'];
  capabilities?: {
    pricing_ready: boolean;
    quote_ready: boolean;
    facility_lookup_ready: boolean;
    switch_request_creatable: boolean;
    switch_dispatch_ready: boolean;
  };
  blockers?: {
    pricing: Array<{ code: string; message?: string | null; field?: string | null; retryable?: boolean | null }>;
    quote: Array<{ code: string; message?: string | null; field?: string | null; retryable?: boolean | null }>;
    facility_lookup: Array<{ code: string; message?: string | null; field?: string | null; retryable?: boolean | null }>;
    switch_creation: Array<{ code: string; message?: string | null; field?: string | null; retryable?: boolean | null }>;
    switch_dispatch: Array<{ code: string; message?: string | null; field?: string | null; retryable?: boolean | null }>;
  };
  retryable?: boolean;
  contract_version?: string;
  warnings?: string[];
  source?: string | { provider?: string | null; reference?: string | null; resolved_by?: string | null; as_of?: string | null } | null;
  customer_message?: string | null;
};

export type WebsiteEnergyResolveInput = {
  postal_code?: string | null;
  city?: string | null;
  street?: string | null;
  street_number?: string | null;
  address?: string | null;
  country?: string | null;
  grid_area_code?: string | null;
  facility_id?: string | null;
  metering_point_id?: string | null;
  requested_start_mode?: 'earliest_possible' | 'specific_date' | null;
  requested_start_date?: string | null;
};

export type WebsitePricingPreviewInput = {
  offer_reference: string;
  price_area_code?: WebsitePriceArea | null;
  resolution_token?: string | null;
  postal_code?: string | null;
  city?: string | null;
  address?: string | null;
  grid_area_code?: string | null;
  metering_point_id?: string | null;
  estimated_monthly_kwh: number;
  annual_consumption_kwh: number;
  requested_start_mode: "earliest_possible" | "specific_date";
  requested_start_date?: string | null;
  start_date?: string | null;
  quote_attempt_id: string;
  customer_type: "private" | "business";
  price_option_reference?: string | null;
  invoice_delivery_method?: WebsiteInvoiceDeliveryMethod | null;
  selected_component_references?: string[] | null;
  site_count?: number | null;
};

export type WebsitePricingQuoteContext = {
  resolution_token?: string | null;
  current_resolution_token?: string | null;
  resolution_id?: string | null;
  postal_code: string;
  city: string;
  address: string;
  price_area_code: WebsitePriceArea;
  grid_area_code?: string | null;
  grid_owner_name?: string | null;
  metering_point_id?: string | null;
  estimated_monthly_kwh: number;
  annual_consumption_kwh: number;
  consumption_profile?: WebsiteConsumptionProfile | null;
  price_option_reference: string;
  invoice_delivery_method: WebsiteInvoiceDeliveryMethod;
  selected_component_references: string[];
  site_count: number;
  requested_start_mode: "earliest_possible" | "specific_date";
  requested_start_date: string | null;
  quote_attempt_id: string;
};

export type WebsiteQuoteAssumption = {
  code?: string | null;
  label: string;
  value?: string | number | boolean | null;
  unit?: string | null;
  description?: string | null;
};

export type WebsiteQuoteMarketSource = {
  name: string;
  period?: string | null;
  resolution?: string | null;
  timestamp?: string | null;
};

export type WebsiteQuoteMarketReference = {
  provider: string | null;
  price_area: WebsitePriceArea | null;
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

export type WebsitePricingPreview = {
  resolution_id: string;
  energy_direction: PublicEnergyDirection;
  production_pricing: PublicProductionPricing | null;
  start_date: string;
  requested_start_mode: "earliest_possible" | "specific_date";
  customer_type: "private" | "business";
  contract: {
    slug: string;
    offer_reference?: string | null;
    contract_reference?: string | null;
    product_code?: string | null;
    name: string;
    contractType:
      "spot_monthly" | "spot_hourly" | "spot_quarterly" | "portfolio_managed" | "fixed" | "mix" | "monthly_fixed";
  };
  priceArea: WebsitePriceArea;
  price_area_code?: WebsitePriceArea;
  kwh: number;
  annual_consumption_kwh?: number;
  pricePerKwhOre: number;
  totalMonthlyCostSek: number;
  totalMonthlyCostInclVatSek?: number;
  totalYearlyCostSek?: number;
  customerNotice?: string;
  legalText?: string;
  specification?: {
    basis?: Record<string, unknown>;
    canonicalLines?: Array<{ code: string; name: string; quantity: number; unit: string; unitPriceExVat: number; amountExVat: number; amountIncVat: number }>;

    fees?: {
      vatIncluded?: boolean;
      markupOre?: number;
      variableFeeOre?: number;
      elcertOre?: number;
      monthlyFeeSek?: number;
      invoiceFeeSek?: number;
      invoiceFeeIncludedInMonthlyEstimate?: boolean;
      billingIntervalMonths?: number;
    };
    [key: string]: unknown;
  };
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
  settlement: WebsiteQuoteSettlement;
  assumptions?: WebsiteQuoteAssumption[];
  market_sources?: WebsiteQuoteMarketSource[];
  market_reference?: WebsiteQuoteMarketReference | null;
  pricing_snapshot_schema_version?: string;
  valid_until: string;
  price_option_reference: string;
  area_price_reference: string | null;
  invoice_delivery_method: WebsiteInvoiceDeliveryMethod;
  selected_component_references: string[];
  mandatory_component_references?: string[];
  conditional_component_references?: string[];
  site_count: number;
  pricing_token?: string;
  pricing_expires_at?: string | null;
  quote_source?: "website";
  token_issuer?: "website";
  raw?: Record<string, unknown>;
};

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export class WebsiteApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly requestId: string | null;

  constructor(message: string, status: number, code: string | null, requestId: string | null) {
    super(message);
    this.name = "WebsiteApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

function responseError(res: Response, data: unknown, fallback: string): WebsiteApiError {
  const root = objectRecord(data);
  const error = objectRecord(root?.error);
  const raw = [
    root?.customer_message, error?.customer_message, error?.message, root?.message, root?.error, data,
  ].find(nonEmptyText);
  const message = raw?.trim();
  const safeMessage = message &&
    !/NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|redirect|<!doctype|<html|text\/html|login|logga in/i.test(message)
    ? message
    : fallback;
  return new WebsiteApiError(
    safeMessage,
    res.status,
    [error?.code, root?.code].find(nonEmptyText) ?? null,
    [error?.request_id, root?.request_id, res.headers.get("x-request-id")].find(nonEmptyText) ?? null,
  );
}

function assertOkResponse(res: Response, data: unknown, fallback: string): void {
  if (!res.ok) throw responseError(res, data, fallback);
}

function isPricingPreview(value: unknown): value is WebsitePricingPreview {
  const quote = objectRecord(value);
  const contract = objectRecord(quote?.contract);
  const settlement = objectRecord(quote?.settlement);
  if (!quote || !contract || !settlement) return false;
  return [
    quote.resolution_id, quote.start_date, quote.valid_until, quote.price_option_reference, quote.pricing_token,
    contract.slug, contract.name, contract.contractType, settlement.model, settlement.customer_accepts,
    settlement.market_data_role, settlement.settlement_resolution,
  ].every(nonEmptyText) &&
    [quote.kwh, quote.pricePerKwhOre, quote.totalMonthlyCostSek, quote.site_count].every(Number.isFinite) &&
    isWebsitePriceArea(quote.priceArea) &&
    (["consumption", "production"] as readonly unknown[]).includes(quote.energy_direction) &&
    (quote.production_pricing === null || objectRecord(quote.production_pricing) !== null) &&
    (["earliest_possible", "specific_date"] as readonly unknown[]).includes(quote.requested_start_mode) &&
    (["private", "business"] as readonly unknown[]).includes(quote.customer_type) &&
    (["email", "e_invoice", "paper", "direct_debit"] as readonly unknown[]).includes(quote.invoice_delivery_method) &&
    (quote.area_price_reference === null || nonEmptyText(quote.area_price_reference)) &&
    Array.isArray(quote.selected_component_references) && quote.selected_component_references.every(nonEmptyText) &&
    typeof settlement.energy_price_locked_at_signup === "boolean" &&
    settlement.uses_actual_metered_consumption === true;
}

async function readJsonResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    await res.text().catch(() => "");
    return null;
  }
  return res.json().catch(() => null);
}

export function normalizeWebsitePostalCode(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

export function isWebsitePriceArea(value: unknown): value is WebsitePriceArea {
  return typeof value === "string" && WEBSITE_PRICE_AREAS.includes(value as WebsitePriceArea);
}

export async function resolveWebsiteEnergyArea(
  input: WebsiteEnergyResolveInput,
  options?: { signal?: AbortSignal },
): Promise<WebsiteEnergyResolution> {
  const res = await fetch("/api/checkout/energy-area/resolve", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: options?.signal,
  });
  const data = await readJsonResponse(res);
  assertOkResponse(res, data, "Kunde inte kontrollera elområde just nu.");
  return (
    data && typeof data === "object" && "data" in data
      ? (data as { data: WebsiteEnergyResolution }).data
      : data
  ) as WebsiteEnergyResolution;
}

export async function previewWebsitePricing(
  input: WebsitePricingPreviewInput,
  signal?: AbortSignal,
): Promise<WebsitePricingPreview> {
  const res = await fetch("/api/checkout/quote", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const data = await readJsonResponse(res);
  assertOkResponse(res, data, "Kunde inte räkna pris just nu.");
  const envelope = objectRecord(data);
  const preview = envelope && "data" in envelope ? envelope.data : data;
  if (!isPricingPreview(preview)) {
    const requestId = responseError(res, data, "").requestId;
    throw new WebsiteApiError("Prissvaret var ofullständigt. Försök räkna pris igen.", res.status, "invalid_quote_response", requestId);
  }
  return preview;
}

export async function verifyWebsitePricingSnapshot(input: {
  pricing_token: string;
  pricing_snapshot_reference?: string;
  ops_quote_reference?: string;
  public_contract_etag?: string | null;
  publication_revision?: number | null;
  contract_payload_sha256?: string | null;
  legal_bundle_version?: string | null;
  legal_document_hashes?: Record<string, string>;
  offer_reference: string;
  price_area_code: WebsitePriceArea;
  estimated_monthly_kwh: number;
  annual_consumption_kwh: number;
  customer_type: "private" | "business";
  requested_start_mode: "earliest_possible" | "specific_date";
  requested_start_date: string | null;
  postal_code: string;
  city: string;
  address: string;
}): Promise<{ ok: boolean; error?: string; code?: string | null; requestId?: string | null }> {
  const res = await fetch("/api/checkout/quote/validate", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await readJsonResponse(res);
  if (res.ok && data && typeof data === "object") return data as { ok: boolean; error?: string };
  const error = responseError(res, data, "Vi kunde inte kontrollera valt avtal just nu.");
  return { ok: false, error: error.message, code: error.code, requestId: error.requestId };
}
