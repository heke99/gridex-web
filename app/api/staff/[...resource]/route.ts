import { staffResource } from '@/lib/staff/handlers'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, context: { params: Promise<{ resource: string[] }> }) {
  return staffResource(request, (await context.params).resource)
}
export const POST = GET
