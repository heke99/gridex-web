import { createHash, randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import { normalizePublicContractApiPayload } from "@/lib/website/publicContractContract";

export type OpsContractType =
  | "variable_spot"
  | "spot_hourly"
  | "portfolio"
  | "portfolio_managed"
  | "fixed"
  | "mix"
  | "mixed"
  | "monthly_fixed"
  | "fixed_monthly"
  | string;

export type OpsPublicContract = {
  id?: string | null;
  offer_reference: string;
  contract_id?: string | null;
  // Internal OPS identifiers are intentionally optional. The public website
  // only relies on offer_reference and the documented public DTO.
  price_plan_id?: string | null;
  price_plan_version_id?: string | null;
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
  included?: string[] | string | null;
  excluded?: string[] | string | null;
  start_info?: string | null;
  customer_types?: string[] | null;
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
  raw?: Record<string, unknown>;
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
  customer_type: "private" | "company";
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
  requested_start_mode: "earliest_possible" | "specific_date";
  requested_start_date?: string | null;
  price_area_code?: string | null;
  current_supplier_name?: string | null;
  current_supplier_id?: string | null;
  current_supplier_org_number?: string | null;
  current_supplier_ediel_id?: string | null;
  source: "gridex_website";
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
  missing_fields: string[];
  blocking_reasons: string[];
  warnings: string[];
  next_step?: string | null;
  message?: string | null;
  raw?: Record<string, unknown>;
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

export type OpsPricePlan = {
  price_plan_id: string;
  price_plan_version_id: string;
  product_code: string;
  name: string;
  type: OpsContractType;
  status?: string | null;
  is_public?: boolean | null;
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
  estimated_monthly_kwh: number;
};

export type OpsWebsitePricingPreview = {
  contract: {
    slug: string;
    offer_reference?: string | null;
    name: string;
    contractType: "spot_hourly" | "portfolio_managed" | "fixed" | "mix" | "monthly_fixed";
  };
  priceArea: OpsWebsitePriceArea;
  price_area_code?: OpsWebsitePriceArea;
  kwh: number;
  pricePerKwhOre: number;
  totalMonthlyCostSek: number;
  totalMonthlyCostInclVatSek?: number;
  totalYearlyCostSek?: number;
  customerNotice?: string;
  legalText?: string;
  specification?: Record<string, unknown>;
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
  if (/invoice|faktura|billing/.test(text)) return "invoice_fee_sek";
  if (/monthly|manads|manad|month|subscription|abon/.test(text))
    return "monthly_fee_sek";
  if (
    /variable_fee|rorlig_avgift|rorlig avgift|rörlig avgift|variable charge|variable_charge|energy_fee|kwh_fee/.test(
      text,
    )
  ) {
    return "variable_markup_ore_per_kwh";
  }
  if (
    /markup|paslag|påslag|supplier_margin|margin|energy_markup|gridex/.test(
      text,
    )
  )
    return "markup_ore_per_kwh";
  if (
    /fixed_price|fastpris|fast pris|fixed kwh|price_per_kwh|kwh_price/.test(
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
    const value = normalizeNumber(row[key]);
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
      contract_id: pickString(r, [
        "contract_id",
        "contractId",
        "contract_product_id",
        "contractProductId",
      ]),
      price_plan_id: pickString(r, ["price_plan_id", "pricePlanId", "plan_id", "planId"]),
      price_plan_version_id: pickString(r, [
        "price_plan_version_id",
        "pricePlanVersionId",
        "pricing_version_id",
        "pricingVersionId",
        "price_version_id",
        "priceVersionId",
        "version_id",
        "versionId",
      ]),
      short_description: pickString(r, ["short_description", "shortDescription", "public_description"]),
      marketing_description: pickString(r, ["marketing_description", "description", "marketingDescription"]),
      badge_text: pickString(r, ["badge_text", "badgeText"]),
      monthly_fee_sek: coalesceNumber(documented.monthly_fee_sek, components.monthly_fee_sek),
      invoice_fee_sek: coalesceNumber(documented.invoice_fee_sek, components.invoice_fee_sek),
      markup_ore_per_kwh: coalesceNumber(documented.markup_ore_per_kwh, components.markup_ore_per_kwh),
      variable_markup_ore_per_kwh: coalesceNumber(
        documented.variable_markup_ore_per_kwh,
        components.variable_markup_ore_per_kwh,
      ),
      fixed_price_ore_per_kwh: coalesceNumber(
        documented.fixed_price_ore_per_kwh,
        components.fixed_price_ore_per_kwh,
      ),
      monthly_fixed_price_sek: coalesceNumber(
        documented.monthly_fixed_price_sek,
        components.monthly_fixed_price_sek,
      ),
      elcert_ore_per_kwh: coalesceNumber(documented.elcert_ore_per_kwh, components.elcert_ore_per_kwh),
      portfolio_price_ore_per_kwh: coalesceNumber(
        documented.portfolio_price_ore_per_kwh,
        components.portfolio_price_ore_per_kwh,
      ),
      vat_rate: coalesceNumber(documented.vat_rate, components.vat_rate),
      pricing_model:
        documented.pricing_model ??
        pickFromRecords([pricing, r], ["pricing_model", "pricingModel", "price_model", "priceModel"]),
      spot_share: coalesceNumber(documented.spot_share, components.spot_share),
      portfolio_share: coalesceNumber(documented.portfolio_share, components.portfolio_share),
      binding_period_months: normalizeNumber(
        r.binding_period_months ?? r.bindingPeriodMonths ?? r.binding_months,
      ),
      notice_period_days: normalizeNumber(
        r.notice_period_days ?? r.noticePeriodDays ?? r.notice_days,
      ),
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
      raw: r,
    };
  }

  const offerReference = pickFromRecords([r], [
    "offer_reference",
    "offerReference",
    "contract_offer_id",
    "contractOfferId",
    "public_offer_id",
    "publicOfferId",
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

  const pricePlanId = pickFromRecords([r], [
    "price_plan_id",
    "pricePlanId",
    "plan_id",
    "planId",
  ]);
  const pricePlanVersionId = pickFromRecords([r], [
    "price_plan_version_id",
    "pricePlanVersionId",
    "version_id",
    "versionId",
    "pricing_version_id",
    "pricingVersionId",
    "price_version_id",
    "priceVersionId",
  ]);

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
    id: pickString(r, ["id"]),
    offer_reference: offerReference,
    contract_id: pickString(r, [
      "contract_id",
      "contractId",
      "contract_product_id",
      "contractProductId",
      "contract_offer_id",
      "contractOfferId",
    ]),
    price_plan_id: pricePlanId,
    price_plan_version_id: pricePlanVersionId,
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
    notice_period_days: normalizeNumber(
      r.notice_period_days ?? r.noticePeriodDays ?? r.notice_days,
    ),
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
    raw: r,
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
    "price_plans",
    "pricePlans",
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

async function opsFetch(path: string, init?: RequestInit): Promise<unknown> {
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

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    redirect: "manual",
  });

  const contentType = res.headers.get("content-type") ?? "";
  const location = res.headers.get("location");

  if (res.status >= 300 && res.status < 400) {
    throw new OpsError(fallbackMessage, 502, {
      redirected: true,
      status: res.status,
      location,
      path,
    });
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

  return payload;
}

async function opsFetchWithFallback(
  paths: string[],
  init?: RequestInit,
): Promise<unknown> {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      return await opsFetch(path, init);
    } catch (error) {
      lastError = error;
      if (isOpsError(error) && error.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new OpsError("Tjänsten kunde inte nås.", 502);
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
): "spot_hourly" | "portfolio_managed" | "fixed" | "mix" {
  const type = typeof value === "string" ? value : "";
  if (type === "fixed") return "fixed";
  if (type === "portfolio" || type === "portfolio_managed")
    return "portfolio_managed";
  if (type === "mix" || type === "mixed") return "mix";
  return "spot_hourly";
}

function mapWebsitePricingPreview(
  payload: unknown,
  fallbackArea: OpsWebsitePriceArea,
): OpsWebsitePricingPreview {
  const row = extractObject(payload);
  const contractRow =
    row.contract &&
    typeof row.contract === "object" &&
    !Array.isArray(row.contract)
      ? (row.contract as Record<string, unknown>)
      : row;
  const area = pickString(row, [
    "priceArea",
    "price_area_code",
    "priceAreaCode",
    "price_area",
  ]);
  const safeArea: OpsWebsitePriceArea = isOpsWebsitePriceArea(area)
    ? area
    : fallbackArea;

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
        ]) ??
        pickString(row, ["offer_reference", "offerReference", "product_code", "productCode"]) ??
        "elavtal",
      offer_reference:
        pickString(contractRow, ["offer_reference", "offerReference"]) ??
        pickString(row, ["offer_reference", "offerReference"]),
      name:
        pickString(contractRow, ["name", "public_name", "publicName", "title", "contract_name"]) ??
        "Elavtal",
      contractType: normalizePreviewContractType(
        contractRow.contractType ??
          contractRow.contract_type ??
          contractRow.type ??
          row.contract_type,
      ),
    },
    priceArea: safeArea,
    price_area_code: safeArea,
    kwh:
      pickNumber(row, [
        "kwh",
        "estimated_monthly_kwh",
        "estimatedMonthlyKwh",
        "monthly_kwh",
        "monthlyKwh",
        "estimated_kwh",
        "estimatedKwh",
      ]) ?? 0,
    pricePerKwhOre:
      pickNumber(row, [
        "pricePerKwhOre",
        "price_per_kwh_ore",
        "totalOrePerKwh",
        "total_ore_per_kwh",
        "total_price_ore_per_kwh",
        "energy_price_ore_per_kwh",
      ]) ?? Number.NaN,
    totalMonthlyCostSek:
      pickNumber(row, [
        "totalMonthlyCostSek",
        "total_monthly_cost_sek",
        "monthlyCostSek",
        "monthly_cost_sek",
        "estimatedMonthlyCostSek",
        "estimated_monthly_cost_sek",
      ]) ?? Number.NaN,
    totalMonthlyCostInclVatSek:
      pickNumber(row, [
        "totalMonthlyCostInclVatSek",
        "total_monthly_cost_incl_vat_sek",
        "total_monthly_cost_inc_vat_sek",
        "totalMonthlyCostIncVatSek",
        "totalMonthlyCostWithVatSek",
        "total_monthly_cost_with_vat_sek",
        "totalMonthlyCostVatIncludedSek",
        "total_monthly_cost_vat_included_sek",
        "monthlyCostInclVatSek",
        "monthly_cost_incl_vat_sek",
      ]) ?? undefined,
    totalYearlyCostSek:
      pickNumber(row, [
        "totalYearlyCostSek",
        "total_yearly_cost_sek",
        "yearlyCostSek",
        "yearly_cost_sek",
        "annualCostSek",
        "annual_cost_sek",
      ]) ?? undefined,
    customerNotice:
      pickString(row, ["customerNotice", "customer_notice"]) ?? undefined,
    legalText: pickString(row, ["legalText", "legal_text"]) ?? undefined,
    specification: normalizeWebsitePricingSpecification(row),
    quote_token:
      pickString(row, [
        "quote_token",
        "quoteToken",
        "pricing_quote_token",
        "pricingQuoteToken",
        "quote",
        "token",
      ]) ?? undefined,
    quote_expires_at:
      pickString(row, [
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

function normalizeCustomerTypeFilter(value?: string | null): "private" | "company" | null {
  return value === "private" || value === "company" ? value : null;
}

async function fetchOpsPublicContractsUncached(
  customerType?: string | null,
): Promise<OpsPublicContract[]> {
  const normalizedCustomerType = normalizeCustomerTypeFilter(customerType);
  const suffix = normalizedCustomerType
    ? `?customer_type=${encodeURIComponent(normalizedCustomerType)}`
    : "";
  const payload = await opsFetch(`/api/v1/website/public-contracts${suffix}`);
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

const fetchCachedOpsPublicContracts = unstable_cache(
  async (customerType: string) =>
    fetchOpsPublicContractsUncached(customerType || null),
  ["ops-public-contracts-v4"],
  { revalidate: 60, tags: ["ops-public-contracts"] },
);

export async function fetchOpsPublicContracts(
  customerType?: "private" | "company" | null,
): Promise<OpsPublicContract[]> {
  return fetchCachedOpsPublicContracts(customerType ?? "");
}

export async function fetchOpsPublicContractsFresh(
  customerType?: "private" | "company" | null,
): Promise<OpsPublicContract[]> {
  return fetchOpsPublicContractsUncached(customerType);
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

function mapPricePlan(row: unknown): OpsPricePlan | null {
  if (!row || typeof row !== "object") return null;
  const mapped = mapPublicContract(row);
  if (!mapped) return null;
  const r = row as Record<string, unknown>;
  if (!mapped.price_plan_id || !mapped.price_plan_version_id || !mapped.product_code) return null;
  return {
    price_plan_id: mapped.price_plan_id,
    price_plan_version_id: mapped.price_plan_version_id,
    product_code: mapped.product_code,
    name: mapped.name,
    type: mapped.type,
    status: pickString(r, ["status", "version_status"]),
    is_public: mapped.is_public,
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

/** @deprecated Use fetchOpsWebsiteLegalBundle. */
export async function fetchOpsLegalTextsCurrent(): Promise<OpsLegalText[]> {
  return (await fetchOpsWebsiteLegalBundle()).texts;
}

export async function fetchOpsPricePlans(): Promise<OpsPricePlan[]> {
  const payload = await opsFetch("/api/v1/website/public-contracts");
  return extractRows(payload)
    .map(mapPricePlan)
    .filter((item): item is OpsPricePlan => item !== null);
}

export async function resolveOpsWebsiteEnergyArea(
  input: OpsWebsiteEnergyResolutionInput,
): Promise<OpsWebsiteEnergyResolution> {
  const payload = await opsFetchWithFallback(
    [
      "/api/v1/website/energy/resolve",
      "/api/v1/website/energy-area/resolve",
      "/api/v1/website/resolve-energy-area",
      "/api/platform/energy/resolve",
    ],
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return mapWebsiteEnergyResolution(payload);
}

export async function fetchOpsWebsiteQuote(
  input: OpsWebsitePricingPreviewInput,
): Promise<OpsWebsitePricingPreview> {
  const payload = await opsFetch("/api/v1/website/quote", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return mapWebsitePricingPreview(payload, input.price_area_code);
}

/** @deprecated Use fetchOpsWebsiteQuote. */
export async function fetchOpsWebsitePricingPreview(
  input: OpsWebsitePricingPreviewInput,
): Promise<OpsWebsitePricingPreview> {
  return fetchOpsWebsiteQuote(input);
}

export type OpsWebsitePricingQuoteValidationInput = {
  quote_token: string;
  offer_reference: string;
  price_area_code: OpsWebsitePriceArea;
  estimated_monthly_kwh: number;
  postal_code: string;
  city: string;
  address: string;
};

export type OpsWebsitePricingQuoteValidationResult = {
  ok: boolean;
  expires_at?: string | null;
  customer_message?: string | null;
};

export async function validateOpsWebsitePricingQuote(
  input: OpsWebsitePricingQuoteValidationInput,
): Promise<OpsWebsitePricingQuoteValidationResult> {
  const payload = await opsFetchWithFallback(
    ["/api/v1/website/pricing/quote/validate"],
    { method: "POST", body: JSON.stringify(input) },
  );
  const row = extractObject(payload);
  return {
    ok: row.ok === true,
    expires_at: pickString(row, ["expires_at", "quote_expires_at", "quoteExpiresAt"]),
    customer_message: pickString(row, ["customer_message", "customerMessage", "message", "error"]),
  };
}

export function buildOpsCustomerApplicationPayload(input: OpsCustomerApplicationInput) {
  const externalCustomerId = normalizeText(input.external_customer_id);
  if (!externalCustomerId) {
    throw new OpsError("Ett stabilt externt kund-ID krävs.", 400, {
      code: "external_customer_id_required",
      field: "external_customer_id",
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
      customer_type: input.customer_type,
      ...(input.first_name ? { first_name: input.first_name } : {}),
      ...(input.last_name ? { last_name: input.last_name } : {}),
      ...(input.company_name ? { company_name: input.company_name } : {}),
      ...(input.personal_number ? { personal_number: input.personal_number } : {}),
      ...(input.organization_number ? { organization_number: input.organization_number } : {}),
      email: input.email,
      phone: input.phone,
    },
    site: {
      ...(input.facility_id ? { facility_id: input.facility_id } : {}),
      ...(input.requested_start_mode === "specific_date" && input.requested_start_date
        ? { move_in_date: input.requested_start_date }
        : {}),
      street: input.address,
      postal_code: input.postal_code,
      city: input.city,
      ...(input.price_area_code ? { price_area_code: input.price_area_code } : {}),
      ...(input.current_supplier_name ? { current_supplier_name: input.current_supplier_name } : {}),
      ...(input.current_supplier_id ? { current_supplier_id: input.current_supplier_id } : {}),
      ...(input.current_supplier_org_number ? { current_supplier_org_number: input.current_supplier_org_number } : {}),
      ...(input.current_supplier_ediel_id ? { current_supplier_ediel_id: input.current_supplier_ediel_id } : {}),
    },
    contract: {
      offer_reference: input.offer_reference,
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

export async function submitOpsCustomerApplication(
  input: OpsCustomerApplicationInput,
): Promise<OpsCustomerApplicationResult> {
  if (env("GRIDEX_ENABLE_LIVE_SIGNUP") !== "true") {
    throw new OpsError("Live-teckning är inte aktiverad för hemsidan.", 503);
  }

  const applicationPayload = buildOpsCustomerApplicationPayload(input);

  const payload = await opsFetchWithFallback(
    ["/api/v1/website/customer-applications"],
    {
      method: "POST",
      headers: { "Idempotency-Key": input.idempotency_key },
      body: JSON.stringify(applicationPayload),
    },
  );

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
