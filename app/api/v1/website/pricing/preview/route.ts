import { NextResponse } from 'next/server'
import {
  fetchOpsPublicContracts,
  getOpsClientStatus,
  isOpsError,
  type OpsWebsitePriceArea,
  type OpsWebsitePricingPreview,
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

function validOpsQuote(preview: OpsWebsitePricingPreview): { token: string; expiresAt: string } | null {
  const token = preview.quote_token?.trim()
  const expiresAt = preview.quote_expires_at?.trim()
  if (!token || !expiresAt || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
    return null
  }
  return { token, expiresAt }
}

function requireOpsPricingQuote(): boolean {
  return process.env.GRIDEX_REQUIRE_OPS_PRICING_QUOTE?.trim() === 'true'
}

function publicPreview(preview: OpsWebsitePricingPreview) {
  const safe = { ...preview }
  delete safe.raw
  delete safe.quote_token
  delete safe.quote_expires_at
  return safe
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
  const offerReference = text(body?.offer_reference ?? body?.offerReference)

  if (!resolvedArea || !monthlyKwh || !postalCode || !city || !address) {
    return NextResponse.json(
      { error: 'Ange adress, ort, postnummer, elområde och en giltig månadsförbrukning innan du räknar pris.' },
      { status: 400 },
    )
  }
  if (!offerReference) {
    return NextResponse.json({ error: 'Välj ett aktuellt elavtal innan du räknar pris.' }, { status: 400 })
  }

  try {
    const contracts = await fetchOpsPublicContracts()
    const contract = contracts.find((item) => item.offer_reference === offerReference)
    if (!contract) return NextResponse.json({ error: 'Valt elavtal kunde inte verifieras.' }, { status: 404 })

    const input: OpsWebsitePricingPreviewInput = {
      offer_reference: contract.offer_reference,
      price_area_code: resolvedArea,
      postal_code: postalCode,
      city,
      address,
      estimated_monthly_kwh: monthlyKwh,
    }
    const preview = await loadVerifiedWebsitePricingPreview(input, contract)
    const opsQuote = validOpsQuote(preview)
    const requireOpsQuote = requireOpsPricingQuote()
    const websiteQuote = opsQuote || requireOpsQuote
      ? null
      : issueWebsitePricingQuote({ preview, contract, location: { postalCode, city, address } })

    if (requireOpsQuote && !opsQuote) {
      return NextResponse.json({ error: 'Priset kunde räknas men inte kontrolleras för teckning just nu.' }, { status: 503 })
    }

    if (!opsQuote && !websiteQuote) {
      return NextResponse.json({ error: 'Priset kan inte kontrolleras för teckning just nu.' }, { status: 503 })
    }

    return NextResponse.json(
      {
        data: {
          ...publicPreview(preview),
          quote_token: opsQuote?.token ?? websiteQuote!.token,
          quote_expires_at: opsQuote?.expiresAt ?? websiteQuote!.quote.expires_at,
          quote_source: opsQuote ? 'ops' : 'website',
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
