import { getOpsPortalIdentityForUser, getPortalSession } from '@/lib/customerPortal/service'
import { downloadOpsCustomerSupportAttachment } from '@/lib/ops/client/customerSupport'
import { isOpsError } from '@/lib/ops/errors'
import { attachmentError } from '@/lib/support/attachmentRequest'

export const runtime = 'nodejs'
export async function GET(_request: Request, { params }: { params: Promise<{ reference: string; attachment: string }> }) {
  const { supabase, user } = await getPortalSession()
  const identity = await getOpsPortalIdentityForUser(supabase, user)
  const { reference, attachment } = await params
  try {
    const file = await downloadOpsCustomerSupportAttachment(identity, reference, attachment)
    return new Response(Buffer.from(file.bytes), { headers: {
      'Content-Type': file.mimeType, 'Content-Disposition': 'attachment', 'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'", 'Referrer-Policy': 'no-referrer',
    } })
  } catch (error) {
    if (isOpsError(error)) return attachmentError(error.status ?? 503, 'attachment_download_failed')
    throw error
  }
}
