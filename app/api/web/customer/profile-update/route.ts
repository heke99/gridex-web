import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { submitOpsCustomerProfileUpdate } from '@/lib/ops/client'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { privateJsonResponse, webErrorResponse } from '@/lib/api/webBoundary'
import { clientOperationId, object, profilePayload } from '@/lib/customerPortal/writeValidation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return webErrorResponse({ code: 'unauthorized', message: 'Du behöver logga in.', retryable: false }, 401)

  const body = object(await req.json().catch(() => null))
  if (!body) return validationError('Ogiltig request-body.')
  const profile = profilePayload(body.profile)
  if (!profile) return validationError('Inga giltiga profilfält angavs.', 'profile')
  const operationId = clientOperationId(body.client_operation_id)
  if (!operationId) return validationError('client_operation_id krävs.', 'client_operation_id')

  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    const result = await submitOpsCustomerProfileUpdate({
      identity,
      idempotencyKey: operationId,
      profile,
      metadata: { source: 'gridex_web_profile_update_route' },
    })
    return privateJsonResponse({ data: result, queued: false })
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'profile-update',
      fallbackMessage: 'Profiländringen kunde inte skickas just nu.',
    })
  }
}
