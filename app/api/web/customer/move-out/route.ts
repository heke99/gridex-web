import { readMoveOutReceipt } from '@/lib/customerPortal/writeResponse'
import { moveOutDateBounds } from '@/lib/website/businessDate'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { submitOpsCustomerMoveOut } from '@/lib/ops/client'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { privateJsonResponse, readWebJson, webErrorResponse } from '@/lib/api/webBoundary'
import { clientOperationId, moveOutPayload, object } from '@/lib/customerPortal/writeValidation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return webErrorResponse({ code: 'unauthorized', message: 'Du behöver logga in.', retryable: false }, 401)

  const parsed = await readWebJson<unknown>(req)
  if (!parsed.ok) return parsed.response
  const body = object(parsed.value)
  if (!body) return validationError('Ogiltig request-body.')
  const moveOut = moveOutPayload(body.move_out)
  if (!moveOut?.requested_move_out_date || !moveOut.facility_reference) {
    return validationError('Flyttuppgifter saknas eller är ogiltiga.', 'move_out')
  }
  // Leave earlier dates to OPS so an existing receipt can still be replayed across midnight.
  if (String(moveOut.requested_move_out_date) > moveOutDateBounds().max) {
    return validationError('Utflyttningsdatum får vara högst 730 dagar framåt.', 'move_out.requested_move_out_date')
  }
  const operationId = clientOperationId(body.client_operation_id)
  if (!operationId) return validationError('client_operation_id krävs.', 'client_operation_id')

  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    const result = await submitOpsCustomerMoveOut({
      identity,
      idempotencyKey: operationId,
      moveOut,
      metadata: { source: 'gridex_web_move_out_route' },
    })
    const receipt = result.ok
      ? readMoveOutReceipt(result.data, moveOut.facility_reference, moveOut.requested_move_out_date)
      : null
    if (!receipt) return webErrorResponse({
      code: 'move_out_receipt_unconfirmed',
      message: 'Kvittot kunde inte bekräftas. Försök igen med samma uppgifter.',
      retryable: true,
    }, 502)
    return privateJsonResponse({ data: result, queued: false, moveOutReceipt: receipt })
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'move-out',
      fallbackMessage: 'Flyttanmälan kunde inte skickas just nu.',
    })
  }
}
