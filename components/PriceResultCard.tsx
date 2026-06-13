// components/PriceResultCard.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";

type PriceArea = "SE1" | "SE2" | "SE3" | "SE4";
type ContractType = "spot_hourly" | "portfolio_managed" | "fixed";

type SpotBasis = {
  type: "previous_month_avg_spot";
  year: number;
  month: number;
  spotAvgOre: number;
  source?:
    | "gridex_monthly_spot_prices"
    | "gridex_spot_monthly_avg"
    | "elprisetjustnu_api";
};

type FixedBasis = {
  type: "admin_fixed_price" | "fixed_price";
  fixedPriceOre: number;
};

type PriceResponse = {
  contract: {
    slug: string;
    name: string;
    contractType: ContractType;
  };
  priceArea: PriceArea;
  kwh: number;
  pricePerKwhOre: number;
  totalMonthlyCostSek: number;
  totalMonthlyCostInclVatSek?: number;
  totalYearlyCostSek?: number;
  customerNotice?: string;
  legalText?: string;
  specification?: {
    basis?: SpotBasis | FixedBasis;
    fees?: {
      markupOre?: number;
      variableFeeOre?: number;
      elcertOre?: number;
      monthlyFeeSek?: number;
    };
  };
};

type Props = {
  data: PriceResponse;
  updatedAt?: Date;
  onSelect?: () => void;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatOre(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value);
}

function contractTypeLabel(type: ContractType) {
  switch (type) {
    case "spot_hourly":
      return "Rörligt månadspris";
    case "portfolio_managed":
      return "Portföljförvaltat";
    case "fixed":
      return "Fastpris";
    default:
      return "Elavtal";
  }
}

function sourceLabel(source: SpotBasis["source"]) {
  switch (source) {
    case "elprisetjustnu_api":
      return "Spotpris från elprisetjustnu.se";
    case "gridex_spot_monthly_avg":
      return "Fallback: äldre Gridex-prisbas";
    case "gridex_monthly_spot_prices":
      return "Fallback: Gridex prisbas";
    default:
      return "Föregående månads snittspot";
  }
}

