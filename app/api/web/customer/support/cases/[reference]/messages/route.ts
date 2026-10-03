import { supportMessagesGET, supportMessagesPOST } from '@/lib/support/customerRoutes'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type Context = { params: Promise<{ reference: string }> }
export async function GET(_request: Request, context: Context) {
  return supportMessagesGET((await context.params).reference)
}
export async function POST(request: Request, context: Context) {
  return supportMessagesPOST(request, (await context.params).reference)
}
