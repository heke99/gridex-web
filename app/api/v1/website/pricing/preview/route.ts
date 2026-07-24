import { NextResponse } from 'next/server'
import {
  fetchOpsPublicContractsSnapshot,
  fetchOpsWebsiteQuote,
  getOpsClientStatus,
  isOpsError,
  type OpsPublicContract,
  type OpsWebsitePriceArea,
} from '@/lib/ops/client'
import {
  issueWebsitePricingQuote,
  quoteToWebsitePricingPreview,
  websitePricingQuoteConfigured,
} from '@/lib/website/pricingQuote'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'
import { parseWebsiteCustomerType } from '@/lib/website/customerType'
import { CUSTOMER_NETWORK_FEE_NOTICE } from '@/lib/website/customerFacingCopy'
import { persistWebsitePricingSnapshot } from '@/lib/website/pricingSnapshotStore'
import { verifyWebsiteEnergyAreaToken } from '@/lib/website/energyAreaToken'
import { buildOpsMarketPriceInput, persistMarketPriceSnapshot } from '@/lib/website/marketPriceService'
import {
  UnsupportedPricingComponentError,
  validatePricingComponentsForQuote,
} from '@/lib/website/componentCalculator'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AREAS = new Set<OpsWebsitePriceArea>(['SE1', 'SE2', 'SE3', 'SE4'])

type PreviewPayload = {
  offer_reference?: unknown
  offerReference?: unknown
  price_area_code?: unknown
  priceAreaCode?: unknown
  priceArea?: unknown
  resolution_token?: unknown
  resolutionToken?: unknown
  postal_code?: unknown
  postalCode?: unknown
  city?: unknown
  address?: unknown
  estimated_monthly_kwh?: unknown
  annual_consumption_kwh?: unknown
  annualConsumptionKwh?: unknown
  estimatedMonthlyKwh?: unknown
  kwh?: unknown
  start_date?: unknown
  startDate?: unknown
  customer_type?: unknown
  customerType?: unknown
}

function text(value: unknown, max = 180): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().slice(0, max)
  return normalized || null
}

function requiredConsumption(value: unknown, max = 2_400_000): number | null {
  const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value)
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= max ? parsed : null
}

function requestedPriceArea(value: unknown): OpsWebsitePriceArea | null {
  const area = typeof value === 'string' ? value.toUpperCase() : ''
  return AREAS.has(area as OpsWebsitePriceArea) ? area as OpsWebsitePriceArea : null
}

function fixedContractPreflight(contract: OpsPublicContract, area: OpsWebsitePriceArea): string | null {
  if (String(contract.contract_type ?? contract.type).toLowerCase() !== 'fixed') return null
  if (contract.price_areas?.length && !contract.price_areas.includes(area)) return 'offer_not_available_in_price_area'
  const rows = (contract.area_pricing ?? []).filter((row) => row.price_area_code === area)
  if (rows.length !== 1) return rows.length === 0 ? 'fixed_area_price_missing' : 'fixed_area_price_ambiguous'
  const areaPrice = rows[0]?.fixed_price_ore_per_kwh
  if (contract.fixed_price_ore_per_kwh != null && areaPrice != null && Math.abs(contract.fixed_price_ore_per_kwh - areaPrice) > 0.000001) {
    return 'public_contract_pricing_conflict'
  }
  return null
}

