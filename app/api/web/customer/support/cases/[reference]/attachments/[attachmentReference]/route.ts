import { supportAttachmentGET } from '@/lib/support/customerRoutes'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(_request: Request, context: { params: Promise<{ reference: string; attachmentReference: string }> }) {
  const params = await context.params
  return supportAttachmentGET(params.reference, params.attachmentReference)
}
