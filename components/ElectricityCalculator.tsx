'use client'

import { useMemo, useState } from 'react'
import PriceResultCard from '@/components/PriceResultCard'
import {
  normalizeWebsitePostalCode,
  previewWebsitePricing,
  resolveWebsiteEnergyArea,
  type WebsiteEnergyResolution,
  type WebsitePriceArea,
  type WebsitePricingPreview,
} from '@/lib/website/publicApi'


type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

export type ContractOption = {
  name: string
  value: string
  productCode: string
  pricePlanId: string
  pricePlanVersionId: string
  contractId?: string | null
  type: string
  monthlyFeeSek?: number | null
  invoiceFeeSek?: number | null
  markupOrePerKwh?: number | null
  variableMarkupOrePerKwh?: number | null
  fixedPriceOrePerKwh?: number | null
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

function customerSafeError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Kunde inte hämta pris just nu.'
  if (
    /NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|redirect/i.test(message) ||
    /<!doctype|<html|text\/html/i.test(message)
  ) {
    return 'Priset kunde inte hämtas just nu. Kontrollera adressen och försök igen om en stund.'
  }
  return message || 'Kunde inte hämta pris just nu.'
}

function areaLabel(area: WebsitePriceArea | null) {
  return area ? `${area} elområde` : 'Ange adress för elområde'
}

export default function ElectricityCalculator({
  contracts = [],
  initialSelectedValue = '',
}: {
  contracts?: ContractOption[]
  initialSelectedValue?: string
}) {
  const initialValue = contracts.some((contract) => contract.value === initialSelectedValue)
    ? initialSelectedValue
    : contracts[0]?.value ?? ''

  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [kwh, setKwh] = useState(2000)
  const [selectedValue, setSelectedValue] = useState(initialValue)
  const [resolution, setResolution] = useState<WebsiteEnergyResolution | null>(null)
  const [result, setResult] = useState<WebsitePricingPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.value === selectedValue) ?? null,
    [contracts, selectedValue]
  )

  const effectiveArea = resolution?.price_area_code || null
  const hasContracts = contracts.length > 0

  async function resolveArea(): Promise<WebsitePriceArea> {
    const normalizedPostalCode = normalizeWebsitePostalCode(postalCode)
    if (!/^\d{5}$/.test(normalizedPostalCode)) {
      throw new Error('Ange ett svenskt postnummer med 5 siffror.')
    }

    const resolved = await resolveWebsiteEnergyArea({
      postal_code: normalizedPostalCode,
      city: city || null,
      address: address || null,
      street: address || null,
    })

    setResolution(resolved)

    if (!resolved.price_area_code) {
      throw new Error(
        resolved.customer_message ||
          'Vi kunde inte fastställa elområde automatiskt. Kontrollera adressen eller välj elområde själv om du redan vet det.'
      )
    }

    return resolved.price_area_code
  }

  async function calculate() {
    if (!selectedContract) {
      setError('Välj ett avtal för att räkna pris.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const resolvedArea = await resolveArea()
      const preview = await previewWebsitePricing({
        contract_id: selectedContract.contractId ?? null,
        price_plan_id: selectedContract.pricePlanId,
        price_plan_version_id: selectedContract.pricePlanVersionId,
        product_code: selectedContract.productCode,
        price_area_code: resolvedArea,
        postal_code: normalizeWebsitePostalCode(postalCode) || null,
        city: city || null,
        address: address || null,
        estimated_monthly_kwh: clampKwh(kwh),
      })

      setResult({
        ...preview,
        contract: {
          ...preview.contract,
          contractType: normalizeContractType(preview.contract.contractType),
        },
      })
    } catch (err) {
      setError(customerSafeError(err))
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
              Postnummer → elområde → rätt pris
            </div>

            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
              Räkna ditt elpris
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-white/60 md:text-base">
              Ange postnummer. Vi använder det enbart för att hitta rätt elområde för prisvisningen.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
            {areaLabel(effectiveArea)}
          </div>
        </div>

        {!hasContracts ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            Det finns inga aktuella elavtal att räkna på just nu.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Postnummer</label>
            <input
              placeholder="Till exempel 19145"
              inputMode="numeric"
              value={postalCode}
              onChange={(e) => {
                setPostalCode(e.target.value)
                setResolution(null)
                setResult(null)
              }}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40"
            />
            <p className="text-xs text-white/40">
              Postnumret används bara för att visa pris för rätt elområde.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Ort</label>
            <input
              placeholder="Till exempel Sollentuna"
              value={city}
              onChange={(e) => {
                setCity(e.target.value)
                setResolution(null)
                setResult(null)
              }}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40"
            />
            <p className="text-xs text-white/40">Valfritt, används bara som stöd i prisvisningen.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Adress</label>
            <input
              placeholder="Gata och nummer"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value)
                setResolution(null)
                setResult(null)
              }}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40"
            />
            <p className="text-xs text-white/40">
              Valfritt, används inte för anläggningsverifiering.
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
              onChange={(e) => {
                setKwh(clampKwh(Number(e.target.value)))
                setResult(null)
              }}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition focus:border-cyan-500/40"
            />
            <p className="text-xs text-white/40">
              Använd uppskattad månadsförbrukning för bättre träff.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Elavtal</label>
            <select
              value={selectedValue}
              onChange={(e) => {
                setSelectedValue(e.target.value)
                setResult(null)
              }}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition focus:border-cyan-500/40"
            >
              <option value="">Välj avtal</option>
              {contracts.map((contract) => (
                <option key={contract.value} value={contract.value}>
                  {contract.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/40">Endast aktuella elavtal visas här.</p>
          </div>
        </div>

        {resolution ? (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <div className="font-semibold">
              {resolution.price_area_code
                ? `Prisområdet är ${resolution.price_area_code}`
                : 'Prisområde behöver kontrolleras'}
            </div>
            <div className="mt-1 text-emerald-50/80">
              Uppgiften används endast för att visa pris, inte för anläggningskontroll.
              {resolution.confidence != null
                ? ` • träffsäkerhet ${Math.round(resolution.confidence * 100)}%`
                : ''}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
          <button
            type="button"
            onClick={calculate}
            disabled={loading || !hasContracts}
            className="w-full rounded-2xl bg-cyan-500 py-4 font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Beräknar...' : 'Hämta pris för postnumret'}
          </button>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300">
            Priset räknas på valt avtal och elområdet för postnumret.
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
            Fyll i uppgifterna ovan och klicka på “Hämta pris för postnumret”. Då visas
            en prisuppskattning baserad på rätt SE-område.
          </div>
        )}
      </div>
    </section>
  )
}
