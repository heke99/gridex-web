import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import SignupFlowClient from '@/components/signup/SignupFlowClient'
import { type SignupContractOption } from '@/components/signup/CustomerApplicationForm'
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
  title: 'Ansök om elavtal – Gridex',
  description:
    'Ansök om elavtal hos Gridex. Välj avtal, granska pris och avgifter, godkänn villkor och få bekräftelse på nästa steg.',
  alternates: { canonical: 'https://gridex.se/teckna-avtal' },
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

function toSignupContractOption(item: OpsPublicContract): SignupContractOption {
  return {
    name: item.name,
    value: item.price_plan_version_id,
    productCode: item.product_code,
    pricePlanId: item.price_plan_id,
    pricePlanVersionId: item.price_plan_version_id,
    contractId: item.contract_id ?? null,
    type: item.type,
    monthlyFeeSek: item.monthly_fee_sek,
    invoiceFeeSek: item.invoice_fee_sek,
    markupOrePerKwh: item.markup_ore_per_kwh,
    variableMarkupOrePerKwh: item.variable_markup_ore_per_kwh,
    fixedPriceOrePerKwh: item.fixed_price_ore_per_kwh,
    validFrom: item.valid_from ?? null,
    validTo: item.valid_to ?? null,
    bindingPeriodMonths: item.binding_period_months ?? null,
    noticePeriodDays: item.notice_period_days ?? null,
    included: item.included ?? null,
    excluded: item.excluded ?? null,
    startInfo: item.start_info ?? null,
    customerTypes: item.customer_types ?? null,
    termsVersion: item.terms_version ?? null,
    privacyPolicyVersion: item.privacy_policy_version ?? null,
    cancellationRightVersion: item.cancellation_right_version ?? null,
    powerOfAttorneyVersion: item.power_of_attorney_version ?? null,
    priceTermsVersion: item.price_terms_version ?? null,
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
      return 'Du behöver godkänna villkor, ångerrätt, integritetspolicy och fullmakt för att skicka ansökan.'
    case 'honeypot':
      return 'Ansökan kunde inte skickas. Kontrollera uppgifterna och försök igen.'
    case 'not_configured':
      return 'Ansökan online är inte aktiverad just nu.'
    case 'ops_unavailable':
      return 'Vi kunde inte skicka din ansökan just nu. Försök igen om en stund eller kontakta kundservice.'
    case 'live_disabled':
      return 'Ansökan online är inte aktiverad just nu.'
    case 'offer':
      return 'Valt avtal kunde inte verifieras. Välj ett aktuellt avtal och försök igen.'
    case 'snapshot':
      return 'Avtalet har uppdaterats sedan sidan laddades. Välj avtalet igen och kontrollera sammanfattningen.'
    case 'rate_limit':
      return 'För många försök på kort tid. Vänta en stund och försök igen.'
    default:
      return null
  }
}

function missingFieldsToQuery(fields: string[]) {
  return fields.slice(0, 8).join(',')
}

function parseOptionalNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseJsonSnapshot(value: string): Record<string, unknown> | null {
  if (!value.trim()) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
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
    } catch {
      loadError = 'Vi kunde inte hämta aktuella elavtal just nu.'
    }
  } else {
    loadError = 'Ansökan online är inte tillgänglig just nu.'
  }

  const signupOptions = contracts.map(toSignupContractOption)
  const selectedContract = selectedContractFromParams(contracts, params)
  const selectedValue = selectedContract?.price_plan_version_id ?? ''
  const pageError = errorText(params.error)
  const canSubmit =
    status.configured && status.liveSignupEnabled && !loadError && contracts.length > 0

  async function submitApplicationAction(formData: FormData) {
    'use server'

    const currentStatus = getOpsClientStatus()
    if (!currentStatus.configured) redirect('/teckna-avtal?error=not_configured')
    if (!currentStatus.liveSignupEnabled) redirect('/teckna-avtal?error=live_disabled')

    const h = await headers()
    const ip = getClientIpFromHeaders(h)
    const userAgent = h.get('user-agent')
    const rate = checkRateLimit(`signup:${ip ?? 'unknown'}`, {
      limit: 8,
      windowMs: 15 * 60 * 1000,
    })
    if (!rate.allowed) redirect('/teckna-avtal?error=rate_limit')

    const honeypot = normalizeText(formData.get('company_website'))
    if (honeypot) redirect('/teckna-avtal?error=honeypot')

    const selectedOffer = normalizeText(formData.get('selected_offer'))
    const liveContracts = await fetchOpsPublicContracts().catch(() => [])
    const offer = liveContracts.find(
      (contract) => contract.price_plan_version_id === selectedOffer
    )

    if (!offer) redirect('/teckna-avtal?error=offer')

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

    const hasIdentity =
      customerType === 'company'
        ? Boolean(companyName && organizationNumber)
        : Boolean(firstName && lastName && personalNumber)

    if (!email || !phone || !address || !postalCode || !city || !hasIdentity) {
      redirect('/teckna-avtal?error=validation')
    }

    if (
      !acceptTerms ||
      !acceptPrivacy ||
      !acceptPowerOfAttorney ||
      !acceptCancellation
    ) {
      redirect('/teckna-avtal?error=consent')
    }

    const contractDisplaySnapshot = parseJsonSnapshot(
      normalizeText(formData.get('contract_display_snapshot'))
    )
    if (
      contractDisplaySnapshot &&
      String(contractDisplaySnapshot.price_plan_version_id || '') !== offer.price_plan_version_id
    ) {
      redirect('/teckna-avtal?error=snapshot')
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
        price_area_code: normalizeText(formData.get('price_area_code')) || null,
        grid_area_code: normalizeText(formData.get('grid_area_code')) || null,
        grid_owner_id: normalizeText(formData.get('grid_owner_id')) || null,
        grid_owner_name: normalizeText(formData.get('grid_owner_name')) || null,
        energy_resolution_status:
          normalizeText(formData.get('energy_resolution_status')) || null,
        energy_resolution_confidence: parseOptionalNumber(
          normalizeText(formData.get('energy_resolution_confidence'))
        ),
        estimated_monthly_kwh: parseOptionalNumber(
          normalizeText(formData.get('estimated_monthly_kwh'))
        ),
        pricing_preview_snapshot: parseJsonSnapshot(
          normalizeText(formData.get('pricing_preview_snapshot'))
        ),
        contract_display_snapshot: parseJsonSnapshot(
          normalizeText(formData.get('contract_display_snapshot'))
        ),
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

      successRedirect = `/teckna-avtal/tack?${qs.toString()}`
    } catch (error) {
      if (isOpsError(error)) {
        if (error.status === 503) redirect('/teckna-avtal?error=live_disabled')
        redirect('/teckna-avtal?error=ops_unavailable')
      }
      redirect('/teckna-avtal?error=ops_unavailable')
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
              Välj avtal • Granska uppgifter • Skicka ansökan
            </div>

            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                Ansök om elavtal
                <br />
                steg för steg
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">
                Välj elavtal, fyll i dina uppgifter och granska allt innan du skickar. Ansökan är inte färdig kundstart förrän Gridex har kontrollerat uppgifterna och bekräftat nästa steg.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/elavtal"
                className="rounded-xl border border-white/10 px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-cyan-500/40 hover:bg-white/5"
              >
                Jämför elavtal
              </Link>
              <Link
                href="/kundservice"
                className="rounded-xl border border-white/10 px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-cyan-500/40 hover:bg-white/5"
              >
                Få hjälp
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <StepCard title="1. Välj avtal" text="Se månadsavgift, påslag och fakturaavgift innan du går vidare." />
            <StepCard title="2. Fyll i uppgifter" text="Privat- och företagsfält visas separat. Anläggningsuppgifter kan kompletteras senare." />
            <StepCard title="3. Granska och skicka" text="Kontrollera sammanfattningen och godkänn juridiska dokument var för sig." />
          </div>
        </div>
      </section>

      {pageError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100" role="alert">
          {pageError}
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          {loadError} Ansökan är därför tillfälligt pausad.
        </div>
      ) : null}

      {!status.liveSignupEnabled ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Ansökan online är inte aktiverad just nu. Kontakta kundservice om du vill ha hjälp.
        </div>
      ) : null}

      <SignupFlowClient
        contracts={signupOptions}
        initialSelectedValue={selectedValue}
        canSubmit={canSubmit}
        utm={{
          utm_source: params.utm_source,
          utm_medium: params.utm_medium,
          utm_campaign: params.utm_campaign,
        }}
        action={submitApplicationAction}
      />
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
