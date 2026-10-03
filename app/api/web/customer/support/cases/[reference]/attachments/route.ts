import { supportAttachmentsGET, supportAttachmentsPOST } from '@/lib/support/customerRoutes'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type Context = { params: Promise<{ reference: string }> }
export async function GET(_request: Request, context: Context) {
  return supportAttachmentsGET((await context.params).reference)
}
export async function POST(request: Request, context: Context) {
  return supportAttachmentsPOST(request, (await context.params).reference)
}
