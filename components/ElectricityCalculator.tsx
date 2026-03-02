'use client'

import { useState } from 'react'
import PriceResultCard from '@/components/PriceResultCard'

const AREAS = ['SE1', 'SE2', 'SE3', 'SE4'] as const
type PriceArea = typeof AREAS[number]

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

    const res = await fetch('/api/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postalCode,
        manualPriceArea: manualArea || undefined,
        kwh,
        contractSlug,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      alert((data as PriceError).error)
      return
    }

    setResult(data as PriceResponse)
  }

  return (
    <section className="relative bg-[#0B0F17] rounded-2xl border border-white/10 p-10 overflow-hidden">
      <div className="relative space-y-8">
        <div>
          <h2 className="text-3xl font-bold">Räkna ditt elpris</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <input
            placeholder="Postnummer"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            className="p-4 bg-black/40 border border-white/10 rounded-xl"
          />

          <select
            value={manualArea}
            onChange={(e) => setManualArea(e.target.value as PriceArea)}
            className="p-4 bg-black/40 border border-white/10 rounded-xl"
          >
            <option value="">Auto</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <input
            type="number"
            value={kwh}
            min={1}
            onChange={(e) => setKwh(Number(e.target.value))}
            className="p-4 bg-black/40 border border-white/10 rounded-xl"
          />

          <select
            value={contractSlug}
            onChange={(e) => setContractSlug(e.target.value)}
            className="p-4 bg-black/40 border border-white/10 rounded-xl"
          >
            <option value="">Välj avtal</option>
            {contracts.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={calculate}
          disabled={loading}
          className="w-full bg-cyan-500 text-black py-4 rounded-xl font-bold"
        >
          {loading ? 'Beräknar...' : 'Se ditt pris'}
        </button>

        {result && (
          <PriceResultCard
            data={result}
            updatedAt={new Date()}
          />
        )}
      </div>
    </section>
  )
}