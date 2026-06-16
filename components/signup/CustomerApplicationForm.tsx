'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  buildPublicContractDisplay,
  formatOreKwh,
  formatSekInvoice,
  formatSekMonth,
  hasNumberValue,
  publicContractTypeLabel,
  type PublicContractDisplay,
} from '@/lib/website/publicContractDisplay'
import type { WebsiteEnergyResolution, WebsitePricingPreview } from '@/lib/website/publicApi'

export type SignupContractOption = {
  name: string
  value: string
  offerReference: string
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
  validFrom?: string | null
  validTo?: string | null
  bindingPeriodMonths?: number | null
  noticePeriodDays?: number | null
  included?: string[] | string | null
  excluded?: string[] | string | null
  startInfo?: string | null
  customerTypes?: string[] | null
  termsVersion?: string | null
  privacyPolicyVersion?: string | null
  cancellationRightVersion?: string | null
  powerOfAttorneyVersion?: string | null
  powerOfAttorneyRequired?: boolean | null
  priceTermsVersion?: string | null
}

type UTMParams = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

type Props = {
  contracts: SignupContractOption[]
  selectedValue: string
  onSelectedValueChange: (value: string) => void
  canSubmit: boolean
  utm: UTMParams
  action: (formData: FormData) => void | Promise<void>
  energyResolution?: WebsiteEnergyResolution | null
  pricingPreview?: WebsitePricingPreview | null
  estimatedMonthlyKwh?: number | null
  contractDisplay?: PublicContractDisplay | null
  onCustomerTypeChange?: (customerType: CustomerType) => void
}

type CustomerType = 'private' | 'company'

type FormValues = {
  customer_type: CustomerType
  selected_offer: string
  first_name: string
  last_name: string
  personal_number: string
  company_name: string
  organization_number: string
  email: string
  phone: string
  address: string
  postal_code: string
  city: string
  apartment: string
  facility_id: string
  metering_point_id: string
  requested_start_mode: 'asap' | 'specific_date'
  requested_start_date: string
}

type Consents = {
  accept_terms: boolean
  accept_price_terms: boolean
  accept_cancellation_right: boolean
  accept_privacy: boolean
  accept_power_of_attorney: boolean
}

const STEPS = ['Välj avtal', 'Dina uppgifter', 'Granska och skicka']

function formatMaybeSekMonth(value: number | null | undefined) {
  return hasNumberValue(value) ? formatSekMonth(value) : 'Visas inte'
}

function formatMaybeSekInvoice(value: number | null | undefined) {
  return hasNumberValue(value) ? formatSekInvoice(value) : 'Visas inte'
}

