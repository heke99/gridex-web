import { NextResponse } from 'next/server'
import { publicContractsResponse } from '@/lib/website/publicContractsEndpoint'

export const revalidate = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (process.env.GRIDEX_ENABLE_LEGACY_WEBSITE_CONTRACTS_ROUTE !== 'true') {
    return NextResponse.json(
      {
        error: {
          code: 'legacy_endpoint_disabled',
          message: 'Använd /api/v1/website/public-contracts.',
        },
      },
      { status: 410 },
    )
  }
  return publicContractsResponse(request)
}
