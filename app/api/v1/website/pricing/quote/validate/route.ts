import { NextResponse } from 'next/server'
import { fetchOpsPublicContractsFresh, type OpsWebsitePriceArea } from '@/lib/ops/client'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'
import { resolveWebsitePriceAreaForPricing } from '@/lib/website/priceAreaResolver'
import { validateWebsitePricingQuote } from '@/lib/website/pricingQuote'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AREAS = new Set<OpsWebsitePriceArea>(['SE1', 'SE2', 'SE3', 'SE4'])

function text(value: unknown, max = 180): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function area(value: unknown): OpsWebsitePriceArea | null {
  const parsed = typeof value === 'string' ? value.toUpperCase() : ''
  return AREAS.has(parsed as OpsWebsitePriceArea) ? parsed as OpsWebsitePriceArea : null
}

function kwh(value: unknown): number | null {
  const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value)
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 200000 ? parsed : null
}

export async function POST(req: Request) {
  const rateLimit = await checkRateLimit(
    `website-quote-validate:${clientIpFromHeaders(new Headers(req.headers))}`,
    { limit: 30, windowMs: 5 * 60_000 },
  )
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'För många kontroller. Vänta en stund och försök igen.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1_000))) },
      },
    )
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const token = text(body?.quote_token, 12_000)
  const offerReference = text(body?.offer_reference)
  const priceAreaCode = area(body?.price_area_code)
  const estimatedMonthlyKwh = kwh(body?.estimated_monthly_kwh)
  const postalCode = text(body?.postal_code, 20).replace(/\s+/g, '')
  const city = text(body?.city)
  const address = text(body?.address)

  if (!token || !offerReference || !priceAreaCode || !estimatedMonthlyKwh || !/^\d{5}$/.test(postalCode) || !city || !address) {
    return NextResponse.json(
      { ok: false, error: 'Prisberäkningen saknar uppgifter och måste göras om.' },
      { status: 400 },
    )
  }

  try {
    const [contracts, resolution] = await Promise.all([
      fetchOpsPublicContractsFresh(),
      resolveWebsitePriceAreaForPricing({ postal_code: postalCode, city, address, street: address }),
    ])
    const contract = contracts.find((item) => item.offer_reference === offerReference)
    if (!contract || !buildPublicContractDisplay(contract).ready) {
      return NextResponse.json({ ok: false, error: 'Det valda avtalet är inte längre tillgängligt.' }, { status: 409 })
    }
    if (!resolution.price_area_code || resolution.price_area_code !== priceAreaCode) {
      return NextResponse.json({ ok: false, error: 'Adressen och elområdet stämmer inte längre. Räkna om priset.' }, { status: 409 })
    }

    const verified = validateWebsitePricingQuote({
      token,
      contract,
      priceAreaCode,
      estimatedMonthlyKwh,
      location: { postalCode, city, address },
    })
    if (!verified.ok) {
      const expired = verified.reason === 'expired'
      return NextResponse.json(
        { ok: false, error: expired ? 'Prisberäkningen har gått ut. Hämta ett nytt pris.' : 'Prisberäkningen är inte längre giltig. Räkna om priset.' },
        { status: 409 },
      )
    }

    return NextResponse.json({ ok: true, quote_expires_at: verified.quote.expires_at })
  } catch (error) {
    console.error('[website quote validate] failed', error)
    return NextResponse.json({ ok: false, error: 'Vi kunde inte kontrollera priset just nu.' }, { status: 503 })
  }
}
