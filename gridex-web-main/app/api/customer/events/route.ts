import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { isOpsCustomerEventType, sendOpsCustomerEvent } from '@/lib/ops/client'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function text(value: unknown, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
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
  if (!isOpsCustomerEventType(eventType)) {
    return NextResponse.json({ error: 'Unsupported event.' }, { status: 400 })
  }

  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    await sendOpsCustomerEvent(identity, {
      event_type: eventType,
      source: 'gridex_website',
      entity_type: text(body?.entity_type) || null,
      entity_id: text(body?.entity_id) || null,
      idempotency_key: text(body?.idempotency_key, 240) || null,
      metadata: metadata(body?.metadata),
    })
  } catch {
    // Customer actions must not fail just because event logging is temporarily unavailable.
    return NextResponse.json({ ok: true, queued: false })
  }

  return NextResponse.json({ ok: true })
}
