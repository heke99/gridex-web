//components/PriceResultCard.tsx
'use client'

import Link from 'next/link'
import { useMemo } from 'react'

type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'
type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

type SpotBasis = {
  type: 'previous_month_avg_spot'
  year: number
  month: number
  spotAvgOre: number
}

type FixedBasis = {
  type: 'admin_fixed_price' | 'fixed_price'
  fixedPriceOre: number
}

type PriceResponse = {
  contract: {
    slug: string
    name: string
    contractType: ContractType
  }
  priceArea: PriceArea
  kwh: number
  pricePerKwhOre: number
  totalMonthlyCostSek: number
  totalMonthlyCostInclVatSek?: number
  totalYearlyCostSek?: number
  customerNotice?: string
  legalText?: string
  specification?: {
    basis?: SpotBasis | FixedBasis
    fees?: {
      markupOre?: number
      variableFeeOre?: number
      monthlyFeeSek?: number
    }
  }
}

type Props = {
  data: PriceResponse
  updatedAt?: Date
  onSelect?: () => void
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('sv-SE').format(value)
}

function formatOre(value: number) {
  return new Intl.NumberFormat('sv-SE', {
    maximumFractionDigits: 2,
  }).format(value)
}

function contractTypeLabel(type: ContractType) {
  switch (type) {
    case 'spot_hourly':
      return 'Spot / timpris'
    case 'portfolio_managed':
      return 'Portföljförvaltat'
    case 'fixed':
      return 'Fastpris'
    default:
      return 'Elavtal'
  }
}

export default function PriceResultCard({
  data,
  updatedAt,
  onSelect,
}: Props) {
  const {
    totalMonthlyCostSek,
    pricePerKwhOre,
    priceArea,
    kwh,
    specification,
    contract,
  } = data

  const basisLabel = useMemo(() => {
    if (!specification?.basis) return 'Prisbas saknas'

    if (specification.basis.type === 'previous_month_avg_spot') {
      return `Spot (snitt ${String(specification.basis.month).padStart(2, '0')}/${specification.basis.year})`
    }

    if (
      specification.basis.type === 'admin_fixed_price' ||
      specification.basis.type === 'fixed_price'
    ) {
      return 'Fast elpris'
    }

    return 'Okänd prisbas'
  }, [specification])

  const basisValue = useMemo(() => {
    if (!specification?.basis) return 0

    if (specification.basis.type === 'previous_month_avg_spot') {
      return specification.basis.spotAvgOre ?? 0
    }

    if (
      specification.basis.type === 'admin_fixed_price' ||
      specification.basis.type === 'fixed_price'
    ) {
      return specification.basis.fixedPriceOre ?? 0
    }

    return 0
  }, [specification])

  const variableFeeOre = specification?.fees?.variableFeeOre ?? 0
  const monthlyFeeSek = specification?.fees?.monthlyFeeSek ?? 0
  const markupOre = specification?.fees?.markupOre
  const contractHref = contract?.slug
    ? `/teckna?contract=${encodeURIComponent(contract.slug)}`
    : '/teckna'

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-6 transition hover:border-cyan-400/40 md:p-8">
      <div className="pointer-events-none absolute -right-28 -top-28 h-[280px] w-[280px] rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="relative space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
              {contractTypeLabel(contract?.contractType ?? 'fixed')}
            </div>

            <div>
              <div className="text-lg font-semibold text-white">
                {contract?.name ?? 'Avtal'}
              </div>
              <div className="text-sm text-gray-400">
                {priceArea} • {formatNumber(kwh ?? 0)} kWh / månad
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            Live
            {updatedAt ? (
              <span>
                •{' '}
                {updatedAt.toLocaleTimeString('sv-SE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            ) : null}
          </div>
        </div>

        {data.customerNotice ? (
          <div
            className={`rounded-2xl border p-4 text-sm ${
              contract.contractType === 'spot_hourly'
                ? 'border-amber-500/25 bg-amber-500/10 text-amber-100'
                : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
            }`}
          >
            {data.customerNotice}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-gray-400">Beräknad månadskostnad</div>
            <div className="mt-2 text-4xl font-bold tracking-tight text-white">
              {formatNumber(totalMonthlyCostSek ?? 0)} kr
              <span className="ml-2 text-lg text-gray-400">/ mån</span>
            </div>
            <div className="mt-2 text-sm text-gray-400">
              {formatOre(pricePerKwhOre ?? 0)} öre/kWh
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-sm font-medium text-white">
              Vad ingår i priset?
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Du ser grunden för priset samt avgifter och eventuella påslag innan
              du går vidare till teckning.
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-300">{basisLabel}</span>
            <span className="text-gray-100">{formatOre(basisValue)} öre</span>
          </div>

          {markupOre !== undefined ? (
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Påslag</span>
              <span className="text-gray-100">{formatOre(markupOre)} öre</span>
            </div>
          ) : null}

          <div className="flex justify-between gap-4">
            <span className="text-gray-300">Rörlig avgift</span>
            <span className="text-gray-100">{formatOre(variableFeeOre)} öre</span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-gray-300">Månadsavgift</span>
            <span className="text-gray-100">{formatNumber(monthlyFeeSek)} kr</span>
          </div>
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
            href="/avtal"
            className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-medium text-white/85 transition hover:bg-white/10"
          >
            Jämför fler elavtal
          </Link>
        </div>
      </div>
    </div>
  )
}