'use client'

import Link from 'next/link'
import type { WebsitePricingPreview } from '@/lib/website/publicApi'

type Props = { data: WebsitePricingPreview; updatedAt?: Date; onSelect?: () => void }
type PricingBasis = NonNullable<WebsitePricingPreview['specification']>['basis']

function hasNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
function formatNumber(value: number, maximumFractionDigits = 0) { return new Intl.NumberFormat('sv-SE', { maximumFractionDigits }).format(value) }
function formatOre(value: number) { return formatNumber(value, 4) }

function contractTypeLabel(type: WebsitePricingPreview['contract']['contractType']) {
  if (type === 'fixed') return 'Fastpris'
  if (type === 'portfolio_managed') return 'Förvaltat avtal'
  if (type === 'mix') return 'Mixavtal'
  return 'Rörligt elpris'
}

function basisLabel(basis: PricingBasis) {
  if (!basis || typeof basis !== 'object' || !('type' in basis)) return null
  const value = basis as Record<string, unknown>
  if (value.type === 'previous_month_avg_spot' && hasNumber(value.spotAvgOre)) return `Föregående månads snittspot (${String(value.month).padStart(2, '0')}/${value.year})`
  if ((value.type === 'fixed_price' || value.type === 'admin_fixed_price') && hasNumber(value.fixedPriceOre)) return 'Fast elpris'
  if (value.type === 'mix') return 'Viktat mixpris'
  return null
}

function basisRows(basis: PricingBasis) {
  if (!basis || typeof basis !== 'object') return [] as Array<[string, string]>
  const value = basis as Record<string, unknown>
  const rows: Array<[string, string]> = []
  if (hasNumber(value.spotAvgOre)) rows.push(['Spotandel', `${formatOre(value.spotAvgOre)} öre/kWh`])
  if (hasNumber(value.fixedPriceOre)) rows.push(['Fast elpris', `${formatOre(value.fixedPriceOre)} öre/kWh`])
  if (hasNumber(value.spotPriceOre)) rows.push(['Rörlig del', `${formatOre(value.spotPriceOre)} öre/kWh`])
  if (hasNumber(value.portfolioPriceOre)) rows.push(['Portföljdel', `${formatOre(value.portfolioPriceOre)} öre/kWh`])
  if (hasNumber(value.spotShare)) rows.push(['Rörlig andel', `${formatNumber(value.spotShare, 2)} %`])
  if (hasNumber(value.portfolioShare)) rows.push(['Portföljandel', `${formatNumber(value.portfolioShare, 2)} %`])
  return rows
}

