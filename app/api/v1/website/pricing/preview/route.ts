import { NextResponse } from "next/server";
import {
  fetchOpsPublicContracts,
  fetchOpsWebsitePricingPreview,
  getOpsClientStatus,
  isOpsError,
  type OpsPublicContract,
  type OpsWebsitePriceArea,
  type OpsWebsitePricingPreview,
  type OpsWebsitePricingPreviewInput,
} from "@/lib/ops/client";
import { fetchMonthlySpotAverageFromElprisetJustNu } from "@/lib/gridex/pricing/elprisetjustnu";
import { prevYearMonth } from "@/lib/gridex/pricing/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AREAS = new Set<OpsWebsitePriceArea>(["SE1", "SE2", "SE3", "SE4"]);

type PreviewPayload = {
  contract_id?: unknown;
  contractId?: unknown;
  price_plan_id?: unknown;
  pricePlanId?: unknown;
  price_plan_version_id?: unknown;
  pricePlanVersionId?: unknown;
  product_code?: unknown;
  productCode?: unknown;
  price_area_code?: unknown;
  priceAreaCode?: unknown;
  priceArea?: unknown;
  postal_code?: unknown;
  postalCode?: unknown;
  city?: unknown;
  address?: unknown;
  estimated_monthly_kwh?: unknown;
  estimatedMonthlyKwh?: unknown;
  kwh?: unknown;
};

function text(value: unknown, max = 180): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed ? trimmed : null;
}

function number(value: unknown, fallback = 2000): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(200000, Math.max(1, parsed));
}

function priceArea(value: unknown): OpsWebsitePriceArea | null {
  const area = typeof value === "string" ? value.toUpperCase() : "";
  return AREAS.has(area as OpsWebsitePriceArea)
    ? (area as OpsWebsitePriceArea)
    : null;
}