export async function POST(req: Request) {
  const requestId = globalThis.crypto.randomUUID()
  const rateLimit = await checkRateLimit(
    `website-pricing-preview:${clientIpFromHeaders(new Headers(req.headers))}`,
    { limit: 30, windowMs: 5 * 60_000 },
  )
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'För många prisförfrågningar. Vänta en stund och försök igen.' },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) } },
    )
  }
  if (!getOpsClientStatus().configured || !websitePricingQuoteConfigured()) {
    return NextResponse.json({ error: 'Prisverifieringen är inte konfigurerad just nu.' }, { status: 503 })
  }

  const body = await req.json().catch(() => null) as PreviewPayload | null
  const monthlyKwh = requiredConsumption(body?.estimated_monthly_kwh ?? body?.estimatedMonthlyKwh ?? body?.kwh, 200_000)
  const annualKwh = requiredConsumption(body?.annual_consumption_kwh ?? body?.annualConsumptionKwh)
  const postalCode = text(body?.postal_code ?? body?.postalCode, 20)?.replace(/\s+/g, '') ?? null
  const city = text(body?.city)
  const address = text(body?.address)
  const offerReference = text(body?.offer_reference ?? body?.offerReference)
  const startDate = text(body?.start_date ?? body?.startDate, 10)
  const customerType = parseWebsiteCustomerType(body?.customer_type ?? body?.customerType)
  const areaToken = text(body?.resolution_token ?? body?.resolutionToken, 12_000)
  const claimedArea = requestedPriceArea(body?.price_area_code ?? body?.priceAreaCode ?? body?.priceArea)

  if (!monthlyKwh || !annualKwh || !postalCode || !/^\d{5}$/.test(postalCode) || !city || !address || !offerReference || !customerType || !areaToken) {
    return NextResponse.json({ error: 'Adress, kundtyp, avtal, förbrukning och verifierat elområde krävs.' }, { status: 400 })
  }

  const verifiedArea = verifyWebsiteEnergyAreaToken({
    token: areaToken,
    location: { postalCode, city, address },
  })
  if (!verifiedArea.ok || (claimedArea && claimedArea !== verifiedArea.payload.price_area_code)) {
    return NextResponse.json({ error: 'Adressen och elområdet måste kontrolleras igen.', code: 'energy_area_token_invalid' }, { status: 409 })
  }

  try {
    const contractsSnapshot = await fetchOpsPublicContractsSnapshot(customerType)
    const contract = contractsSnapshot.contracts.find((item) => item.offer_reference === offerReference)
    if (!contract || !buildPublicContractDisplay(contract).ready) {
      return NextResponse.json({ error: 'Valt elavtal kunde inte verifieras.' }, { status: 404 })
    }
    const fixedBlocker = fixedContractPreflight(contract, verifiedArea.payload.price_area_code)
    if (fixedBlocker) {
      return NextResponse.json({ error: 'Fastpriset saknas eller är inkonsekvent för valt elområde.', code: fixedBlocker }, { status: 409 })
    }
    validatePricingComponentsForQuote(
      contract.calculation_components?.length
        ? contract.calculation_components
        : contract.pricing_components ?? [],
    )

    const marketPrice = await buildOpsMarketPriceInput({
      contract,
      priceArea: verifiedArea.payload.price_area_code,
    })
    const marketPriceSnapshotId = await persistMarketPriceSnapshot(marketPrice)
    const opsQuote = await fetchOpsWebsiteQuote({
      offer_reference: offerReference,
      price_area_code: verifiedArea.payload.price_area_code,
      resolution_reference: verifiedArea.payload.resolution_reference,
      estimated_monthly_kwh: monthlyKwh,
      annual_consumption_kwh: annualKwh,
      start_date: startDate,
      customer_type: customerType,
      market_price: marketPrice,
      public_contract_etag: contractsSnapshot.etag,
      publication_revision: contractsSnapshot.publication_revision,
    })
    const enrichedQuote = {
      ...opsQuote,
      public_contract_etag: opsQuote.public_contract_etag ?? contractsSnapshot.etag,
      publication_revision: opsQuote.publication_revision ?? contractsSnapshot.publication_revision,
    }
    const pricingSnapshotReference = await persistWebsitePricingSnapshot({
      preview: enrichedQuote,
      contract,
      customerType,
      marketPriceSnapshotId,
    })
    const lockedPreview = { ...enrichedQuote, pricing_snapshot_reference: pricingSnapshotReference }
    const websiteQuote = issueWebsitePricingQuote({
      preview: lockedPreview,
      contract,
      location: { postalCode, city, address },
    })
    if (!websiteQuote) throw new Error('OPS quote could not be locked for checkout.')

    const data = {
      ...quoteToWebsitePricingPreview(websiteQuote.quote, websiteQuote.token),
      customerNotice: CUSTOMER_NETWORK_FEE_NOTICE,
      quote_source: 'website' as const,
      token_issuer: 'website' as const,
      canonical_source: 'ops' as const,
    }
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof UnsupportedPricingComponentError) {
      console.error('[website pricing quote] unsupported component', {
        request_id: requestId,
        component_code: error.componentCode,
        message: error.message,
      })
      return NextResponse.json(
        {
          error: 'Det valda avtalet innehåller en prisdel som inte kan beräknas säkert.',
          code: 'unsupported_pricing_component',
          request_id: requestId,
        },
        { status: 409 },
      )
    }
    console.error('[website pricing quote] failed', {
      request_id: requestId,
      status: isOpsError(error) ? error.status : null,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        error: `Elområdet hittades, men priset kunde inte hämtas för valt avtal. Referens: ${requestId.slice(0, 8)}.`,
        code: isOpsError(error) ? 'ops_quote_failed' : 'website_quote_failed',
        request_id: requestId,
      },
      { status: isOpsError(error) ? error.status : 503 },
    )
  }
}
