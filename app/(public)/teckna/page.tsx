import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import ElectricityCalculator, { type ContractOption } from '@/components/ElectricityCalculator'
import {
  createApplicationIdempotencyKey,
  createExternalApplicationId,
  fetchOpsPublicContracts,
  getOpsClientStatus,
  hashIp,
  isOpsError,
  submitOpsCustomerApplication,
  type OpsPublicContract,
} from '@/lib/ops/client'
import { checkRateLimit } from '@/lib/security/rateLimit'

export const metadata: Metadata = {
  title: 'Teckna elavtal – snabbt & transparent',
  description:
    'Teckna elavtal hos Gridex. Fyll i dina uppgifter, välj avtal och få bekräftelse på nästa steg.',
  alternates: { canonical: 'https://gridex.se/teckna' },
}

type PageParams = {
  planVersion?: string
  contract?: string
  error?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

function normalizeText(value: FormDataEntryValue | null): string {
  return String(value || '').trim()
}

function normalizeEmail(value: FormDataEntryValue | null): string {
  return String(value || '').trim().toLowerCase()
}

function getClientIpFromHeaders(h: Headers): string | null {
  const xff = h.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }

  const xrip = h.get('x-real-ip')
  if (xrip) return xrip.trim()

  return null
}

function toContractOption(item: OpsPublicContract): ContractOption {
  return {
    name: item.name,
    value: item.price_plan_version_id,
    productCode: item.product_code,
    pricePlanId: item.price_plan_id,
    pricePlanVersionId: item.price_plan_version_id,
    type: item.type,
    monthlyFeeSek: item.monthly_fee_sek,
    invoiceFeeSek: item.invoice_fee_sek,
    markupOrePerKwh: item.markup_ore_per_kwh,
    variableMarkupOrePerKwh: item.variable_markup_ore_per_kwh,
    fixedPriceOrePerKwh: item.fixed_price_ore_per_kwh,
  }
}

function selectedContractFromParams(
  contracts: OpsPublicContract[],
  params: PageParams
): OpsPublicContract | null {
  const wanted = params.planVersion ?? params.contract ?? ''
  if (wanted) {
    const match = contracts.find(
      (contract) =>
        contract.price_plan_version_id === wanted ||
        contract.price_plan_id === wanted ||
        contract.product_code === wanted
    )
    if (match) return match
  }

  return contracts[0] ?? null
}

function errorText(code?: string) {
  switch (code) {
    case 'validation':
      return 'Kontrollera obligatoriska uppgifter och försök igen.'
    case 'consent':
      return 'Du behöver godkänna villkor, integritet, fullmakt, ångerrätt och leverantörsbyte för att skicka ansökan.'
    case 'honeypot':
      return 'Ansökan kunde inte skickas. Kontrollera uppgifterna och försök igen.'
    case 'not_configured':
      return 'Teckning är inte aktiverad just nu.'
    case 'ops_unavailable':
      return 'Vi kunde inte skicka din ansökan just nu. Försök igen om en stund.'
    case 'live_disabled':
      return 'Teckning är inte aktiverad för produktion ännu.'
    case 'offer':
      return 'Valt avtal kunde inte verifieras. Välj ett aktuellt avtal och försök igen.'
    case 'rate_limit':
      return 'För många försök på kort tid. Vänta en stund och försök igen.'
    default:
      return null
  }
}

function missingFieldsToQuery(fields: string[]) {
  return fields.slice(0, 8).join(',')
}

