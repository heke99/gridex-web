import { customerResourceResponse } from '@/lib/customerPortal/resourceRoute'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return customerResourceResponse('me')
}
