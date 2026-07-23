import { NextResponse } from "next/server";
import {
  fetchOpsPublicContracts,
  getOpsClientStatus,
  isOpsError,
  type OpsWebsitePriceArea,
} from "@/lib/ops/client";
import {
  issueWebsitePricingQuote,
  quoteToWebsitePricingPreview,
  websitePricingQuoteConfigured,
} from "@/lib/website/pricingQuote";
import {
  loadVerifiedWebsitePricingPreview,
  websitePricingPreviewSource,
  WebsitePricingPreviewError,
} from "@/lib/website/pricingPreview";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/security/rateLimit";
import { buildPublicContractDisplay } from "@/lib/website/publicContractDisplay";
import { parseWebsiteCustomerType } from "@/lib/website/customerType";
import { resolveWebsitePriceAreaForPricing } from "@/lib/website/priceAreaResolver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AREAS = new Set<OpsWebsitePriceArea>(["SE1", "SE2", "SE3", "SE4"]);

type PreviewPayload = {
  offer_reference?: unknown;
  offerReference?: unknown;
  price_area_code?: unknown;
  priceAreaCode?: unknown;
  priceArea?: unknown;
  postal_code?: unknown;
  postalCode?: unknown;
  city?: unknown;
  address?: unknown;
  estimated_monthly_kwh?: unknown;
  annual_consumption_kwh?: unknown;
  annualConsumptionKwh?: unknown;
  grid_area_code?: unknown;
  gridAreaCode?: unknown;
  metering_point_id?: unknown;
  meteringPointId?: unknown;
  estimatedMonthlyKwh?: unknown;
  kwh?: unknown;
  start_date?: unknown;
  startDate?: unknown;
  customer_type?: unknown;
  customerType?: unknown;
};

function text(value: unknown, max = 180): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

function requiredConsumption(value: unknown, max = 2_400_000): number | null {
  const parsed = Number(
    typeof value === "string" ? value.replace(",", ".") : value,
  );
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > max) return null;
  return parsed;
}

function priceArea(value: unknown): OpsWebsitePriceArea | null {
  const area = typeof value === "string" ? value.toUpperCase() : "";
  return AREAS.has(area as OpsWebsitePriceArea)
    ? (area as OpsWebsitePriceArea)
    : null;
}

export async function POST(req: Request) {
  const requestId = globalThis.crypto.randomUUID();
  const rateLimit = await checkRateLimit(
    `website-pricing-preview:${clientIpFromHeaders(new Headers(req.headers))}`,
    { limit: 30, windowMs: 5 * 60_000 },
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "För många prisförfrågningar. Vänta en stund och försök igen." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1_000))) },
      },
    );
  }
  const status = getOpsClientStatus();
  if (!status.configured) {
    return NextResponse.json(
      { error: "Priset kan inte räknas just nu." },
      { status: 503 },
    );
  }
  if (!websitePricingQuoteConfigured()) {
    console.error("[website pricing preview] GRIDEX_WEBSITE_PRICING_QUOTE_SECRET is missing", { request_id: requestId });
    return NextResponse.json(
      { error: "Prisverifieringen är inte konfigurerad just nu." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as PreviewPayload | null;
  const requestedArea = priceArea(body?.price_area_code ?? body?.priceAreaCode ?? body?.priceArea);
  const monthlyKwh = requiredConsumption(
    body?.estimated_monthly_kwh ?? body?.estimatedMonthlyKwh ?? body?.kwh,
    200000,
  );
  const annualKwh = requiredConsumption(
    body?.annual_consumption_kwh ?? body?.annualConsumptionKwh,
  );
  const postalCode = text(body?.postal_code ?? body?.postalCode, 20);
  const city = text(body?.city);
  const address = text(body?.address);
  const offerReference = text(body?.offer_reference ?? body?.offerReference);
  const startDate = text(body?.start_date ?? body?.startDate, 10);
  const customerType = parseWebsiteCustomerType(body?.customer_type ?? body?.customerType);
  const gridAreaCode = text(body?.grid_area_code ?? body?.gridAreaCode, 120);
  const meteringPointId = text(body?.metering_point_id ?? body?.meteringPointId, 120);

  if (!monthlyKwh || !annualKwh || !postalCode || !city || !address) {
    return NextResponse.json(
      {
        error:
          "Ange adress, ort, postnummer, elområde och en giltig månadsförbrukning innan du räknar pris.",
      },
      { status: 400 },
    );
  }
  if (!offerReference) {
    return NextResponse.json(
      { error: "Välj ett aktuellt elavtal innan du räknar pris." },
      { status: 400 },
    );
  }

  try {
    const resolution = await resolveWebsitePriceAreaForPricing({ postal_code: postalCode, city, address, street: address });
    const resolvedArea = resolution.price_area_code;
    if (!resolvedArea || (requestedArea && requestedArea !== resolvedArea)) return NextResponse.json({ error: "Adressen och elområdet måste kontrolleras igen." }, { status: 409 });
    const contracts = await fetchOpsPublicContracts();
    const contract = contracts.find(
      (item) => item.offer_reference === offerReference,
    );
    if (!contract || !buildPublicContractDisplay(contract).ready)
      return NextResponse.json(
        { error: "Valt elavtal kunde inte verifieras." },
        { status: 404 },
      );

    const preview = await loadVerifiedWebsitePricingPreview(
      {
        offer_reference: offerReference,
        price_area_code: resolvedArea,
        postal_code: postalCode,
        city,
        address,
        estimated_monthly_kwh: monthlyKwh,
        annual_consumption_kwh: annualKwh,
        grid_area_code: gridAreaCode,
        metering_point_id: meteringPointId,
        start_date: startDate,
        customer_type: customerType,
      },
      contract,
    );
    const websiteQuote = issueWebsitePricingQuote({
      preview,
      contract,
      location: { postalCode, city, address },
    });
    if (!websiteQuote) {
      throw new WebsitePricingPreviewError("Prisberäkningen kunde inte låsas för teckning.");
    }
    const data = {
      ...quoteToWebsitePricingPreview(websiteQuote.quote, websiteQuote.token),
      customerNotice: preview.customerNotice,
      legalText: preview.legalText,
      quote_source: websitePricingPreviewSource(),
      token_issuer: "website" as const,
    };

    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof WebsitePricingPreviewError) {
      return NextResponse.json(
        { error: error.message || "Prisberäkningen kunde inte verifieras." },
        { status: 409 },
      );
    }
    if (isOpsError(error)) {
      console.error("[website pricing preview] OPS contract lookup failed", {
        request_id: requestId,
        status: error.status,
        message: error.message,
        details: error.details,
      });
      const generic = /Tjänsten kunde inte slutföra åtgärden just nu/i.test(error.message);
      return NextResponse.json(
        {
          error: generic
            ? `Elområdet hittades, men priset kunde inte hämtas för valt avtal. Referens: ${requestId.slice(0, 8)}.`
            : error.message || `Vi kunde inte hämta prisuppgifter just nu. Referens: ${requestId.slice(0, 8)}.`,
          code: "ops_contract_lookup_failed",
          request_id: requestId,
        },
        { status: error.status || 502 },
      );
    }
    console.error("[website pricing preview] failed", { request_id: requestId, error });
    return NextResponse.json(
      {
        error: `Vi kunde inte hämta prisuppgifter just nu. Referens: ${requestId.slice(0, 8)}.`,
        code: "website_pricing_failed",
        request_id: requestId,
      },
      { status: 502 },
    );
  }
}
