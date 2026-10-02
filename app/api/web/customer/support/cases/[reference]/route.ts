import { supportCaseGET } from '@/lib/support/customerRoutes'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  return supportCaseGET((await context.params).reference)
}
