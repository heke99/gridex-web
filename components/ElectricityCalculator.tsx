'use client'

import { useMemo, useState } from 'react'
import PriceResultCard from '@/components/PriceResultCard'

const AREAS = ['SE1', 'SE2', 'SE3', 'SE4'] as const
type PriceArea = (typeof AREAS)[number]

type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

export type ContractOption = {
  name: string
  value: string
  productCode: string
  pricePlanId: string
  pricePlanVersionId: string
  type: string
  monthlyFeeSek?: number | null
  invoiceFeeSek?: number | null
  markupOrePerKwh?: number | null
  variableMarkupOrePerKwh?: number | null
  fixedPriceOrePerKwh?: number | null
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

type MonthlySpotResponse = {
  priceArea: PriceArea
  year: number
  month: number
  avgSpotOre: number
}

function clampKwh(value: number) {
  if (!Number.isFinite(value)) return 2000
  return Math.min(200000, Math.max(1, value))
}

function normalizeContractType(type: string): ContractType {
  if (type === 'fixed') return 'fixed'
  if (type === 'portfolio' || type === 'portfolio_managed') return 'portfolio_managed'
  return 'spot_hourly'
}

function safeNumber(value: number | null | undefined, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

async function fetchMonthlySpot(area: PriceArea): Promise<MonthlySpotResponse> {
  const res = await fetch(`/api/elpris/monthly?area=${area}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const data = await res.json()

  if (!res.ok) {
    throw new Error(data?.error || 'Kunde inte hämta spotpris.')
  }

  return data as MonthlySpotResponse
}

export default function ElectricityCalculator({
  contracts = [],
}: {
  contracts?: ContractOption[]
}) {
  const [postalCode, setPostalCode] = useState('')
  const [manualArea, setManualArea] = useState<PriceArea | ''>('')
  const [kwh, setKwh] = useState(2000)
  const [selectedValue, setSelectedValue] = useState(contracts[0]?.value ?? '')
  const [result, setResult] = useState<PriceResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.value === selectedValue) ?? null,
    [contracts, selectedValue]
  )

  async function calculate() {
    if (!selectedContract) {
      setError('Välj ett avtal för att räkna pris.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const area = manualArea || 'SE3'
      const contractType = normalizeContractType(selectedContract.type)
      const usage = clampKwh(kwh)
      const monthlyFeeSek = safeNumber(selectedContract.monthlyFeeSek)
      const invoiceFeeSek = safeNumber(selectedContract.invoiceFeeSek)
      const markupOre = safeNumber(selectedContract.markupOrePerKwh)
      const variableFeeOre = safeNumber(selectedContract.variableMarkupOrePerKwh)

      if (contractType === 'fixed') {
        const fixedPriceOre = safeNumber(selectedContract.fixedPriceOrePerKwh)
        if (fixedPriceOre <= 0) {
          setError('Fastpris saknar kWh-pris just nu.')
          return
        }

        const pricePerKwhOre = fixedPriceOre + markupOre + variableFeeOre
        setResult({
          contract: {
            slug: selectedContract.productCode,
            name: selectedContract.name,
            contractType,
          },
          priceArea: area,
          kwh: usage,
          pricePerKwhOre,
          totalMonthlyCostSek:
            (pricePerKwhOre * usage) / 100 + monthlyFeeSek + invoiceFeeSek,
          specification: {
            basis: { type: 'admin_fixed_price', fixedPriceOre },
            fees: {
              markupOre,
              variableFeeOre,
              monthlyFeeSek: monthlyFeeSek + invoiceFeeSek,
            },
          },
        })
        return
      }

      const spot = await fetchMonthlySpot(area)
      const pricePerKwhOre = spot.avgSpotOre + markupOre + variableFeeOre

      setResult({
        contract: {
          slug: selectedContract.productCode,
          name: selectedContract.name,
          contractType,
        },
        priceArea: area,
        kwh: usage,
        pricePerKwhOre,
        totalMonthlyCostSek:
          (pricePerKwhOre * usage) / 100 + monthlyFeeSek + invoiceFeeSek,
        specification: {
          basis: {
            type: 'previous_month_avg_spot',
            year: spot.year,
            month: spot.month,
            spotAvgOre: spot.avgSpotOre,
          },
          fees: {
            markupOre,
            variableFeeOre,
            monthlyFeeSek: monthlyFeeSek + invoiceFeeSek,
          },
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta pris just nu.')
    } finally {
      setLoading(false)
    }
  }

  const hasContracts = contracts.length > 0

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
              Välj elområde, uppskatta din förbrukning och jämför våra aktuella elavtal.
              Beräkningen är en uppskattning; när du skickar in ansökan får du
              en bekräftelse med valt avtal och nästa steg.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
            Aktuella avtal och avgifter
          </div>
        </div>

        {!hasContracts ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            Det finns inga aktuella elavtal att räkna på just nu.
          </div>
        ) : null}

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
              Postnummer hjälper oss att ge en bättre uppskattning. Nätinformation kontrolleras när ansökan behandlas.
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
              <option value="">SE3 som standard</option>
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
              value={selectedValue}
              onChange={(e) => setSelectedValue(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition focus:border-cyan-500/40"
            >
              <option value="">Välj avtal</option>
              {contracts.map((contract) => (
                <option key={contract.value} value={contract.value}>
                  {contract.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/40">
              Endast aktuella elavtal visas här.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
          <button
            onClick={calculate}
            disabled={loading || !hasContracts}
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
