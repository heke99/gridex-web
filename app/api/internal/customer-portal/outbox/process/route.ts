import { NextResponse } from 'next/server'
import { processPortalWriteOutbox } from '@/lib/customerPortal/outbox'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function authorized(request: Request): boolean {
  const secret = process.env.CUSTOMER_PORTAL_OUTBOX_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const authorization = request.headers.get('authorization')
  const headerSecret = request.headers.get('x-cron-secret')
  return authorization === `Bearer ${secret}` || headerSecret === secret
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json({ ok: true, ...(await processPortalWriteOutbox()) })
  } catch (error) {
    console.error('[customer portal outbox] cron failed', error)
    return NextResponse.json({ error: 'Outbox processing failed.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
