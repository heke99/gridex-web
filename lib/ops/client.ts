import { createHash, randomUUID } from "node:crypto";
import {
  normalizePublicContractApiPayload,
  publishedPricingComponentAmount,
  type PublicPortfolioMonthlyPrice,
  type PublicPricingComponent,
} from "@/lib/website/publicContractContract";
import { toOpsCustomerType, type WebsiteCustomerType } from "@/lib/website/customerType";

export type OpsContractType =
  | "variable_spot"
  | "variable_monthly"
  | "variable_hourly"
  | "spot_monthly"
  | "spot_hourly"
  | "spot_quarterly"
  | "quarter_hourly"
  | "portfolio"
  | "portfolio_managed"
  | "fixed"
  | "mix"
  | "mixed"
  | "monthly_fixed"
  | "fixed_monthly"
  | string;

export type OpsPublicContract = {
  offer_reference: string;
  product_code?: string | null;
  name: string;
  type: OpsContractType;
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

export type OpsWebsitePowerOfAttorneyInput = {
  accepted: boolean;
  scope: Array<"supplier_switch" | "facility_information_lookup" | string>;
  signerName?: string | null;
  signerIdentityNumber?: string | null;
  method: "website_acceptance" | string;
  acceptedAt: string;
  textVersionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type OpsCustomerApplicationInput = {
  offer_reference: string;
  quote_reference: string;
  annual_consumption_kwh: number;
  customer_type: WebsiteCustomerType;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  personal_number?: string | null;
  organization_number?: string | null;
  email: string;
  phone: string;
  address: string;
  postal_code: string;
  city: string;
  facility_id?: string | null;
  metering_point_id?: string | null;
  grid_area_code?: string | null;
  grid_owner_id?: string | null;
  grid_owner_name?: string | null;
  requested_start_mode: "earliest_possible" | "specific_date";
  requested_start_date?: string | null;
  price_area_code?: string | null;
  current_supplier_name?: string | null;
  current_supplier_id?: string | null;
  current_supplier_org_number?: string | null;
  current_supplier_ediel_id?: string | null;
  source: string;
  idempotency_key: string;
  external_customer_id: string;
  customer_portal_user_id?: string | null;
  auth_user_id?: string | null;
  consents: {
    terms: boolean;
    privacy_policy: boolean;
    withdrawal: boolean;
    power_of_attorney: boolean;
    price_terms: boolean;
  };
  powerOfAttorney?: OpsWebsitePowerOfAttorneyInput | null;
};

export type OpsCustomerApplicationResult = {
  status: string;
  contract_status?: string | null;
  signed_at?: string | null;
  withdrawal_deadline_at?: string | null;
  signature_snapshot_sha256?: string | null;
  can_send_agreement_confirmation?: boolean | null;
  can_start_switch?: boolean | null;
  can_create_supplier_switch_request?: boolean | null;
  can_dispatch_supplier_switch?: boolean | null;
  supplier_switch_status?: string | null;
  customer_id?: string | null;
  customer_number?: string | null;
  application_id?: string | null;
  application_number?: string | null;
  external_customer_id?: string | null;
  portal_identity_id?: string | null;
  contract_id?: string | null;
  contract_number?: string | null;
  customer_site_id?: string | null;
  metering_point_id?: string | null;
  price_plan_id?: string | null;
  price_plan_version_id?: string | null;
  contract_price_snapshot_id?: string | null;
  offer_reference?: string | null;
  power_of_attorney_id?: string | null;
  power_of_attorney?: Record<string, unknown> | null;
  nextAction?: Record<string, unknown> | null;
  manualInformationRequest?: Record<string, unknown> | null;
  communication?: OpsCustomerApplicationCommunication | null;
  missing_fields: string[];
  blocking_reasons: string[];
  warnings: string[];
  next_step?: string | null;
  message?: string | null;
  raw?: Record<string, unknown>;
};

export type OpsCustomerApplicationCommunication = {
  triggered: string[];
  queued: string[];
  sent: string[];
  failed: string[];
  source_of_truth?: string | null;
  dispatch_status?: string | null;
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
  body: string;
  id?: string | null;
  url?: string | null;
  offer_reference?: string | null;
  published_at?: string | null;
  raw?: Record<string, unknown>;
};

export type OpsWebsitePriceArea = "SE1" | "SE2" | "SE3" | "SE4";

export type OpsWebsiteEnergyResolutionInput = {
  postal_code: string;
  city?: string | null;
  street?: string | null;
  address?: string | null;
  apartment?: string | null;
};

export type OpsWebsiteEnergyResolution = {
  status: string;
  price_area_code: OpsWebsitePriceArea | null;
  grid_area_code?: string | null;
  grid_owner_id?: string | null;
  grid_owner_name?: string | null;
  confidence?: number | null;
  source?: string | null;
  source_chain?: string[];
  customer_message?: string | null;
  raw?: Record<string, unknown>;
};

export type OpsWebsitePricingPreviewInput = {
  offer_reference: string;
  price_area_code: OpsWebsitePriceArea;
  postal_code?: string | null;
  city?: string | null;
  address?: string | null;
  grid_area_code?: string | null;
  metering_point_id?: string | null;
  estimated_monthly_kwh: number;
  annual_consumption_kwh?: number | null;
  start_date?: string | null;
  customer_type?: WebsiteCustomerType | null;
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

export type OpsWebsitePricingPreview = {
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
  quote_reference?: string;
  pricing_interval?: string;
  estimate_method?: string;
  source_period?: string;
  market_data_timestamp?: string;
  is_binding?: boolean;
  assumptions?: OpsQuoteAssumption[];
  market_sources?: OpsQuoteMarketSource[];
  pricing_snapshot_schema_version?: string;
  valid_until?: string;
  quote_token?: string;
  quote_expires_at?: string;
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
  environment?: string | null;
  channel?: string | null;
  api_version?: string | null;
  raw: Record<string, unknown>;
};

export type OpsPublicContractsSnapshot = {
  contracts: OpsPublicContract[];
  etag: string | null;
  publication_revision: string | null;
  tenant_reference: string;
  not_modified: boolean;
};

export class OpsError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "OpsError";
    this.status = status;
    this.details = details;
  }
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function opsBaseUrl(): string | undefined {
  const value = env("GRIDEX_OPS_API_URL") ?? env("GRIDEX_OPS_BASE_URL");
  if (!value) return undefined;
  return value.replace(/\/+$/, "");
}

const OPS_API_KEY_FULL_SECRET_NOT_PREFIX = "OPS_API_KEY_FULL_SECRET_NOT_PREFIX";

function expectedOpsTenantReference(): string | null {
  return env("GRIDEX_EXPECTED_TENANT_REFERENCE") ?? null;
}

function opsTenantCacheKey(): string {
  const baseUrl = opsBaseUrl() ?? "unconfigured";
  const tenantReference = expectedOpsTenantReference() ?? "missing-tenant-reference";
  return createHash("sha256").update(`${baseUrl}|${tenantReference}`).digest("hex").slice(0, 24);
}

function tenantReferenceFromPayload(payload: unknown): string | null {
  const root = recordValue(payload);
  const data = recordValue(root?.data);
  const meta = recordValue(root?.meta) ?? recordValue(data?.meta);
  const context = recordValue(root?.context) ?? recordValue(data?.context);
  return pickFromRecords([meta, context, data, root], ["tenant_reference", "tenantReference"]);
}

function assertExpectedTenantReference(actual: string | null, source: string): string {
  const expected = expectedOpsTenantReference();
  if (!expected) {
    throw new OpsError("OPS tenantreferens är inte konfigurerad.", 503, {
      code: "ops_tenant_reference_not_configured",
      source,
    });
  }
  if (!actual) {
    throw new OpsError("OPS kunde inte verifiera tenant-bindningen.", 503, {
      code: "ops_tenant_binding_unverified",
      expected_tenant_reference: expected,
      source,
    });
  }
  if (actual !== expected) {
    throw new OpsError("OPS API-nyckeln tillhör fel tenant.", 503, {
      code: "ops_tenant_mismatch",
      expected_tenant_reference: expected,
      actual_tenant_reference: actual,
      source,
    });
  }
  return actual;
}

const OPS_API_KEY_ENV_NAMES = [
  "GRIDEX_WEBSITE_API_KEY",
  "GRIDEX_CUSTOMER_PORTAL_API_KEY",
  "GRIDEX_OPS_CUSTOMER_PORTAL_API_KEY",
  "GRIDEX_OPS_API_KEY",
  "OPS_API_KEY",
] as const;

function opsApiKey(): { value?: string; source?: string; invalidReason?: string } {
  for (const name of OPS_API_KEY_ENV_NAMES) {
    const value = env(name);
    if (!value) continue;

    const prefixOnly = /^gdxp_[a-z0-9]+$/i.test(value) && value.length <= 18;
    if (prefixOnly) {
      return {
        source: name,
        invalidReason: `${OPS_API_KEY_FULL_SECRET_NOT_PREFIX}: ${name} innehåller bara API-nyckelns prefix, inte hela token.`,
      };
    }

    return { value, source: name };
  }

  return {};
}

export function getOpsClientStatus(): OpsClientStatus {
  const missing: string[] = [];
  const baseUrl = opsBaseUrl();
  const apiKey = opsApiKey();
  if (!baseUrl) missing.push("GRIDEX_OPS_API_URL");
  if (!apiKey.value) missing.push(apiKey.invalidReason ?? "GRIDEX_WEBSITE_API_KEY");
  if (!expectedOpsTenantReference()) missing.push("GRIDEX_EXPECTED_TENANT_REFERENCE");

  let unsafeProductionUrl = false;
  if (
    process.env.NODE_ENV === "production" &&
    env("GRIDEX_ALLOW_UNSAFE_OPS_URL") !== "true" &&
    baseUrl
  ) {
    try {
      const parsed = new URL(baseUrl);
      const configuredHosts = (env("GRIDEX_OPS_ALLOWED_HOSTS") ?? "app.gridex.se")
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean);
      unsafeProductionUrl =
        parsed.protocol !== "https:" ||
        !configuredHosts.includes(parsed.hostname.toLowerCase()) ||
        /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(baseUrl) ||
        /test|staging|preview/i.test(parsed.hostname);
    } catch {
      unsafeProductionUrl = true;
    }
  }

  if (unsafeProductionUrl) {
    missing.push("GRIDEX_OPS_API_URL_PRODUCTION_GUARD");
  }

  const liveSignupEnabled = env("GRIDEX_ENABLE_LIVE_SIGNUP") === "true";
  if (
    liveSignupEnabled &&
    !env("GRIDEX_WEBSITE_HASH_PEPPER") &&
    !env("PII_HASH_PEPPER")
  ) {
    missing.push("GRIDEX_WEBSITE_HASH_PEPPER_OR_PII_HASH_PEPPER");
  }

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

function pickNumber(
  row: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const picked = normalizeNumber(row[key]);
    if (picked !== null) return picked;
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
  const legal = recordValue(r.legal);
  const components = extractOpsPriceComponents(r);
  const documented = normalizePublicContractApiPayload(r);
  if (documented) {
    return {
      ...documented,
      short_description: pickString(r, ["short_description", "shortDescription", "public_description"]),
      marketing_description: pickString(r, ["marketing_description", "description", "marketingDescription"]),
      badge_text: pickString(r, ["badge_text", "badgeText"]),
      monthly_fee_sek: coalesceNumber(
        publishedPricingComponentAmount(documented.pricing_components, 'monthly_fee_sek'),
        documented.monthly_fee_sek,
        components.monthly_fee_sek,
      ),
      invoice_fee_sek: coalesceNumber(
        publishedPricingComponentAmount(documented.pricing_components, 'invoice_fee_sek'),
        documented.invoice_fee_sek,
        components.invoice_fee_sek,
      ),
      markup_ore_per_kwh: coalesceNumber(
        publishedPricingComponentAmount(documented.pricing_components, 'markup_ore_per_kwh'),
        documented.markup_ore_per_kwh,
        components.markup_ore_per_kwh,
      ),
      variable_markup_ore_per_kwh: coalesceNumber(
        publishedPricingComponentAmount(documented.pricing_components, 'variable_markup_ore_per_kwh'),
        documented.variable_markup_ore_per_kwh,
        components.variable_markup_ore_per_kwh,
      ),
      fixed_price_ore_per_kwh: coalesceNumber(
        publishedPricingComponentAmount(documented.pricing_components, 'fixed_price_ore_per_kwh'),
        documented.fixed_price_ore_per_kwh,
        components.fixed_price_ore_per_kwh,
      ),
      monthly_fixed_price_sek: coalesceNumber(
        publishedPricingComponentAmount(documented.pricing_components, 'monthly_fixed_price_sek'),
        documented.monthly_fixed_price_sek,
        components.monthly_fixed_price_sek,
      ),
      elcert_ore_per_kwh: coalesceNumber(
        publishedPricingComponentAmount(documented.pricing_components, 'elcert_ore_per_kwh'),
        documented.elcert_ore_per_kwh,
        components.elcert_ore_per_kwh,
      ),
      portfolio_price_ore_per_kwh: coalesceNumber(
        publishedPricingComponentAmount(documented.pricing_components, 'portfolio_price_ore_per_kwh'),
        documented.portfolio_price_ore_per_kwh,
        components.portfolio_price_ore_per_kwh,
      ),
      vat_rate: coalesceNumber(
        publishedPricingComponentAmount(documented.pricing_components, 'vat_rate'),
        documented.vat_rate,
        components.vat_rate,
      ),
      pricing_model:
        documented.pricing_model ??
        pickFromRecords([pricing, r], ["pricing_model", "pricingModel", "price_model", "priceModel"]),
      spot_share: coalesceNumber(
        publishedPricingComponentAmount(documented.pricing_components, 'spot_share'),
        documented.spot_share,
        components.spot_share,
      ),
      portfolio_share: coalesceNumber(
        publishedPricingComponentAmount(documented.pricing_components, 'portfolio_share'),
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

  const offerReference = pickFromRecords([r], [
    "offer_reference",
    "offerReference",
  ]);
  const productCode = pickFromRecords([r], [
    "product_code",
    "productCode",
    "code",
    "offer_code",
    "offerCode",
  ]);
  const name = pickFromRecords([r], [
    "name",
    "public_name",
    "publicName",
    "title",
    "contract_name",
    "offer_name",
    "offerName",
    "display_name",
    "displayName",
  ]);

  if (!offerReference || !name) return null;

  const isPublic = pickBooleanFromRecords([r], ["is_public", "isPublic", "public"]);
  const isActive = pickBooleanFromRecords([r], ["is_active", "isActive", "active"]);
  // Legacy OPS responses may contain these fields, but public contracts are
  // already publication-filtered by OPS and must not be rejected for omitting them.


  const withdrawalVersion = pickFromRecords([legal, r], [
    "withdrawal_version",
    "withdrawalVersion",
    "cancellation_right_version",
    "cancellationRightVersion",
  ]);

  const singleCustomerType = pickFromRecords([r], ["customer_type", "customerType"]);
  const customerTypes = Array.isArray(r.customer_types)
    ? r.customer_types.map(String).filter(Boolean)
    : Array.isArray(r.customerTypes)
      ? r.customerTypes.map(String).filter(Boolean)
      : singleCustomerType
        ? [singleCustomerType]
        : null;

  return {
    offer_reference: offerReference,
    product_code: productCode,
    name,
    type:
      pickString(r, ["type", "contract_type", "contractType", "product_type"]) ??
      "variable_spot",
    short_description: pickString(r, ["short_description", "shortDescription", "public_description"]),
    marketing_description: pickString(r, [
      "marketing_description",
      "description",
      "marketingDescription",
    ]),
    badge_text: pickString(r, ["badge_text", "badgeText"]),
    monthly_fee_sek: components.monthly_fee_sek ?? null,
    invoice_fee_sek: components.invoice_fee_sek ?? null,
    markup_ore_per_kwh: components.markup_ore_per_kwh ?? null,
    variable_markup_ore_per_kwh: components.variable_markup_ore_per_kwh ?? null,
    fixed_price_ore_per_kwh: components.fixed_price_ore_per_kwh ?? null,
    monthly_fixed_price_sek: components.monthly_fixed_price_sek ?? null,
    elcert_ore_per_kwh: components.elcert_ore_per_kwh ?? null,
    portfolio_price_ore_per_kwh: components.portfolio_price_ore_per_kwh ?? null,
    vat_rate: components.vat_rate ?? null,
    pricing_model: pickFromRecords([pricing, r], ["pricing_model", "pricingModel", "price_model", "priceModel"]),
    spot_share: components.spot_share ?? null,
    portfolio_share: components.portfolio_share ?? null,
    valid_from: pickString(r, ["valid_from", "validFrom"]),
    valid_to: pickString(r, ["valid_to", "validTo"]),
    binding_period_months: normalizeNumber(
      r.binding_period_months ?? r.bindingPeriodMonths ?? r.binding_months,
    ),
    notice_period_months: normalizeNumber(
      r.notice_period_months ?? r.noticePeriodMonths ?? r.notice_months ?? r.noticeMonths,
    ),
    notice_period_days: normalizeNumber(
      r.notice_period_days ?? r.noticePeriodDays ?? r.notice_days,
    ),
    automatic_renewal: pickBooleanFromRecords([r], ["automatic_renewal", "automaticRenewal"]),
    included: Array.isArray(r.included)
      ? r.included.map(String).filter(Boolean)
      : pickString(r, ["included"]),
    excluded: Array.isArray(r.excluded)
      ? r.excluded.map(String).filter(Boolean)
      : pickString(r, ["excluded"]),
    start_info: pickString(r, ["start_info", "startInfo"]),
    customer_types: customerTypes,
    terms_version: pickFromRecords([legal, r], ["terms_version", "termsVersion"]),
    terms_version_id: pickFromRecords([legal, r], ["terms_version_id", "termsVersionId"]),
    terms_url: pickFromRecords([legal, r], ["terms_url", "termsUrl"]),
    privacy_policy_version: pickFromRecords([legal, r], [
      "privacy_policy_version",
      "privacyPolicyVersion",
    ]),
    privacy_policy_version_id: pickFromRecords([legal, r], [
      "privacy_policy_version_id",
      "privacyPolicyVersionId",
    ]),
    privacy_policy_url: pickFromRecords([legal, r], ["privacy_policy_url", "privacyPolicyUrl"]),
    cancellation_right_version: withdrawalVersion,
    withdrawal_version: withdrawalVersion,
    withdrawal_version_id: pickFromRecords([legal, r], [
      "withdrawal_version_id",
      "withdrawalVersionId",
      "cancellation_right_version_id",
      "cancellationRightVersionId",
    ]),
    withdrawal_url: pickFromRecords([legal, r], [
      "withdrawal_url",
      "withdrawalUrl",
      "cancellation_right_url",
      "cancellationRightUrl",
    ]),
    power_of_attorney_version: pickFromRecords([legal, r], [
      "power_of_attorney_version",
      "powerOfAttorneyVersion",
      "power_of_attorney_text_version",
      "powerOfAttorneyTextVersion",
      "power_of_attorney_legal_text_version",
      "powerOfAttorneyLegalTextVersion",
      "poa_version",
      "poaVersion",
    ]),
    power_of_attorney_version_id: pickFromRecords([legal, r], [
      "power_of_attorney_version_id",
      "powerOfAttorneyVersionId",
      "power_of_attorney_text_version_id",
      "powerOfAttorneyTextVersionId",
      "power_of_attorney_legal_text_version_id",
      "powerOfAttorneyLegalTextVersionId",
      "poa_version_id",
      "poaVersionId",
    ]),
    power_of_attorney_url: pickFromRecords([legal, r], [
      "power_of_attorney_url",
      "powerOfAttorneyUrl",
      "power_of_attorney_text_url",
      "powerOfAttorneyTextUrl",
      "poa_url",
      "poaUrl",
    ]),
    power_of_attorney_required: pickBooleanFromRecords([legal, r], [
      "power_of_attorney_required",
      "powerOfAttorneyRequired",
    ]),
    price_terms_version: pickFromRecords([legal, r], [
      "price_terms_version",
      "priceTermsVersion",
      "price_terms",
      "priceTerms",
    ]),
    price_terms_version_id: pickFromRecords([legal, r], [
      "price_terms_version_id",
      "priceTermsVersionId",
    ]),
    price_terms_url: pickFromRecords([legal, r], ["price_terms_url", "priceTermsUrl"]),
    is_public: isPublic,
    is_active: isActive,
    sort_order: normalizeNumber(r.sort_order ?? r.sortOrder),
  };
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

function customerSafeOpsMessage(payload: unknown, fallback: string): string {
  if (looksLikeRedirectOrHtml(payload)) return fallback;

  if (payload && typeof payload === "object") {
    const raw =
      (payload as Record<string, unknown>).customer_message ??
      (payload as Record<string, unknown>).customerMessage ??
      (payload as Record<string, unknown>).message ??
      (payload as Record<string, unknown>).error;

    if (typeof raw === "string" && raw.trim()) {
      const trimmed = raw.trim();
      return looksLikeRedirectOrHtml(trimmed) ? fallback : trimmed;
    }
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

async function opsRequest(
  path: string,
  init?: RequestInit,
  options: { allowNotModified?: boolean } = {},
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
  headers.set("Authorization", `Bearer ${apiKey.value}`);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const timeout = timeoutSignal(init?.signal);
  const requestUrl = `${baseUrl}${path}`;
  const request = (url: string) => fetch(url, {
    ...init,
    headers,
    signal: timeout.signal,
    cache: "no-store",
    redirect: "manual",
  });
  let res: Response;
  try {
    res = await request(requestUrl);
    const canonicalRedirect = isSafeOpsCanonicalRedirect(
      requestUrl,
      res.headers.get("location"),
      res.status,
    );
    if (canonicalRedirect) res = await request(canonicalRedirect);
  } catch (error) {
    if (timeout.signal.aborted && !init?.signal?.aborted) {
      timeout.cleanup();
      throw new OpsError("Tjänsten svarade inte i tid.", 504, {
        code: "ops_request_timeout",
        path,
        timeout_ms: opsTimeoutMs(),
      });
    }
    timeout.cleanup();
    throw error;
  }

  try {
    const contentType = res.headers.get("content-type") ?? "";
    const location = res.headers.get("location");

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
        payload,
      );
    }

    return { status: res.status, headers: new Headers(res.headers), payload };
  } catch (error) {
    if (timeout.signal.aborted && !init?.signal?.aborted && !isOpsError(error)) {
      throw new OpsError("Tjänsten svarade inte i tid.", 504, {
        code: "ops_request_timeout",
        path,
        timeout_ms: opsTimeoutMs(),
      });
    }
    throw error;
  } finally {
    timeout.cleanup();
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

function mapWebsiteEnergyResolution(
  payload: unknown,
): OpsWebsiteEnergyResolution {
  const row = extractObject(payload);
  const nested = row.resolution;
  const r =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? { ...row, ...(nested as Record<string, unknown>) }
      : row;

  const area =
    pickString(r, [
      "price_area_code",
      "priceAreaCode",
      "price_area",
      "priceArea",
      "area",
    ]) ?? null;

  return {
    status:
      pickString(r, ["status", "resolution_status", "resolutionStatus"]) ??
      (isOpsWebsitePriceArea(area) ? "resolved" : "needs_review"),
    price_area_code: isOpsWebsitePriceArea(area) ? area : null,
    grid_area_code: pickString(r, [
      "grid_area_code",
      "gridAreaCode",
      "network_area_code",
      "networkAreaCode",
    ]),
    grid_owner_id: pickString(r, [
      "grid_owner_id",
      "gridOwnerId",
      "network_owner_id",
      "networkOwnerId",
    ]),
    grid_owner_name: pickString(r, [
      "grid_owner_name",
      "gridOwnerName",
      "network_owner_name",
      "networkOwnerName",
    ]),
    confidence: normalizeNumber(
      r.confidence ?? r.match_confidence ?? r.matchConfidence,
    ),
    source: pickString(r, ["source", "match_source", "matchSource"]),
    source_chain: pickStringArray(r, ["source_chain", "sourceChain"]),
    customer_message: pickString(r, [
      "customer_message",
      "customerMessage",
      "message",
    ]),
    raw: row,
  };
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

function mapWebsitePricingPreview(
  payload: unknown,
  fallbackArea: OpsWebsitePriceArea,
): OpsWebsitePricingPreview {
  const row = extractObject(payload);
  const metadataRow = recordValue(row.metadata) ?? recordValue(row.meta) ?? {};
  const quoteRow = recordValue(row.quote) ?? {};
  const offerRow = recordValue(row.offer);
  const inputRow = recordValue(row.input);
  const estimateRow = recordValue(row.estimate);
  const contractRow = recordValue(row.contract) ?? offerRow ?? row;
  const lines = Array.isArray(row.lines)
    ? row.lines.map(recordValue).filter((item): item is Record<string, unknown> => item !== null)
    : [];
  const area = pickString(inputRow ?? row, [
    "priceArea",
    "price_area_code",
    "priceAreaCode",
    "price_area",
  ]);
  const safeArea: OpsWebsitePriceArea = isOpsWebsitePriceArea(area)
    ? area
    : fallbackArea;
  const monthlyKwh =
    pickNumber(inputRow ?? row, [
      "estimated_monthly_consumption_kwh",
      "estimated_monthly_kwh",
      "estimatedMonthlyKwh",
      "monthly_kwh",
      "monthlyKwh",
      "kwh",
    ]) ?? 0;
  const monthlyExVat =
    pickNumber(estimateRow ?? row, [
      "monthly_ex_vat",
      "totalMonthlyCostSek",
      "total_monthly_cost_sek",
      "monthlyCostSek",
      "monthly_cost_sek",
    ]) ?? Number.NaN;
  const monthlyIncVat =
    pickNumber(estimateRow ?? row, [
      "monthly_inc_vat",
      "totalMonthlyCostInclVatSek",
      "total_monthly_cost_incl_vat_sek",
      "total_monthly_cost_inc_vat_sek",
      "monthlyCostInclVatSek",
      "monthly_cost_incl_vat_sek",
    ]) ?? undefined;
  const annualIncVat =
    pickNumber(estimateRow ?? row, [
      "annual_inc_vat",
      "totalYearlyCostSek",
      "total_yearly_cost_sek",
      "annualCostSek",
      "annual_cost_sek",
    ]) ?? undefined;
  const fixedMonthlyExVat = lines.reduce((sum, line) => {
    const calculationType = pickString(line, ["calculation_type", "calculationType"]);
    return calculationType === "per_month" || calculationType === "per_invoice"
      ? sum + (pickNumber(line, ["amount_ex_vat", "amountExVat"]) ?? 0)
      : sum;
  }, 0);
  const derivedPricePerKwhOre =
    Number.isFinite(monthlyExVat) && monthlyKwh > 0
      ? Math.max(0, ((monthlyExVat - fixedMonthlyExVat) / monthlyKwh) * 100)
      : Number.NaN;
  const normalizedSpecification = normalizeWebsitePricingSpecification({
    ...row,
    components: lines,
  });
  const normalizedFees = recordValue(normalizedSpecification?.fees) ?? {};
  const hasInvoiceFeeLine = lines.some(
    (line) => pickString(line, ["component_code", "component_type"]) === "invoice_fee",
  );

  return {
    contract: {
      slug:
        pickString(contractRow, [
          "slug",
          "offer_reference",
          "offerReference",
          "product_code",
          "productCode",
          "contract_slug",
          "contractSlug",
        ]) ?? "elavtal",
      offer_reference: pickString(contractRow, ["offer_reference", "offerReference"]),
      name:
        pickString(contractRow, ["name", "public_name", "publicName", "title", "contract_name"]) ??
        "Elavtal",
      contractType: normalizePreviewContractType(
        contractRow.contractType ??
          contractRow.contract_type ??
          contractRow.type ??
          offerRow?.contract_type,
      ),
    },
    priceArea: safeArea,
    price_area_code: safeArea,
    kwh: monthlyKwh,
    annual_consumption_kwh:
      pickNumber(inputRow ?? {}, ["annual_consumption_kwh", "annualConsumptionKwh"]) ??
      pickNumber(row, ["annual_consumption_kwh", "annualConsumptionKwh"]) ??
      monthlyKwh * 12,
    pricePerKwhOre:
      pickNumber(row, [
        "pricePerKwhOre",
        "price_per_kwh_ore",
        "totalOrePerKwh",
        "total_ore_per_kwh",
      ]) ?? derivedPricePerKwhOre,
    totalMonthlyCostSek: monthlyExVat,
    totalMonthlyCostInclVatSek: monthlyIncVat,
    totalYearlyCostSek: annualIncVat,
    customerNotice:
      pickString(row, ["customerNotice", "customer_notice"]) ??
      "Priset är beräknat server-side av OPS från avtalets låsta prisversion.",
    legalText:
      pickString(row, ["legalText", "legal_text"]) ??
      "Beräkningen är en offert. Slutlig faktura använder verkliga mätvärden och avtalets låsta prisunderlag.",
    specification: {
      ...(normalizedSpecification ?? {}),
      basis: {
        type: "ops_canonical_quote",
        snapshot_schema: pickString(row, ["snapshot_schema"]),
        billing_month: pickString(inputRow ?? {}, ["billing_month"]),
      },
      fees: {
        ...normalizedFees,
        invoiceFeeIncludedInMonthlyEstimate: hasInvoiceFeeLine,
        billingIntervalMonths: 1,
      },
      lines,
    },
    quote_reference:
      pickFromRecords([quoteRow, metadataRow, row], [
        "quote_reference",
        "quoteReference",
        "reference",
      ]) ?? undefined,
    pricing_interval:
      pickFromRecords([quoteRow, metadataRow, row], ["pricing_interval", "pricingInterval", "interval"]) ?? undefined,
    estimate_method:
      pickFromRecords([quoteRow, metadataRow, row], ["estimate_method", "estimateMethod", "method"]) ?? undefined,
    source_period:
      quoteSourcePeriod(
        quoteRow.source_period ?? metadataRow.source_period ?? row.source_period ??
        quoteRow.sourcePeriod ?? metadataRow.sourcePeriod ?? row.sourcePeriod,
      ) ?? undefined,
    market_data_timestamp:
      pickFromRecords([quoteRow, metadataRow, row], [
        "market_data_timestamp",
        "marketDataTimestamp",
        "market_updated_at",
        "marketUpdatedAt",
      ]) ?? undefined,
    is_binding:
      pickBooleanFromRecords([quoteRow, metadataRow, row], ["is_binding", "isBinding", "binding"]) ?? undefined,
    assumptions: normalizeQuoteAssumptions(
      quoteRow.assumptions ?? metadataRow.assumptions ?? row.assumptions,
    ),
    market_sources: normalizeQuoteMarketSources(
      quoteRow.market_sources ?? metadataRow.market_sources ?? row.market_sources ??
      quoteRow.marketSources ?? metadataRow.marketSources ?? row.marketSources,
    ),
    pricing_snapshot_schema_version:
      pickFromRecords([quoteRow, metadataRow, row], [
        "pricing_snapshot_schema_version",
        "pricingSnapshotSchemaVersion",
        "snapshot_schema_version",
        "snapshot_schema",
      ]) ?? undefined,
    valid_until:
      pickFromRecords([quoteRow, metadataRow, row], [
        "valid_until",
        "validUntil",
        "quote_expires_at",
        "quoteExpiresAt",
        "expires_at",
        "expiresAt",
      ]) ?? undefined,
    quote_token:
      pickFromRecords([quoteRow, metadataRow, row], [
        "quote_token",
        "quoteToken",
        "pricing_quote_token",
        "pricingQuoteToken",
        "token",
      ]) ?? undefined,
    quote_expires_at:
      pickFromRecords([quoteRow, metadataRow, row], [
        "valid_until",
        "validUntil",
        "quote_expires_at",
        "quoteExpiresAt",
        "pricing_quote_expires_at",
        "pricingQuoteExpiresAt",
        "expires_at",
        "expiresAt",
      ]) ?? undefined,
    raw: row,
  };
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
  return value === "private" || value === "company" ? value : null;
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
  const root = recordValue(payload) ?? {};
  const data = recordValue(root.data);
  const context = recordValue(root.context) ?? recordValue(data?.context) ?? data ?? root;
  const meta = recordValue(root.meta) ?? recordValue(data?.meta);
  const tenantReference = pickFromRecords(
    [context, meta, data, root],
    ["tenant_reference", "tenantReference"],
  );
  const verifiedTenantReference = assertExpectedTenantReference(
    tenantReference,
    "/api/v1/integration/context",
  );
  return {
    tenant_reference: verifiedTenantReference,
    environment: pickFromRecords([context, meta, data, root], ["environment", "api_environment"]),
    channel: pickFromRecords([context, meta, data, root], ["channel"]),
    api_version: pickFromRecords([context, meta, data, root], ["api_version", "apiVersion"]),
    raw: root,
  };
}

export async function fetchOpsIntegrationContext(forceFresh = false): Promise<OpsIntegrationContext> {
  const key = opsTenantCacheKey();
  const now = Date.now();
  if (!forceFresh && integrationContextCache?.key === key && integrationContextCache.expiresAt > now) {
    return integrationContextCache.value;
  }
  const payload = await opsFetch("/api/v1/integration/context");
  const value = integrationContextFromPayload(payload);
  integrationContextCache = { key, expiresAt: now + 5 * 60_000, value };
  return value;
}

async function verifiedTenantReference(payload: unknown, source: string): Promise<string> {
  const direct = tenantReferenceFromPayload(payload);
  if (direct) return assertExpectedTenantReference(direct, source);
  return (await fetchOpsIntegrationContext()).tenant_reference;
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
  const expected = expectedOpsTenantReference();
  if (input?.tenantReference && expected && input.tenantReference !== expected) return;
  publicContractsCache.clear();
}

export async function fetchOpsPublicContractsSnapshot(
  customerType?: WebsiteCustomerType | null,
  options: { forceFresh?: boolean } = {},
): Promise<OpsPublicContractsSnapshot> {
  const cacheKey = publicContractsCacheKey(customerType);
  const cached = publicContractsCache.get(cacheKey);
  const headers = new Headers();
  if (!options.forceFresh && cached?.etag) headers.set("If-None-Match", cached.etag);

  const response = await opsRequest(
    publicContractsPath(customerType),
    { method: "GET", headers },
    { allowNotModified: true },
  );

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

  if (!type || !version || !title || !body) return null;

  return {
    type,
    version,
    title,
    body,
    id: pickString(r, ["id", "version_id", "versionId", "text_version_id"]),
    url: pickString(r, ["url", "href", "public_url", "publicUrl"]),
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
    "texts", "legal_texts", "legalTexts", "documents", "items",
    "terms", "privacy_policy", "withdrawal", "power_of_attorney", "price_terms",
  ];

  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) rows.push(...value);
    else if (value && typeof value === "object") {
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

function assertCanonicalQuoteMetadata(preview: OpsWebsitePricingPreview): void {
  const missing: string[] = [];
  if (!preview.quote_reference) missing.push("quote_reference");
  if (!preview.pricing_interval) missing.push("pricing_interval");
  if (!preview.estimate_method) missing.push("estimate_method");
  if (typeof preview.is_binding !== "boolean") missing.push("is_binding");
  if (!preview.pricing_snapshot_schema_version) missing.push("pricing_snapshot_schema_version");
  if (!preview.valid_until) missing.push("valid_until");
  const marketLinked = ["spot_monthly", "spot_hourly", "spot_quarterly", "mix"].includes(
    preview.contract.contractType,
  );
  if (marketLinked && !preview.source_period) missing.push("source_period");
  if (marketLinked && !preview.market_data_timestamp) missing.push("market_data_timestamp");
  if (marketLinked && !preview.market_sources?.length) missing.push("market_sources");
  if (missing.length) {
    throw new OpsError("OPS quote saknar obligatorisk metadata.", 502, {
      code: "ops_quote_metadata_incomplete",
      missing_fields: missing,
      offer_reference: preview.contract.offer_reference ?? null,
    });
  }
}

export async function fetchOpsWebsiteQuote(
  input: OpsWebsitePricingPreviewInput,
): Promise<OpsWebsitePricingPreview> {
  const startDate = input.start_date?.trim() || new Date().toISOString().slice(0, 10);
  const annualConsumptionKwh = input.annual_consumption_kwh ?? input.estimated_monthly_kwh * 12;
  if (!Number.isFinite(annualConsumptionKwh) || annualConsumptionKwh <= 0) {
    throw new OpsError("Årsförbrukningen är ogiltig.", 400, {
      code: "annual_consumption_invalid",
      field: "annual_consumption_kwh",
    });
  }
  const payload = await opsFetch("/api/v1/website/quote", {
    method: "POST",
    body: JSON.stringify({
      offer_reference: input.offer_reference,
      price_area: input.price_area_code,
      annual_consumption_kwh: annualConsumptionKwh,
      start_date: startDate,
      ...(input.customer_type ? { customer_type: toOpsCustomerType(input.customer_type) } : {}),
      ...(input.postal_code ? { postal_code: input.postal_code } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.address ? { address: input.address } : {}),
      ...(input.grid_area_code ? { grid_area_code: input.grid_area_code } : {}),
      ...(input.metering_point_id ? { metering_point_id: input.metering_point_id } : {}),
    }),
  });
  await verifiedTenantReference(payload, "/api/v1/website/quote");
  const preview = mapWebsitePricingPreview(payload, input.price_area_code);
  assertCanonicalQuoteMetadata(preview);
  return preview;
}

export function buildOpsCustomerApplicationPayload(input: OpsCustomerApplicationInput) {
  const externalCustomerId = normalizeText(input.external_customer_id);
  if (!externalCustomerId) {
    throw new OpsError("Ett stabilt externt kund-ID krävs.", 400, {
      code: "external_customer_id_required",
      field: "external_customer_id",
    });
  }
  if (!normalizeText(input.quote_reference)) {
    throw new OpsError("Quote reference krävs för kundansökan.", 400, {
      code: "quote_reference_required",
      field: "contract.quote_reference",
    });
  }
  if (!Number.isFinite(input.annual_consumption_kwh) || input.annual_consumption_kwh <= 0) {
    throw new OpsError("Årsförbrukningen är ogiltig.", 400, {
      code: "annual_consumption_invalid",
      field: "site.annual_consumption_kwh",
    });
  }
  if (input.requested_start_mode === "specific_date" && !normalizeText(input.requested_start_date)) {
    throw new OpsError("Startdatum krävs när ett specifikt datum har valts.", 400, {
      code: "requested_start_date_required",
      field: "contract.requested_start_date",
    });
  }

  const portalUserId = input.customer_portal_user_id ?? input.auth_user_id ?? null;
  const authUserId = input.auth_user_id ?? input.customer_portal_user_id ?? null;

  return {
    external_customer_id: externalCustomerId,
    source: input.source,
    ...(portalUserId ? { customer_portal_user_id: portalUserId } : {}),
    ...(authUserId ? { auth_user_id: authUserId } : {}),
    customer: {
      customer_type: toOpsCustomerType(input.customer_type),
      ...(input.first_name ? { first_name: input.first_name } : {}),
      ...(input.last_name ? { last_name: input.last_name } : {}),
      ...(input.company_name ? { company_name: input.company_name } : {}),
      ...(input.personal_number ? { personal_number: input.personal_number } : {}),
      ...(input.organization_number ? { org_number: input.organization_number } : {}),
      email: input.email,
      phone: input.phone,
    },
    site: {
      ...(input.facility_id ? { facility_id: input.facility_id } : {}),
      ...(input.metering_point_id ? { metering_point_id: input.metering_point_id } : {}),
      ...(input.requested_start_mode === "specific_date" && input.requested_start_date
        ? { move_in_date: input.requested_start_date }
        : {}),
      street: input.address,
      postal_code: input.postal_code,
      city: input.city,
      ...(input.price_area_code ? { price_area_code: input.price_area_code } : {}),
      annual_consumption_kwh: input.annual_consumption_kwh,
      ...(input.grid_area_code ? { grid_area_code: input.grid_area_code } : {}),
      ...(input.grid_owner_id ? { grid_owner_id: input.grid_owner_id } : {}),
      ...(input.grid_owner_name ? { grid_owner_name: input.grid_owner_name } : {}),
      ...(input.current_supplier_name ? { current_supplier_name: input.current_supplier_name } : {}),
      ...(input.current_supplier_id ? { current_supplier_id: input.current_supplier_id } : {}),
      ...(input.current_supplier_org_number ? { current_supplier_org_number: input.current_supplier_org_number } : {}),
      ...(input.current_supplier_ediel_id ? { current_supplier_ediel_id: input.current_supplier_ediel_id } : {}),
    },
    contract: {
      offer_reference: input.offer_reference,
      quote_reference: input.quote_reference,
      requested_start_mode: input.requested_start_mode,
      requested_start_date:
        input.requested_start_mode === "specific_date"
          ? input.requested_start_date ?? null
          : null,
    },
    consents: input.consents,
    ...(input.powerOfAttorney ? { powerOfAttorney: input.powerOfAttorney } : {}),
  };
}

function mapCustomerApplicationCommunication(
  value: unknown,
): OpsCustomerApplicationCommunication | null {
  const row = recordValue(value);
  if (!row) return null;
  return {
    triggered: pickStringArray(row, ["triggered"]) ?? [],
    queued: pickStringArray(row, ["queued"]) ?? [],
    sent: pickStringArray(row, ["sent"]) ?? [],
    failed: pickStringArray(row, ["failed"]) ?? [],
    source_of_truth: pickString(row, ["source_of_truth", "sourceOfTruth"]),
    dispatch_status: pickString(row, ["dispatch_status", "dispatchStatus"]),
    raw: row,
  };
}

export async function submitOpsCustomerApplication(
  input: OpsCustomerApplicationInput,
): Promise<OpsCustomerApplicationResult> {
  if (env("GRIDEX_ENABLE_LIVE_SIGNUP") !== "true") {
    throw new OpsError("Live-teckning är inte aktiverad för hemsidan.", 503);
  }

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

export function mapOpsCustomerApplicationResult(
  payload: unknown,
): OpsCustomerApplicationResult {

  const data =
    payload && typeof payload === "object" && "data" in payload
      ? ((payload as { data?: unknown }).data ?? payload)
      : payload;

  const row =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  const missing = Array.isArray(row.missing_fields)
    ? row.missing_fields.map(String)
    : Array.isArray(row.missingFields)
      ? row.missingFields.map(String)
      : [];
  const blockingReasons = Array.isArray(row.blocking_reasons)
    ? row.blocking_reasons.map(String)
    : Array.isArray(row.blockingReasons)
      ? row.blockingReasons.map(String)
      : [];
  const warnings = Array.isArray(row.warnings)
    ? row.warnings.map(String)
    : [];

  return {
    status: pickString(row, ["status"]) ?? "application_received",
    contract_status: pickString(row, ["contract_status", "contractStatus"]),
    signed_at: pickString(row, ["signed_at", "signedAt"]),
    withdrawal_deadline_at: pickString(row, [
      "withdrawal_deadline_at",
      "withdrawalDeadlineAt",
    ]),
    signature_snapshot_sha256: pickString(row, [
      "signature_snapshot_sha256",
      "signatureSnapshotSha256",
    ]),
    can_send_agreement_confirmation: pickBoolean(row, [
      "can_send_agreement_confirmation",
      "canSendAgreementConfirmation",
    ]),
    can_start_switch: pickBoolean(row, ["can_start_switch", "canStartSwitch"]),
    can_create_supplier_switch_request: pickBoolean(row, [
      "can_create_supplier_switch_request",
      "canCreateSupplierSwitchRequest",
    ]),
    can_dispatch_supplier_switch: pickBoolean(row, [
      "can_dispatch_supplier_switch",
      "canDispatchSupplierSwitch",
    ]),
    supplier_switch_status: pickString(row, [
      "supplier_switch_status",
      "supplierSwitchStatus",
    ]),
    customer_id: pickString(row, ["customer_id", "customerId"]),
    customer_number: pickString(row, ["customer_number", "customerNumber"]),
    application_id: pickString(row, ["application_id", "applicationId"]),
    application_number: pickString(row, [
      "application_number",
      "applicationNumber",
    ]),
    external_customer_id: pickString(row, ["external_customer_id", "externalCustomerId"]),
    portal_identity_id: pickString(row, ["portal_identity_id", "portalIdentityId"]),
    contract_id: pickString(row, ["contract_id", "contractId"]),
    contract_number: pickString(row, ["contract_number", "contractNumber"]),
    customer_site_id: pickString(row, ["customer_site_id", "customerSiteId"]),
    metering_point_id: pickString(row, [
      "metering_point_id",
      "meteringPointId",
    ]),
    price_plan_id: pickString(row, ["price_plan_id", "pricePlanId"]),
    price_plan_version_id: pickString(row, [
      "price_plan_version_id",
      "pricePlanVersionId",
    ]),
    contract_price_snapshot_id: pickString(row, [
      "contract_price_snapshot_id",
      "contractPriceSnapshotId",
    ]),
    offer_reference: pickString(row, ["offer_reference", "offerReference"]),
    power_of_attorney_id: pickString(row, [
      "power_of_attorney_id",
      "powerOfAttorneyId",
      "power_of_attorneyId",
    ]),
    power_of_attorney:
      recordValue(row.power_of_attorney) ?? recordValue(row.powerOfAttorney),
    nextAction: recordValue(row.nextAction) ?? recordValue(row.next_action),
    manualInformationRequest:
      recordValue(row.manualInformationRequest) ??
      recordValue(row.manual_information_request),
    communication: mapCustomerApplicationCommunication(row.communication),
    missing_fields: missing,
    blocking_reasons: blockingReasons,
    warnings,
    next_step: pickString(row, ["next_step", "nextStep"]),
    message: pickString(row, ["message"]),
    raw: row,
  };
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
  headers.set("x-gridex-portal-user-id", identity.userId);

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
  input: { notificationIds?: string[]; all?: boolean; operationId: string },
): Promise<void> {
  const ids = (input.notificationIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (!input.all && ids.length === 0) {
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
    body: JSON.stringify(input.all ? { all: true } : { notification_ids: ids }),
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
