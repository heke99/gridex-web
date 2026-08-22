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

import type { OpsPublicContract, OpsAuthorizationProbeResult, OpsPublicContractDiagnostic, OpsWebsitePriceArea, OpsWebsiteQuoteInput, OpsInvoiceDeliveryMethod, OpsWebsiteQuoteSettlement, OpsQuoteAssumption, OpsQuoteMarketSource, OpsQuoteMarketReference, OpsWebsitePricingPreview, OpsClientStatus, OpsIntegrationContext, OpsPublicContractIssue, OpsBlockedPublicContract, OpsPublicContractFeedState, OpsEmptyFeedAuthorizationReason, OpsEmptyFeedAuthorization, OpsPublicContractsSnapshot } from './types'
import { opsErrorCodeValue } from './portal'

export function opsBaseUrl(): string {
  return getOpsApiBaseUrl()
}

export function opsOrganizationCacheKey(): string {
  const baseUrl = opsBaseUrl()
  const apiKey = getOpsApiKey().value ?? "missing-api-key";
  return createHash("sha256").update(`${baseUrl}|${apiKey}`).digest("hex").slice(0, 24);
}

export function organizationReferenceFromPayload(payload: unknown): string | null {
  const root = recordValue(payload);
  const data = recordValue(root?.data);
  const meta = recordValue(root?.meta) ?? recordValue(data?.meta);
  const context = recordValue(root?.context) ?? recordValue(data?.context);
  return pickFromRecords([meta, context, data, root], ["organization_reference", "organizationReference"]);
}

export function assertOrganizationReference(actual: string | null, source: string): string {
  if (!actual) {
    throw new OpsError("OPS kunde inte verifiera organisationsbindningen från API-nyckeln.", 503, {
      code: "ops_organization_binding_unverified",
      source,
    });
  }
  return actual;
}

export function getOpsClientStatus(): OpsClientStatus {
  return getOpsTransportStatus()
}

export function normalizeNumber(value: unknown): number | null {
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

export function normalizeInteger(value: unknown): number | null {
  const normalized = normalizeNumber(value)
  return normalized !== null && Number.isSafeInteger(normalized) ? normalized : null
}

export function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}


