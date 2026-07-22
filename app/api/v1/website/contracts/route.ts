import { NextResponse } from 'next/server'
import { publicContractsResponse } from '@/lib/website/publicContractsEndpoint'

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
  const response = await publicContractsResponse(request)
  response.headers.set('Deprecation', 'true')
  response.headers.set('Sunset', 'Sat, 31 Oct 2026 23:59:59 GMT')
  response.headers.set('Link', '</api/v1/website/public-contracts>; rel="successor-version"')
  return response
}
