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
  type WebsitePricingQuoteContext,
} from '@/lib/website/publicApi'

export type ContractOption = {
  name: string
  value: string
  offerReference: string
  type: string
  monthlyFeeSek?: number | null
  invoiceFeeSek?: number | null
  markupOrePerKwh?: number | null
  variableMarkupOrePerKwh?: number | null
  fixedPriceOrePerKwh?: number | null
  monthlyFixedPriceSek?: number | null
  elcertOrePerKwh?: number | null
  portfolioPriceOrePerKwh?: number | null
  vatRate?: number | null
  pricingModel?: string | null
  spotShare?: number | null
  portfolioShare?: number | null
}

type Props = {
  contracts?: ContractOption[]
  initialSelectedValue?: string
  selectedValue?: string
  onSelectedValueChange?: (value: string) => void
  onPricingPreviewChange?: (preview: WebsitePricingPreview | null) => void
  onEnergyResolutionChange?: (resolution: WebsiteEnergyResolution | null) => void
  onEstimatedMonthlyKwhChange?: (kwh: number | null) => void
  onQuoteContextChange?: (context: WebsitePricingQuoteContext | null) => void
  initialPricingPreview?: WebsitePricingPreview | null
}

function validKwh(value: string): number | null {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 200000 ? parsed : null
}

function normalizeContractType(type: string): WebsitePricingPreview['contract']['contractType'] {
  if (type === 'fixed') return 'fixed'
  if (type === 'portfolio' || type === 'portfolio_managed') return 'portfolio_managed'
  if (type === 'mix' || type === 'mixed') return 'mix'
  return 'spot_hourly'
}

function customerSafeError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Kunde inte hämta pris just nu.'
  if (/NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|redirect/i.test(message) || /<!doctype|<html|text\/html/i.test(message)) {
    return 'Priset kunde inte hämtas just nu. Kontrollera uppgifterna och försök igen om en stund.'
  }
  return message || 'Kunde inte hämta pris just nu.'
}

function areaLabel(area: WebsitePriceArea | null) {
  return area ? `Elområde: ${area}` : 'Ange adress för att räkna pris'
}

function manualResolution(area: WebsitePriceArea): WebsiteEnergyResolution {
  return {
    status: 'manual_price_area',
    price_area_code: area,
    confidence: 1,
    source: 'customer_selected_price_area',
    customer_message: 'Elområdet har valts manuellt för prisberäkning. Vid teckning kontrolleras adressen igen.',
  }
}

