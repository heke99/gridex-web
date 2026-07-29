import { NextResponse } from 'next/server'
import {
  fetchOpsPublicContractsFresh,
  fetchOpsWebsitePortfolioPrices,
  isOpsError,
} from '@/lib/ops/client'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PRICE_AREAS = new Set(['SE1', 'SE2', 'SE3', 'SE4'])

export async function GET(req: Request) {
  const url = new URL(req.url)
  const offerReference = url.searchParams.get('offer_reference')?.trim() ?? ''
  const priceArea = (url.searchParams.get('price_area') ?? '').trim().toUpperCase()

  if (!offerReference || !PRICE_AREAS.has(priceArea)) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: 'offer_reference och price_area krävs.' } },
      { status: 400 },
    )
  }

  const rate = await checkRateLimit(
    `website-portfolio-prices:${clientIpFromHeaders(new Headers(req.headers))}`,
    { limit: 30, windowMs: 10 * 60_000 },
  )
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited' } },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1_000))) } },
    )
  }

  try {
    const contracts = await fetchOpsPublicContractsFresh()
    const contract = contracts.find((item) => item.offer_reference === offerReference)
    const type = String(contract?.contract_type ?? contract?.type ?? '').toLowerCase()
    if (!contract || !['portfolio', 'portfolio_managed', 'mix', 'mixed'].includes(type)) {
      return NextResponse.json({ error: { code: 'offer_not_available' } }, { status: 404 })
    }
    if (contract.price_areas?.length && !contract.price_areas.includes(priceArea as 'SE1' | 'SE2' | 'SE3' | 'SE4')) {
      return NextResponse.json({ error: { code: 'offer_not_available_in_price_area' } }, { status: 404 })
    }

    const result = await fetchOpsWebsitePortfolioPrices({
      offerReference,
      priceArea: priceArea as 'SE1' | 'SE2' | 'SE3' | 'SE4',
    })
    const { raw, ...publicResult } = result
    void raw
    return NextResponse.json(
      {
        data: {
          method: publicResult.method,
          historical_final_prices: publicResult.historical_final_prices,
          final_billing_rule: publicResult.final_billing_rule,
        },
        request_id: publicResult.request_id,
        contract_schema_version: publicResult.contract_schema_version,
      },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' } },
    )
  } catch (error) {
    const status = isOpsError(error) && error.status >= 400 && error.status < 500 ? error.status : 503
    return NextResponse.json(
      { error: { code: isOpsError(error) ? error.code ?? 'portfolio_history_unavailable' : 'portfolio_history_unavailable' } },
      { status },
    )
  }
}
