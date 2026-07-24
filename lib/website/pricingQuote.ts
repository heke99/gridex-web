import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { OpsPublicContract } from "@/lib/ops/client";
import type {
  WebsitePricingPreview,
  WebsitePriceArea,
  WebsiteQuoteAssumption,
  WebsiteQuoteMarketSource,
} from "@/lib/website/publicApi";

const QUOTE_VERSION = "v3";
const QUOTE_TTL_MS = 20 * 60 * 1000;

type QuoteFees = NonNullable<WebsitePricingPreview["specification"]>["fees"];
type QuoteBasis = NonNullable<WebsitePricingPreview["specification"]>["basis"];

/** Immutable website signature around the exact local pricing snapshot shown to the customer. */
export type WebsitePricingQuote = {
  version: 3;
  issued_at: string;
  expires_at: string;
  valid_until: string;
  location_fingerprint: string;
  pricing_snapshot_reference: string;
  ops_quote_reference: string;
  public_contract_etag: string | null;
  publication_revision: string | null;
  contract_payload_sha256: string | null;
  legal_bundle_version: string | null;
  legal_document_hashes: Record<string, string>;
  contract: {
    offer_reference: string;
    name: string;
    contract_type: WebsitePricingPreview["contract"]["contractType"];
  };
  price_area_code: WebsitePriceArea;
  estimated_monthly_kwh: number;
  annual_consumption_kwh: number;
  price_per_kwh_ore: number;
  total_monthly_cost_sek: number;
  total_monthly_cost_incl_vat_sek: number;
  total_yearly_cost_sek: number | null;
  pricing_interval: string;
  estimate_method: string;
  source_period: string | null;
  source_window: { start: string; end: string } | null;
  market_data_timestamp: string | null;
  is_binding: boolean;
  assumptions: WebsiteQuoteAssumption[];
  market_sources: WebsiteQuoteMarketSource[];
  pricing_snapshot_schema_version: string;
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
function quoteSecret(): string | null { return env("GRIDEX_WEBSITE_PRICING_QUOTE_SECRET"); }
export function websitePricingQuoteConfigured(): boolean { return Boolean(quoteSecret()); }
function base64url(value: string): string { return Buffer.from(value).toString("base64url"); }
function fromBase64url(value: string): string | null {
  try { return Buffer.from(value, "base64url").toString("utf8"); } catch { return null; }
}
function hmac(value: string, secret: string): string { return createHmac("sha256", secret).update(value).digest("base64url"); }
function equalSignature(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("sv-SE");
}
export function pricingLocationFingerprint(input: { postalCode: string; city: string; address: string }): string | null {
  const secret = quoteSecret();
  if (!secret) return null;
  return hmac(`location:${[normalized(input.postalCode).replace(/\s/g, ""), normalized(input.city), normalized(input.address)].join("|")}`, secret);
}
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function text(value: unknown): value is string { return typeof value === "string" && Boolean(value.trim()); }
function validArea(value: unknown): value is WebsitePriceArea { return value === "SE1" || value === "SE2" || value === "SE3" || value === "SE4"; }
function cloneRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
function publicQuoteFees(value: unknown): QuoteFees | undefined {
  const fees = cloneRecord(value)
  if (!fees) return undefined
  delete fees.invoiceFeeSek
  delete fees.invoiceFeeIncludedInMonthlyEstimate
  return fees as QuoteFees
}
function cloneBasis(value: unknown): QuoteBasis | undefined { return cloneRecord(value); }
function validDate(value: unknown): value is string { return text(value) && Number.isFinite(Date.parse(value)); }

function isQuote(value: unknown): value is WebsitePricingQuote {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const q = value as Partial<WebsitePricingQuote>;
  const c = q.contract;
  return q.version === 3 && validDate(q.issued_at) && validDate(q.expires_at) && validDate(q.valid_until) &&
    text(q.location_fingerprint) && text(q.pricing_snapshot_reference) && text(q.ops_quote_reference) && Boolean(c && text(c.offer_reference) && text(c.name) && text(c.contract_type)) &&
    validArea(q.price_area_code) && finite(q.estimated_monthly_kwh) && finite(q.annual_consumption_kwh) &&
    finite(q.price_per_kwh_ore) && finite(q.total_monthly_cost_sek) && finite(q.total_monthly_cost_incl_vat_sek) &&
    text(q.pricing_interval) && text(q.estimate_method) && typeof q.is_binding === "boolean" &&
    Array.isArray(q.assumptions) && Array.isArray(q.market_sources) && text(q.pricing_snapshot_schema_version);
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
  const opsValidUntil = input.preview.valid_until;
  const required = input.preview.ops_quote_reference && input.preview.pricing_interval && input.preview.estimate_method &&
    input.preview.pricing_snapshot_schema_version && validDate(opsValidUntil) && typeof input.preview.is_binding === "boolean";
  if (!secret || !locationFingerprint || !validArea(area) || !required || !finite(input.preview.kwh) ||
      !finite(input.preview.annual_consumption_kwh) || !finite(input.preview.pricePerKwhOre) ||
      !finite(input.preview.totalMonthlyCostSek) || !finite(input.preview.totalMonthlyCostInclVatSek)) return null;

  const pricingSnapshotReference = input.preview.pricing_snapshot_reference ?? `wps_${createHash("sha256").update([input.contract.offer_reference, area, String(input.preview.kwh), now.toISOString()].join("|")).digest("hex").slice(0, 24)}`;
  const pricingInterval = input.preview.pricing_interval as string;
  const estimateMethod = input.preview.estimate_method as string;
  const isBinding = input.preview.is_binding as boolean;
  const schemaVersion = input.preview.pricing_snapshot_schema_version as string;
  const validUntil = opsValidUntil as string;
  const localExpiry = now.getTime() + QUOTE_TTL_MS;
  const opsExpiry = Date.parse(validUntil);
  const quote: WebsitePricingQuote = {
    version: 3,
    issued_at: now.toISOString(),
    expires_at: new Date(Math.min(localExpiry, opsExpiry)).toISOString(),
    valid_until: validUntil,
    location_fingerprint: locationFingerprint,
    pricing_snapshot_reference: pricingSnapshotReference,
    ops_quote_reference: input.preview.ops_quote_reference as string,
    public_contract_etag: input.preview.public_contract_etag ?? null,
    publication_revision: input.preview.publication_revision ?? null,
    contract_payload_sha256: input.preview.contract_payload_sha256 ?? null,
    legal_bundle_version: input.preview.legal_bundle_version ?? null,
    legal_document_hashes: input.preview.legal_document_hashes ?? {},
    contract: { offer_reference: input.contract.offer_reference, name: input.contract.name, contract_type: input.preview.contract.contractType },
    price_area_code: area,
    estimated_monthly_kwh: input.preview.kwh,
    annual_consumption_kwh: input.preview.annual_consumption_kwh,
    price_per_kwh_ore: input.preview.pricePerKwhOre,
    total_monthly_cost_sek: input.preview.totalMonthlyCostSek,
    total_monthly_cost_incl_vat_sek: input.preview.totalMonthlyCostInclVatSek,
    total_yearly_cost_sek: finite(input.preview.totalYearlyCostSek) ? input.preview.totalYearlyCostSek : null,
    pricing_interval: pricingInterval,
    estimate_method: estimateMethod,
    source_period: input.preview.source_period ?? null,
    source_window: input.preview.source_window ?? null,
    market_data_timestamp: input.preview.market_data_timestamp ?? null,
    is_binding: isBinding,
    assumptions: input.preview.assumptions ?? [],
    market_sources: input.preview.market_sources ?? [],
    pricing_snapshot_schema_version: schemaVersion,
    specification: { basis: cloneBasis(input.preview.specification?.basis), fees: publicQuoteFees(input.preview.specification?.fees) },
  };
  const encoded = base64url(JSON.stringify(quote));
  return { token: `${QUOTE_VERSION}.${encoded}.${hmac(`${QUOTE_VERSION}.${encoded}`, secret)}`, quote };
}

export function verifyWebsitePricingQuote(token: string | null | undefined, now = new Date()): PricingQuoteVerification {
  const secret = quoteSecret();
  if (!secret) return { ok: false, reason: "not_configured" };
  if (!token) return { ok: false, reason: "invalid" };
  const [version, payload, signature, ...rest] = token.split(".");
  if (version !== QUOTE_VERSION || !payload || !signature || rest.length || !equalSignature(hmac(`${version}.${payload}`, secret), signature)) return { ok: false, reason: "invalid" };
  const raw = fromBase64url(payload);
  if (!raw) return { ok: false, reason: "invalid" };
  try {
    const quote = JSON.parse(raw) as unknown;
    if (!isQuote(quote)) return { ok: false, reason: "invalid" };
    if (Date.parse(quote.expires_at) <= now.getTime() || Date.parse(quote.valid_until) <= now.getTime()) return { ok: false, reason: "expired" };
    return { ok: true, quote };
  } catch { return { ok: false, reason: "invalid" }; }
}

export function quoteToWebsitePricingPreview(quote: WebsitePricingQuote, token?: string): WebsitePricingPreview {
  return {
    contract: { slug: quote.contract.offer_reference, offer_reference: quote.contract.offer_reference, name: quote.contract.name, contractType: quote.contract.contract_type },
    priceArea: quote.price_area_code,
    price_area_code: quote.price_area_code,
    kwh: quote.estimated_monthly_kwh,
    annual_consumption_kwh: quote.annual_consumption_kwh,
    pricePerKwhOre: quote.price_per_kwh_ore,
    totalMonthlyCostSek: quote.total_monthly_cost_sek,
    totalMonthlyCostInclVatSek: quote.total_monthly_cost_incl_vat_sek,
    totalYearlyCostSek: quote.total_yearly_cost_sek ?? undefined,
    specification: quote.specification,
    pricing_snapshot_reference: quote.pricing_snapshot_reference,
    ops_quote_reference: quote.ops_quote_reference,
    public_contract_etag: quote.public_contract_etag,
    publication_revision: quote.publication_revision,
    contract_payload_sha256: quote.contract_payload_sha256,
    legal_bundle_version: quote.legal_bundle_version,
    legal_document_hashes: quote.legal_document_hashes,
    pricing_interval: quote.pricing_interval,
    estimate_method: quote.estimate_method,
    source_period: quote.source_period ?? undefined,
    source_window: quote.source_window,
    market_data_timestamp: quote.market_data_timestamp ?? undefined,
    is_binding: quote.is_binding,
    assumptions: quote.assumptions,
    market_sources: quote.market_sources,
    pricing_snapshot_schema_version: quote.pricing_snapshot_schema_version,
    valid_until: quote.valid_until,
    pricing_token: token,
    pricing_expires_at: quote.expires_at,
    quote_source: "website",
  };
}

export function validateWebsitePricingQuote(input: {
  token: string | null | undefined;
  pricingSnapshotReference?: string | null;
  contract: OpsPublicContract;
  priceAreaCode: WebsitePriceArea;
  estimatedMonthlyKwh: number;
  annualConsumptionKwh: number;
  location: { postalCode: string; city: string; address: string };
}): { ok: true; quote: WebsitePricingQuote } | { ok: false; reason: string } {
  const verified = verifyWebsitePricingQuote(input.token);
  if (!verified.ok) return { ok: false, reason: verified.reason };
  const { quote } = verified;
  if (quote.contract.offer_reference !== input.contract.offer_reference) return { ok: false, reason: "contract_changed" };
  if (input.pricingSnapshotReference && quote.pricing_snapshot_reference !== input.pricingSnapshotReference) return { ok: false, reason: "quote_changed" };
  if (quote.price_area_code !== input.priceAreaCode) return { ok: false, reason: "area_changed" };
  if (Math.abs(quote.estimated_monthly_kwh - input.estimatedMonthlyKwh) > 0.001) return { ok: false, reason: "kwh_changed" };
  if (Math.abs(quote.annual_consumption_kwh - input.annualConsumptionKwh) > 0.001) return { ok: false, reason: "annual_kwh_changed" };
  const fingerprint = pricingLocationFingerprint(input.location);
  if (!fingerprint || !equalSignature(quote.location_fingerprint, fingerprint)) return { ok: false, reason: "location_changed" };
  return { ok: true, quote };
}
