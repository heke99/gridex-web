import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { submitOpsCustomerProfileUpdate } from '@/lib/ops/client'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { privateJsonResponse, readWebJson, webErrorResponse } from '@/lib/api/webBoundary'
import { clientOperationId, facilityUpdatePayload, object, profilePayload } from '@/lib/customerPortal/writeValidation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return webErrorResponse({ code: 'unauthorized', message: 'Du behöver logga in.', retryable: false }, 401)

  const parsed = await readWebJson<unknown>(req)
  if (!parsed.ok) return parsed.response
  const body = object(parsed.value)
  if (!body) return validationError('Ogiltig request-body.')
  const profile = profilePayload(body.profile)
  const facilityData = facilityUpdatePayload(body.facility_data)
  if (body.profile !== undefined && !profile) return validationError('Profiluppgifterna är ogiltiga.', 'profile')
  if (body.facility_data !== undefined && !facilityData) return validationError('Anläggningens adressuppgifter är ogiltiga.', 'facility_data')
  if (!profile && !facilityData) return validationError('Ange profiluppgifter eller en anläggningsadress.')
  const operationId = clientOperationId(body.client_operation_id)
  if (!operationId) return validationError('client_operation_id krävs.', 'client_operation_id')

  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    const result = await submitOpsCustomerProfileUpdate({
      identity,
      idempotencyKey: operationId,
      profile,
      facilityData,
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
