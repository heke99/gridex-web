import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { isTransientOpsError, submitOpsCustomerProfileUpdate } from '@/lib/ops/client'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { enqueuePortalWrite } from '@/lib/customerPortal/outbox'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { clientOperationId, object, profilePayload } from '@/lib/customerPortal/writeValidation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { code: 'unauthorized', message: 'Du behöver logga in.' } }, { status: 401 })

  const body = object(await req.json().catch(() => null))
  if (!body) return validationError('Ogiltig request-body.')
  const profile = profilePayload(body.profile)
  if (!profile) return validationError('Inga giltiga profilfält angavs.', 'profile')

  const operationId = clientOperationId(body.client_operation_id ?? body.idempotency_key) ?? randomUUID()
  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    try {
      const result = await submitOpsCustomerProfileUpdate({
        identity,
        idempotencyKey: operationId,
        profile,
        metadata: { source: 'gridex_web_profile_update_route' },
      })
      return NextResponse.json({ data: result, queued: false })
    } catch (error) {
      if (!isTransientOpsError(error)) throw error
      await enqueuePortalWrite({
        userId: user.id,
        operationType: 'profile_update',
        idempotencyKey: `profile-update:${user.id}:${operationId}`,
        identity,
        payload: {
          operation_id: operationId,
          profile,
          metadata: { source: 'gridex_web_profile_update_route' },
        },
      })
      return NextResponse.json({ data: { ok: true, status: 'queued' }, queued: true }, { status: 202 })
    }
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'profile-update',
      fallbackMessage: 'Profiländringen kunde inte skickas just nu.',
    })
  }
}