export default function PriceResultCard({ data, updatedAt, onSelect }: Props) {
  const {
    totalMonthlyCostSek,
    totalMonthlyCostInclVatSek,
    pricePerKwhOre,
    priceArea,
    kwh,
    specification,
    contract,
  } = data;

  const basisLabel = useMemo(() => {
    if (!specification?.basis) return "Prisbas saknas";

    if (specification.basis.type === "previous_month_avg_spot") {
      const sourceSuffix =
        specification.basis.source === "elprisetjustnu_api"
          ? " från prisdatakälla"
          : "";
      return `Föregående månads spotpris${sourceSuffix} (${String(specification.basis.month).padStart(2, "0")}/${specification.basis.year})`;
    }

    if (
      specification.basis.type === "admin_fixed_price" ||
      specification.basis.type === "fixed_price"
    ) {
      return "Fast elpris";
    }

    return "Okänd prisbas";
  }, [specification]);

  const basisValue = useMemo(() => {
    if (!specification?.basis) return 0;

    if (specification.basis.type === "previous_month_avg_spot") {
      return specification.basis.spotAvgOre ?? 0;
    }

    if (
      specification.basis.type === "admin_fixed_price" ||
      specification.basis.type === "fixed_price"
    ) {
      return specification.basis.fixedPriceOre ?? 0;
    }

    return 0;
  }, [specification]);

  const spotSource =
    specification?.basis?.type === "previous_month_avg_spot"
      ? specification.basis.source
      : undefined;
  const variableFeeOre = specification?.fees?.variableFeeOre;
  const monthlyFeeSek = specification?.fees?.monthlyFeeSek;
  const markupOre = specification?.fees?.markupOre;
  const elcertOre = specification?.fees?.elcertOre;
  const contractHref = contract?.slug
    ? `/teckna-avtal?contract=${encodeURIComponent(contract.slug)}`
    : "/teckna-avtal";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-6 transition hover:border-cyan-400/40 md:p-8">
      <div className="pointer-events-none absolute -right-28 -top-28 h-[280px] w-[280px] rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="relative space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
              {contractTypeLabel(contract?.contractType ?? "fixed")}
            </div>

            <div>
              <div className="text-lg font-semibold text-white">
                {contract?.name ?? "Avtal"}
              </div>
              <div className="text-sm text-gray-400">
                {priceArea} • {formatNumber(kwh ?? 0)} kWh / månad
              </div>
            </div>
          </div>

          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
            {sourceLabel(spotSource)}
            {updatedAt ? (
              <span>
                {" "}
                • beräknat{" "}
                {updatedAt.toLocaleTimeString("sv-SE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
          </div>
        </div>

        {data.customerNotice ? (
          <div
            className={`rounded-2xl border p-4 text-sm ${
              contract.contractType === "spot_hourly"
                ? "border-amber-500/25 bg-amber-500/10 text-amber-100"
                : "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            {data.customerNotice}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-gray-400">
              Beräknad månadskostnad inkl. moms
            </div>
            <div className="mt-2 text-4xl font-bold tracking-tight text-white">
              {formatNumber(
                totalMonthlyCostInclVatSek ?? totalMonthlyCostSek ?? 0,
              )}{" "}
              kr
              <span className="ml-2 text-lg text-gray-400">/ mån</span>
            </div>
            <div className="mt-2 text-sm text-gray-400">
              {formatOre(pricePerKwhOre ?? 0)} öre/kWh exkl. moms före
              månadsavgift
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-sm font-medium text-white">
              Detta ingår i beräkningen
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Spot-/baspris, Gridex påslag, rörliga avgifter, elcertifikat,
              månadsavgift och moms. Elnätsavgift från nätägaren ingår inte.
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-300">{basisLabel}</span>
            <span className="text-gray-100">
              {formatOre(basisValue)} öre/kWh
            </span>
          </div>

          {markupOre !== undefined ? (
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Gridex påslag</span>
              <span className="text-gray-100">
                {formatOre(markupOre)} öre/kWh
              </span>
            </div>
          ) : null}

          {variableFeeOre !== undefined ? (
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Rörlig avgift</span>
              <span className="text-gray-100">
                {formatOre(variableFeeOre)} öre/kWh
              </span>
            </div>
          ) : null}

          {elcertOre !== undefined ? (
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Elcertifikat</span>
              <span className="text-gray-100">
                {formatOre(elcertOre)} öre/kWh
              </span>
            </div>
          ) : null}

          {monthlyFeeSek !== undefined ? (
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Månadsavgift</span>
              <span className="text-gray-100">
                {formatNumber(monthlyFeeSek)} kr/mån
              </span>
            </div>
          ) : null}

          <div className="border-t border-white/10 pt-3">
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Beräknat exkl. moms</span>
              <span className="text-gray-100">
                {formatNumber(totalMonthlyCostSek ?? 0)} kr/mån
              </span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span className="text-gray-300">Beräknat inkl. moms</span>
              <span className="font-semibold text-white">
                {formatNumber(
                  totalMonthlyCostInclVatSek ?? totalMonthlyCostSek ?? 0,
                )}{" "}
                kr/mån
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-100">
          Rörligt månadspris bygger på föregående månads genomsnittliga spotpris
          i ditt elområde. Faktiskt pris kan ändras månad för månad.
          Elnätsavgift, eventuell effektavgift och nätägarens fasta avgifter
          faktureras normalt separat av nätägaren och ingår inte i denna
          beräkning.
        </div>

        {data.legalText ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-xs leading-relaxed text-gray-300">
            {data.legalText}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {onSelect ? (
            <button
              onClick={onSelect}
              className="w-full rounded-2xl bg-cyan-500 py-4 text-lg font-bold text-black shadow-[0_0_40px_rgba(34,211,238,0.30)] transition hover:bg-cyan-400"
            >
              Teckna avtal
            </button>
          ) : (
            <Link
              href={contractHref}
              className="flex w-full items-center justify-center rounded-2xl bg-cyan-500 py-4 text-lg font-bold text-black shadow-[0_0_40px_rgba(34,211,238,0.30)] transition hover:bg-cyan-400"
            >
              Teckna avtal
            </Link>
          )}

          <Link
            href="/elavtal"
            className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-medium text-white/85 transition hover:bg-white/10"
          >
            Jämför fler elavtal
          </Link>
        </div>
      </div>
    </div>
  );
}
