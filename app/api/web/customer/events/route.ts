import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { isOpsCustomerEventType, sendOpsCustomerEvent } from '@/lib/ops/client'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { customerResourceResponse } from '@/lib/customerPortal/resourceRoute'
import { clientOperationId, object, text } from '@/lib/customerPortal/writeValidation'
import { privateJsonResponse, readWebJson, webErrorResponse } from '@/lib/api/webBoundary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return customerResourceResponse('events')
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return webErrorResponse({ code: 'unauthorized', message: 'Du behöver logga in.', retryable: false }, 401)
  }
  const parsed = await readWebJson<Record<string, unknown>>(req)
  if (!parsed.ok) return parsed.response
  const body = object(parsed.value)
  if (!body) return validationError('Ogiltig request-body.')
  const eventType = text(body.event_type, 160) ?? ''
  if (!isOpsCustomerEventType(eventType)) {
    return validationError('Händelsetypen stöds inte.', 'event_type')
  }
  const operationId = clientOperationId(body.client_operation_id)
  if (!operationId) return validationError('client_operation_id krävs.', 'client_operation_id')
  const rawMetadata = object(body.metadata) ?? {}
  const metadata = Object.fromEntries(Object.entries(rawMetadata).slice(0, 50))

  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    await sendOpsCustomerEvent(identity, {
      event_type: eventType,
      source: 'gridex_website',
      entity_type: text(body.entity_type, 160),
      entity_id: text(body.entity_id, 240),
      idempotency_key: operationId,
      metadata,
    })
    return privateJsonResponse({ ok: true, queued: false })
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'customer-event',
      fallbackMessage: 'Händelsen kunde inte registreras.',
    })
  }
}
