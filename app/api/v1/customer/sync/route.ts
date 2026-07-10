import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { submitOpsCustomerSync } from '@/lib/ops/client'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
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
  if (!user) return NextResponse.json({ error: { code: 'unauthorized', message: 'Du behöver logga in.' } }, { status: 401 })

  const body = object(await req.json().catch(() => null))
  if (!body) return validationError('Ogiltig request-body.')

  const powerOfAttorney = syncPowerOfAttorney(body.power_of_attorney ?? body.powerOfAttorney)
  const legalAcceptances = syncLegalAcceptances(body.legal_acceptances ?? body.legalAcceptances)
  const documents = syncDocuments(body.documents)
  const facilityData = syncFacilityData(body.facility_data ?? body.facilityData)
  const profile = profilePayload(body.profile)
  if (!powerOfAttorney && legalAcceptances.length === 0 && documents.length === 0 && !facilityData && !profile) {
    return validationError('Inga synkbara kunduppgifter angavs.')
  }

  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    const result = await submitOpsCustomerSync({
      identity,
      idempotencyKey: clientOperationId(body.client_operation_id ?? body.idempotency_key),
      powerOfAttorney,
      legalAcceptances,
      documents,
      facilityData,
      profile,
      metadata: { source: 'gridex_web_customer_sync_route' },
    })
    return NextResponse.json({ data: result })
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'customer-sync',
      fallbackMessage: 'Kunduppgifterna kunde inte synkas just nu.',
    })
  }
}
