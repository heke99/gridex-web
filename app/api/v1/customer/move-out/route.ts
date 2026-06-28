import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { submitOpsCustomerMoveOut } from '@/lib/ops/client'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown, max = 240): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })
  }

  const body = object(await req.json().catch(() => null)) ?? {}
  const moveOut = object(body.move_out ?? body.moveOut) ?? body

  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    const result = await submitOpsCustomerMoveOut({
      identity,
      idempotencyKey: text(body.idempotency_key ?? body.idempotencyKey),
      moveOut,
      metadata: object(body.metadata) ?? { source: 'gridex_web_move_out_route' },
    })

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[customer portal] OPS move-out failed', error)
    return NextResponse.json(
      { error: 'Flyttanmälan kunde inte skickas just nu.', code: 'customer_portal_unavailable' },
      { status: 502 },
    )
  }
}
