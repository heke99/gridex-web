import { webErrorResponse } from '@/lib/api/webBoundary'
import { validMeteringQuery } from '@/lib/ops/meteringQuery'
import { customerResourceResponse } from '@/lib/customerPortal/resourceRoute'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  if (!validMeteringQuery(query)) {
    return webErrorResponse({ code: 'invalid_metering_query', message: 'Ogiltiga filter för mätvärden.', retryable: false }, 400)
  }
  return customerResourceResponse('metering-values', undefined, query)
}
