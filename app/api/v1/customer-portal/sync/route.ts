import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { enqueuePortalWrite } from '@/lib/customerPortal/outbox'
import { customerApiErrorResponse } from '@/lib/customerPortal/apiErrors'
import { isTransientOpsError, submitOpsCustomerPortalSync } from '@/lib/ops/client'
import { clientOperationId, object } from '@/lib/customerPortal/writeValidation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Du behöver logga in.' } }, { status: 401 })
  }

  const body = object(await req.json().catch(() => ({}))) ?? {}
  const operationId = clientOperationId(body.client_operation_id ?? body.idempotency_key) ?? randomUUID()

  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    const metadata = { source: 'gridex_web_customer_portal_sync_route' }
    try {
      const result = await submitOpsCustomerPortalSync({
        identity,
        idempotencyKey: operationId,
        customerNumber: identity.customerNumber,
        externalCustomerId: identity.externalCustomerId,
        email: identity.email,
        metadata,
      })
      return NextResponse.json({ data: result, queued: false })
    } catch (error) {
      if (!isTransientOpsError(error)) throw error
      await enqueuePortalWrite({
        userId: user.id,
        operationType: 'customer_portal_sync',
        idempotencyKey: `customer-portal-sync:${user.id}:${operationId}`,
        identity,
        payload: {
          operation_id: operationId,
          customer_number: identity.customerNumber ?? null,
          external_customer_id: identity.externalCustomerId ?? null,
          email: identity.email ?? null,
          metadata,
        },
      })
      return NextResponse.json({ data: { ok: true, status: 'queued' }, queued: true }, { status: 202 })
    }
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'customer-portal-sync',
      fallbackMessage: 'Kopplingen till Mina sidor kunde inte synkas just nu.',
    })
  }
}
