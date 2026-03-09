'use client'

import { useState } from 'react'
import PriceResultCard from '@/components/PriceResultCard'

const AREAS = ['SE1', 'SE2', 'SE3', 'SE4'] as const
type PriceArea = (typeof AREAS)[number]

type ContractOption = {
  name: string
  slug: string
}

type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

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
  specification: {
    basis:
      | {
          type: 'previous_month_avg_spot'
          year: number
          month: number
          spotAvgOre: number
        }
      | {
          type: 'admin_fixed_price'
          fixedPriceOre: number
        }
    fees: {
      markupOre?: number
      variableFeeOre: number
      monthlyFeeSek: number
    }
  }
}

type PriceError = {
  error: string
}

function clampKwh(value: number) {
  if (!Number.isFinite(value)) return 2000
  return Math.min(200000, Math.max(1, value))
}

export default function ElectricityCalculator({
  contracts = [],
}: {
  contracts?: ContractOption[]
}) {
  const [postalCode, setPostalCode] = useState('')
  const [manualArea, setManualArea] = useState<PriceArea | ''>('')
  const [kwh, setKwh] = useState(2000)
  const [contractSlug, setContractSlug] = useState('')
  const [result, setResult] = useState<PriceResponse | null>(null)
  const [loading, setLoading] = useState(false)

  async function calculate() {
    if (!contractSlug) {
      alert('Välj ett avtal för att räkna pris.')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postalCode: postalCode.trim(),
          manualPriceArea: manualArea || undefined,
          kwh: clampKwh(kwh),
          contractSlug,
        }),
      })

      const data = (await res.json()) as PriceResponse | PriceError

      if (!res.ok) {
        alert((data as PriceError).error)
        return
      }

      setResult(data as PriceResponse)
    } catch {
      alert('Kunde inte hämta pris just nu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F17] p-10">
      <div className="relative space-y-8">
        <div>
          <h2 className="text-3xl font-bold">Räkna ditt elpris</h2>
          <p className="mt-2 text-sm text-white/60">
            Ange postnummer eller välj elområde manuellt, välj avtal och uppskattad förbrukning.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <input
            placeholder="Postnummer"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 p-4"
          />

          <select
            value={manualArea}
            onChange={(e) => setManualArea(e.target.value as PriceArea | '')}
            className="rounded-xl border border-white/10 bg-black/40 p-4"
          >
            <option value="">Auto</option>
            {AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>

          <input
            type="number"
            value={kwh}
            min={1}
            onChange={(e) => setKwh(clampKwh(Number(e.target.value)))}
            className="rounded-xl border border-white/10 bg-black/40 p-4"
          />

          <select
            value={contractSlug}
            onChange={(e) => setContractSlug(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 p-4"
          >
            <option value="">Välj avtal</option>
            {contracts.map((contract) => (
              <option key={contract.slug} value={contract.slug}>
                {contract.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={calculate}
          disabled={loading}
          className="w-full rounded-xl bg-cyan-500 py-4 font-bold text-black disabled:opacity-60"
        >
          {loading ? 'Beräknar...' : 'Se ditt pris'}
        </button>

        {result ? <PriceResultCard data={result} updatedAt={new Date()} /> : null}
      </div>
    </section>
  )
}