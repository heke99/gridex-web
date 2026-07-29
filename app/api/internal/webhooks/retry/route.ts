import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { processOpsWebhookRetries } from '@/lib/webhooks/retry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function safeEqual(value: string, expected: string): boolean {
  const left = Buffer.from(value)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

function authorized(request: Request): boolean {
  const secret = process.env.WEBHOOK_RETRY_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const header = request.headers.get('x-cron-secret')?.trim()
  return Boolean((bearer && safeEqual(bearer, secret)) || (header && safeEqual(header, secret)))
}

export async function POST(request: Request) {
  if (!authorized(request)) {
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
