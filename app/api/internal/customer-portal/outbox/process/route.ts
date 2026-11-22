import { verifyScheduledJobRequest } from '@/lib/integrations/auth'
import { NextResponse } from 'next/server'
import { processPortalWriteOutbox } from '@/lib/customerPortal/outbox'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!verifyScheduledJobRequest(request, process.env.CUSTOMER_PORTAL_OUTBOX_CRON_SECRET)) {
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
