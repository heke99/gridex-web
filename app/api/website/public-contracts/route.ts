import { publicContractsResponse } from '@/lib/website/publicContractsEndpoint'

export const revalidate = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return publicContractsResponse(request)
}
