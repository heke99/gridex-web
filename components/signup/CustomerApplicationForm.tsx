'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import PriceResultCard from '@/components/PriceResultCard'
import {
  isWebsitePriceArea,
  normalizeWebsitePostalCode,
  previewWebsitePricing,
  resolveWebsiteEnergyArea,
  type WebsiteEnergyResolution,
  type WebsitePriceArea,
  type WebsitePricingPreview,
} from '@/lib/website/publicApi'

export type SignupContractOption = {
  name: string
  value: string
  productCode: string
  pricePlanId: string
  pricePlanVersionId: string
  contractId?: string | null
  type: string
  termsVersion?: string | null
  privacyPolicyVersion?: string | null
  cancellationRightVersion?: string | null
  powerOfAttorneyVersion?: string | null
}

type UTMParams = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

type Props = {
  contracts: SignupContractOption[]
  initialSelectedValue: string
  canSubmit: boolean
  utm: UTMParams
  action: (formData: FormData) => void | Promise<void>
}

const AREAS = ['SE1', 'SE2', 'SE3', 'SE4'] as const

function clampKwh(value: number) {
  if (!Number.isFinite(value)) return 2000
  return Math.min(200000, Math.max(1, value))
}

function normalizeContractType(type: string): 'spot_hourly' | 'portfolio_managed' | 'fixed' {
  if (type === 'fixed') return 'fixed'
  if (type === 'portfolio' || type === 'portfolio_managed') return 'portfolio_managed'
  return 'spot_hourly'
}

function stringifySnapshot(value: unknown): string {
  try {
    return JSON.stringify(value ?? {})
  } catch {
    return '{}'
  }
}

function resolutionMessage(resolution: WebsiteEnergyResolution | null) {
  if (!resolution) return 'Ange adress och kontrollera prisområdet.'
  if (resolution.price_area_code) {
    const owner = resolution.grid_owner_name ? ` hos ${resolution.grid_owner_name}` : ''
    return `Prisområdet är ${resolution.price_area_code}${owner}.`
  }
  return resolution.customer_message || 'Prisområde behöver kontrolleras innan avtalet startar.'
}