function formatMaybeOre(value: number | null | undefined) {
  return hasNumberValue(value) ? formatOreKwh(value) : 'Visas inte'
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function normalizePostalCode(value: string) {
  return value.replace(/\s/g, '')
}

function optionAsOpsContract(contract: SignupContractOption) {
  return {
    offer_reference: contract.offerReference,
    contract_id: contract.contractId ?? null,
    price_plan_id: contract.pricePlanId,
    price_plan_version_id: contract.pricePlanVersionId,
    product_code: contract.productCode,
    name: contract.name,
    type: contract.type,
    monthly_fee_sek: contract.monthlyFeeSek ?? null,
    invoice_fee_sek: contract.invoiceFeeSek ?? null,
    markup_ore_per_kwh: contract.markupOrePerKwh ?? null,
    variable_markup_ore_per_kwh: contract.variableMarkupOrePerKwh ?? null,
    fixed_price_ore_per_kwh: contract.fixedPriceOrePerKwh ?? null,
    valid_from: contract.validFrom ?? null,
    valid_to: contract.validTo ?? null,
    binding_period_months: contract.bindingPeriodMonths ?? null,
    notice_period_days: contract.noticePeriodDays ?? null,
    included: contract.included ?? null,
    excluded: contract.excluded ?? null,
    start_info: contract.startInfo ?? null,
    customer_types: contract.customerTypes ?? null,
    terms_version: contract.termsVersion ?? null,
    privacy_policy_version: contract.privacyPolicyVersion ?? null,
    cancellation_right_version: contract.cancellationRightVersion ?? null,
    power_of_attorney_version: contract.powerOfAttorneyVersion ?? null,
    power_of_attorney_required: contract.powerOfAttorneyRequired ?? false,
    price_terms_version: contract.priceTermsVersion ?? null,
    is_public: true,
    is_active: true,
  }
}

function Field({
  id,
  label,
  name,
  value,
  onChange,
  type = 'text',
  required = false,
  help,
  error,
  autoComplete,
  inputMode,
}: {
  id: string
  label: string
  name: keyof FormValues
  value: string
  onChange: (name: keyof FormValues, value: string) => void
  type?: string
  required?: boolean
  help?: string
  error?: string
  autoComplete?: string
  inputMode?: 'text' | 'numeric' | 'tel' | 'email'
}) {
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-white/80">
        {label} {required ? <span className="text-cyan-300">*</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30"
      />
      {help ? <p id={helpId} className="mt-2 text-xs leading-5 text-white/45">{help}</p> : null}
      {error ? <p id={errorId} className="mt-2 text-xs leading-5 text-red-200" aria-live="polite">{error}</p> : null}
    </div>
  )
}

function Checkbox({
  id,
  name,
  checked,
  onChange,
  children,
  required = true,
}: {
  id: string
  name: keyof Consents
  checked: boolean
  onChange: (name: keyof Consents, value: boolean) => void
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 text-sm leading-6 text-gray-300">
      <input
        id={id}
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(name, event.target.checked)}
        required={required}
        className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40 focus:ring-2 focus:ring-cyan-500/40"
      />
      <span>{children}</span>
    </label>
  )
}

