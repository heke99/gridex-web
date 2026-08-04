"use client";

import Link from "next/link";
import type { WebsitePricingPreview } from "@/lib/website/publicApi";
import { CUSTOMER_NETWORK_FEE_NOTICE } from "@/lib/website/customerFacingCopy";

type Props = { data: WebsitePricingPreview; updatedAt?: Date; onSelect?: () => void; continueHref?: string };
function hasNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function formatNumber(value: number, maximumFractionDigits = 0) { return new Intl.NumberFormat("sv-SE", { maximumFractionDigits }).format(value); }
function formatOre(value: number) { return formatNumber(value, 4); }
function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("sv-SE") : value;
}
function contractTypeLabel(type: WebsitePricingPreview["contract"]["contractType"]) {
  if (type === "fixed") return "Fastpris";
  if (type === "monthly_fixed") return "Fast månadspris";
  if (type === "spot_monthly") return "Månadspris";
  if (type === "spot_hourly") return "Timpris";
  if (type === "spot_quarterly") return "Kvartspris";
  if (type === "portfolio_managed") return "Förvaltat avtal";
  return "Mixavtal";
}

export default function PriceResultCard({ data, updatedAt, onSelect, continueHref }: Props) {
  const { totalMonthlyCostSek, totalMonthlyCostInclVatSek, pricePerKwhOre, priceArea, kwh, specification, contract } = data;
  const fees = specification?.fees ?? {};
  const contractHref = continueHref ?? (contract.offer_reference ? `/teckna-avtal?offer=${encodeURIComponent(contract.offer_reference)}` : "/teckna-avtal");
  const estimatedInclVat = hasNumber(totalMonthlyCostInclVatSek) ? totalMonthlyCostInclVatSek : undefined;
  const marketTimestamp = formatDate(data.market_data_timestamp);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-6 transition hover:border-cyan-400/40 md:p-8">
      <div className="pointer-events-none absolute -right-28 -top-28 h-[280px] w-[280px] rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="relative space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">{contractTypeLabel(contract.contractType)}</span>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${data.is_binding ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-amber-500/20 bg-amber-500/10 text-amber-100"}`}>
                {data.is_binding ? "Bindande pris" : "Indikativ prisuppgift"}
              </span>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{contract.name}</div>
              <div className="text-sm text-gray-400">{priceArea} • {formatNumber(kwh)} kWh/månad • {formatNumber(data.annual_consumption_kwh ?? kwh * 12)} kWh/år</div>
            </div>
          </div>
          {updatedAt ? <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">Visad {updatedAt.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}</div> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-gray-400">Beräknad månadskostnad inkl. moms</div>
            <div className="mt-2 text-4xl font-bold tracking-tight text-white">{hasNumber(estimatedInclVat) ? `${formatNumber(estimatedInclVat)} kr` : "Kan inte visas"}<span className="ml-2 text-lg text-gray-400">/ mån</span></div>
            {hasNumber(pricePerKwhOre) ? <div className="mt-2 text-sm text-gray-400">{formatOre(pricePerKwhOre)} öre/kWh exkl. moms före fasta avgifter</div> : null}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-sm">
            <div className="font-medium text-white">Prisunderlag</div>
            <dl className="mt-3 space-y-2 text-gray-300">
              {data.pricing_interval ? <div className="flex justify-between gap-4"><dt>Prisintervall</dt><dd className="text-right text-white">{data.pricing_interval}</dd></div> : null}
              {data.source_period ? <div className="flex justify-between gap-4"><dt>Underlagsperiod</dt><dd className="text-right text-white">{data.source_period}</dd></div> : null}
              {marketTimestamp ? <div className="flex justify-between gap-4"><dt>Marknadsdata</dt><dd className="text-right text-white">{marketTimestamp}</dd></div> : null}
            </dl>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm">
          {hasNumber(fees.markupOre) ? <div className="flex justify-between gap-4"><span className="text-gray-300">Påslag</span><span className="text-gray-100">{formatOre(fees.markupOre)} öre/kWh</span></div> : null}
          {hasNumber(fees.variableFeeOre) ? <div className="flex justify-between gap-4"><span className="text-gray-300">Rörlig avgift</span><span className="text-gray-100">{formatOre(fees.variableFeeOre)} öre/kWh</span></div> : null}
          {hasNumber(fees.elcertOre) ? <div className="flex justify-between gap-4"><span className="text-gray-300">Elcertifikat</span><span className="text-gray-100">{formatOre(fees.elcertOre)} öre/kWh</span></div> : null}
          {hasNumber(fees.monthlyFeeSek) ? <div className="flex justify-between gap-4"><span className="text-gray-300">Månadsavgift</span><span className="text-gray-100">{formatNumber(fees.monthlyFeeSek, 2)} kr/mån</span></div> : null}
          <div className="border-t border-white/10 pt-3">
            {hasNumber(totalMonthlyCostSek) ? <div className="flex justify-between gap-4"><span className="text-gray-300">Beräknat exkl. moms</span><span className="text-gray-100">{formatNumber(totalMonthlyCostSek)} kr/mån</span></div> : null}
            {hasNumber(estimatedInclVat) ? <div className="mt-2 flex justify-between gap-4"><span className="text-gray-300">Beräknat inkl. moms</span><span className="font-semibold text-white">{formatNumber(estimatedInclVat)} kr/mån</span></div> : null}
          </div>
        </div>

        {data.assumptions?.length ? <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm"><div className="font-medium text-white">Antaganden i beräkningen</div><ul className="mt-3 space-y-2 text-gray-300">{data.assumptions.map((item, index) => <li key={`${item.code ?? item.label}-${index}`}>• {item.label}{item.value !== undefined && item.value !== null ? `: ${String(item.value)}${item.unit ? ` ${item.unit}` : ""}` : ""}</li>)}</ul></div> : null}
        {data.market_sources?.length ? <div className="text-xs leading-relaxed text-gray-400">Marknadskällor: {data.market_sources.map((source) => source.name).join(", ")}.</div> : null}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs leading-relaxed text-emerald-100">Ditt pris är hämtat från det publicerade avtalet i OPS och verifieras igen innan avtalet registreras.</div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-100">{CUSTOMER_NETWORK_FEE_NOTICE}</div>

        <div className="grid gap-3 md:grid-cols-2">
          {onSelect ? <button type="button" onClick={onSelect} className="w-full rounded-2xl bg-cyan-500 py-4 text-lg font-bold text-black shadow-[0_0_40px_rgba(34,211,238,0.30)] transition hover:bg-cyan-400">Välj detta avtal</button> : <Link href={contractHref} className="flex w-full items-center justify-center rounded-2xl bg-cyan-500 py-4 text-lg font-bold text-black shadow-[0_0_40px_rgba(34,211,238,0.30)] transition hover:bg-cyan-400">Teckna elavtal</Link>}
          <Link href="/elavtal" className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-medium text-white/85 transition hover:bg-white/10">Jämför fler elavtal</Link>
        </div>
      </div>
    </div>
  );
}
