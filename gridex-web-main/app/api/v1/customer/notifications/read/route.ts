import { NextResponse } from 'next/server'
import { CustomerPortalAccessError, markCustomerNotificationsRead as markOpsCustomerNotificationsRead } from '@/lib/customerPortal/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function idsFromPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []

  const row = payload as Record<string, unknown>
  const rawIds = row.notification_ids ?? row.notificationIds ?? row.ids
  if (!Array.isArray(rawIds)) return []

  return rawIds
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter(Boolean)
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}))
    const result = await markOpsCustomerNotificationsRead(idsFromPayload(payload))
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CustomerPortalAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      )
    }

    console.error('[customer portal] mark notifications read failed', error)
    return NextResponse.json(
      { error: 'Notiserna kunde inte uppdateras just nu.', code: 'customer_portal_unavailable' },
      { status: 503 },
    )
  }
}
