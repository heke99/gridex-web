import { markCustomerNotificationsRead } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { privateJsonResponse } from '@/lib/api/webBoundary'
import { clientOperationId, object } from '@/lib/customerPortal/writeValidation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = object(await request.json().catch(() => null))
  if (!body) return validationError('Ogiltig request-body.')
  if (!Array.isArray(body.notification_ids)) {
    return validationError('Ange notification_ids.', 'notification_ids')
  }
  const ids = body.notification_ids
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter(Boolean)
  if (ids.length === 0) {
    return validationError('Minst en giltig notis måste anges.', 'notification_ids')
  }
  const operationId = clientOperationId(body.client_operation_id)
  if (!operationId) return validationError('client_operation_id krävs.', 'client_operation_id')

  try {
    return privateJsonResponse(await markCustomerNotificationsRead({
      notificationIds: ids,
      operationId,
    }))
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'notifications-read',
      fallbackMessage: 'Notiserna kunde inte uppdateras just nu.',
    })
  }
}
