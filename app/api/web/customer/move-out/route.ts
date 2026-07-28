import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { submitOpsCustomerMoveOut } from '@/lib/ops/client'
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
  const moveOut = moveOutPayload(body.move_out)
  if (!moveOut?.move_out_date) return validationError('Flyttuppgifter saknas eller är ogiltiga.', 'move_out')
  if (!moveOut.site_id && !moveOut.customer_site_id && !moveOut.facility_id) {
    return validationError('Ange vilken anläggning flytten gäller.', 'move_out.site_id')
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
    return NextResponse.json({ data: result, queued: false })
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'move-out',
      fallbackMessage: 'Flyttanmälan kunde inte skickas just nu.',
    })
  }
}
