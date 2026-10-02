import { getPortalSession, getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { customerApiErrorResponse } from '@/lib/customerPortal/apiErrors'
import { privateJsonResponse, readWebJson, webErrorResponse, PRIVATE_NO_STORE_HEADERS, isSameOriginWebRequest } from '@/lib/api/webBoundary'
import { checkRateLimit } from '@/lib/security/rateLimit'
import {
  createOpsCustomerSupportCase,
  downloadOpsCustomerSupportAttachment,
  fetchOpsCustomerSupportAttachments,
  fetchOpsCustomerSupportCase,
  fetchOpsCustomerSupportMessages,
  fetchOpsCustomerSupportTickets,
  readBoundedSupportBytes,
  replyOpsCustomerSupportCase,
  uploadOpsCustomerSupportAttachment,
} from '@/lib/ops/client/support'
import { supportCreateInput, supportIdempotencyKey, supportListQuery, supportReplyInput, supportReference, SUPPORT_FILE_TYPES, SUPPORT_UPLOAD_MAX_BYTES } from './validation'
import type { OpsPortalIdentity } from '@/lib/ops/client/portal'

async function identity() {
  const { supabase, user } = await getPortalSession()
  return getOpsPortalIdentityForUser(supabase, user)
}

async function limitedWrite(who: OpsPortalIdentity) {
  const rate = await checkRateLimit(`ops-support-write:${who.userId}`, { limit: 30, windowMs: 15 * 60 * 1000 })
  if (rate.allowed) return null
  return webErrorResponse({ code: 'rate_limited', message: 'För många meddelanden. Vänta en stund och försök igen.', retryable: true }, 429, {
    'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
  })
}

function errorResponse(error: unknown) {
  return customerApiErrorResponse(error, { logLabel: 'support', fallbackMessage: 'Kundservice kunde inte nås. Försök igen om en stund.' })
}

export async function supportCasesGET(request: Request) {
  try {
    const query = supportListQuery(new URL(request.url).searchParams)
    return privateJsonResponse(await fetchOpsCustomerSupportTickets(await identity(), query))
  } catch (error) { return errorResponse(error) }
}

export async function supportCasesPOST(request: Request) {
  try {
    const who = await identity()
    const limited = await limitedWrite(who)
    if (limited) return limited
    const body = await readWebJson<unknown>(request, { maxBytes: 40 * 1024 })
    if (!body.ok) return body.response
    const operationId = supportIdempotencyKey(request.headers.get('Idempotency-Key'))
    return privateJsonResponse(await createOpsCustomerSupportCase(who, supportCreateInput(body.value), operationId), { status: 201 })
  } catch (error) { return errorResponse(error) }
}

export async function supportCaseGET(caseReference: string) {
  try {
    return privateJsonResponse(await fetchOpsCustomerSupportCase(await identity(), caseReference))
  } catch (error) { return errorResponse(error) }
}

export async function supportMessagesGET(caseReference: string) {
  try {
    return privateJsonResponse(await fetchOpsCustomerSupportMessages(await identity(), caseReference))
  } catch (error) { return errorResponse(error) }
}

export async function supportMessagesPOST(request: Request, caseReference: string) {
  try {
    const who = await identity()
    const limited = await limitedWrite(who)
    if (limited) return limited
    const body = await readWebJson<unknown>(request, { maxBytes: 36 * 1024 })
    if (!body.ok) return body.response
    const operationId = supportIdempotencyKey(request.headers.get('Idempotency-Key'))
    return privateJsonResponse(await replyOpsCustomerSupportCase(who, caseReference, supportReplyInput(body.value), operationId), { status: 201 })
  } catch (error) { return errorResponse(error) }
}

export async function supportAttachmentsGET(caseReference: string) {
  try {
    return privateJsonResponse(await fetchOpsCustomerSupportAttachments(await identity(), caseReference))
  } catch (error) { return errorResponse(error) }
}

export async function supportAttachmentsPOST(request: Request, caseReference: string) {
  try {
    const who = await identity()
    const limited = await limitedWrite(who)
    if (limited) return limited
    if (!isSameOriginWebRequest(request)) {
      return webErrorResponse({ code: 'cross_site_request_blocked', message: 'Begäran kommer från en otillåten origin.', retryable: false }, 403)
    }
    const operationId = supportIdempotencyKey(request.headers.get('Idempotency-Key'))
    const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? ''
    supportReference(caseReference)
    if (!SUPPORT_FILE_TYPES.has(contentType)) return webErrorResponse({ code: 'unsupported_media_type', message: 'Välj en PDF-, PNG- eller JPEG-fil.', retryable: false }, 415)
    const bytes = await readBoundedSupportBytes(new Response(request.body, { headers: request.headers }), SUPPORT_UPLOAD_MAX_BYTES)
    let fileName: string | undefined
    const rawName = request.headers.get('x-file-name')
    if (rawName) {
      try { fileName = decodeURIComponent(rawName).replace(/[\r\n\x00]/g, '').slice(0, 160) } catch { fileName = 'bilaga' }
    }
    return privateJsonResponse(await uploadOpsCustomerSupportAttachment(who, caseReference, { bytes, contentType, fileName }, operationId), { status: 201 })
  } catch (error) { return errorResponse(error) }
}

export async function supportAttachmentGET(caseReference: string, attachmentReference: string) {
  try {
    const result = await downloadOpsCustomerSupportAttachment(await identity(), caseReference, attachmentReference)
    const extension = result.contentType === 'application/pdf' ? 'pdf' : result.contentType === 'image/png' ? 'png' : 'jpg'
    return new Response(Buffer.from(result.bytes), {
      headers: {
        ...PRIVATE_NO_STORE_HEADERS,
        'Content-Type': result.contentType,
        'Content-Length': String(result.bytes.length),
        'Content-Disposition': `attachment; filename="gridex-bilaga.${extension}"`,
        'Content-Security-Policy': "sandbox; default-src 'none'",
        'X-Gridex-Sha256': result.sha256,
      },
    })
  } catch (error) { return errorResponse(error) }
}