export default function ElectricityCalculator({
  contracts = [],
  initialSelectedValue = '',
  selectedValue: controlledSelectedValue,
  onSelectedValueChange,
  onPricingPreviewChange,
  onEnergyResolutionChange,
  onEstimatedMonthlyKwhChange,
  onQuoteContextChange,
  initialPricingPreview = null,
}: Props) {
  const initialValue = contracts.some((contract) => contract.value === initialSelectedValue)
    ? initialSelectedValue
    : (contracts[0]?.value ?? '')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [kwhInput, setKwhInput] = useState(String(initialPricingPreview?.kwh ?? 2000))
  const [internalSelectedValue, setInternalSelectedValue] = useState(initialValue)
  const [manualArea, setManualArea] = useState<WebsitePriceArea | ''>(initialPricingPreview?.price_area_code ?? initialPricingPreview?.priceArea ?? '')
  const [resolution, setResolutionState] = useState<WebsiteEnergyResolution | null>(
    initialPricingPreview ? manualResolution(initialPricingPreview.price_area_code ?? initialPricingPreview.priceArea) : null,
  )
  const [result, setResultState] = useState<WebsitePricingPreview | null>(initialPricingPreview)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedValue = controlledSelectedValue ?? internalSelectedValue
  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.value === selectedValue) ?? null,
    [contracts, selectedValue],
  )
  const effectiveArea = resolution?.price_area_code || (manualArea || null)
  const hasContracts = contracts.length > 0
  const monthlyKwh = validKwh(kwhInput)

  function setSelectedValue(value: string) {
    setInternalSelectedValue(value)
    onSelectedValueChange?.(value)
    setResult(null)
  }

  function setResolution(value: WebsiteEnergyResolution | null) {
    setResolutionState(value)
    onEnergyResolutionChange?.(value)
  }

  function setResult(value: WebsitePricingPreview | null) {
    setResultState(value)
    onPricingPreviewChange?.(value)
  }

  function clearQuote() {
    setResult(null)
    onQuoteContextChange?.(null)
    setError(null)
  }

  async function resolveArea(): Promise<WebsitePriceArea> {
    const normalizedPostalCode = normalizeWebsitePostalCode(postalCode)
    if (manualArea) {
      const manual = manualResolution(manualArea)
      setResolution(manual)
      return manualArea
    }
    if (!/^\d{5}$/.test(normalizedPostalCode) || !city.trim() || !address.trim()) {
      throw new Error('Ange adress, ort och ett svenskt postnummer med 5 siffror innan du räknar pris.')
    }

    const resolved = await resolveWebsiteEnergyArea({
      postal_code: normalizedPostalCode,
      city: city.trim(),
      address: address.trim(),
      street: address.trim(),
    })
    setResolution(resolved)
    if (!resolved.price_area_code) {
      throw new Error(resolved.customer_message || 'Vi kunde inte fastställa elområde automatiskt. Välj SE1, SE2, SE3 eller SE4 manuellt om du redan vet ditt elområde.')
    }
    return resolved.price_area_code
  }

  async function calculate() {
    if (!selectedContract) return setError('Välj ett avtal för att räkna pris.')
    if (!monthlyKwh) return setError('Ange en månadsförbrukning mellan 1 och 200 000 kWh.')
    const normalizedPostalCode = normalizeWebsitePostalCode(postalCode)
    if (!/^\d{5}$/.test(normalizedPostalCode) || !city.trim() || !address.trim()) {
      return setError('Ange adress, ort och ett svenskt postnummer med 5 siffror innan du räknar pris.')
    }

    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const resolvedArea = await resolveArea()
      const preview = await previewWebsitePricing({
        offer_reference: selectedContract.offerReference,
        price_area_code: resolvedArea,
        postal_code: normalizeWebsitePostalCode(postalCode),
        city: city.trim(),
        address: address.trim(),
        estimated_monthly_kwh: monthlyKwh,
      })
      setResult({
        ...preview,
        contract: {
          ...preview.contract,
          contractType: normalizeContractType(preview.contract.contractType),
          offer_reference: preview.contract.offer_reference ?? selectedContract.offerReference,
        },
      })
      onQuoteContextChange?.({
        postal_code: normalizedPostalCode,
        city: city.trim(),
        address: address.trim(),
        price_area_code: resolvedArea,
        estimated_monthly_kwh: monthlyKwh,
      })
    } catch (err) {
      setError(customerSafeError(err))
    } finally {
      setLoading(false)
    }
  }

  function updateKwh(value: string) {
    setKwhInput(value)
    const next = validKwh(value)
    onEstimatedMonthlyKwhChange?.(next)
    clearQuote()
  }

  const postalCodeHelpId = 'calculator-postal-code-help'
  const calculationStatusId = 'calculator-status'

  return (
    <section id="rakna-elpris" className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-6 md:p-10">
      <div className="pointer-events-none absolute -top-24 right-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-[100px]" />
      <div className="relative space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">Adress → elområde → prisberäkning</div>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">Räkna ditt elpris</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60 md:text-base">Priset hämtas från det valda publicerade avtalet. Prisberäkningen säkras för avtal, elområde, adress och månadsförbrukning innan den kan användas i teckning.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300" aria-live="polite">{areaLabel(effectiveArea)}</div>
        </div>

        {!hasContracts ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">Det finns inga aktuella elavtal att räkna på just nu.</div> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="calculator-postal-code" className="text-sm font-medium text-white/80">Postnummer</label>
            <input id="calculator-postal-code" placeholder="Till exempel 21120" inputMode="numeric" value={postalCode} onChange={(event) => { setPostalCode(event.target.value); setResolution(null); clearQuote() }} aria-describedby={postalCodeHelpId} className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30" />
            <p id={postalCodeHelpId} className="text-xs text-white/40">Används tillsammans med adress och ort för att fastställa rätt elområde.</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="calculator-city" className="text-sm font-medium text-white/80">Ort</label>
            <input id="calculator-city" placeholder="Till exempel Malmö" value={city} onChange={(event) => { setCity(event.target.value); setResolution(null); clearQuote() }} className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30" />
          </div>
          <div className="space-y-2">
            <label htmlFor="calculator-address" className="text-sm font-medium text-white/80">Adress</label>
            <input id="calculator-address" placeholder="Gata och nummer" value={address} onChange={(event) => { setAddress(event.target.value); setResolution(null); clearQuote() }} className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30" />
          </div>
          <div className="space-y-2">
            <label htmlFor="calculator-manual-area" className="text-sm font-medium text-white/80">Elområde manuellt (vägledande)</label>
            <select id="calculator-manual-area" value={manualArea} onChange={(event) => { const next = event.target.value as WebsitePriceArea | ''; setManualArea(next); setResolution(next ? manualResolution(next) : null); clearQuote() }} className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30">
              <option value="">Hitta via adress</option><option value="SE1">SE1</option><option value="SE2">SE2</option><option value="SE3">SE3</option><option value="SE4">SE4</option>
            </select>
            <p className="text-xs text-white/40">Används för prisberäkning om automatisk matchning saknas. Vid teckning kontrolleras adress och elområde igen.</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="calculator-kwh" className="text-sm font-medium text-white/80">Förbrukning (kWh / månad)</label>
            <input id="calculator-kwh" type="number" value={kwhInput} min={1} max={200000} onChange={(event) => updateKwh(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30" />
            <p className="text-xs text-white/40">Ange uppskattad månadsförbrukning. Ett exakt kWh-värde krävs för en prisberäkning.</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="calculator-contract" className="text-sm font-medium text-white/80">Elavtal</label>
            <select id="calculator-contract" value={selectedValue} onChange={(event) => setSelectedValue(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30">
              <option value="">Välj avtal</option>{contracts.map((contract) => <option key={contract.value} value={contract.value}>{contract.name}</option>)}
            </select>
          </div>
        </div>

        {resolution?.price_area_code ? <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-100">Elområde: {resolution.price_area_code}</div> : null}
        <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
          <button type="button" onClick={calculate} disabled={loading || !hasContracts} className="w-full rounded-2xl bg-cyan-500 py-4 font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70">{loading ? 'Beräknar...' : 'Hämta pris'}</button>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300">Prisberäkningen baseras på valt avtal, elområde och uppskattad förbrukning. Rörligt pris följer marknaden och kan ändras över tid.</div>
        </div>
        <div id={calculationStatusId} aria-live="polite">{error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}</div>
        {result ? <div className="pt-2" aria-live="polite"><PriceResultCard data={result} updatedAt={new Date()} /></div> : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/40">Fyll i adress, ort, postnummer, förbrukning och valt avtal. Sedan kan du hämta en prisberäkning.</div>}
      </div>
    </section>
  )
}
