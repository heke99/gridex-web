import { getOpsPortalIdentityForUser, getPortalSession } from '@/lib/customerPortal/service'
import { uploadOpsCustomerSupportAttachment } from '@/lib/ops/client/customerSupport'
import { isOpsError } from '@/lib/ops/errors'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { attachmentError, readAttachmentRequest } from '@/lib/support/attachmentRequest'

export const runtime = 'nodejs'
export async function POST(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { supabase, user } = await getPortalSession()
  const rate = await checkRateLimit(`support-attachment:${user.id}`, { limit: 20, windowMs: 15 * 60_000 })
  if (!rate.allowed) return attachmentError(429, 'attachment_rate_limited')
  const identity = await getOpsPortalIdentityForUser(supabase, user)
  const upload = await readAttachmentRequest(request)
  if (upload.response) return upload.response
  try {
    await uploadOpsCustomerSupportAttachment(identity, (await params).reference, upload.bytes, upload.mimeType, upload.fileName, upload.key)
    return Response.json({ ok: true }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (isOpsError(error)) return attachmentError(error.status ?? 503, 'attachment_upload_failed')
    throw error
  }
}
