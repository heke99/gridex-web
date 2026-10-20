import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { submitOpsCustomerPortalSync } from '@/lib/ops/client'
import { clientOperationId, object } from '@/lib/customerPortal/writeValidation'
import { privateJsonResponse, readWebJson, webErrorResponse } from '@/lib/api/webBoundary'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'
import { linkExistingPortalCustomer } from '@/lib/customerPortal/existingCustomerLink'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return webErrorResponse({ code: 'unauthorized', message: 'Du behöver logga in.', retryable: false }, 401)
  }

  const parsed = await readWebJson<unknown>(req, { maxBytes: 2048 })
  if (!parsed.ok) return parsed.response
  const body = object(parsed.value)
  if (!body) return validationError('Ogiltig request-body.')
  const operationId = clientOperationId(body.client_operation_id)
  if (!operationId) return validationError('client_operation_id krävs.', 'client_operation_id')

  try {
    if (body.customer_number !== undefined) {
      const limits = await Promise.all([
        checkRateLimit(`portal-first-link:user:${user.id}`, { limit: 10, windowMs: 15 * 60_000 }),
        checkRateLimit(`portal-first-link:ip:${clientIpFromHeaders(req.headers)}`, { limit: 30, windowMs: 15 * 60_000 }),
      ])
      const refused = limits.find(limit => !limit.allowed)
      if (refused) {
        const unavailable = refused.source === 'unavailable'
        return webErrorResponse({ code: unavailable ? 'rate_limit_unavailable' : 'rate_limited',
          message: 'Kundkopplingen kan inte göras just nu. Försök igen senare.', retryable: true }, unavailable ? 503 : 429,
        { 'Retry-After': String(Math.max(1, Math.ceil((refused.resetAt - Date.now()) / 1000))) })
      }
      const result = await linkExistingPortalCustomer({ user, customerNumber: body.customer_number, operationId })
      return privateJsonResponse({ data: result, queued: false })
    }
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