export default function CustomerApplicationForm({
  contracts,
  selectedValue,
  onSelectedValueChange,
  canSubmit,
  utm,
  action,
  energyResolution,
  pricingPreview,
  estimatedMonthlyKwh,
  contractDisplay,
  onCustomerTypeChange,
}: Props) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormValues>({
    customer_type: 'private',
    selected_offer: selectedValue,
    first_name: '',
    last_name: '',
    personal_number: '',
    company_name: '',
    organization_number: '',
    email: '',
    phone: '',
    address: '',
    postal_code: '',
    city: '',
    apartment: '',
    facility_id: '',
    metering_point_id: '',
    requested_start_mode: 'asap',
    requested_start_date: '',
  })
  const [consents, setConsents] = useState<Consents>({
    accept_terms: false,
    accept_price_terms: false,
    accept_cancellation_right: false,
    accept_privacy: false,
    accept_power_of_attorney: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})


  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.value === selectedValue) ?? null,
    [contracts, selectedValue],
  )

  const fallbackDisplay = useMemo(
    () => (selectedContract ? buildPublicContractDisplay(optionAsOpsContract(selectedContract)) : null),
    [selectedContract],
  )
  const activeDisplay = contractDisplay ?? fallbackDisplay
  const powerOfAttorneyRequired = activeDisplay?.legalVersions.powerOfAttorneyRequired === true

  function updateField(name: keyof FormValues, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
    if (name === 'selected_offer') onSelectedValueChange(value)
    if (name === 'customer_type') onCustomerTypeChange?.(value as CustomerType)
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  function updateConsent(name: keyof Consents, value: boolean) {
    setConsents((current) => ({ ...current, [name]: value }))
  }

  function validateCurrentStep() {
    const nextErrors: Record<string, string> = {}

    if (step === 0 && !selectedValue) nextErrors.selected_offer = 'Välj ett elavtal för att gå vidare.'

    if (step === 1) {
      if (form.customer_type === 'private') {
        if (!form.first_name.trim()) nextErrors.first_name = 'Ange ditt förnamn.'
        if (!form.last_name.trim()) nextErrors.last_name = 'Ange ditt efternamn.'
        if (!form.personal_number.trim()) nextErrors.personal_number = 'Ange personnummer i format ååååmmddnnnn.'
      } else {
        if (!form.company_name.trim()) nextErrors.company_name = 'Ange företagsnamn.'
        if (!form.organization_number.trim()) nextErrors.organization_number = 'Ange organisationsnummer.'
      }

      if (!form.email.trim() || !isValidEmail(form.email)) nextErrors.email = 'Ange en giltig e-postadress.'
      if (!form.phone.trim()) nextErrors.phone = 'Ange telefonnummer.'
      if (!form.address.trim()) nextErrors.address = 'Ange adress.'
      if (!/^\d{5}$/.test(normalizePostalCode(form.postal_code))) nextErrors.postal_code = 'Ange postnummer med fem siffror.'
      if (!form.city.trim()) nextErrors.city = 'Ange ort.'
      if (form.requested_start_mode === 'specific_date' && !form.requested_start_date) nextErrors.requested_start_date = 'Välj önskat startdatum eller ändra till snarast möjligt.'
    }

    if (step === 2) {
      if (!contractDisplaySnapshot) nextErrors.contract_display_snapshot = 'Valt avtal kunde inte verifieras. Välj avtalet igen.'
      if (!consents.accept_terms) nextErrors.accept_terms = 'Du behöver godkänna villkoren.'
      if (!consents.accept_price_terms) nextErrors.accept_price_terms = 'Du behöver godkänna prisvillkoren.'
      if (!consents.accept_cancellation_right) nextErrors.accept_cancellation_right = 'Du behöver bekräfta information om ångerrätt.'
      if (!consents.accept_privacy) nextErrors.accept_privacy = 'Du behöver ta del av integritetspolicyn.'
      if (powerOfAttorneyRequired && !consents.accept_power_of_attorney) nextErrors.accept_power_of_attorney = 'Du behöver godkänna fullmakten för att Gridex ska kunna hämta anläggningsuppgifter.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function nextStep() {
    if (!validateCurrentStep()) return
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  function previousStep() {
    setErrors({})
    setStep((current) => Math.max(current - 1, 0))
  }

  const errorList = Object.values(errors)
  const allConsentsAccepted =
    consents.accept_terms &&
    consents.accept_price_terms &&
    consents.accept_cancellation_right &&
    consents.accept_privacy &&
    (!powerOfAttorneyRequired || consents.accept_power_of_attorney)
  const pricingPreviewSnapshot = pricingPreview ? JSON.stringify(pricingPreview) : ''
  const contractDisplaySnapshot = activeDisplay ? JSON.stringify(activeDisplay.snapshot) : ''
  const submitDisabled = !canSubmit || !allConsentsAccepted || !contractDisplaySnapshot

  return (
    <div className="space-y-8" aria-live="polite">
      <ol className="grid gap-3 md:grid-cols-3" aria-label="Ansökningssteg">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`rounded-2xl border p-4 text-sm ${
              index === step
                ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-100'
                : index < step
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-white/10 bg-white/5 text-gray-400'
            }`}
          >
            <span className="font-semibold">Steg {index + 1}</span>
            <span className="mt-1 block">{label}</span>
          </li>
        ))}
      </ol>

      {errorList.length > 0 ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100" role="alert">
          <div className="font-semibold">Kontrollera uppgifterna</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errorList.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      ) : null}

      {step === 0 ? (
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-white md:text-3xl">Välj elavtal</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">Välj ett publicerat elavtal. Saknade prisrader visas inte, men riktiga nollvärden visas som 0.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {contracts.map((contract) => {
              const active = contract.value === selectedValue
              return (
                <label
                  key={contract.value}
                  className={`cursor-pointer rounded-3xl border p-5 transition focus-within:ring-2 focus-within:ring-cyan-500/40 ${
                    active ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-white/10 bg-white/5 hover:border-cyan-500/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="selected_offer_radio"
                    value={contract.value}
                    checked={active}
                    onChange={(event) => updateField('selected_offer', event.target.value)}
                    className="sr-only"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-white">{contract.name}</div>
                      <div className="mt-1 text-sm text-gray-400">{publicContractTypeLabel(contract.type)}</div>
                    </div>
                    {active ? <span className="rounded-full bg-cyan-500 px-3 py-1 text-xs font-semibold text-black">Valt</span> : null}
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-gray-300">
                    <div className="flex justify-between gap-4"><span className="text-gray-500">Månadsavgift</span><span>{formatMaybeSekMonth(contract.monthlyFeeSek)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-gray-500">Påslag</span><span>{formatMaybeOre(contract.markupOrePerKwh)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-gray-500">Fakturaavgift</span><span>{formatMaybeSekInvoice(contract.invoiceFeeSek)}</span></div>
                    {hasNumberValue(contract.fixedPriceOrePerKwh) ? <div className="flex justify-between gap-4"><span className="text-gray-500">Fast elpris</span><span>{formatOreKwh(contract.fixedPriceOrePerKwh)}</span></div> : null}
                  </div>
                </label>
              )
            })}
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white md:text-3xl">Dina uppgifter</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">Anläggnings-ID och mätpunkts-ID är valfria i ansökan. Om de saknas kan Gridex, med din fullmakt, hämta och verifiera uppgifterna hos ditt elnätsföretag innan avtalet startar.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="customer_type" className="text-sm font-medium text-white/80">Kundtyp</label>
              <select
                id="customer_type"
                name="customer_type"
                value={form.customer_type}
                onChange={(event) => updateField('customer_type', event.target.value as FormValues['customer_type'])}
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30"
              >
                <option value="private">Privatkund</option>
                <option value="company">Företag</option>
              </select>
            </div>

            {form.customer_type === 'private' ? (
              <>
                <Field id="first_name" label="Förnamn" name="first_name" value={form.first_name} onChange={updateField} required error={errors.first_name} autoComplete="given-name" />
                <Field id="last_name" label="Efternamn" name="last_name" value={form.last_name} onChange={updateField} required error={errors.last_name} autoComplete="family-name" />
                <Field id="personal_number" label="Personnummer" name="personal_number" value={form.personal_number} onChange={updateField} required error={errors.personal_number} inputMode="numeric" help="Format: ååååmmddnnnn." />
              </>
            ) : (
              <>
                <Field id="company_name" label="Företagsnamn" name="company_name" value={form.company_name} onChange={updateField} required error={errors.company_name} autoComplete="organization" />
                <Field id="organization_number" label="Organisationsnummer" name="organization_number" value={form.organization_number} onChange={updateField} required error={errors.organization_number} inputMode="numeric" />
              </>
            )}

            <Field id="email" label="E-post" name="email" value={form.email} onChange={updateField} type="email" required error={errors.email} autoComplete="email" inputMode="email" />
            <Field id="phone" label="Telefon" name="phone" value={form.phone} onChange={updateField} required error={errors.phone} autoComplete="tel" inputMode="tel" />
            <Field id="address" label="Adress" name="address" value={form.address} onChange={updateField} required error={errors.address} autoComplete="street-address" />
            <Field id="postal_code" label="Postnummer" name="postal_code" value={form.postal_code} onChange={updateField} required error={errors.postal_code} autoComplete="postal-code" inputMode="numeric" />
            <Field id="city" label="Ort" name="city" value={form.city} onChange={updateField} required error={errors.city} autoComplete="address-level2" />
            <Field id="apartment" label="Lägenhet eller portkod" name="apartment" value={form.apartment} onChange={updateField} help="Valfritt." />
            <Field id="facility_id" label="Anläggnings-ID" name="facility_id" value={form.facility_id} onChange={updateField} help="Valfritt. Kan kompletteras via fullmakt." />
            <Field id="metering_point_id" label="Mätpunkts-ID" name="metering_point_id" value={form.metering_point_id} onChange={updateField} help="Valfritt. Kan kompletteras via fullmakt." />

            <div>
              <label htmlFor="requested_start_mode" className="text-sm font-medium text-white/80">Önskad start</label>
              <select
                id="requested_start_mode"
                name="requested_start_mode"
                value={form.requested_start_mode}
                onChange={(event) => updateField('requested_start_mode', event.target.value as FormValues['requested_start_mode'])}
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30"
              >
                <option value="asap">Så snart som möjligt</option>
                <option value="specific_date">Jag vill välja datum</option>
              </select>
              <p className="mt-2 text-xs leading-5 text-white/45">Om inget datum väljs startar avtalet så snart uppgifterna är verifierade och marknadsreglerna tillåter det.</p>
            </div>

            {form.requested_start_mode === 'specific_date' ? (
              <Field id="requested_start_date" label="Önskat startdatum" name="requested_start_date" value={form.requested_start_date} onChange={updateField} type="date" required error={errors.requested_start_date} />
            ) : null}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <form action={action} className="space-y-6">
          <input type="hidden" name="company_website" value="" />
          <input type="hidden" name="utm_source" value={utm.utm_source ?? ''} />
          <input type="hidden" name="utm_medium" value={utm.utm_medium ?? ''} />
          <input type="hidden" name="utm_campaign" value={utm.utm_campaign ?? ''} />
          {Object.entries(form).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={key === 'selected_offer' ? selectedValue : value} />
          ))}
          <input type="hidden" name="price_area_code" value={energyResolution?.price_area_code ?? pricingPreview?.price_area_code ?? pricingPreview?.priceArea ?? ''} />
          <input type="hidden" name="grid_area_code" value={energyResolution?.grid_area_code ?? ''} />
          <input type="hidden" name="grid_owner_id" value={energyResolution?.grid_owner_id ?? ''} />
          <input type="hidden" name="grid_owner_name" value={energyResolution?.grid_owner_name ?? ''} />
          <input type="hidden" name="energy_resolution_status" value={energyResolution?.status ?? ''} />
          <input type="hidden" name="energy_resolution_confidence" value={energyResolution?.confidence ?? ''} />
          <input type="hidden" name="estimated_monthly_kwh" value={estimatedMonthlyKwh ?? pricingPreview?.kwh ?? ''} />
          <input type="hidden" name="pricing_preview_snapshot" value={pricingPreviewSnapshot} />
          <input type="hidden" name="contract_display_snapshot" value={contractDisplaySnapshot} />

          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-white md:text-3xl">Granska innan du skickar</h2>
              <p className="mt-2 text-sm leading-6 text-gray-400">Detta är en ansökan. Gridex bekräftar nästa steg när uppgifterna är mottagna och kontrollerade.</p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
                <div className="text-base font-semibold text-white">Valt avtal och pris</div>
                <dl className="mt-4 space-y-3">
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Avtal</dt><dd className="text-right text-white">{selectedContract?.name ?? 'Valt avtal'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Typ</dt><dd className="text-right text-white">{selectedContract ? publicContractTypeLabel(selectedContract.type) : 'Elavtal'}</dd></div>
                  {activeDisplay?.rows.map((row) => (
                    <div key={row.key} className="flex justify-between gap-4"><dt className="text-gray-500">{row.label}</dt><dd className="text-right text-white">{row.formatted}</dd></div>
                  ))}
                  {pricingPreview ? <div className="flex justify-between gap-4"><dt className="text-gray-500">Elområde</dt><dd className="text-right text-white">{pricingPreview.price_area_code ?? pricingPreview.priceArea}</dd></div> : null}
                  {pricingPreview ? <div className="flex justify-between gap-4"><dt className="text-gray-500">Beräknad förbrukning</dt><dd className="text-right text-white">{pricingPreview.kwh.toLocaleString('sv-SE')} kWh/mån</dd></div> : null}
                </dl>
                <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-xs leading-6 text-cyan-50/85">
                  Ingår: {activeDisplay?.included.join(', ') || 'elhandelsavtal och avtalsadministration'}. Ingår inte: {activeDisplay?.excluded.join(', ') || 'elnätsavgift och nätägarens avgifter'}.
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
                <div className="text-base font-semibold text-white">Kontakt och start</div>
                <dl className="mt-4 space-y-3">
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Kundtyp</dt><dd className="text-right text-white">{form.customer_type === 'company' ? 'Företag' : 'Privatkund'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Namn</dt><dd className="text-right text-white">{form.customer_type === 'company' ? form.company_name : `${form.first_name} ${form.last_name}`}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">E-post</dt><dd className="break-all text-right text-white">{form.email}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Telefon</dt><dd className="text-right text-white">{form.phone}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Adress</dt><dd className="text-right text-white">{form.address}, {form.postal_code} {form.city}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Start</dt><dd className="text-right text-white">{form.requested_start_mode === 'specific_date' && form.requested_start_date ? form.requested_start_date : 'Så snart som möjligt'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Anläggnings-ID</dt><dd className="text-right text-white">{form.facility_id || 'Kompletteras vid behov'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Mätpunkts-ID</dt><dd className="text-right text-white">{form.metering_point_id || 'Kompletteras vid behov'}</dd></div>
                </dl>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-5">
              <div>
                <div className="text-base font-semibold text-white">Villkor och godkännanden</div>
                <p className="mt-1 text-sm leading-6 text-gray-400">Läs igenom dokumenten innan du skickar ansökan. Dina godkännanden sparas säkert tillsammans med din ansökan.</p>
              </div>
              <Checkbox id="accept_terms" name="accept_terms" checked={consents.accept_terms} onChange={updateConsent}>
                Jag godkänner Gridex <Link href="/allmanna-villkor" className="text-cyan-300 underline underline-offset-4 hover:text-cyan-200" target="_blank">allmänna villkor</Link>.
              </Checkbox>
              <Checkbox id="accept_price_terms" name="accept_price_terms" checked={consents.accept_price_terms} onChange={updateConsent}>
                Jag godkänner <Link href="/prisvillkor" className="text-cyan-300 underline underline-offset-4 hover:text-cyan-200" target="_blank">prisvillkoren</Link> för valt elavtal.
              </Checkbox>
              <Checkbox id="accept_cancellation_right" name="accept_cancellation_right" checked={consents.accept_cancellation_right} onChange={updateConsent}>Jag har tagit del av informationen om <Link href="/angerratt" className="text-cyan-300 underline underline-offset-4 hover:text-cyan-200" target="_blank">ångerrätt</Link>.</Checkbox>
              <Checkbox id="accept_privacy" name="accept_privacy" checked={consents.accept_privacy} onChange={updateConsent}>Jag har tagit del av hur Gridex behandlar mina personuppgifter i <Link href="/integritetspolicy" className="text-cyan-300 underline underline-offset-4 hover:text-cyan-200" target="_blank">integritetspolicyn</Link>.</Checkbox>
              {powerOfAttorneyRequired ? (
                <>
                  <Checkbox id="accept_power_of_attorney" name="accept_power_of_attorney" checked={consents.accept_power_of_attorney} onChange={updateConsent}>Jag godkänner <Link href="/fullmakt" className="text-cyan-300 underline underline-offset-4 hover:text-cyan-200" target="_blank">fullmakten</Link> och ger Gridex rätt att begära och hantera uppgifter från nätägaren för att behandla ansökan och starta elavtalet.</Checkbox>
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-xs leading-relaxed text-cyan-50/85">Fullmakten används för uppgifter från elnätsföretaget, till exempel anläggnings-ID, mätpunkts-ID, nätområde, nätägare och information som behövs för leverantörsbyte.</div>
                </>
              ) : null}
            </div>
          </section>

          {Object.values(errors).length > 0 ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100" role="alert">Kontrollera godkännandena innan du skickar ansökan.</div> : null}

          <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
            <button type="button" onClick={previousStep} className="h-12 rounded-2xl border border-white/10 px-6 text-sm font-semibold text-white transition hover:border-cyan-500/40 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-cyan-300/50">Tillbaka</button>
            <div className="text-sm text-gray-400">När du skickar ansökan sparas uppgifterna och Gridex återkommer med nästa steg.</div>
            <button disabled={submitDisabled} className="h-12 rounded-2xl bg-cyan-500 px-8 font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70">Skicka ansökan</button>
          </div>
        </form>
      ) : null}

      {step < 2 ? (
        <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
          <button type="button" onClick={previousStep} disabled={step === 0} className="h-12 rounded-2xl border border-white/10 px-6 text-sm font-semibold text-white transition hover:border-cyan-500/40 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-cyan-300/50">Tillbaka</button>
          <div className="text-sm text-gray-400">{canSubmit ? 'Du kan granska allt innan ansökan skickas.' : 'Ansökan online är tillfälligt pausad.'}</div>
          <button type="button" onClick={nextStep} disabled={!canSubmit && step === 0} className="h-12 rounded-2xl bg-cyan-500 px-8 font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70">Nästa</button>
        </div>
      ) : null}
    </div>
  )
}
