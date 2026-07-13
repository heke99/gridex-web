import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { isTransientOpsError, submitOpsCustomerMoveOut } from '@/lib/ops/client'
import { enqueuePortalWrite } from '@/lib/customerPortal/outbox'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { clientOperationId, moveOutPayload, object } from '@/lib/customerPortal/writeValidation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { code: 'unauthorized', message: 'Du behöver logga in.' } }, { status: 401 })

  const body = object(await req.json().catch(() => null))
  if (!body) return validationError('Ogiltig request-body.')
  const moveOut = moveOutPayload(body.move_out ?? body.moveOut)
  if (!moveOut) return validationError('Flyttuppgifter saknas eller är ogiltiga.', 'move_out')
  if (!moveOut.move_out_date) return validationError('Utflyttningsdatum saknas.', 'move_out.move_out_date')
  if (!moveOut.site_id && !moveOut.customer_site_id && !moveOut.facility_id) {
    return validationError('Ange vilken anläggning flytten gäller.', 'move_out.site_id')
  }

  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    const operationId = clientOperationId(body.client_operation_id ?? body.idempotency_key) ?? randomUUID()
    const metadata = { source: 'gridex_web_move_out_route' }
    try {
      const result = await submitOpsCustomerMoveOut({
        identity,
        idempotencyKey: operationId,
        moveOut,
        metadata,
      })
      return NextResponse.json({ data: result, queued: false })
    } catch (error) {
      if (!isTransientOpsError(error)) throw error
      await enqueuePortalWrite({
        userId: user.id,
        operationType: 'move_out',
        idempotencyKey: `move-out:${user.id}:${operationId}`,
        identity,
        payload: { operation_id: operationId, move_out: moveOut, metadata },
      })
      return NextResponse.json({ data: { ok: true, status: 'queued' }, queued: true }, { status: 202 })
    }
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'move-out',
      fallbackMessage: 'Flyttanmälan kunde inte skickas just nu.',
    })
  }
}
