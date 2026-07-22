import { NextResponse } from 'next/server'
import { resolveWebsitePriceAreaForPricing } from '@/lib/website/priceAreaResolver'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ResolvePayload = {
  postal_code?: unknown
  postalCode?: unknown
  city?: unknown
  street?: unknown
  address?: unknown
}

function text(value: unknown, max = 180): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed ? trimmed : null
}

function browserResolution(resolution: Awaited<ReturnType<typeof resolveWebsitePriceAreaForPricing>>) {
  return {
    status: resolution.status,
    price_area_code: resolution.price_area_code,
    grid_area_code: resolution.grid_area_code ?? null,
    grid_owner_id: resolution.grid_owner_id ?? null,
    grid_owner_name: resolution.grid_owner_name ?? null,
    confidence: resolution.confidence ?? null,
    source: resolution.source ?? null,
    customer_message: resolution.customer_message ?? null,
  }
}

export async function POST(req: Request) {
  const rateLimit = await checkRateLimit(
    `website-energy-resolve:${clientIpFromHeaders(new Headers(req.headers))}`,
    { limit: 30, windowMs: 5 * 60_000 },
  )
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'För många adresskontroller. Vänta en stund och försök igen.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1_000))) },
      },
    )
  }
  const body = (await req.json().catch(() => null)) as ResolvePayload | null

  if (!body) {
    return NextResponse.json({ error: 'Kontrollera adressuppgifterna och försök igen.' }, { status: 400 })
  }

  const postalCode = String(body.postal_code ?? body.postalCode ?? '').replace(/\s+/g, '')
  const city = text(body.city)
  const address = text(body.address ?? body.street)
  if (!/^\d{5}$/.test(postalCode) || !city || !address) {
    return NextResponse.json({ error: 'Ange adress, ort och ett svenskt postnummer med fem siffror.' }, { status: 400 })
  }

  const resolution = await resolveWebsitePriceAreaForPricing({
    postal_code: postalCode,
    city,
    address,
    street: address,
  }).catch((error) => {
    console.error('[website energy resolve] failed', error)
    return null
  })

  if (!resolution) {
    return NextResponse.json({ error: 'Vi kunde inte kontrollera elområdet just nu.' }, { status: 503 })
  }

  if (!resolution.price_area_code) {
    return NextResponse.json(
      {
        error:
          resolution.customer_message ||
          'Vi kunde inte hitta elområdet automatiskt. Kontrollera postnumret och försök igen.',
        data: browserResolution(resolution),
      },
      { status: resolution.status === 'error' ? 400 : 422 }
    )
  }

  return NextResponse.json({ data: browserResolution(resolution) })
}
