import { createHmac, timingSafeEqual } from "node:crypto";
import type { OpsPublicContract } from "@/lib/ops/client";
import type {
  WebsitePricingPreview,
  WebsitePriceArea,
} from "@/lib/website/publicApi";

const QUOTE_VERSION = "v1";
const QUOTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type QuoteFees = {
  markupOre?: number;
  variableFeeOre?: number;
  elcertOre?: number;
  monthlyFeeSek?: number;
  invoiceFeeSek?: number;
  invoiceFeeIncludedInMonthlyEstimate?: boolean;
  billingIntervalMonths?: number;
};

type QuoteBasis = NonNullable<WebsitePricingPreview["specification"]>["basis"];

/**
 * Integrity signature for the price displayed by this website. Submission
 * verifies the token and also recalculates the current public price server-side.
 * OPS remains the legal source of truth and creates the final contract snapshot.
 */
export type WebsitePricingQuote = {
  version: 1;
  issued_at: string;
  expires_at: string;
  location_fingerprint: string;
  contract: {
    offer_reference: string;
    name: string;
    contract_type: WebsitePricingPreview["contract"]["contractType"];
  };
  price_area_code: WebsitePriceArea;
  estimated_monthly_kwh: number;
  price_per_kwh_ore: number;
  total_monthly_cost_sek: number;
  total_monthly_cost_incl_vat_sek: number;
  total_yearly_cost_sek: number | null;
  specification: {
    basis?: QuoteBasis;
    fees?: QuoteFees;
  };
};

export type PricingQuoteVerification =
  | { ok: true; quote: WebsitePricingQuote }
  | { ok: false; reason: "invalid" | "expired" | "not_configured" };

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function quoteSecret(): string | null {
  return env("GRIDEX_WEBSITE_PRICING_QUOTE_SECRET");
}