export default function CustomerApplicationForm({
  contracts,
  initialSelectedValue,
  canSubmit,
  utm,
  action,
}: Props) {
  const initialValue = contracts.some((contract) => contract.value === initialSelectedValue)
    ? initialSelectedValue
    : contracts[0]?.value ?? ''

  const [customerType, setCustomerType] = useState<'private' | 'company'>('private')
  const [selectedValue, setSelectedValue] = useState(initialValue)
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [apartment, setApartment] = useState('')
  const [monthlyKwh, setMonthlyKwh] = useState(2000)
  const [manualArea, setManualArea] = useState<WebsitePriceArea | ''>('')
  const [resolution, setResolution] = useState<WebsiteEnergyResolution | null>(null)
  const [preview, setPreview] = useState<WebsitePricingPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.value === selectedValue) ?? null,
    [contracts, selectedValue]
  )

  const resolvedArea = manualArea || resolution?.price_area_code || null
  const previewSnapshot = preview
    ? {
        price_area_code: preview.priceArea,
        kwh: preview.kwh,
        price_per_kwh_ore: preview.pricePerKwhOre,
        total_monthly_cost_sek: preview.totalMonthlyCostSek,
        total_monthly_cost_inc_vat_sek: preview.totalMonthlyCostInclVatSek,
        specification: preview.specification ?? null,
      }
    : null

  async function resolveArea(): Promise<WebsitePriceArea | null> {
    if (manualArea) {
      const manualResolution: WebsiteEnergyResolution = {
        status: 'manual',
        price_area_code: manualArea,
        source: 'manual',
        customer_message: 'Du har valt elområde själv.',
      }
      setResolution(manualResolution)
      return manualArea
    }

    const normalizedPostalCode = normalizeWebsitePostalCode(postalCode)
    if (!/^\d{5}$/.test(normalizedPostalCode)) {
      throw new Error('Ange ett svenskt postnummer med 5 siffror.')
    }

    const resolved = await resolveWebsiteEnergyArea({
      postal_code: normalizedPostalCode,
      city: city || null,
      address: address || null,
      street: address || null,
      apartment: apartment || null,
    })

    setResolution(resolved)

    if (!resolved.price_area_code) {
      throw new Error(
        resolved.customer_message ||
          'Vi kunde inte fastställa elområde automatiskt. Ansökan kan skickas, men uppgifterna behöver kontrolleras innan avtalet startar.'
      )
    }

    return resolved.price_area_code
  }

  async function calculatePreview() {
    if (!selectedContract) {
      setPreviewError('Välj ett elavtal först.')
      return
    }

    setLoadingPreview(true)
    setPreviewError(null)
    setPreview(null)

    try {
      const area = await resolveArea()
      if (!area) return

      const result = await previewWebsitePricing({
        contract_id: selectedContract.contractId ?? null,
        price_plan_id: selectedContract.pricePlanId,
        price_plan_version_id: selectedContract.pricePlanVersionId,
        product_code: selectedContract.productCode,
        price_area_code: area,
        postal_code: normalizeWebsitePostalCode(postalCode) || null,
        city: city || null,
        address: address || null,
        estimated_monthly_kwh: clampKwh(monthlyKwh),
      })

      setPreview({
        ...result,
        contract: {
          ...result.contract,
          contractType: normalizeContractType(result.contract.contractType),
        },
      })
    } catch (error) {
      setPreviewError(
        error instanceof Error
          ? error.message
          : 'Priset kunde inte räknas just nu. Du kan ändå skicka ansökan så kontrollerar vi uppgifterna.'
      )
    } finally {
      setLoadingPreview(false)
    }
  }

  function resetEnergyState() {
    setResolution(null)
    setPreview(null)
    setPreviewError(null)
  }

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="utm_source" value={utm.utm_source ?? ''} />
      <input type="hidden" name="utm_medium" value={utm.utm_medium ?? ''} />
      <input type="hidden" name="utm_campaign" value={utm.utm_campaign ?? ''} />
      <input type="hidden" name="price_area_code" value={resolvedArea ?? ''} />
      <input type="hidden" name="grid_area_code" value={resolution?.grid_area_code ?? ''} />
      <input type="hidden" name="grid_owner_id" value={resolution?.grid_owner_id ?? ''} />
      <input type="hidden" name="grid_owner_name" value={resolution?.grid_owner_name ?? ''} />
      <input type="hidden" name="energy_resolution_status" value={resolution?.status ?? ''} />
      <input
        type="hidden"
        name="energy_resolution_confidence"
        value={resolution?.confidence != null ? String(resolution.confidence) : ''}
      />
      <input type="hidden" name="estimated_monthly_kwh" value={String(clampKwh(monthlyKwh))} />
      <input
        type="hidden"
        name="pricing_preview_snapshot"
        value={stringifySnapshot(previewSnapshot)}
      />

      <div className="hidden" aria-hidden="true">
        <label>
          Företagswebbplats
          <input name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-white/80">Kundtyp</label>
          <select
            name="customer_type"
            value={customerType}
            onChange={(event) =>
              setCustomerType(event.target.value === 'company' ? 'company' : 'private')
            }
            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition focus:border-cyan-500/40"
          >
            <option value="private">Privatkund</option>
            <option value="company">Företag</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-white/80">Avtal</label>
          <select
            name="selected_offer"
            required
            value={selectedValue}
            onChange={(event) => {
              setSelectedValue(event.target.value)
              setPreview(null)
              setPreviewError(null)
            }}
            disabled={contracts.length === 0}
            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition focus:border-cyan-500/40 disabled:opacity-60"
          >
            {contracts.map((contract) => (
              <option key={contract.value} value={contract.value}>
                {contract.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-white/45">
            Valt avtal och prisversion sparas tillsammans med ansökan.
          </p>
        </div>

        {customerType === 'private' ? (
          <>
            <Field label="Förnamn" name="first_name" />
            <Field label="Efternamn" name="last_name" />
            <Field label="Personnummer" name="personal_number" />
          </>
        ) : (
          <>
            <Field label="Företagsnamn" name="company_name" />
            <Field label="Organisationsnummer" name="organization_number" />
          </>
        )}

        <Field label="E-post" name="email" type="email" required />
        <Field label="Telefon" name="phone" required />
        <Field
          label="Adress"
          name="address"
          required
          value={address}
          onChange={(value) => {
            setAddress(value)
            resetEnergyState()
          }}
        />
        <Field
          label="Postnummer"
          name="postal_code"
          required
          inputMode="numeric"
          value={postalCode}
          onChange={(value) => {
            setPostalCode(value)
            resetEnergyState()
          }}
        />
        <Field
          label="Ort"
          name="city"
          required
          value={city}
          onChange={(value) => {
            setCity(value)
            resetEnergyState()
          }}
        />
        <Field
          label="Lägenhet"
          name="apartment"
          value={apartment}
          onChange={(value) => {
            setApartment(value)
            resetEnergyState()
          }}
        />

        <div>
          <label className="text-sm font-medium text-white/80">Elområde om du redan vet det</label>
          <select
            value={manualArea}
            onChange={(event) => {
              const value = event.target.value
              setManualArea(isWebsitePriceArea(value) ? value : '')
              resetEnergyState()
            }}
            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition focus:border-cyan-500/40"
          >
            <option value="">Hämta automatiskt från adressen</option>
            {AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-white/45">
            Normalt räcker postnummer och adress. Manuell väljare finns som säker reserv.
          </p>
        </div>

        <Field
          label="Uppskattad förbrukning"
          name="monthly_kwh_display"
          type="number"
          help="kWh per månad. Används endast för prisuppskattningen."
          value={String(monthlyKwh)}
          onChange={(value) => {
            setMonthlyKwh(clampKwh(Number(value)))
            setPreview(null)
          }}
        />

        <Field
          label="Anläggnings-ID"
          name="facility_id"
          help="Valfritt. Gridex kan behöva komplettera uppgiften från ditt elnätsföretag innan avtalet startar."
        />
        <Field
          label="Mätpunkts-ID"
          name="metering_point_id"
          help="Valfritt. Leverantörsbyte går vidare först när anläggningsuppgifterna är verifierade."
        />

        <div>
          <label className="text-sm font-medium text-white/80">Start</label>
          <select
            name="requested_start_mode"
            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition focus:border-cyan-500/40"
          >
            <option value="asap">Så snart som möjligt</option>
            <option value="specific_date">Jag vill välja datum</option>
          </select>
        </div>
        <Field label="Önskat startdatum" name="requested_start_date" type="date" />
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="text-sm font-semibold text-white">Prisområde och pris</div>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              {resolutionMessage(resolution)} Priset uppdateras när du byter avtal,
              adress eller förbrukning.
            </p>
          </div>
          <button
            type="button"
            onClick={calculatePreview}
            disabled={loadingPreview || !selectedContract}
            className="h-12 rounded-2xl bg-cyan-500 px-6 font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPreview ? 'Kontrollerar...' : 'Kontrollera pris'}
          </button>
        </div>

        {resolution?.price_area_code ? (
          <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            {resolution.price_area_code} är valt prisområde.
            {resolution.grid_owner_name ? ` Nätägare: ${resolution.grid_owner_name}.` : ''}
            {resolution.confidence != null ? ` Träffsäkerhet: ${Math.round(resolution.confidence * 100)}%.` : ''}
          </div>
        ) : null}

        {previewError ? (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            {previewError}
          </div>
        ) : null}

        {preview ? (
          <div className="mt-5">
            <PriceResultCard data={preview} updatedAt={new Date()} />
          </div>
        ) : null}
      </div>

      <div className="space-y-5 rounded-3xl border border-white/10 bg-black/30 p-6">
        <div>
          <div className="text-sm font-medium text-white">Sammanfattning och godkännanden</div>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            Läs igenom avtalet och länkarna nedan. Varje godkännande sparas med version,
            tidpunkt och koppling till din ansökan.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-gray-300">
          <div className="font-semibold text-white">Vad händer när du tecknar?</div>
          <p className="mt-2">
            Gridex tar emot din ansökan, sparar valt avtal och prisversion,
            kontrollerar anläggningsuppgifter och återkommer om något behöver kompletteras.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Om anläggnings-ID eller mätpunkts-ID saknas kan du fortsätta ändå.
            Uppgifterna behöver verifieras innan leverantörsbytet kan gå vidare.
          </p>
        </div>

        <Checkbox name="accept_terms">
          Jag har tagit del av och godkänner{' '}
          <Link href="/allmanna-villkor" className="text-cyan-300 underline underline-offset-4 hover:text-cyan-200" target="_blank">
            allmänna villkor
          </Link>{' '}
          samt{' '}
          <Link href="/prisvillkor" className="text-cyan-300 underline underline-offset-4 hover:text-cyan-200" target="_blank">
            prisinformationen
          </Link>{' '}
          för valt elavtal.
        </Checkbox>
        <Checkbox name="accept_cancellation_right">
          Jag bekräftar att jag har fått information om min{' '}
          <Link href="/angerratt" className="text-cyan-300 underline underline-offset-4 hover:text-cyan-200" target="_blank">
            ångerrätt
          </Link>
          .
        </Checkbox>
        <Checkbox name="accept_privacy">
          Jag har tagit del av hur Gridex behandlar mina personuppgifter i{' '}
          <Link href="/integritetspolicy" className="text-cyan-300 underline underline-offset-4 hover:text-cyan-200" target="_blank">
            integritetspolicyn
          </Link>
          .
        </Checkbox>
        <Checkbox name="accept_power_of_attorney">
          Jag ger Gridex fullmakt att begära, ta emot och hantera de anläggningsuppgifter
          som behövs för att starta och administrera mitt elavtal.
        </Checkbox>

        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-xs leading-relaxed text-cyan-50/85">
          Fullmakten används för uppgifter från elnätsföretaget, till exempel anläggnings-ID,
          mätpunkts-ID, nätområde, nätägare och information som behövs för leverantörsbyte.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="text-sm text-gray-400">
          Kontrollera uppgifterna innan du tecknar. Om något saknas behandlas ansökan och kompletteras innan avtalet startar.
        </div>

        <button
          disabled={!canSubmit}
          className="h-12 rounded-2xl bg-cyan-500 px-8 font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Teckna elavtal
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  required = false,
  type = 'text',
  help,
  inputMode,
  value,
  onChange,
}: {
  label: string
  name: string
  required?: boolean
  type?: string
  help?: string
  inputMode?: 'numeric' | 'text'
  value?: string
  onChange?: (value: string) => void
}) {
  return (
    <div>
      <label className="text-sm font-medium text-white/80">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        inputMode={inputMode}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40"
      />
      {help ? <p className="mt-2 text-xs text-white/45">{help}</p> : null}
    </div>
  )
}

function Checkbox({ name, children }: { name: string; children: ReactNode }) {
  return (
    <label className="flex items-start gap-3 text-sm text-gray-300">
      <input type="checkbox" name={name} required className="mt-1" />
      <span>{children}</span>
    </label>
  )
}
