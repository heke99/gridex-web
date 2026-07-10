import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import {
  isOpsCustomerEventType,
  isTransientOpsError,
  sendOpsCustomerEvent,
} from '@/lib/ops/client'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { enqueuePortalWrite } from '@/lib/customerPortal/outbox'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { clientOperationId, object, text } from '@/lib/customerPortal/writeValidation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function metadata(value: unknown): Record<string, unknown> {
  const row = object(value)
  if (!row) return {}
  return Object.fromEntries(Object.entries(row).slice(0, 50))
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Du behöver logga in.' } }, { status: 401 })
  }

  const body = object(await req.json().catch(() => null))
  if (!body) return validationError('Ogiltig request-body.')
  const eventType = text(body.event_type, 160) ?? ''
  if (!isOpsCustomerEventType(eventType)) {
    return validationError('Händelsetypen stöds inte.', 'event_type')
  }

  const operationId =
    clientOperationId(body.client_operation_id ?? body.idempotency_key) ?? randomUUID()
  const identity = await getOpsPortalIdentityForUser(supabase, user)
  const payload = {
    event_type: eventType,
    entity_type: text(body.entity_type, 160),
    entity_id: text(body.entity_id, 240),
    operation_id: operationId,
    metadata: metadata(body.metadata),
  }

  try {
    await sendOpsCustomerEvent(identity, {
      event_type: eventType,
      source: 'gridex_website',
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      idempotency_key: operationId,
      metadata: payload.metadata,
    })
    return NextResponse.json({ ok: true, queued: false })
  } catch (error) {
    if (!isTransientOpsError(error)) {
      return customerApiErrorResponse(error, {
        logLabel: 'customer-event',
        fallbackMessage: 'Händelsen kunde inte registreras.',
      })
    }
    try {
      await enqueuePortalWrite({
        userId: user.id,
        operationType: 'customer_event',
        idempotencyKey: `customer-event:${user.id}:${operationId}`,
        identity,
        payload,
      })
      return NextResponse.json({ ok: true, queued: true }, { status: 202 })
    } catch (queueError) {
      console.error('[customer event] OPS and outbox failed', { error, queueError })
      return NextResponse.json(
        { error: { code: 'customer_event_not_recorded', message: 'Händelsen kunde inte registreras just nu.' } },
        { status: 503 },
      )
    }
  }
}
