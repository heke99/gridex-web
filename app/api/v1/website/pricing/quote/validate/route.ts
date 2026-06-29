import { NextResponse } from 'next/server'
import {
  fetchOpsPublicContracts,
  type OpsWebsitePriceArea,
} from '@/lib/ops/client'
import { validateWebsitePricingQuote } from '@/lib/website/pricingQuote'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AREAS = new Set<OpsWebsitePriceArea>(['SE1', 'SE2', 'SE3', 'SE4'])

function text(value: unknown, max = 180): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function number(value: unknown): number | null {
  const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value)
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 200000 ? parsed : null
}

function area(value: unknown): OpsWebsitePriceArea | null {
  const parsed = typeof value === 'string' ? value.toUpperCase() : ''
  return AREAS.has(parsed as OpsWebsitePriceArea) ? (parsed as OpsWebsitePriceArea) : null
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const token = text(body?.quote_token, 8000)
  const offerReference = text(body?.offer_reference)
  const priceAreaCode = area(body?.price_area_code)
  const estimatedMonthlyKwh = number(body?.estimated_monthly_kwh)
  const postalCode = text(body?.postal_code, 20)
  const city = text(body?.city)
  const address = text(body?.address)

  if (!token || !offerReference || !priceAreaCode || !estimatedMonthlyKwh || !postalCode || !city || !address) {
    return NextResponse.json({ ok: false, error: 'Kontrollera adress, elområde och förbrukning innan du går vidare.' }, { status: 400 })
  }

  try {
    const contracts = await fetchOpsPublicContracts()
    const contract = contracts.find((item) => item.offer_reference === offerReference)
    if (!contract) return NextResponse.json({ ok: false, error: 'Det valda avtalet är inte längre tillgängligt.' }, { status: 409 })

    const local = validateWebsitePricingQuote({
      token,
      contract,
      priceAreaCode,
      estimatedMonthlyKwh,
      location: { postalCode, city, address },
    })

    if (!local.ok) {
      return NextResponse.json({ ok: false, error: 'Din prisberäkning har ändrats eller har gått ut. Räkna om priset innan du går vidare.' }, { status: 409 })
    }

    return NextResponse.json({ ok: true, expires_at: local.quote.expires_at, quote_source: 'website' })
  } catch (error) {
    console.error('[website pricing quote validate] failed', error)
    return NextResponse.json({ ok: false, error: 'Vi kunde inte kontrollera prisberäkningen just nu.' }, { status: 503 })
  }
}
