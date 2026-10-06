import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { processPublicSupportReceipts } from '@/lib/customerPortal/publicSupportReceipts'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const received = request.headers.get('authorization') ?? ''
  const expected = secret ? `Bearer ${secret}` : ''
  if (!expected || Buffer.byteLength(received) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Four provider calls at 12 seconds each leave room for database I/O within
  // this function's budget; unclaimed receipts stay queued for the next run.
  try { return NextResponse.json({ ok: true, ...await processPublicSupportReceipts(4) }) }
  catch { return NextResponse.json({ error: 'Bekräftelsekön kunde inte behandlas.' }, { status: 503 }) }
}
export async function GET(request: Request) { return POST(request) }
