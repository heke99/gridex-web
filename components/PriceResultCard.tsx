// components/PriceResultCard.tsx
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

function formatNumber(n: number) {
  return new Intl.NumberFormat('sv-SE').format(n)
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
      return `Spot (snitt ${specification.basis.month}/${specification.basis.year})`
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
    <div className="relative rounded-2xl bg-[#0B0F17] border border-white/10 p-8 overflow-hidden transition hover:border-cyan-400/40">
      {/* Glow effect */}
      <div className="absolute -top-32 -right-32 w-[300px] h-[300px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">
              {contract?.name ?? 'Avtal'}
            </div>
            <div className="text-xs text-gray-500">
              {priceArea} • {formatNumber(kwh ?? 0)} kWh/mån
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Live
            {updatedAt && (
              <span>
                • {updatedAt.toLocaleTimeString('sv-SE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>

        {/* Main Price */}
        <div>
          <div className="text-4xl font-bold tracking-tight">
            {formatNumber(totalMonthlyCostSek ?? 0)} kr
            <span className="text-lg text-gray-400 ml-2">/ mån</span>
          </div>

          <div className="text-sm text-gray-400 mt-1">
            {pricePerKwhOre ?? 0} öre/kWh
          </div>
        </div>

        {/* Specification */}
        <div className="border-t border-white/10 pt-6 space-y-3 text-sm">

          <div className="flex justify-between">
            <span className="text-gray-300">{basisLabel}</span>
            <span className="text-gray-100">{basisValue} öre</span>
          </div>

          {markupOre !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-300">Påslag</span>
              <span className="text-gray-100">
                {markupOre} öre
              </span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-gray-300">Rörlig avgift</span>
            <span className="text-gray-100">
              {variableFeeOre} öre
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-300">Månadsavgift</span>
            <span className="text-gray-100">
              {formatNumber(monthlyFeeSek)} kr
            </span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onSelect}
          className="w-full bg-cyan-500 hover:bg-cyan-400 transition text-black py-4 rounded-xl font-bold text-lg shadow-[0_0_40px_rgba(34,211,238,0.35)]"
        >
          Teckna avtal
        </button>

      </div>
    </div>
  )
}