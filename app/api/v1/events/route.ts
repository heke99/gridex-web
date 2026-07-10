import { NextResponse } from 'next/server'
import { POST as postCustomerEvent } from '@/app/api/customer/events/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  // The official tenant-events reader is OPS at app.gridex.se/api/v1/events.
  // Never proxy the tenant event stream with the website server-side key.
  return NextResponse.json({ error: 'Not found.' }, { status: 404 })
}

export async function POST(request: Request) {
  // Reuse the hardened customer-event implementation so the alias has the
  // same authentication, validation, idempotency, error and outbox behavior.
  return postCustomerEvent(request)
}