function money(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeContractType(
  type: string,
): "spot_hourly" | "portfolio_managed" | "fixed" {
  if (type === "fixed") return "fixed";
  if (type === "portfolio" || type === "portfolio_managed")
    return "portfolio_managed";
  return "spot_hourly";
}

type PreviewFees = {
  markupOre?: number;
  variableFeeOre?: number;
  elcertOre?: number;
  monthlyFeeSek?: number;
};

function readFees(data: OpsWebsitePricingPreview): PreviewFees {
  const spec = data.specification;
  const fees =
    spec &&
    typeof spec === "object" &&
    "fees" in spec &&
    spec.fees &&
    typeof spec.fees === "object"
      ? (spec.fees as Record<string, unknown>)
      : {};

  return {
    markupOre: normalizeOptionalNumber(
      fees.markupOre ?? fees.markup_ore ?? fees.markup_ore_per_kwh,
    ),
    variableFeeOre: normalizeOptionalNumber(
      fees.variableFeeOre ??
        fees.variable_fee_ore ??
        fees.variable_fee_ore_per_kwh,
    ),
    elcertOre: normalizeOptionalNumber(
      fees.elcertOre ?? fees.elcert_ore ?? fees.elcert_ore_per_kwh,
    ),
    monthlyFeeSek: normalizeOptionalNumber(
      fees.monthlyFeeSek ?? fees.monthly_fee_sek,
    ),
  };
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(
    typeof value === "string" ? value.replace(",", ".") : value,
  );
  return Number.isFinite(parsed) ? parsed : undefined;
}

function preferContractComponent(
  previewValue: number | undefined,
  contractValue: number | null | undefined,
) {
  if (typeof contractValue === "number" && Number.isFinite(contractValue)) {
    if (previewValue === undefined) return contractValue;
    if (previewValue === 0 && contractValue !== 0) return contractValue;
  }
  return previewValue;
}

function basisOre(data: OpsWebsitePricingPreview): number | null {
  const basis =
    data.specification &&
    typeof data.specification === "object" &&
    "basis" in data.specification &&
    data.specification.basis &&
    typeof data.specification.basis === "object"
      ? (data.specification.basis as Record<string, unknown>)
      : null;

  if (!basis) return null;
  const type = typeof basis.type === "string" ? basis.type : "";
  if (type === "previous_month_avg_spot")
    return (
      normalizeOptionalNumber(basis.spotAvgOre ?? basis.spot_avg_ore) ?? null
    );
  if (type === "admin_fixed_price" || type === "fixed_price") {
    return (
      normalizeOptionalNumber(basis.fixedPriceOre ?? basis.fixed_price_ore) ??
      null
    );
  }
  return null;
}

function enrichPreviewWithContract(
  data: OpsWebsitePricingPreview,
  contract: OpsPublicContract | undefined,
): OpsWebsitePricingPreview {
  if (!contract) return data;

  const currentFees = readFees(data);
  const monthlyFromContract =
    money(contract.monthly_fee_sek) + money(contract.invoice_fee_sek);
  const fees: PreviewFees = {
    markupOre: preferContractComponent(
      currentFees.markupOre,
      contract.markup_ore_per_kwh,
    ),
    variableFeeOre: preferContractComponent(
      currentFees.variableFeeOre,
      contract.variable_markup_ore_per_kwh,
    ),
    elcertOre: currentFees.elcertOre,
    monthlyFeeSek: preferContractComponent(
      currentFees.monthlyFeeSek,
      monthlyFromContract,
    ),
  };

  const basis = basisOre(data);
  const pricePerKwhOre =
    basis === null
      ? data.pricePerKwhOre
      : Number(
          (
            basis +
            money(fees.markupOre) +
            money(fees.variableFeeOre) +
            money(fees.elcertOre)
          ).toFixed(4),
        );
  const totalMonthlyCostSek =
    basis === null
      ? data.totalMonthlyCostSek
      : Number(
          (
            (pricePerKwhOre * data.kwh) / 100 +
            money(fees.monthlyFeeSek)
          ).toFixed(2),
        );

  return {
    ...data,
    contract: {
      slug: data.contract.slug || contract.product_code,
      name: data.contract.name || contract.name,
      contractType: normalizeContractType(contract.type),
    },
    pricePerKwhOre,
    totalMonthlyCostSek,
    totalMonthlyCostInclVatSek: Number((totalMonthlyCostSek * 1.25).toFixed(2)),
    totalYearlyCostSek: Number((totalMonthlyCostSek * 12).toFixed(2)),
    specification: {
      ...(data.specification ?? {}),
      fees: {
        ...((
          data.specification as { fees?: Record<string, unknown> } | undefined
        )?.fees ?? {}),
        ...fees,
      },
    },
  };
}

function matchesContract(
  contract: OpsPublicContract,
  input: OpsWebsitePricingPreviewInput,
) {
  const wanted = [
    input.contract_id,
    input.price_plan_id,
    input.price_plan_version_id,
    input.product_code,
  ]
    .map((value) => value?.trim())
    .filter(Boolean);

  return wanted.some(
    (value) =>
      value === contract.contract_id ||
      value === contract.price_plan_id ||
      value === contract.price_plan_version_id ||
      value === contract.product_code,
  );
}

async function fallbackPreview(
  input: OpsWebsitePricingPreviewInput,
): Promise<OpsWebsitePricingPreview> {
  const contracts = await fetchOpsPublicContracts();
  const contract = contracts.find((item) => matchesContract(item, input));

  if (!contract) {
    throw Object.assign(new Error("Valt elavtal kunde inte verifieras."), {
      status: 404,
    });
  }

  const monthlyKwh = number(input.estimated_monthly_kwh);
  const contractType = normalizeContractType(contract.type);
  const monthlyFeeSek = money(contract.monthly_fee_sek);
  const invoiceFeeSek = money(contract.invoice_fee_sek);
  const markupOre = money(contract.markup_ore_per_kwh);
  const variableFeeOre = money(contract.variable_markup_ore_per_kwh);
  const fixedPriceOre = money(contract.fixed_price_ore_per_kwh);
  const monthlyFeeTotalSek = monthlyFeeSek + invoiceFeeSek;

  let basis:
    | {
        type: "previous_month_avg_spot";
        year: number;
        month: number;
        spotAvgOre: number;
        source: "elprisetjustnu_api";
      }
    | { type: "admin_fixed_price"; fixedPriceOre: number };

  let baseOre = fixedPriceOre;

  if (contractType === "fixed" && fixedPriceOre > 0) {
    basis = { type: "admin_fixed_price", fixedPriceOre };
  } else if (contractType === "portfolio_managed" && fixedPriceOre > 0) {
    basis = { type: "admin_fixed_price", fixedPriceOre };
  } else {
    const period = prevYearMonth(new Date());
    const spot = await fetchMonthlySpotAverageFromElprisetJustNu({
      year: period.year,
      month: period.month,
      priceArea: input.price_area_code,
    });

    if (!spot) {
      throw Object.assign(
        new Error("Spotpris kunde inte hämtas för valt elområde."),
        {
          status: 502,
        },
      );
    }

    baseOre = spot.avgSpotOre;
    basis = {
      type: "previous_month_avg_spot",
      year: spot.year,
      month: spot.month,
      spotAvgOre: spot.avgSpotOre,
      source: "elprisetjustnu_api",
    };
  }

  const totalOre = baseOre + markupOre + variableFeeOre;
  const totalMonthlyCostSek =
    (totalOre * monthlyKwh) / 100 + monthlyFeeTotalSek;

  return {
    contract: {
      slug: contract.product_code,
      name: contract.name,
      contractType,
    },
    priceArea: input.price_area_code,
    price_area_code: input.price_area_code,
    kwh: monthlyKwh,
    pricePerKwhOre: Number(totalOre.toFixed(4)),
    totalMonthlyCostSek: Number(totalMonthlyCostSek.toFixed(2)),
    totalMonthlyCostInclVatSek: Number((totalMonthlyCostSek * 1.25).toFixed(2)),
    totalYearlyCostSek: Number((totalMonthlyCostSek * 12).toFixed(2)),
    customerNotice:
      "Priset är en uppskattning baserad på valt elområde och aktuell prisinformation. Slutlig bekräftelse skickas när ansökan har behandlats.",
    specification: {
      basis,
      fees: {
        markupOre,
        variableFeeOre,
        elcertOre: 0,
        monthlyFeeSek: monthlyFeeTotalSek,
      },
    },
  };
}

export async function POST(req: Request) {
  const status = getOpsClientStatus();

  if (!status.configured) {
    return NextResponse.json(
      { error: "Priset kan inte räknas just nu." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as PreviewPayload | null;
  const resolvedArea = priceArea(
    body?.price_area_code ?? body?.priceAreaCode ?? body?.priceArea,
  );

  if (!resolvedArea) {
    return NextResponse.json(
      {
        error:
          "Elområde saknas. Ange postnummer och kontrollera prisområdet först.",
      },
      { status: 400 },
    );
  }

  const input: OpsWebsitePricingPreviewInput = {
    contract_id: text(body?.contract_id ?? body?.contractId),
    price_plan_id: text(body?.price_plan_id ?? body?.pricePlanId),
    price_plan_version_id: text(
      body?.price_plan_version_id ?? body?.pricePlanVersionId,
    ),
    product_code: text(body?.product_code ?? body?.productCode),
    price_area_code: resolvedArea,
    postal_code: text(body?.postal_code ?? body?.postalCode, 20),
    city: text(body?.city),
    address: text(body?.address),
    estimated_monthly_kwh: number(
      body?.estimated_monthly_kwh ?? body?.estimatedMonthlyKwh ?? body?.kwh,
    ),
  };

  try {
    const data = await fetchOpsWebsitePricingPreview(input);
    let contract: OpsPublicContract | undefined;
    try {
      contract = (await fetchOpsPublicContracts()).find((item) =>
        matchesContract(item, input),
      );
    } catch {
      contract = undefined;
    }
    return NextResponse.json({
      data: enrichPreviewWithContract(data, contract),
    });
  } catch (error) {
    if (isOpsError(error) && error.status !== 404) {
      return NextResponse.json(
        { error: error.message || "Priset kan inte räknas just nu." },
        { status: error.status },
      );
    }

    try {
      const data = await fallbackPreview(input);
      return NextResponse.json({ data, fallback: true });
    } catch (fallbackError) {
      const message =
        fallbackError instanceof Error
          ? fallbackError.message
          : "Priset kan inte räknas just nu.";
      const fallbackStatus =
        typeof fallbackError === "object" &&
        fallbackError !== null &&
        "status" in fallbackError &&
        typeof (fallbackError as { status?: unknown }).status === "number"
          ? (fallbackError as { status: number }).status
          : 502;

      return NextResponse.json({ error: message }, { status: fallbackStatus });
    }
  }
}
