import { NextResponse } from 'next/server'
import { fetchOpsPublicContractsFresh } from '@/lib/ops/client'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'
import { contractSupportsCustomerType, parseWebsiteCustomerType } from '@/lib/website/customerType'
import { createWebsiteCheckoutContext } from '@/lib/website/checkoutContextStore'
import { quoteToWebsitePricingPreview } from '@/lib/website/pricingQuote'
import { validateCanonicalWebsiteQuote } from '@/lib/website/canonicalQuoteValidation'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'
import { parseRequestedStartSelection } from '@/lib/website/requestedStart'
import {
  consumptionProfileMatchesMonthlyKwh,
  normalizeWebsiteConsumptionProfile,
} from '@/lib/website/consumptionEstimator'
import { readWebJson } from '@/lib/api/webBoundary'
import { matchesGridexWebsiteCheckoutPolicy } from '@/lib/website/checkoutPolicy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'


function text(value: unknown, max = 180): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function POST(req: Request) {
  const rateLimit = await checkRateLimit(
    `website-checkout-context:${clientIpFromHeaders(new Headers(req.headers))}`,
    { limit: 12, windowMs: 10 * 60_000 },
  )
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'För många försök. Vänta en stund och försök igen.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1_000))) },
      },
    )
  }

  const parsedBody = await readWebJson<Record<string, unknown>>(req)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.value
  const customerType = parseWebsiteCustomerType(body?.customer_type)
  const requestedStart = parseRequestedStartSelection({
    mode: body?.requested_start_mode,
    requestedDate: body?.requested_start_date,
  })
  const offerReference = text(body?.offer_reference)
  const quoteToken = text(body?.pricing_token, 12_000)
  const postalCode = text(body?.postal_code, 20).replace(/\s+/g, '')
  const city = text(body?.city)
  const address = text(body?.address)
  const resolutionToken = text(body?.resolution_token, 12_000)
  const estimatedMonthlyKwh = Number(body?.estimated_monthly_kwh)
  const annualConsumptionKwh = Number(body?.annual_consumption_kwh)
  const pricingSnapshotReference = text(body?.pricing_snapshot_reference, 180)
  const consumptionProfile = normalizeWebsiteConsumptionProfile(body?.consumption_profile)
  const quoteAttemptId = text(body?.quote_attempt_id, 80)

  if (!customerType) {
    return NextResponse.json({ error: { code: 'validation_error', field: 'customer_type' } }, { status: 400 })
  }
  if (!requestedStart.ok) {
    return NextResponse.json({ error: { code: 'validation_error', field: requestedStart.code.startsWith('requested_start_mode') ? 'requested_start_mode' : 'requested_start_date' } }, { status: 400 })
  }

  if (
    !offerReference ||
    !quoteToken ||
    !/^\d{5}$/.test(postalCode) ||
    !city ||
    !address ||
    !resolutionToken ||
    !Number.isFinite(estimatedMonthlyKwh) ||
    estimatedMonthlyKwh < 1 ||
    estimatedMonthlyKwh > 200000 ||
    !Number.isFinite(annualConsumptionKwh) ||
    annualConsumptionKwh < 1 ||
    annualConsumptionKwh > 2_400_000 ||
    !consumptionProfile ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(quoteAttemptId) ||
    !consumptionProfileMatchesMonthlyKwh(consumptionProfile, estimatedMonthlyKwh) ||
    Math.abs(consumptionProfile.annual_kwh - annualConsumptionKwh) > 0.001
  ) {
    return NextResponse.json({ error: 'Prisberäkningen är ofullständig.' }, { status: 400 })
  }

  try {
    const contracts = await fetchOpsPublicContractsFresh(customerType)
    const contract = contracts.find((item) => item.offer_reference === offerReference)
    if (
      !contract ||
      !buildPublicContractDisplay(contract).onlineReady ||
      !contractSupportsCustomerType(contract.customer_types, customerType)
    ) {
      return NextResponse.json({ error: 'Det valda avtalet är inte tillgängligt för kundtypen.' }, { status: 409 })
    }
    const verified = await validateCanonicalWebsiteQuote({
      pricingToken: quoteToken,
      pricingSnapshotReference,
      resolutionToken,
      contract,
      customerType,
      estimatedMonthlyKwh,
      annualConsumptionKwh,
      requestedStartMode: requestedStart.value.mode,
      requestedStartDate: requestedStart.value.requestedDate,
      location: { postalCode, city, address },
    })
    if (!verified.ok) {
      return NextResponse.json({ error: 'Prisunderlaget kunde inte kontrolleras automatiskt. Försök igen.' }, { status: 409 })
    }
    if (
      verified.value.displayedQuote.version >= 5 &&
      verified.value.displayedQuote.quote_attempt_id !== quoteAttemptId
    ) {
      return NextResponse.json(
        { error: 'Prisförsöket matchar inte den signerade prisberäkningen.', code: 'quote_attempt_mismatch' },
        { status: 409 },
      )
    }
    if (!matchesGridexWebsiteCheckoutPolicy(verified.value.quote)) {
      return NextResponse.json(
        { error: 'De valda avtalsinställningarna kunde inte kontrolleras automatiskt.', code: 'checkout_policy_changed' },
        { status: 409 },
      )
    }

    const token = await createWebsiteCheckoutContext({
      customerType,
      selectedOffer: offerReference,
      pricingPreview: quoteToWebsitePricingPreview(verified.value.quote, verified.value.pricingToken),
      quoteContext: {
        postal_code: postalCode,
        city,
        address,
        resolution_token: verified.value.resolutionToken,
        resolution_id: verified.value.area.resolutionId,
        price_area_code: verified.value.area.priceAreaCode,
        grid_area_code: verified.value.area.gridAreaCode,
        grid_owner_name: verified.value.area.gridOwnerName,
        estimated_monthly_kwh: estimatedMonthlyKwh,
        annual_consumption_kwh: annualConsumptionKwh,
        consumption_profile: consumptionProfile,
        price_option_reference: verified.value.quote.price_option_reference,
        invoice_delivery_method: verified.value.quote.invoice_delivery_method,
        selected_component_references: verified.value.quote.selected_component_references,
        site_count: verified.value.quote.site_count,
        requested_start_mode: verified.value.quote.requested_start_mode,
        requested_start_date: verified.value.quote.requested_start_mode === 'specific_date' ? verified.value.quote.start_date : null,
        quote_attempt_id: verified.value.quote.quote_attempt_id ?? quoteAttemptId,
      },
    })
    return NextResponse.json({ checkout_token: token })
  } catch (error) {
    console.error('[website checkout context] failed', error)
    return NextResponse.json({ error: 'Vi kunde inte spara prisberäkningen just nu.' }, { status: 503 })
  }
}
