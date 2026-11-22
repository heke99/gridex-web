import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { submitOpsCustomerSync } from '@/lib/ops/client'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { privateJsonResponse, readWebJson, webErrorResponse } from '@/lib/api/webBoundary'
import { clientIpFromHeaders } from '@/lib/security/rateLimit'
import { prepareCustomerSyncReceipt, completeCustomerSyncReceipt, type CustomerSyncReceipt } from '@/lib/customerPortal/syncReceipt'
import {
  clientOperationId,
  CUSTOMER_SYNC_LIST_LIMITS,
  object,
  profilePayload,
  syncDocuments,
  syncFacilityData,
  syncLegalAcceptances,
  syncPowerOfAttorney,
} from '@/lib/customerPortal/writeValidation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function facilityOutcome(synced: unknown, expected: number) {
  const summary = object(object(object(synced)?.summary)?.facility_data)
  const processed = summary?.processed
  const updated = summary?.updated
  const skipped = summary?.skipped
  const meteringPoints = summary?.metering_point_created ?? 0
  if (processed !== expected || typeof updated !== 'number' || typeof skipped !== 'number' ||
      typeof meteringPoints !== 'number' || [updated, skipped, meteringPoints].some(value => !Number.isInteger(value) || value < 0) ||
      updated + skipped > expected || meteringPoints + skipped > expected) return 'unconfirmed'
  if (skipped === expected) return 'skipped'
  if (skipped > 0) return 'partial'
  return updated > 0 || meteringPoints > 0 ? 'updated' : 'unchanged'
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return webErrorResponse({ code: 'unauthorized', message: 'Du behöver logga in.', retryable: false }, 401)

  const parsed = await readWebJson<unknown>(req)
  if (!parsed.ok) return parsed.response
  const body = object(parsed.value)
  if (!body) return validationError('Ogiltig request-body.')
  const powerOfAttorney = syncPowerOfAttorney(body.power_of_attorney)
  if (body.power_of_attorney !== undefined && !powerOfAttorney) {
    return validationError('Fullmakten behöver ett uttryckligt godkännande och kompletta signeringsuppgifter.', 'power_of_attorney')
  }
  const lists = {
    legal_acceptances: syncLegalAcceptances,
    documents: syncDocuments,
    facility_data: syncFacilityData,
  }
  const normalized: Record<keyof typeof lists, Record<string, unknown>[]> = {
    legal_acceptances: [], documents: [], facility_data: [],
  }
  for (const field of Object.keys(lists) as (keyof typeof lists)[]) {
    const value = body[field]
    if (value === undefined) continue
    const isList = Array.isArray(value)
    if (!isList && (field !== 'facility_data' || !object(value))) {
      return validationError('Ogiltigt format för synkposter.', field)
    }
    const items = isList ? value : [value]
    const limit = CUSTOMER_SYNC_LIST_LIMITS[field]
    if (items.length > limit) return validationError(`Högst ${limit} synkposter får anges.`, field)
    for (const [index, item] of items.entries()) {
      const [entry] = lists[field]([item])
      if (!entry) return validationError('Synkposten är ogiltig.', isList ? `${field}[${index}]` : field)
      normalized[field].push(entry)
    }
  }
  const { legal_acceptances: legalAcceptances, documents, facility_data: facilityData } = normalized
  const profile = profilePayload(body.profile)
  if (!powerOfAttorney && legalAcceptances.length === 0 && documents.length === 0 && facilityData.length === 0 && !profile) {
    return validationError('Inga synkbara kunduppgifter angavs.')
  }
  const operationId = clientOperationId(body.client_operation_id)
  if (!operationId) return validationError('client_operation_id krävs.', 'client_operation_id')

  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    const payload = {
      ...(powerOfAttorney ? { power_of_attorney: powerOfAttorney } : {}),
      legal_acceptances: legalAcceptances, documents, facility_data: facilityData, profile,
      metadata: { source: 'gridex_web_customer_sync_route' },
    }
    let receipt: CustomerSyncReceipt | null = null
    if (powerOfAttorney) {
      receipt = await prepareCustomerSyncReceipt({
        userId: user.id, operationId, identity,
        payload: { ...payload, power_of_attorney: powerOfAttorney },
        evidence: { ipAddress: clientIpFromHeaders(req.headers), userAgent: req.headers.get('user-agent') },
      })
    }
    const prepared = receipt?.payload ?? payload
    const result = await submitOpsCustomerSync({
      identity: receipt?.identity ?? identity,
      idempotencyKey: operationId,
      powerOfAttorney: (prepared.power_of_attorney as Record<string, unknown> | undefined) ?? null,
      legalAcceptances: prepared.legal_acceptances as Record<string, unknown>[],
      documents: prepared.documents as Record<string, unknown>[],
      facilityData: prepared.facility_data as Record<string, unknown>[],
      profile: prepared.profile as Record<string, unknown> | null,
      metadata: { source: 'gridex_web_customer_sync_route' },
    })
    if (receipt && result.ok) {
      await completeCustomerSyncReceipt(receipt).catch(() => {
        console.error('[customer-sync] accepted consent receipt requires reconciliation')
      })
    }
    const expectedFacilities = (prepared.facility_data as Record<string, unknown>[]).length
    return privateJsonResponse({
      data: result,
      queued: false,
      ...(expectedFacilities > 0 && { facilityOutcome: facilityOutcome(result.ok ? result.synced : null, expectedFacilities) }),
    })
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'customer-sync',
      fallbackMessage: 'Kunduppgifterna kunde inte synkas just nu.',
    })
  }
}
