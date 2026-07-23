import { NextResponse } from 'next/server'
import { verifyWebsitePricingQuote } from '@/lib/website/pricingQuote'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { pricing_token?: unknown } | null
  const token = typeof body?.pricing_token === 'string' ? body.pricing_token : ''
  const verified = verifyWebsitePricingQuote(token)
  if (!verified.ok) return NextResponse.json({ ok: false, error: 'Prisberäkningen är ogiltig eller har gått ut.' }, { status: 409 })
  return NextResponse.json({ ok: true, pricing_snapshot_reference: verified.quote.pricing_snapshot_reference, valid_until: verified.quote.valid_until })
}
