import { customerPoaArchiveDetailResponse } from '@/lib/customerPortal/poaArchiveRoute'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: Request, context: { params: Promise<{ verificationReference: string }> }) {
  return customerPoaArchiveDetailResponse(request, (await context.params).verificationReference)
}