export function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function pickFromRecords(
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

export function pickBooleanFromRecords(
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

export function amountFromObject(value: unknown): number | null {
  const row = recordValue(value);
  if (!row) return normalizeNumber(value);
  return normalizeNumber(row.amount ?? row.value ?? row.price ?? row.rate);
}

export function pickString(
  row: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const picked = normalizeText(row[key]);
    if (picked) return picked;
  }
  return null;
}

export function pickBoolean(
  row: Record<string, unknown>,
  keys: string[],
): boolean | null {
  for (const key of keys) {
    if (typeof row[key] === "boolean") return row[key] as boolean;
  }
  return null;
}

export type NormalizedOpsPriceComponents = {
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

export const COMPONENT_ARRAY_KEYS = [
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

export function toSearchText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function collectComponentRows(
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

export function classifyComponent(
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

export const COMPONENT_AREA_KEYS = [
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

export function hasExplicitComponentPriceArea(row: Record<string, unknown>): boolean {
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

export function pickComponentNumber(row: Record<string, unknown>): number | null {
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

export function extractOpsPriceComponents(
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

export function coalesceNumber(
  ...values: Array<number | null | undefined>
): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export function mapPublicContract(row: unknown): OpsPublicContract | null {
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

  return null;
}

export function extractRows(payload: unknown): unknown[] {
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

export async function opsRequest(
  path: string,
  init?: RequestInit,
  options: OpsRequestOptions = {},
): Promise<OpsHttpResponse> {
  return transportOpsRequest(path, init, options)
}

export function jsonRequestBody(init?: RequestInit): unknown {
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

export function schemaValidationIssues(error: unknown): Array<{
  path: string
  keyword: string
  message: string | null
  additional_property: string | null
}> {
  if (!(error instanceof OpsSchemaError)) return []
  const details = recordValue(error.details)
  const errors = Array.isArray(details?.errors) ? details.errors : []
  return errors.flatMap((item) => {
    const row = recordValue(item)
    if (!row) return []
    const params = recordValue(row.params)
    return [{
      path: normalizeText(row.instancePath) ?? '/',
      keyword: normalizeText(row.keyword) ?? 'unknown',
      message: normalizeText(row.message),
      additional_property: normalizeText(params?.additionalProperty),
    }]
  })
}

export function observeRuntimeSchemaValidation(input: {
  endpoint: string
  schema: string
  validate: () => void
}): void {
  try {
    input.validate()
  } catch (error) {
    if (isCompatibleAdditiveResponseSchemaError(error)) {
      console.warn('[gridex-openapi] compatible additive response fields detected', {
        endpoint: input.endpoint,
        schema: input.schema,
        code: isOpsError(error) ? error.code : null,
        request_id: isOpsError(error) ? error.requestId : null,
        correlation_id: isOpsError(error) ? error.correlationId : null,
        issues: schemaValidationIssues(error),
      })
      return
    }
    throw error
  }
}

export async function opsFetch(path: string, init?: RequestInit): Promise<unknown> {
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

export function extractObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return {};
  const p = payload as Record<string, unknown>;
  const data = p.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return p;
}

export function isOpsWebsitePriceArea(value: unknown): value is OpsWebsitePriceArea {
  return (
    typeof value === "string" && ["SE1", "SE2", "SE3", "SE4"].includes(value)
  );
}

export function pickStringArray(
  row: Record<string, unknown>,
  keys: string[],
): string[] | undefined {
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
  }
  return undefined;
}

export function normalizePreviewContractType(
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

export function normalizeQuoteAssumptions(value: unknown): OpsQuoteAssumption[] {
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

export function normalizeQuoteMarketSources(value: unknown): OpsQuoteMarketSource[] {
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

export function quoteSourcePeriod(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  const row = recordValue(value);
  if (!row) return null;
  const label = pickString(row, ["label", "period", "name"]);
  if (label) return label;
  const start = pickString(row, ["start", "from", "period_start", "periodStart"]);
  const end = pickString(row, ["end", "to", "period_end", "periodEnd"]);
  return start && end ? `${start}–${end}` : start ?? end;
}

export function quoteSourceWindow(value: unknown): { start: string; end: string } | null {
  const row = recordValue(value);
  if (!row) return null;
  const start = pickString(row, ["start", "from", "period_start", "periodStart"]);
  const end = pickString(row, ["end", "to", "period_end", "periodEnd"]);
  return start && end ? { start, end } : null;
}

export function normalizeWebsitePricingSpecification(
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

export function normalizeCustomerTypeFilter(value?: string | null): WebsiteCustomerType | null {
  return value === "private" || value === "business" ? value : null;
}

export function extractQuoteRow(payload: unknown): Record<string, unknown> {
  const root = extractObject(payload);
  const quote = recordValue(root.quote) ?? recordValue(root.pricing_quote) ?? root;
  return quote;
}

export function quoteNumber(row: Record<string, unknown>, paths: string[][]): number | null {
  for (const path of paths) {
    let current: unknown = row;
    for (const key of path) current = recordValue(current)?.[key];
    const value = normalizeNumber(current);
    if (value !== null) return value;
  }
  return null;
}

export function normalizeQuoteMarketReference(value: unknown): OpsQuoteMarketReference | null {
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

export function mapOpsWebsiteQuote(payload: unknown, input: OpsWebsiteQuoteInput): OpsWebsitePricingPreview {
  const row = extractQuoteRow(payload);
  const contract = recordValue(row.contract) ?? recordValue(row.offer) ?? {};
  const totals = recordValue(row.totals) ?? recordValue(row.total) ?? {};
  const estimate = recordValue(row.estimate) ?? {};
  const selectedAreaPrice = recordValue(row.selected_area_price ?? row.selectedAreaPrice) ?? {};
  const quoteInput = recordValue(row.input) ?? recordValue(row.request) ?? {};
  const marketReferenceRow = recordValue(row.market_reference ?? row.marketReference) ?? {};
  const quoteReference = pickString(row, ['quote_reference', 'quoteReference', 'reference']);
  const offerReference = pickString(row, ['offer_reference']);
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
  const annualKwh = quoteNumber(quoteInput, [['annual_consumption_kwh']]);
  const monthlyKwh = quoteNumber(row, [['estimated_monthly_kwh'], ['monthly_kwh'], ['consumption', 'estimated_monthly_kwh']])
    ?? (annualKwh !== null ? annualToMonthlyKwh(annualKwh) : null);
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
  const resolutionId = pickString(quoteInput, ['resolution_id']);
  const startDate = pickString(quoteInput, ['start_date']);
  const priceOptionReference = pickString(row, ['price_option_reference']);
  const areaPriceReference = pickString(row, ['area_price_reference']);
  const invoiceDeliveryMethod = pickString(row, ['invoice_delivery_method']);
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
  const selectedComponentReferences = pickStringArray(row, ['selected_component_references']);
  const mandatoryComponentReferences = pickStringArray(row, ['mandatory_component_references']);
  const conditionalComponentReferences = pickStringArray(row, ['conditional_component_references']);
  const siteCount = normalizeInteger(row.site_count);
  const settlement = recordValue(row.settlement) as OpsWebsiteQuoteSettlement | null;
  const validUntilTimestamp = validUntil ? Date.parse(validUntil) : Number.NaN
  if (
    !quoteReference ||
    !offerReference ||
    !validUntil ||
    !Number.isFinite(validUntilTimestamp) ||
    !Object.hasOwn(row, 'price_option_reference') ||
    !Object.hasOwn(row, 'area_price_reference') ||
    !normalizedInvoiceDeliveryMethod ||
    !settlement ||
    !resolutionId ||
    !startDate ||
    !isOpsWebsitePriceArea(area) ||
    annualKwh === null ||
    !selectedComponentReferences ||
    !mandatoryComponentReferences ||
    !conditionalComponentReferences ||
    siteCount === null ||
    !Number.isInteger(siteCount) ||
    siteCount < 1
  ) {
    throw new OpsError('OPS returnerade en ofullständig canonical quote.', 502, {
      code: 'ops_quote_contract_invalid',
      quote_reference: quoteReference,
      offer_reference: offerReference,
      price_area_code: area,
      resolution_id: resolutionId,
      start_date: startDate,
    });
  }
  if (monthlyKwh === null || pricePerKwh === null || monthlyExVat === null || monthlyIncVat === null) {
    throw new OpsError('OPS-offerten saknar presenterbar prisberäkning.', 502, {
      code: 'ops_quote_presentation_incomplete',
      quote_reference: quoteReference,
      missing: {
        estimated_monthly_kwh: monthlyKwh === null,
        price_per_kwh_ore: pricePerKwh === null,
        monthly_ex_vat: monthlyExVat === null,
        monthly_inc_vat: monthlyIncVat === null,
      },
    })
  }
  if (
    offerReference !== input.offer_reference ||
    resolutionId !== input.resolution_id ||
    startDate !== input.start_date ||
    annualKwh !== input.annual_consumption_kwh ||
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
    requested_start_mode: input.requested_start_mode,
    customer_type: input.customer_type,
    contract: {
      slug: offerReference,
      offer_reference: offerReference,
      contract_reference: pickString(row, ['contract_reference', 'contractReference']) ?? pickString(contract, ['contract_reference', 'contractReference']),
      product_code: pickString(row, ['product_code', 'productCode']) ?? pickString(contract, ['product_code', 'productCode']),
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
    settlement,
    assumptions: normalizeQuoteAssumptions(row.assumptions),
    market_sources: marketSources,
    market_reference: marketReference,
    pricing_snapshot_schema_version: pickString(row, ['pricing_snapshot_schema_version', 'schema_version', 'schemaVersion']) ?? GRIDEX_WEBSITE_API_CONTRACT_VERSION,
    valid_until: validUntil,
    price_option_reference: priceOptionReference,
    area_price_reference: areaPriceReference,
    invoice_delivery_method: normalizedInvoiceDeliveryMethod,
    selected_component_references: selectedComponentReferences,
    mandatory_component_references: mandatoryComponentReferences,
    conditional_component_references: conditionalComponentReferences,
    site_count: siteCount,
    raw: row,
  };
}

export function publicContractsPath(
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

export function diagnosticBlockers(value: unknown): string[] {
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

export function mapPublicContractDiagnostic(
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

export function extractPublicContractDiagnostics(payload: unknown): OpsPublicContractDiagnostic[] {
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

export let integrationContextCache: {
  key: string;
  expiresAt: number;
  value: OpsIntegrationContext;
} | null = null;

export function integrationContextFromPayload(payload: unknown): OpsIntegrationContext {
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
  const organizationReference = pickFromRecords(
    [context, meta, data, root],
    ['organization_reference', 'organizationReference'],
  )
  const verifiedOrganizationReference = assertOrganizationReference(
    organizationReference,
    '/api/v1/integration/context',
  )
  const contractVersion =
    pickFromRecords([context, meta, data, root], ['contract_version', 'contractVersion'])
  const requiredEnvironmentVariables =
    pickStringArray(configuration, ['required_environment_variables', 'requiredEnvironmentVariables']) ?? []
  const websiteMissing =
    pickStringArray(capabilities, [
      'missing_website_scopes',
      'missingWebsiteScopes',
      'missing_website_scopes',
      'missingWebsiteScopes',
    ]) ?? []
  const portalMissing =
    pickStringArray(capabilities, ['missing_customer_portal_scopes', 'missingCustomerPortalScopes']) ?? []
  const completeMissing =
    pickStringArray(capabilities, ['missing_complete_tenant_website_scopes', 'missingCompleteTenantWebsiteScopes']) ??
    [...new Set([...websiteMissing, ...portalMissing])]
  const recommendedMissing =
    pickStringArray(capabilities, ['missing_recommended_scopes', 'missingRecommendedScopes', 'missing_recommended_scopes', 'missingRecommendedScopes']) ?? []
  const requiredWebsiteScopes =
    pickStringArray(capabilities, ['required_website_scopes', 'requiredWebsiteScopes', 'required_website_scopes', 'requiredWebsiteScopes']) ?? []
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
  const value: OpsIntegrationContext = {
    organization_reference: verifiedOrganizationReference,
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
      openapi_url: websiteOpenapiUrl ?? '',
      customer_portal_openapi_url: customerPortalOpenapiUrl ?? '',
    },
    capabilities: {
      website_checkout_ready:
        pickBoolean(capabilities, ['website_checkout_ready', 'websiteCheckoutReady']) ?? websiteMissing.length === 0,
      customer_portal_ready:
        pickBoolean(capabilities, ['customer_portal_ready', 'customerPortalReady']) ?? portalMissing.length === 0,
      complete_integration_ready:
        pickBoolean(capabilities, ['complete_integration_ready', 'completeIntegrationReady']) ?? completeMissing.length === 0,
      missing_website_scopes: websiteMissing,
      missing_customer_portal_scopes: portalMissing,
      missing_recommended_scopes: recommendedMissing,
      required_website_scopes: requiredWebsiteScopes,
      required_customer_portal_scopes: requiredPortalScopes,
    },
    raw: root,
  }
  const integrationWarnings: Array<Record<string, unknown>> = []
  if (!contractVersion) {
    throw new OpsError('OPS integration context saknar canonical kontraktsversion.', 502, {
      code: 'ops_integration_contract_version_missing',
      endpoint: '/api/v1/integration/context',
      retryable: false,
    })
  }
  if (contractVersion !== GRIDEX_WEBSITE_API_CONTRACT_VERSION) {
    throw new OpsError('OPS integration context använder en annan kontraktsversion än Gridex Web.', 502, {
      code: 'ops_integration_contract_version_mismatch',
      expected: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
      received: contractVersion,
      endpoint: '/api/v1/integration/context',
      retryable: false,
    })
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
  const key = opsOrganizationCacheKey();
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

export async function verifiedOrganizationReference(payload: unknown, source: string): Promise<string> {
  const context = await getVerifiedOpsIntegrationContext();
  const direct = organizationReferenceFromPayload(payload);
  if (direct && direct !== context.organization_reference) {
    throw new OpsError("OPS-svaret tillhör fel organisation.", 503, {
      code: "ops_organization_mismatch",
      expected_organization_reference: context.organization_reference,
      actual_organization_reference: direct,
      source,
    });
  }
  return context.organization_reference;
}

export function publicationRevisionFromPayload(payload: unknown): number | null {
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

export function contractVersionFromPayload(payload: unknown): string | null {
  const root = recordValue(payload)
  const data = recordValue(root?.data)
  const meta = recordValue(root?.meta) ?? recordValue(data?.meta)
  return pickFromRecords(
    [meta, data, root],
    ['contract_schema_version', 'contractSchemaVersion', 'contract_version', 'contractVersion'],
  )
}

export const EMPTY_FEED_AUTHORIZATION_REASONS = new Set<OpsEmptyFeedAuthorizationReason>([
  'no_canonical_publications',
  'canonical_unpublished_or_archived',
  'publication_validity_ended',
  'canonical_no_visible_contracts',
])
export const EMPTY_FEED_AUTHORIZATION_KEYS = new Set([
  'authorized',
  'reason',
  'publication_revision',
  'canonical_source',
  'affected_offer_references',
  'blockers',
])

export function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null
  return [...value] as string[]
}

export function publicContractFeedMetadata(payload: unknown, publicationRevision: number): {
  feedState: OpsPublicContractFeedState
  emptyFeedAuthorization: OpsEmptyFeedAuthorization | null
  upstreamCount: number
} {
  const root = recordValue(payload)
  const meta = recordValue(root?.meta)
  const rows = Array.isArray(root?.data) ? root.data : null
  if (!root || !meta || !rows) {
    throw new OpsError('OPS public-contracts saknar canonical data/meta.', 502, {
      code: 'ops_public_contracts_feed_metadata_invalid',
      endpoint: '/api/v1/website/public-contracts',
      retryable: false,
    })
  }

  if (meta.channel !== 'website' || meta.api_version !== 'v1') {
    throw new OpsError('OPS public-contracts meta beskriver fel kanal eller API-version.', 502, {
      code: 'ops_public_contracts_meta_context_invalid',
      endpoint: '/api/v1/website/public-contracts',
      channel: meta.channel ?? null,
      api_version: meta.api_version ?? null,
      retryable: false,
    })
  }

  const declaredCount = normalizeInteger(meta.count)
  if (declaredCount === null || declaredCount < 0 || declaredCount !== rows.length) {
    throw new OpsError('OPS public-contracts meta.count matchar inte data.', 502, {
      code: 'ops_public_contracts_count_mismatch',
      endpoint: '/api/v1/website/public-contracts',
      declared_count: declaredCount,
      actual_count: rows.length,
      retryable: false,
    })
  }
  if (!Array.isArray(root.contracts) || canonicalSha256(root.contracts) !== canonicalSha256(rows)) {
    throw new OpsError('OPS public-contracts compatibility-aliasen contracts matchar inte data.', 502, {
      code: 'ops_public_contracts_alias_mismatch',
      endpoint: '/api/v1/website/public-contracts',
      retryable: false,
    })
  }

  const feedState = meta.feed_state
  if (feedState !== 'contracts_present' && feedState !== 'canonical_empty') {
    throw new OpsError('OPS public-contracts saknar giltigt feed_state.', 502, {
      code: 'ops_public_contracts_feed_state_invalid',
      endpoint: '/api/v1/website/public-contracts',
      retryable: false,
    })
  }

  if (feedState === 'contracts_present') {
    if (rows.length === 0 || meta.empty_feed_authorization !== null) {
      throw new OpsError('OPS public-contracts contracts_present saknar avtal eller innehåller tomfeedbevis.', 502, {
        code: 'ops_public_contracts_feed_state_mismatch',
        endpoint: '/api/v1/website/public-contracts',
        feed_state: feedState,
        upstream_count: rows.length,
        retryable: false,
      })
    }
    return { feedState, emptyFeedAuthorization: null, upstreamCount: rows.length }
  }

  if (rows.length !== 0) {
    throw new OpsError('OPS public-contracts canonical_empty innehåller avtal.', 502, {
      code: 'ops_public_contracts_feed_state_mismatch',
      endpoint: '/api/v1/website/public-contracts',
      feed_state: feedState,
      upstream_count: rows.length,
      retryable: false,
    })
  }

  const authorization = recordValue(meta.empty_feed_authorization)
  const reason = authorization?.reason
  const affected = stringArray(authorization?.affected_offer_references)
  const blockers = stringArray(authorization?.blockers)
  const authorizationRevision = normalizeInteger(authorization?.publication_revision)
  const extraKeys = authorization
    ? Object.keys(authorization).filter((key) => !EMPTY_FEED_AUTHORIZATION_KEYS.has(key))
    : ['missing']
  if (
    !authorization ||
    authorization.authorized !== true ||
    typeof reason !== 'string' ||
    !EMPTY_FEED_AUTHORIZATION_REASONS.has(reason as OpsEmptyFeedAuthorizationReason) ||
    authorizationRevision !== publicationRevision ||
    authorization.canonical_source !== 'canonical_public_contract_delivery_readiness_v' ||
    affected === null ||
    blockers === null ||
    extraKeys.length > 0
  ) {
    throw new OpsError('OPS public-contracts canonical_empty saknar giltigt empty_feed_authorization.', 502, {
      code: 'ops_public_contracts_empty_authorization_invalid',
      endpoint: '/api/v1/website/public-contracts',
      response_publication_revision: publicationRevision,
      authorization_publication_revision: authorizationRevision,
      retryable: false,
    })
  }

  return {
    feedState,
    emptyFeedAuthorization: {
      authorized: true,
      reason: reason as OpsEmptyFeedAuthorizationReason,
      publication_revision: authorizationRevision,
      canonical_source: 'canonical_public_contract_delivery_readiness_v',
      affected_offer_references: affected,
      blockers,
    },
    upstreamCount: 0,
  }
}

export type PublicContractsCacheEntry = OpsPublicContractsSnapshot & { cache_key: string };
export const publicContractsCache = new Map<string, PublicContractsCacheEntry>();
export const WEBSITE_OPENAPI_SCHEMA_SHA256 = GRIDEX_WEBSITE_OPENAPI_SHA256

export function publicContractsCacheKey(customerType?: WebsiteCustomerType | null): string {
  return [
    opsOrganizationCacheKey(),
    'website',
    'public-contracts',
    GRIDEX_WEBSITE_API_CONTRACT_VERSION,
    customerType ? toOpsCustomerType(customerType) : 'all',
  ].join('|');
}

export function publicContractReference(value: unknown): string | null {
  const row = recordValue(value)
  return row ? pickString(row, ['offer_reference', 'offerReference']) : null
}

export function publicContractParseReasons(value: unknown): string[] {
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

export function normalizePublicContractCompatibility(
  value: unknown,
  basePath: string,
): { value: unknown; issues: ContractValidationIssue[] } {
  const row = recordValue(value)
  if (!row || !Array.isArray(row.price_options)) return { value, issues: [] }

  const issues: ContractValidationIssue[] = []
  let changed = false
  const priceOptions = row.price_options.map((option, index) => {
    const optionRow = recordValue(option)
    if (!optionRow) return option

    const canonicalDefault = optionRow.is_default
    const deprecatedDefault = optionRow.default
    if (typeof canonicalDefault !== 'boolean' && typeof deprecatedDefault === 'boolean') {
      changed = true
      issues.push(contractIssue({
        code: 'deprecated_default_alias_used',
        path: `${basePath}.price_options[${index}].is_default`,
        severity: 'compatibility',
        source: 'normalization',
        detail: 'Canonical is_default was restored from the documented deprecated default alias.',
      }))
      return { ...optionRow, is_default: deprecatedDefault }
    }

    return option
  })

  return changed
    ? { value: { ...row, price_options: priceOptions }, issues }
    : { value, issues }
}

export function parseOpsPublicContractsPayload(payload: unknown): {
  contracts: OpsPublicContract[]
  blockedContracts: OpsBlockedPublicContract[]
  warnings: OpsPublicContractIssue[]
  compatibilityIssues: OpsPublicContractIssue[]
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
  const warnings: OpsPublicContractIssue[] = []
  const compatibilityIssues: OpsPublicContractIssue[] = []

  rows.forEach((rawRow, index) => {
    const basePath = `data[${index}]`
    const normalized = normalizePublicContractCompatibility(rawRow, basePath)
    const row = normalized.value
    const offerReference = publicContractReference(row)
    const openApi = validateOpenApiSchema('website', 'PublicContract', row)
    const semanticIssues = publicContractValidationIssues(row, basePath)
    const structuralIssues = openApi.errors.map((issue) => classifyOpenApiIssue({
      issue,
      root: row,
      basePath,
    }))
    const issues = [...normalized.issues, ...semanticIssues, ...structuralIssues]
    const mapped = mapPublicContract(row)
    if (!mapped) {
      issues.push(contractIssue({
        code: 'public_contract_normalization_failed',
        path: basePath,
        severity: 'blocking',
        source: 'normalization',
      }))
    }

    // OPS serializes the canonical public DTO and validates it against the same
    // checked-in OpenAPI contract before returning 200. Gridex Web may add
    // presentation/readiness warnings, but a duplicate semantic policy must
    // not turn an otherwise structurally valid, normalizable canonical DTO
    // into a tenant-wide outage. Fatal, structural and normalization failures
    // remain fail-closed.
    const canonicalDtoAccepted =
      mapped !== null &&
      !structuralIssues.some(isBlockingContractIssue) &&
      !normalized.issues.some(isBlockingContractIssue)
    const effectiveIssues = issues.map((issue) => (
      canonicalDtoAccepted &&
      issue.source === 'semantic' &&
      issue.severity === 'blocking'
        ? {
            ...issue,
            severity: 'warning' as const,
            detail: issue.detail
              ? `${issue.detail}; canonical OPS DTO accepted`
              : 'canonical OPS DTO accepted',
          }
        : issue
    ))

    for (const issue of effectiveIssues) {
      const withOffer = { ...issue, offer_reference: offerReference }
      if (issue.severity === 'compatibility') compatibilityIssues.push(withOffer)
      else if (issue.severity === 'warning') warnings.push(withOffer)
    }

    const blockingIssues = effectiveIssues.filter(isBlockingContractIssue)
    if (mapped && blockingIssues.length === 0) {
      contracts.push(mapped)
      return
    }

    blockedContracts.push({
      offer_reference: offerReference,
      reasons: [...new Set((blockingIssues.length
        ? blockingIssues.map((issue) => issue.code)
        : publicContractParseReasons(row)))],
      issues: effectiveIssues,
    })
  })

  contracts.sort((a, b) => {
    const sa = a.sort_order ?? 10_000
    const sb = b.sort_order ?? 10_000
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name, 'sv')
  })
  return { contracts, blockedContracts, warnings, compatibilityIssues }
}

export function invalidateOpsPublicContractsCache(input?: {
  organizationReference?: string | null;
  channel?: string | null;
  publicationRevision?: number | null;
}): void {
  if (input?.channel && input.channel !== "website") return;
  if (input?.organizationReference) {
    for (const [key, value] of publicContractsCache.entries()) {
      if (value.organization_reference === input.organizationReference) publicContractsCache.delete(key);
    }
    return;
  }
  publicContractsCache.clear();
}