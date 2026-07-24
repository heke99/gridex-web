import { NextResponse } from 'next/server'
import { fetchOpsCurrentMarketPrice, isOpsError } from '@/lib/ops/client'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Payload = { resolution_id?: unknown; resolutionId?: unknown }

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized && normalized.length <= 200 ? normalized : null
}

export async function POST(request: Request) {
  const rate = await checkRateLimit(
    `website-market-price-current:${clientIpFromHeaders(new Headers(request.headers))}`,
    { limit: 30, windowMs: 5 * 60_000 },
  )
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'För många prisförfrågningar.' } },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1_000))) } },
    )
  }

  const body = await request.json().catch(() => null) as Payload | null
  const resolutionId = text(body?.resolution_id ?? body?.resolutionId)
  if (!resolutionId) {
    return NextResponse.json(
      { error: { code: 'resolution_required', message: 'Adressen behöver kontrolleras innan priset kan hämtas.' } },
      { status: 400 },
    )
  }

  try {
    const data = await fetchOpsCurrentMarketPrice(resolutionId)
    const { raw: _raw, ...publicData } = data
    return NextResponse.json({ data: publicData }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const code = isOpsError(error) ? error.code : null
    const status = isOpsError(error) && error.status < 500 ? error.status : 503
    return NextResponse.json(
      {
        error: {
          code: code ?? 'market_price_unavailable',
          message: code === 'market_price_stale'
            ? 'Ett aktuellt marknadspris kan inte hämtas just nu.'
            : 'Marknadspriset kan inte hämtas just nu.',
        },
      },
      { status, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
}
