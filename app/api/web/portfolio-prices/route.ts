import { NextResponse } from 'next/server'
import {
  fetchOpsPublicContractsFresh,
  fetchOpsWebsitePortfolioPrices,
  isOpsError,
} from '@/lib/ops/client'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type PublicPortfolioPrice = {
  offer_reference: string
  price_area_code: 'SE1' | 'SE2' | 'SE3' | 'SE4'
  year: number
  month: number
  amount_ore_per_kwh: number
  unit: 'ore_per_kwh'
  finalized_at: string | null
}

function stringValue(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}
function numberValue(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(row[key])
    if (Number.isFinite(value)) return value
  }
  return null
}
function sanitizePortfolioPrice(
  row: Record<string, unknown>,
  offerReference: string,
  requestedArea: PublicPortfolioPrice['price_area_code'],
): PublicPortfolioPrice | null {
  const area = (stringValue(row, ['price_area_code', 'price_area', 'priceAreaCode']) ?? requestedArea).toUpperCase()
  const year = numberValue(row, ['year', 'settlement_year'])
  const month = numberValue(row, ['month', 'settlement_month'])
  const amount = numberValue(row, ['amount_ore_per_kwh', 'price_ore_per_kwh', 'portfolio_price_ore_per_kwh', 'amount'])
  const unit = (stringValue(row, ['unit']) ?? 'ore_per_kwh').toLowerCase()
  const status = stringValue(row, ['status', 'price_status', 'settlement_status'])?.toLowerCase() ?? 'final'
  if (
    area !== requestedArea ||
    !Number.isInteger(year) || year! < 2000 || year! > 2200 ||
    !Number.isInteger(month) || month! < 1 || month! > 12 ||
    amount == null || amount < 0 ||
    !['ore_per_kwh', 'öre_per_kwh'].includes(unit) ||
    !/final|finalized|settled|published/.test(status)
  ) return null
  return {
    offer_reference: offerReference,
    price_area_code: requestedArea,
    year: year!,
    month: month!,
    amount_ore_per_kwh: amount,
    unit: 'ore_per_kwh',
    finalized_at: stringValue(row, ['finalized_at', 'settled_at', 'published_at']),
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const offerReference = url.searchParams.get('offer_reference')?.trim() ?? ''
  const priceArea = url.searchParams.get('price_area_code')?.trim().toUpperCase() ?? ''
  if (!offerReference || !['SE1', 'SE2', 'SE3', 'SE4'].includes(priceArea)) {
    return NextResponse.json({ error: { code: 'invalid_request' } }, { status: 400 })
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
    const data = result.flatMap((row) => {
      const sanitized = sanitizePortfolioPrice(row, offerReference, priceArea as PublicPortfolioPrice['price_area_code'])
      return sanitized ? [sanitized] : []
    })
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' } })
  } catch (error) {
    const status = isOpsError(error) && error.status >= 400 && error.status < 500 ? error.status : 503
    return NextResponse.json({ error: { code: 'portfolio_history_unavailable' } }, { status })
  }
}
