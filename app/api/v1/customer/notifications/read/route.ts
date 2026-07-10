import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { markCustomerNotificationsRead } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function operationId(value: unknown): string {
  if (typeof value === 'string' && /^[0-9a-zA-Z:_-]{8,240}$/.test(value.trim())) {
    return value.trim()
  }
  return randomUUID()
}

export async function POST(request: Request) {
  const body = object(await request.json().catch(() => null))
  if (!body) return validationError('Ogiltig request-body.')

  const all = body.all === true
  const rawIds = body.notification_ids ?? body.notificationIds ?? body.ids
  if (!all && !Array.isArray(rawIds)) {
    return validationError('Ange notification_ids eller all=true.', 'notification_ids')
  }

  const ids = Array.isArray(rawIds)
    ? rawIds
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter(Boolean)
    : []

  if (!all && ids.length === 0) {
    return validationError('Minst en giltig notis måste anges.', 'notification_ids')
  }
  if (all && ids.length > 0) {
    return validationError('Skicka antingen all=true eller notification_ids, inte båda.')
  }

  try {
    const result = await markCustomerNotificationsRead({
      notificationIds: ids,
      all,
      operationId: operationId(body.client_operation_id ?? body.idempotency_key),
    })
    return NextResponse.json(result)
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'notifications-read',
      fallbackMessage: 'Notiserna kunde inte uppdateras just nu.',
    })
  }
}
