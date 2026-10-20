import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { customerApiErrorResponse, validationError } from '@/lib/customerPortal/apiErrors'
import { privateJsonResponse, readWebJson, webErrorResponse } from '@/lib/api/webBoundary'
import { enqueuePrivacyRequest, listPrivacyRequests } from '@/lib/customerPortal/privacy'
import { parsePrivacyIntent } from '@/lib/customerPortal/privacyRules'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createSupabaseServerActionClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return webErrorResponse({ code: 'unauthorized', message: 'Du behöver logga in.' }, 401)
    return privateJsonResponse({ data: await listPrivacyRequests(user.id) })
  } catch (error) {
    return customerApiErrorResponse(error, { logLabel: 'privacy-list', fallbackMessage: 'Begärandena kunde inte hämtas.' })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerActionClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return webErrorResponse({ code: 'unauthorized', message: 'Du behöver logga in.' }, 401)
    if (!user.email_confirmed_at || !user.email) {
      return webErrorResponse({ code: 'email_not_verified', message: 'Bekräfta din e-postadress först.' }, 403)
    }
    const parsed = await readWebJson<unknown>(request, { maxBytes: 1024 })
    if (!parsed.ok) return parsed.response
    const intent = parsePrivacyIntent(parsed.value)
    if (!intent) return validationError('Ange typ av begäran och ett giltigt begäran-ID.')
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    const receipt = await enqueuePrivacyRequest({ userId: user.id, ...intent, identity })
    return privateJsonResponse({ data: receipt, status: 'received' }, { status: 202 })
  } catch (error) {
    return customerApiErrorResponse(error, { logLabel: 'privacy-create', fallbackMessage: 'Begäran kunde inte sparas. Försök igen med samma begäran-ID.' })
  }
}
