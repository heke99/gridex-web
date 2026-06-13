import { NextResponse } from 'next/server'
import { resolveWebsitePriceAreaForPricing } from '@/lib/website/priceAreaResolver'

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

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ResolvePayload | null

  const resolution = await resolveWebsitePriceAreaForPricing({
    postal_code: String(body?.postal_code ?? body?.postalCode ?? ''),
    city: text(body?.city),
    address: text(body?.address ?? body?.street),
    street: text(body?.street ?? body?.address),
  })

  if (!resolution.price_area_code) {
    return NextResponse.json(
      {
        error:
          resolution.customer_message ||
          'Vi kunde inte hitta elområdet automatiskt. Kontrollera postnumret och försök igen.',
        data: resolution,
      },
      { status: resolution.status === 'error' ? 400 : 422 }
    )
  }

  return NextResponse.json({ data: resolution })
}
