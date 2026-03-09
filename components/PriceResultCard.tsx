'use client'

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
  type: 'admin_fixed_price'
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

    if (specification.basis.type === 'admin_fixed_price') {
      return 'Fast pris (admin)'
    }

    return 'Okänd prisbas'
  }, [specification])

  const basisValue = useMemo(() => {
    if (!specification?.basis) return 0

    if (specification.basis.type === 'previous_month_avg_spot') {
      return specification.basis.spotAvgOre ?? 0
    }

    if (specification.basis.type === 'admin_fixed_price') {
      return specification.basis.fixedPriceOre ?? 0
    }

    return 0
  }, [specification])

  const variableFeeOre = specification?.fees?.variableFeeOre ?? 0
  const monthlyFeeSek = specification?.fees?.monthlyFeeSek ?? 0
  const markupOre = specification?.fees?.markupOre

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F17] p-8 transition hover:border-cyan-400/40">
      <div className="pointer-events-none absolute -right-32 -top-32 h-[300px] w-[300px] rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="relative space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">
              {contract?.name ?? 'Avtal'}
            </div>
            <div className="text-xs text-gray-500">
              {priceArea} • {formatNumber(kwh ?? 0)} kWh/mån
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
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

        <div>
          <div className="text-4xl font-bold tracking-tight">
            {formatNumber(totalMonthlyCostSek ?? 0)} kr
            <span className="ml-2 text-lg text-gray-400">/ mån</span>
          </div>

          <div className="mt-1 text-sm text-gray-400">
            {formatOre(pricePerKwhOre ?? 0)} öre/kWh
          </div>
        </div>

        <div className="space-y-3 border-t border-white/10 pt-6 text-sm">
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

        <button
          onClick={onSelect}
          className="w-full rounded-xl bg-cyan-500 py-4 text-lg font-bold text-black shadow-[0_0_40px_rgba(34,211,238,0.35)] transition hover:bg-cyan-400"
        >
          Teckna avtal
        </button>
      </div>
    </div>
  )
}