export function websitePricingQuoteConfigured(): boolean {
  return Boolean(quoteSecret());
}

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function fromBase64url(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function hmac(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function equalSignature(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("sv-SE");
}

export function pricingLocationFingerprint(input: {
  postalCode: string;
  city: string;
  address: string;
}): string | null {
  const secret = quoteSecret();
  if (!secret) return null;
  const payload = [
    normalized(input.postalCode).replace(/\s/g, ""),
    normalized(input.city),
    normalized(input.address),
  ].join("|");
  return hmac(`location:${payload}`, secret);
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cloneBasis(value: unknown): QuoteBasis {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const record = value as Record<string, unknown>;
  const type = record.type;

  if (
    type === "previous_month_avg_spot" &&
    typeof record.year === "number" &&
    Number.isFinite(record.year) &&
    typeof record.month === "number" &&
    Number.isFinite(record.month) &&
    typeof record.spotAvgOre === "number" &&
    Number.isFinite(record.spotAvgOre)
  ) {
    const source = record.source;
    return {
      type,
      year: record.year,
      month: record.month,
      spotAvgOre: record.spotAvgOre,
      ...(source === "gridex_monthly_spot_prices" ||
      source === "gridex_spot_monthly_avg" ||
      source === "elprisetjustnu_api"
        ? { source }
        : {}),
    };
  }

  if (
    (type === "admin_fixed_price" || type === "fixed_price") &&
    typeof record.fixedPriceOre === "number" &&
    Number.isFinite(record.fixedPriceOre)
  ) {
    return { type, fixedPriceOre: record.fixedPriceOre };
  }

  if (
    type === "monthly_fixed_price" &&
    typeof record.monthlyFixedPriceSek === "number" &&
    Number.isFinite(record.monthlyFixedPriceSek)
  ) {
    return { type, monthlyFixedPriceSek: record.monthlyFixedPriceSek };
  }

  if (type === "mix") {
    const numberOrUndefined = (key: string) =>
      typeof record[key] === "number" && Number.isFinite(record[key])
        ? record[key]
        : undefined;
    const source =
      typeof record.source === "string"
        ? record.source.slice(0, 120)
        : undefined;
    return {
      type,
      spotShare: numberOrUndefined("spotShare"),
      portfolioShare: numberOrUndefined("portfolioShare"),
      spotPriceOre: numberOrUndefined("spotPriceOre"),
      portfolioPriceOre: numberOrUndefined("portfolioPriceOre"),
      year: numberOrUndefined("year"),
      month: numberOrUndefined("month"),
      ...(source ? { source } : {}),
    };
  }

  return undefined;
}

function cloneFees(value: unknown): QuoteFees | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const source = value as Record<string, unknown>;
  const fees: QuoteFees = {};
  for (const key of [
    "markupOre",
    "variableFeeOre",
    "elcertOre",
    "monthlyFeeSek",
    "invoiceFeeSek",
    "billingIntervalMonths",
  ] as const) {
    const parsed = number(source[key]);
    if (parsed !== null) fees[key] = parsed;
  }
  if (typeof source.invoiceFeeIncludedInMonthlyEstimate === "boolean") {
    fees.invoiceFeeIncludedInMonthlyEstimate =
      source.invoiceFeeIncludedInMonthlyEstimate;
  }
  return Object.keys(fees).length ? fees : undefined;
}

function validArea(value: unknown): value is WebsitePriceArea {
  return (
    value === "SE1" || value === "SE2" || value === "SE3" || value === "SE4"
  );
}

function isQuote(value: unknown): value is WebsitePricingQuote {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const quote = value as Partial<WebsitePricingQuote>;
  const contract = quote.contract;
  return (
    quote.version === 1 &&
    typeof quote.issued_at === "string" &&
    typeof quote.expires_at === "string" &&
    typeof quote.location_fingerprint === "string" &&
    Boolean(
      contract &&
      typeof contract === "object" &&
      contract.offer_reference &&
      contract.name &&
      contract.contract_type,
    ) &&
    validArea(quote.price_area_code) &&
    typeof quote.estimated_monthly_kwh === "number" &&
    Number.isFinite(quote.estimated_monthly_kwh) &&
    typeof quote.price_per_kwh_ore === "number" &&
    Number.isFinite(quote.price_per_kwh_ore) &&
    typeof quote.total_monthly_cost_sek === "number" &&
    Number.isFinite(quote.total_monthly_cost_sek) &&
    typeof quote.total_monthly_cost_incl_vat_sek === "number" &&
    Number.isFinite(quote.total_monthly_cost_incl_vat_sek)
  );
}

export function issueWebsitePricingQuote(input: {
  preview: WebsitePricingPreview;
  contract: OpsPublicContract;
  location: { postalCode: string; city: string; address: string };
  now?: Date;
}): { token: string; quote: WebsitePricingQuote } | null {
  const secret = quoteSecret();
  const locationFingerprint = pricingLocationFingerprint(input.location);
  const now = input.now ?? new Date();
  const area = input.preview.price_area_code ?? input.preview.priceArea;
  const totalMonthlyCostSek = number(input.preview.totalMonthlyCostSek);
  const totalMonthlyCostInclVatSek = number(
    input.preview.totalMonthlyCostInclVatSek,
  );
  const pricePerKwhOre = number(input.preview.pricePerKwhOre);

  if (
    !secret ||
    !locationFingerprint ||
    !validArea(area) ||
    totalMonthlyCostSek === null ||
    totalMonthlyCostInclVatSek === null ||
    pricePerKwhOre === null
  ) {
    return null;
  }

  const quote: WebsitePricingQuote = {
    version: 1,
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + QUOTE_TTL_MS).toISOString(),
    location_fingerprint: locationFingerprint,
    contract: {
      offer_reference: input.contract.offer_reference,
      name: input.contract.name,
      contract_type: input.preview.contract.contractType,
    },
    price_area_code: area,
    estimated_monthly_kwh: input.preview.kwh,
    price_per_kwh_ore: pricePerKwhOre,
    total_monthly_cost_sek: totalMonthlyCostSek,
    total_monthly_cost_incl_vat_sek: totalMonthlyCostInclVatSek,
    total_yearly_cost_sek: number(input.preview.totalYearlyCostSek),
    specification: {
      basis: cloneBasis(input.preview.specification?.basis),
      fees: cloneFees(input.preview.specification?.fees),
    },
  };

  const encoded = base64url(JSON.stringify(quote));
  return {
    token: `${QUOTE_VERSION}.${encoded}.${hmac(`${QUOTE_VERSION}.${encoded}`, secret)}`,
    quote,
  };
}

export function verifyWebsitePricingQuote(
  token: string | null | undefined,
  now = new Date(),
): PricingQuoteVerification {
  const secret = quoteSecret();
  if (!secret) return { ok: false, reason: "not_configured" };
  if (!token) return { ok: false, reason: "invalid" };

  const [version, payload, signature, ...rest] = token.split(".");
  if (
    version !== QUOTE_VERSION ||
    !payload ||
    !signature ||
    rest.length > 0 ||
    !equalSignature(hmac(`${version}.${payload}`, secret), signature)
  ) {
    return { ok: false, reason: "invalid" };
  }

  const raw = fromBase64url(payload);
  if (!raw) return { ok: false, reason: "invalid" };

  try {
    const quote = JSON.parse(raw) as unknown;
    if (!isQuote(quote)) return { ok: false, reason: "invalid" };
    const expiresAt = Date.parse(quote.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime())
      return { ok: false, reason: "expired" };
    return { ok: true, quote };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function quoteToWebsitePricingPreview(
  quote: WebsitePricingQuote,
  token?: string,
): WebsitePricingPreview {
  return {
    contract: {
      slug: quote.contract.offer_reference,
      offer_reference: quote.contract.offer_reference,
      name: quote.contract.name,
      contractType: quote.contract.contract_type,
    },
    priceArea: quote.price_area_code,
    price_area_code: quote.price_area_code,
    kwh: quote.estimated_monthly_kwh,
    pricePerKwhOre: quote.price_per_kwh_ore,
    totalMonthlyCostSek: quote.total_monthly_cost_sek,
    totalMonthlyCostInclVatSek: quote.total_monthly_cost_incl_vat_sek,
    totalYearlyCostSek: quote.total_yearly_cost_sek ?? undefined,
    specification: quote.specification,
    quote_token: token,
    quote_expires_at: quote.expires_at,
    quote_source: "website",
  };
}

export function validateWebsitePricingQuote(input: {
  token: string | null | undefined;
  contract: OpsPublicContract;
  priceAreaCode: WebsitePriceArea;
  estimatedMonthlyKwh: number;
  location: { postalCode: string; city: string; address: string };
}): { ok: true; quote: WebsitePricingQuote } | { ok: false; reason: string } {
  const verified = verifyWebsitePricingQuote(input.token);
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const { quote } = verified;
  if (quote.contract.offer_reference !== input.contract.offer_reference) {
    return { ok: false, reason: "contract_changed" };
  }

  if (quote.price_area_code !== input.priceAreaCode)
    return { ok: false, reason: "area_changed" };
  if (Math.abs(quote.estimated_monthly_kwh - input.estimatedMonthlyKwh) > 0.001)
    return { ok: false, reason: "kwh_changed" };

  const fingerprint = pricingLocationFingerprint(input.location);
  if (
    !fingerprint ||
    !equalSignature(quote.location_fingerprint, fingerprint)
  ) {
    return { ok: false, reason: "location_changed" };
  }

  return { ok: true, quote };
}
