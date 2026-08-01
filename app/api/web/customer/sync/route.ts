import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { submitOpsCustomerSync } from '@/lib/ops/client'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { privateJsonResponse, webErrorResponse } from '@/lib/api/webBoundary'
import {
  clientOperationId,
  object,
  profilePayload,
  syncDocuments,
  syncFacilityData,
  syncLegalAcceptances,
  syncPowerOfAttorney,
} from '@/lib/customerPortal/writeValidation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return webErrorResponse({ code: 'unauthorized', message: 'Du behöver logga in.', retryable: false }, 401)

  const body = object(await req.json().catch(() => null))
  if (!body) return validationError('Ogiltig request-body.')
  const powerOfAttorney = syncPowerOfAttorney(body.power_of_attorney)
  const legalAcceptances = syncLegalAcceptances(body.legal_acceptances)
  const documents = syncDocuments(body.documents)
  const facilityData = syncFacilityData(body.facility_data)
  const profile = profilePayload(body.profile)
  if (!powerOfAttorney && legalAcceptances.length === 0 && documents.length === 0 && facilityData.length === 0 && !profile) {
    return validationError('Inga synkbara kunduppgifter angavs.')
  }
  const operationId = clientOperationId(body.client_operation_id)
  if (!operationId) return validationError('client_operation_id krävs.', 'client_operation_id')

  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    const result = await submitOpsCustomerSync({
      identity,
      idempotencyKey: operationId,
      powerOfAttorney,
      legalAcceptances,
      documents,
      facilityData,
      profile,
      metadata: { source: 'gridex_web_customer_sync_route' },
    })
    return privateJsonResponse({ data: result, queued: false })
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'customer-sync',
      fallbackMessage: 'Kunduppgifterna kunde inte synkas just nu.',
    })
  }
}
