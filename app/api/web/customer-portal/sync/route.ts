import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { submitOpsCustomerPortalSync } from '@/lib/ops/client'
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
  const operationId = clientOperationId(body.client_operation_id)
  if (!operationId) return validationError('client_operation_id krävs.', 'client_operation_id')

  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    const result = await submitOpsCustomerPortalSync({
      identity,
      idempotencyKey: operationId,
      customerNumber: identity.customerNumber,
      externalCustomerId: identity.externalCustomerId,
      email: identity.email,
      metadata: { source: 'tenant_website_customer_portal_sync_route' },
    })
    return NextResponse.json({ data: result, queued: false })
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'customer-portal-sync',
      fallbackMessage: 'Kopplingen till Mina sidor kunde inte synkas just nu.',
    })
  }
}
