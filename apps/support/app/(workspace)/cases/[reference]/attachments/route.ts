import { requireSupportSession } from '@/support/lib/session'
import { StaffApiError } from '@/staff-api/client'
import { attachmentError, readAttachmentRequest } from '../../../../../../../lib/support/attachmentRequest'

export const runtime = 'nodejs'
export async function POST(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { api } = await requireSupportSession()
  const visibility = request.headers.get('x-attachment-visibility') ?? 'internal'
  if (visibility !== 'internal' && visibility !== 'customer') return attachmentError(400, 'attachment_visibility_invalid')
  const upload = await readAttachmentRequest(request)
  if (upload.response) return upload.response
  try {
    await api.uploadAttachment((await params).reference, upload.bytes, upload.mimeType, upload.fileName, visibility, upload.key)
    return Response.json({ ok: true }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof StaffApiError) return attachmentError(error.status, error.code)
    throw error
  }
}
