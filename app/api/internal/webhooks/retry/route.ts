import { verifyScheduledJobRequest } from '@/lib/integrations/auth'
import { NextResponse } from 'next/server'
import { processOpsWebhookRetries } from '@/lib/webhooks/retry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!verifyScheduledJobRequest(request, process.env.WEBHOOK_RETRY_CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json({ ok: true, ...(await processOpsWebhookRetries()) })
  } catch (error) {
    console.error('[ops webhook retry] processing failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    })
    return NextResponse.json({ error: 'Webhook retry processing failed.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
