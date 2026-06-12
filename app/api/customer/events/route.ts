import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { sendOpsCustomerEvent } from '@/lib/ops/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED = new Set([
  'customer.opened_contract',
  'customer.downloaded_contract',
  'customer.opened_invoice',
  'customer.downloaded_invoice',
  'customer.updated_contact_details',
  'customer.accepted_power_of_attorney',
  'customer.completed_facility_data',
  'customer.viewed_switch_status',
])

function text(value: unknown, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const eventType = text(body?.event_type)
  if (!ALLOWED.has(eventType)) {
    return NextResponse.json({ error: 'Unsupported event.' }, { status: 400 })
  }

  try {
    await sendOpsCustomerEvent(
      { userId: user.id, email: user.email ?? null },
      {
        event_type: eventType,
        source: 'gridex_website',
        entity_type: text(body?.entity_type) || null,
        entity_id: text(body?.entity_id) || null,
        metadata:
          body && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
            ? (body.metadata as Record<string, unknown>)
            : {},
      }
    )
  } catch {
    // Customer actions must not fail just because event logging is temporarily unavailable.
    return NextResponse.json({ ok: true, queued: false })
  }

  return NextResponse.json({ ok: true })
}
