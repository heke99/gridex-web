import { NextResponse } from 'next/server'
import {
  fetchOpsPublicContracts,
  getOpsClientStatus,
  isOpsError,
  type OpsWebsitePriceArea,
  type OpsWebsitePricingPreviewInput,
} from '@/lib/ops/client'
import { issueWebsitePricingQuote } from '@/lib/website/pricingQuote'
import { loadVerifiedWebsitePricingPreview, WebsitePricingPreviewError } from '@/lib/website/pricingPreview'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AREAS = new Set<OpsWebsitePriceArea>(['SE1', 'SE2', 'SE3', 'SE4'])

type PreviewPayload = {
  offer_reference?: unknown
  offerReference?: unknown
  contract_id?: unknown
  contractId?: unknown
  price_plan_id?: unknown
  pricePlanId?: unknown
  price_plan_version_id?: unknown
  pricePlanVersionId?: unknown
  product_code?: unknown
  productCode?: unknown
  price_area_code?: unknown
  priceAreaCode?: unknown
  priceArea?: unknown
  postal_code?: unknown
  postalCode?: unknown
  city?: unknown
  address?: unknown
  estimated_monthly_kwh?: unknown
  estimatedMonthlyKwh?: unknown
  kwh?: unknown
}

function text(value: unknown, max = 180): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

function requiredMonthlyKwh(value: unknown): number | null {
  const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 200000) return null
  return parsed
}

function priceArea(value: unknown): OpsWebsitePriceArea | null {
  const area = typeof value === 'string' ? value.toUpperCase() : ''
  return AREAS.has(area as OpsWebsitePriceArea) ? (area as OpsWebsitePriceArea) : null
}

export async function POST(req: Request) {
  const status = getOpsClientStatus()
  if (!status.configured) {
    return NextResponse.json({ error: 'Priset kan inte räknas just nu.' }, { status: 503 })
  }

  const body = (await req.json().catch(() => null)) as PreviewPayload | null
  const resolvedArea = priceArea(body?.price_area_code ?? body?.priceAreaCode ?? body?.priceArea)
  const monthlyKwh = requiredMonthlyKwh(body?.estimated_monthly_kwh ?? body?.estimatedMonthlyKwh ?? body?.kwh)
  const postalCode = text(body?.postal_code ?? body?.postalCode, 20)
  const city = text(body?.city)
  const address = text(body?.address)

  if (!resolvedArea || !monthlyKwh || !postalCode || !city || !address) {
    return NextResponse.json(
      { error: 'Ange adress, ort, postnummer, elområde och en giltig månadsförbrukning innan du räknar pris.' },
      { status: 400 },
    )
  }

  const offerReference = text(body?.offer_reference ?? body?.offerReference)
  if (!offerReference) {
    return NextResponse.json({ error: 'Välj ett aktuellt elavtal innan du räknar pris.' }, { status: 400 })
  }

  try {
    const contracts = await fetchOpsPublicContracts()
    const contract = contracts.find((item) => item.offer_reference === offerReference)
    if (!contract) return NextResponse.json({ error: 'Valt elavtal kunde inte verifieras.' }, { status: 404 })

    const suppliedIdentifiers = {
      contract_id: text(body?.contract_id ?? body?.contractId),
      price_plan_id: text(body?.price_plan_id ?? body?.pricePlanId),
      price_plan_version_id: text(body?.price_plan_version_id ?? body?.pricePlanVersionId),
      product_code: text(body?.product_code ?? body?.productCode),
    }
    if (
      (suppliedIdentifiers.contract_id && suppliedIdentifiers.contract_id !== contract.contract_id) ||
      (suppliedIdentifiers.price_plan_id && suppliedIdentifiers.price_plan_id !== contract.price_plan_id) ||
      (suppliedIdentifiers.price_plan_version_id && suppliedIdentifiers.price_plan_version_id !== contract.price_plan_version_id) ||
      (suppliedIdentifiers.product_code && suppliedIdentifiers.product_code !== contract.product_code)
    ) {
      return NextResponse.json({ error: 'Valt elavtal kunde inte verifieras.' }, { status: 409 })
    }

    const input: OpsWebsitePricingPreviewInput = {
      offer_reference: contract.offer_reference,
      contract_id: contract.contract_id ?? null,
      price_plan_id: contract.price_plan_id,
      price_plan_version_id: contract.price_plan_version_id,
      product_code: contract.product_code,
      price_area_code: resolvedArea,
      postal_code: postalCode,
      city,
      address,
      estimated_monthly_kwh: monthlyKwh,
    }
    const preview = await loadVerifiedWebsitePricingPreview(input, contract)
    const quote = issueWebsitePricingQuote({
      preview,
      contract,
      location: { postalCode, city, address },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Priset kan inte säkras för ansökan just nu.' }, { status: 503 })
    }

    return NextResponse.json(
      {
        data: {
          ...preview,
          quote_token: quote.token,
          quote_expires_at: quote.quote.expires_at,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    if (error instanceof WebsitePricingPreviewError) {
      return NextResponse.json({ error: 'Vi kunde inte hämta en komplett prisberäkning för valt avtal.' }, { status: 503 })
    }
    if (isOpsError(error)) {
      return NextResponse.json({ error: error.message || 'Vi kunde inte hämta prisuppgifter just nu.' }, { status: error.status || 502 })
    }
    console.error('[website pricing preview] failed', error)
    return NextResponse.json({ error: 'Vi kunde inte hämta prisuppgifter just nu.' }, { status: 502 })
  }
}
