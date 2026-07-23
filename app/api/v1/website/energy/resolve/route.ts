import { NextResponse } from 'next/server'
import { resolveWebsitePriceAreaForPricing } from '@/lib/website/priceAreaResolver'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ResolvePayload = { postal_code?: unknown; postalCode?: unknown; city?: unknown; street?: unknown; address?: unknown }
function text(value: unknown, max = 180): string | null { if (typeof value !== 'string') return null; const v=value.trim().slice(0,max); return v || null }

export async function POST(req: Request) {
  const rateLimit = await checkRateLimit(`website-energy-resolve:${clientIpFromHeaders(new Headers(req.headers))}`, { limit: 30, windowMs: 5 * 60_000 })
  if (!rateLimit.allowed) return NextResponse.json({ error: 'För många adresskontroller. Vänta en stund och försök igen.' }, { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rateLimit.resetAt-Date.now())/1000))) } })
  const body = await req.json().catch(() => null) as ResolvePayload | null
  const postalCode = String(body?.postal_code ?? body?.postalCode ?? '').replace(/\s+/g,'')
  const city = text(body?.city)
  const address = text(body?.address ?? body?.street)
  if (!/^\d{5}$/.test(postalCode) || !city || !address) return NextResponse.json({ error: 'Ange adress, ort och ett svenskt postnummer med fem siffror.' }, { status: 400 })
  try {
    const resolution = await resolveWebsitePriceAreaForPricing({ postal_code: postalCode, city, address, street: address })
    if (!resolution.price_area_code) return NextResponse.json({ error: resolution.customer_message || 'Vi kunde inte fastställa elområdet säkert.', data: resolution }, { status: 422 })
    const confidence = resolution.confidence ?? 0
    const assurance_level = confidence >= 0.95 ? 'sufficient_for_application' : confidence >= 0.75 ? 'indicative_only' : 'unresolved'
    return NextResponse.json({ data: { ...resolution, assurance_level } }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[website energy resolve] local resolver failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Vi kunde inte kontrollera elområdet just nu.' }, { status: 503 })
  }
}