export default async function TecknaPage({
  searchParams,
}: {
  searchParams?: Promise<PageParams>
}) {
  const params = (await searchParams) ?? {}
  const status = getOpsClientStatus()
  let contracts: OpsPublicContract[] = []
  let loadError: string | null = null

  if (status.configured) {
    try {
      contracts = await fetchOpsPublicContracts()
    } catch (error) {
      loadError =
        error instanceof Error
          ? error.message
          : 'Kunde inte hämta aktuella elavtal.'
    }
  } else {
    loadError = 'Teckning är inte tillgänglig just nu.'
  }

  const options = contracts.map(toContractOption)
  const selectedContract = selectedContractFromParams(contracts, params)
  const selectedValue = selectedContract?.price_plan_version_id ?? ''
  const pageError = errorText(params.error)
  const canSubmit =
    status.configured && status.liveSignupEnabled && !loadError && contracts.length > 0

  async function submitApplicationAction(formData: FormData) {
    'use server'

    const currentStatus = getOpsClientStatus()
    if (!currentStatus.configured) redirect('/teckna?error=not_configured')
    if (!currentStatus.liveSignupEnabled) redirect('/teckna?error=live_disabled')

    const h = await headers()
    const ip = getClientIpFromHeaders(h)
    const userAgent = h.get('user-agent')
    const rate = checkRateLimit(`signup:${ip ?? 'unknown'}`, {
      limit: 8,
      windowMs: 15 * 60 * 1000,
    })
    if (!rate.allowed) redirect('/teckna?error=rate_limit')

    const honeypot = normalizeText(formData.get('company_website'))
    if (honeypot) redirect('/teckna?error=honeypot')

    const selectedOffer = normalizeText(formData.get('selected_offer'))
    const liveContracts = await fetchOpsPublicContracts().catch(() => [])
    const offer = liveContracts.find(
      (contract) => contract.price_plan_version_id === selectedOffer
    )

    if (!offer) redirect('/teckna?error=offer')

    const customerTypeRaw = normalizeText(formData.get('customer_type'))
    const customerType = customerTypeRaw === 'company' ? 'company' : 'private'
    const firstName = normalizeText(formData.get('first_name'))
    const lastName = normalizeText(formData.get('last_name'))
    const companyName = normalizeText(formData.get('company_name'))
    const personalNumber = normalizeText(formData.get('personal_number'))
    const organizationNumber = normalizeText(formData.get('organization_number'))
    const email = normalizeEmail(formData.get('email'))
    const phone = normalizeText(formData.get('phone'))
    const address = normalizeText(formData.get('address'))
    const postalCode = normalizeText(formData.get('postal_code'))
    const city = normalizeText(formData.get('city'))
    const apartment = normalizeText(formData.get('apartment'))
    const facilityId = normalizeText(formData.get('facility_id'))
    const meteringPointId = normalizeText(formData.get('metering_point_id'))
    const requestedStartModeRaw = normalizeText(formData.get('requested_start_mode'))
    const requestedStartMode =
      requestedStartModeRaw === 'specific_date' ? 'specific_date' : 'asap'
    const requestedStartDate = normalizeText(formData.get('requested_start_date'))

    const acceptTerms = String(formData.get('accept_terms') || '') === 'on'
    const acceptPrivacy = String(formData.get('accept_privacy') || '') === 'on'
    const acceptPowerOfAttorney =
      String(formData.get('accept_power_of_attorney') || '') === 'on'
    const acceptCancellation =
      String(formData.get('accept_cancellation_right') || '') === 'on'
    const acceptSwitch = String(formData.get('accept_supplier_switch') || '') === 'on'

    const hasIdentity =
      customerType === 'company'
        ? Boolean(companyName && organizationNumber)
        : Boolean(firstName && lastName && personalNumber)

    if (!email || !phone || !address || !postalCode || !city || !hasIdentity) {
      redirect('/teckna?error=validation')
    }

    if (
      !acceptTerms ||
      !acceptPrivacy ||
      !acceptPowerOfAttorney ||
      !acceptCancellation ||
      !acceptSwitch
    ) {
      redirect('/teckna?error=consent')
    }

    const idempotencyKey = createApplicationIdempotencyKey([
      'gridex_website_application_v1',
      email,
      customerType,
      customerType === 'company' ? organizationNumber : personalNumber,
      address,
      postalCode,
      offer.price_plan_version_id,
      requestedStartMode,
      requestedStartDate || 'asap',
    ])

    let successRedirect = ''

    try {
      const result = await submitOpsCustomerApplication({
        customer_type: customerType,
        first_name: firstName || null,
        last_name: lastName || null,
        company_name: companyName || null,
        personal_number: personalNumber || null,
        organization_number: organizationNumber || null,
        email,
        phone,
        address,
        postal_code: postalCode,
        city,
        apartment: apartment || null,
        facility_id: facilityId || null,
        metering_point_id: meteringPointId || null,
        requested_start_mode: requestedStartMode,
        requested_start_date:
          requestedStartMode === 'specific_date' ? requestedStartDate || null : null,
        price_plan_id: offer.price_plan_id,
        price_plan_version_id: offer.price_plan_version_id,
        product_code: offer.product_code,
        source: 'gridex_website',
        idempotency_key: idempotencyKey,
        external_application_id: createExternalApplicationId(),
        utm_source: normalizeText(formData.get('utm_source')) || null,
        utm_medium: normalizeText(formData.get('utm_medium')) || null,
        utm_campaign: normalizeText(formData.get('utm_campaign')) || null,
        user_agent: userAgent,
        ip_hash: hashIp(ip),
        consents: {
          terms: true,
          privacy: true,
          power_of_attorney: true,
          cancellation_right: true,
          supplier_switch: true,
          terms_version: offer.terms_version ?? null,
          privacy_policy_version: offer.privacy_policy_version ?? null,
          cancellation_right_version: offer.cancellation_right_version ?? null,
          power_of_attorney_version: offer.power_of_attorney_version ?? null,
        },
      })

      const qs = new URLSearchParams()
      qs.set('status', result.status)
      if (result.customer_number) qs.set('customerNumber', result.customer_number)
      if (result.contract_number) qs.set('contractNumber', result.contract_number)
      if (result.application_number) qs.set('applicationNumber', result.application_number)
      if (result.next_step) qs.set('nextStep', result.next_step)
      if (result.missing_fields.length > 0) {
        qs.set('missing', missingFieldsToQuery(result.missing_fields))
      }

      successRedirect = `/teckna/tack?${qs.toString()}`
    } catch (error) {
      if (isOpsError(error)) {
        if (error.status === 503) redirect('/teckna?error=live_disabled')
        redirect('/teckna?error=ops_unavailable')
      }
      redirect('/teckna?error=ops_unavailable')
    }

    redirect(successRedirect)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 py-12 md:py-16">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-[120px]" />

        <div className="relative grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
              Räkna först • Teckna tryggt • Vi hjälper dig vidare
            </div>

            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                Teckna elavtal
                <br />
                på ett tydligare sätt
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">
                Fyll i dina uppgifter och välj det elavtal som passar dig. När
                ansökan är skickad får du en bekräftelse med nästa steg.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <StepCard title="1. Välj avtal" text="Välj bland aktuella elavtal." />
            <StepCard title="2. Fyll i uppgifter" text="Anläggnings-ID och mätpunkt kan lämnas tomma om du inte har dem." />
            <StepCard title="3. Vi går vidare" text="Vi kontrollerar anläggning, fullmakt och leverantörsbyte." />
          </div>
        </div>
      </section>

      <ElectricityCalculator contracts={options} />

      <section className="rounded-3xl border border-white/10 bg-gray-950 p-8 md:p-10">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Fyll i uppgifter för att ansöka
          </h2>
          <p className="mt-3 text-gray-400">
            När ansökan skickas sparas dina uppgifter och samtycken säkert.
            Vi återkommer med bekräftelse och nästa steg.
          </p>
        </div>

        {pageError ? (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {pageError}
          </div>
        ) : null}

        {loadError ? (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            {loadError} Teckning är därför tillfälligt pausad.
          </div>
        ) : null}

        {!status.liveSignupEnabled ? (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            Teckning online är inte aktiverad just nu. Kontakta kundservice om du vill ha hjälp.
          </div>
        ) : null}

        <form action={submitApplicationAction} className="space-y-8">
          <input type="hidden" name="utm_source" value={params.utm_source ?? ''} />
          <input type="hidden" name="utm_medium" value={params.utm_medium ?? ''} />
          <input type="hidden" name="utm_campaign" value={params.utm_campaign ?? ''} />
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
                defaultValue={selectedValue}
                disabled={contracts.length === 0}
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition focus:border-cyan-500/40 disabled:opacity-60"
              >
                {contracts.map((contract) => (
                  <option
                    key={contract.price_plan_version_id}
                    value={contract.price_plan_version_id}
                  >
                    {contract.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-white/45">
                Ditt valda avtal används när ansökan skickas.
              </p>
            </div>

            <Field label="Förnamn" name="first_name" />
            <Field label="Efternamn" name="last_name" />
            <Field label="Personnummer" name="personal_number" />
            <Field label="Företagsnamn" name="company_name" />
            <Field label="Organisationsnummer" name="organization_number" />
            <Field label="E-post" name="email" type="email" required />
            <Field label="Telefon" name="phone" required />
            <Field label="Adress" name="address" required />
            <Field label="Postnummer" name="postal_code" required />
            <Field label="Ort" name="city" required />
            <Field label="Lägenhet" name="apartment" />
            <Field
              label="Anläggnings-ID"
              name="facility_id"
              help="Valfritt. Om du saknar uppgiften hjälper vi dig att kontrollera den där det är möjligt."
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

          <div className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-6">
            <div className="text-sm font-medium text-white">
              Godkänn villkor för att skicka ansökan
            </div>

            <Checkbox name="accept_terms">
              Jag godkänner Gridex avtalsvillkor för valt elavtal.
            </Checkbox>
            <Checkbox name="accept_privacy">
              Jag godkänner behandling av personuppgifter enligt integritetspolicyn.
            </Checkbox>
            <Checkbox name="accept_power_of_attorney">
              Jag ger Gridex fullmakt att begära och hantera anläggningsuppgifter från nätägare.
            </Checkbox>
            <Checkbox name="accept_cancellation_right">
              Jag har tagit del av information om ångerrätt.
            </Checkbox>
            <Checkbox name="accept_supplier_switch">
              Jag godkänner att Gridex hanterar leverantörsbyte när uppgifterna är verifierade.
            </Checkbox>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-gray-400">
              När du skickar ansökan sparas dina uppgifter, samtycken, fullmakt och ångerrätt säkert. Vi skickar bekräftelse och återkommer om något behöver kompletteras.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="text-sm text-gray-400">
              Kontrollera uppgifterna innan du skickar. Om du klickar två gånger
              ska det inte skapa dubbla ansökningar.
            </div>

            <button
              disabled={!canSubmit}
              className="h-12 rounded-2xl bg-cyan-500 px-8 font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Skicka ansökan
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function StepCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-sm text-gray-400">{text}</p>
    </div>
  )
}

function Field({
  label,
  name,
  required = false,
  type = 'text',
  help,
}: {
  label: string
  name: string
  required?: boolean
  type?: string
  help?: string
}) {
  return (
    <div>
      <label className="text-sm font-medium text-white/80">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
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
