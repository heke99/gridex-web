import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { isTransientOpsError, submitOpsCustomerSync } from '@/lib/ops/client'
import { enqueuePortalWrite } from '@/lib/customerPortal/outbox'
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
    const operationId = clientOperationId(body.client_operation_id ?? body.idempotency_key) ?? randomUUID()
    const payload = {
      operation_id: operationId,
      power_of_attorney: powerOfAttorney,
      legal_acceptances: legalAcceptances,
      documents,
      facility_data: facilityData,
      profile,
      metadata: { source: 'gridex_web_customer_sync_route' },
    }
    try {
      const result = await submitOpsCustomerSync({
        identity,
        idempotencyKey: operationId,
        powerOfAttorney,
        legalAcceptances,
        documents,
        facilityData,
        profile,
        metadata: payload.metadata,
      })
      return NextResponse.json({ data: result, queued: false })
    } catch (error) {
      if (!isTransientOpsError(error)) throw error
      await enqueuePortalWrite({
        userId: user.id,
        operationType: facilityData && !powerOfAttorney && legalAcceptances.length === 0 && documents.length === 0 && !profile
          ? 'facility_data_update'
          : 'customer_sync',
        idempotencyKey: `customer-sync:${user.id}:${operationId}`,
        identity,
        payload,
      })
      return NextResponse.json({ data: { ok: true, status: 'queued' }, queued: true }, { status: 202 })
    }
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'customer-sync',
      fallbackMessage: 'Kunduppgifterna kunde inte synkas just nu.',
    })
  }
}
