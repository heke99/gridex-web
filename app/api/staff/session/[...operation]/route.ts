import { staffAuthPOST } from '@/lib/staff/handlers'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: Request, context: { params: Promise<{ operation: string[] }> }) {
  return staffAuthPOST(request, (await context.params).operation.join('/'))
}
