import { NextResponse } from 'next/server'
import { isOpsCustomerEventType, sendOpsCustomerEvent } from '@/lib/ops/client'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown, max = 160): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

export async function GET() {
  // The official tenant-events reader is OPS at app.gridex.se/api/v1/events
  // and requires an OPS API key with events.read. Do not proxy it through the
  // public website, because that would expose the website server-side key and
  // tenant event stream behind an unauthenticated gridex.se route.
  return NextResponse.json({ error: 'Not found.' }, { status: 404 })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const eventType = text(body.event_type ?? body.type) ?? ''
    if (!isOpsCustomerEventType(eventType)) {
      return NextResponse.json({ error: 'Unsupported event.' }, { status: 400 })
    }

    const overview = await getCustomerPortalOverview()
    const profile = overview.profile

    if (!profile?.user_id) {
      return NextResponse.json({ error: 'Kunden är inte inloggad.' }, { status: 401 })
    }

    await sendOpsCustomerEvent(
      {
        userId: profile.user_id,
        email: profile.email,
        customerNumber: profile.customer_number ?? profile.contract_customer_ref ?? null,
        externalCustomerId:
          profile.external_customer_id && profile.external_customer_id !== profile.customer_number
            ? profile.external_customer_id
            : null,
      },
      {
        event_type: eventType,
        source: 'gridex_website',
        entity_type: text(body.entity_type) || null,
        entity_id: text(body.entity_id) || null,
        idempotency_key: text(body.idempotency_key, 240) || null,
        metadata: metadata(body.metadata),
      },
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[customer portal] event route failed', error)
    return NextResponse.json(
      { error: 'Händelsen kunde inte skickas just nu.' },
      { status: 500 },
    )
  }
}
