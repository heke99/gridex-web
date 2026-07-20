import { NextResponse } from 'next/server'
import { fetchOpsPublicContractsFresh, type OpsWebsitePriceArea } from '@/lib/ops/client'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'
import { contractSupportsCustomerType, type WebsiteCustomerType } from '@/lib/website/customerType'
import { createWebsiteCheckoutContext } from '@/lib/website/checkoutContextStore'
import { resolveWebsitePriceAreaForPricing } from '@/lib/website/priceAreaResolver'
import { quoteToWebsitePricingPreview, validateWebsitePricingQuote } from '@/lib/website/pricingQuote'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'
import {
  consumptionProfileMatchesMonthlyKwh,
  normalizeWebsiteConsumptionProfile,
} from '@/lib/website/consumptionEstimator'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AREAS = new Set<OpsWebsitePriceArea>(['SE1', 'SE2', 'SE3', 'SE4'])

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

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const customerType: WebsiteCustomerType = body?.customer_type === 'company' ? 'company' : 'private'
  const offerReference = text(body?.offer_reference)
  const quoteToken = text(body?.quote_token, 12_000)
  const postalCode = text(body?.postal_code, 20).replace(/\s+/g, '')
  const city = text(body?.city)
  const address = text(body?.address)
  const area = text(body?.price_area_code).toUpperCase() as OpsWebsitePriceArea
  const estimatedMonthlyKwh = Number(body?.estimated_monthly_kwh)
  const consumptionProfile = normalizeWebsiteConsumptionProfile(body?.consumption_profile)

  if (
    !offerReference ||
    !quoteToken ||
    !/^\d{5}$/.test(postalCode) ||
    !city ||
    !address ||
    !AREAS.has(area) ||
    !Number.isFinite(estimatedMonthlyKwh) ||
    estimatedMonthlyKwh < 1 ||
    estimatedMonthlyKwh > 200000 ||
    !consumptionProfile ||
    !consumptionProfileMatchesMonthlyKwh(consumptionProfile, estimatedMonthlyKwh)
  ) {
    return NextResponse.json({ error: 'Prisberäkningen är ofullständig.' }, { status: 400 })
  }

  try {
    const [contracts, resolution] = await Promise.all([
      fetchOpsPublicContractsFresh(),
      resolveWebsitePriceAreaForPricing({ postal_code: postalCode, city, address, street: address }),
    ])
    const contract = contracts.find((item) => item.offer_reference === offerReference)
    if (
      !contract ||
      !buildPublicContractDisplay(contract).ready ||
      !contractSupportsCustomerType(contract.customer_types, customerType)
    ) {
      return NextResponse.json({ error: 'Det valda avtalet är inte tillgängligt för kundtypen.' }, { status: 409 })
    }
    if (!resolution.price_area_code || resolution.price_area_code !== area) {
      return NextResponse.json({ error: 'Adressen och elområdet måste kontrolleras igen.' }, { status: 409 })
    }

    const verified = validateWebsitePricingQuote({
      token: quoteToken,
      contract,
      priceAreaCode: area,
      estimatedMonthlyKwh,
      location: { postalCode, city, address },
    })
    if (!verified.ok) {
      return NextResponse.json({ error: 'Uppgifterna behöver verifieras igen innan du fortsätter.' }, { status: 409 })
    }

    const token = await createWebsiteCheckoutContext({
      customerType,
      selectedOffer: offerReference,
      pricingPreview: quoteToWebsitePricingPreview(verified.quote, quoteToken),
      quoteContext: {
        postal_code: postalCode,
        city,
        address,
        price_area_code: area,
        estimated_monthly_kwh: estimatedMonthlyKwh,
        consumption_profile: consumptionProfile,
      },
    })
    return NextResponse.json({ checkout_token: token })
  } catch (error) {
    console.error('[website checkout context] failed', error)
    return NextResponse.json({ error: 'Vi kunde inte spara prisberäkningen just nu.' }, { status: 503 })
  }
}
