//components/ElectricityCalculator.tsx
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
  const [contractSlug, setContractSlug] = useState(contracts[0]?.slug ?? '')
  const [result, setResult] = useState<PriceResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function calculate() {
    if (!contractSlug) {
      setError('Välj ett avtal för att räkna pris.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/offers/calculate', {
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
        setError((data as PriceError).error || 'Kunde inte beräkna priset.')
        return
      }

      setResult(data as PriceResponse)
    } catch {
      setError('Kunde inte hämta pris just nu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      id="rakna-elpris"
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-6 md:p-10"
    >
      <div className="pointer-events-none absolute -top-24 right-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-[100px]" />

      <div className="relative space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
Föregående månads spotpris • SE1–SE4 • Transparent pris
            </div>

            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
              Räkna ditt elpris
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-white/60 md:text-base">
              Ange postnummer eller välj elområde manuellt, välj avtal och fyll i
              uppskattad förbrukning. Rörligt pris beräknas med föregående
              kalendermånads snittspot från elprisetjustnu API. Förbrukningen
              påverkar totalen, inte själva spotpriset.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
Spotpris: föregående kalendermånads API-snitt, inte ett manuellt pris
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">
              Postnummer
            </label>
            <input
              placeholder="Till exempel 11455"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40"
            />
            <p className="text-xs text-white/40">
              Ange postnummer för automatisk områdesmatchning.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">
              Elområde
            </label>
            <select
              value={manualArea}
              onChange={(e) => setManualArea(e.target.value as PriceArea | '')}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition focus:border-cyan-500/40"
            >
              <option value="">Auto</option>
              {AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/40">
              Välj manuellt om du redan vet vilket område du tillhör.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">
              Förbrukning (kWh / månad)
            </label>
            <input
              type="number"
              value={kwh}
              min={1}
              onChange={(e) => setKwh(clampKwh(Number(e.target.value)))}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition focus:border-cyan-500/40"
            />
            <p className="text-xs text-white/40">
              Använd din uppskattade månadsförbrukning för bättre träff.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Elavtal</label>
            <select
              value={contractSlug}
              onChange={(e) => setContractSlug(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition focus:border-cyan-500/40"
            >
              <option value="">Välj avtal</option>
              {contracts.map((contract) => (
                <option key={contract.slug} value={contract.slug}>
                  {contract.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/40">
              Välj det avtal du vill jämföra och räkna på.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
          <button
            onClick={calculate}
            disabled={loading}
            className="w-full rounded-2xl bg-cyan-500 py-4 font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Beräknar...' : 'Se ditt pris'}
          </button>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300">
            Du ser full specifikation innan teckning.
          </div>
        </div>

        <div aria-live="polite">
          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="pt-2" aria-live="polite">
            <PriceResultCard data={result} updatedAt={new Date()} />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/40">
            Fyll i uppgifterna ovan och klicka på “Se ditt pris” för att visa
            föregående månads spotbaserade pris här.
          </div>
        )}
      </div>
    </section>
  )
}