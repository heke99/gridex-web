import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { submitOpsCustomerPortalSync } from '@/lib/ops/client'
import { clientOperationId, object } from '@/lib/customerPortal/writeValidation'
import { privateJsonResponse, readWebJson, webErrorResponse } from '@/lib/api/webBoundary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return webErrorResponse({ code: 'unauthorized', message: 'Du behöver logga in.', retryable: false }, 401)
  }

  const parsed = await readWebJson<unknown>(req)
  if (!parsed.ok) return parsed.response
  const body = object(parsed.value)
  if (!body) return validationError('Ogiltig request-body.')
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
    return privateJsonResponse({ data: result, queued: false })
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'customer-portal-sync',
      fallbackMessage: 'Kopplingen till Mina sidor kunde inte synkas just nu.',
    })
  }
}