export default function PriceResultCard({ data, updatedAt, onSelect }: Props) {
  const { totalMonthlyCostSek, totalMonthlyCostInclVatSek, pricePerKwhOre, priceArea, kwh, specification, contract } = data
  const fees = specification?.fees ?? {}
  const contractHref = contract.offer_reference
    ? `/teckna-avtal?offer=${encodeURIComponent(contract.offer_reference)}${data.quote_token ? `&quote=${encodeURIComponent(data.quote_token)}` : ''}`
    : '/teckna-avtal'
  const estimatedInclVat = hasNumber(totalMonthlyCostInclVatSek) ? totalMonthlyCostInclVatSek : undefined
  const invoiceIncluded = fees.invoiceFeeIncludedInMonthlyEstimate
  const basisName = basisLabel(specification?.basis)

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-6 transition hover:border-cyan-400/40 md:p-8">
      <div className="pointer-events-none absolute -right-28 -top-28 h-[280px] w-[280px] rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="relative space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2"><div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">{contractTypeLabel(contract.contractType)}</div><div><div className="text-lg font-semibold text-white">{contract.name}</div><div className="text-sm text-gray-400">{priceArea} • {formatNumber(kwh)} kWh / månad</div></div></div>
          {updatedAt ? <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">Beräknat {updatedAt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</div> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="text-sm text-gray-400">Beräknad månadskostnad inkl. moms</div><div className="mt-2 text-4xl font-bold tracking-tight text-white">{hasNumber(estimatedInclVat) ? `${formatNumber(estimatedInclVat)} kr` : 'Kan inte visas'}<span className="ml-2 text-lg text-gray-400">/ mån</span></div>{hasNumber(pricePerKwhOre) ? <div className="mt-2 text-sm text-gray-400">{formatOre(pricePerKwhOre)} öre/kWh exkl. moms före fasta avgifter</div> : null}</div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5"><div className="text-sm font-medium text-white">Detta ingår i beräkningen</div><p className="mt-2 text-sm leading-relaxed text-gray-400">Elhandelspris och de avgifter som OPS har räknat med för valt avtal. Elnätsavgift och nätägarens avgifter ingår inte.</p></div>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm">
          {basisName ? <div className="flex justify-between gap-4"><span className="text-gray-300">{basisName}</span><span className="text-gray-100">{contract.contractType === 'mix' ? 'Se fördelning nedan' : ''}</span></div> : null}
          {basisRows(specification?.basis).map(([label, value]) => <div key={label} className="flex justify-between gap-4"><span className="text-gray-300">{label}</span><span className="text-gray-100">{value}</span></div>)}
          {hasNumber(fees.markupOre) ? <div className="flex justify-between gap-4"><span className="text-gray-300">Påslag</span><span className="text-gray-100">{formatOre(fees.markupOre)} öre/kWh</span></div> : null}
          {hasNumber(fees.variableFeeOre) ? <div className="flex justify-between gap-4"><span className="text-gray-300">Rörlig avgift</span><span className="text-gray-100">{formatOre(fees.variableFeeOre)} öre/kWh</span></div> : null}
          {hasNumber(fees.elcertOre) ? <div className="flex justify-between gap-4"><span className="text-gray-300">Elcertifikat</span><span className="text-gray-100">{formatOre(fees.elcertOre)} öre/kWh</span></div> : null}
          {hasNumber(fees.monthlyFeeSek) ? <div className="flex justify-between gap-4"><span className="text-gray-300">Månadsavgift</span><span className="text-gray-100">{formatNumber(fees.monthlyFeeSek, 2)} kr/mån</span></div> : null}
          {hasNumber(fees.invoiceFeeSek) ? <div className="flex justify-between gap-4"><span className="text-gray-300">Fakturaavgift</span><span className="text-right text-gray-100">{formatNumber(fees.invoiceFeeSek, 2)} kr/faktura{invoiceIncluded ? ' • inräknad i uppskattningen' : ' • per faktura'}</span></div> : null}
          <div className="border-t border-white/10 pt-3">{hasNumber(totalMonthlyCostSek) ? <div className="flex justify-between gap-4"><span className="text-gray-300">Beräknat exkl. moms</span><span className="text-gray-100">{formatNumber(totalMonthlyCostSek)} kr/mån</span></div> : null}{hasNumber(estimatedInclVat) ? <div className="mt-2 flex justify-between gap-4"><span className="text-gray-300">Beräknat inkl. moms</span><span className="font-semibold text-white">{formatNumber(estimatedInclVat)} kr/mån</span></div> : null}</div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-100">Priset säkras mot ditt slutliga avtal, elområde, adress och kWh-tal när ansökan granskas. Rörligt pris kan ändras månad för månad. Elnätsavgifter ingår inte.</div>
        <div className="grid gap-3 md:grid-cols-2">{onSelect ? <button type="button" onClick={onSelect} className="w-full rounded-2xl bg-cyan-500 py-4 text-lg font-bold text-black shadow-[0_0_40px_rgba(34,211,238,0.30)] transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300/70">Välj detta avtal</button> : <Link href={contractHref} className="flex w-full items-center justify-center rounded-2xl bg-cyan-500 py-4 text-lg font-bold text-black shadow-[0_0_40px_rgba(34,211,238,0.30)] transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300/70">Teckna avtal</Link>}<Link href="/elavtal" className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-medium text-white/85 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/50">Jämför fler elavtal</Link></div>
      </div>
    </div>
  )
}
