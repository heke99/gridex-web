import { NextResponse } from 'next/server'
import {
  fetchOpsPublicContractsSnapshot,
  fetchOpsWebsiteQuote,
  getOpsClientStatus,
  isOpsError,
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
import {
  isStrictCalendarDate,
  stockholmCalendarDate,
} from '@/lib/website/businessDate'
import { readWebJson } from '@/lib/api/webBoundary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AREAS = new Set<OpsWebsitePriceArea>(['SE1', 'SE2', 'SE3', 'SE4'])

type PreviewPayload = {
  offer_reference?: unknown
  price_area_code?: unknown
  resolution_token?: unknown
  postal_code?: unknown
  city?: unknown
  address?: unknown
  estimated_monthly_kwh?: unknown
  annual_consumption_kwh?: unknown
  start_date?: unknown
  customer_type?: unknown
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

  const parsedBody = await readWebJson<PreviewPayload>(req)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.value
  const monthlyKwh = requiredConsumption(body?.estimated_monthly_kwh, 200_000)
  const annualKwh = requiredConsumption(body?.annual_consumption_kwh)
  const postalCode = text(body?.postal_code, 20)?.replace(/\s+/g, '') ?? null
  const city = text(body?.city)
  const address = text(body?.address)
  const offerReference = text(body?.offer_reference)
  const requestedStartDate = text(body?.start_date, 10)
  const canonicalStartDate = requestedStartDate ?? stockholmCalendarDate()
  const customerType = parseWebsiteCustomerType(body?.customer_type)
  const areaToken = text(body?.resolution_token, 12_000)
  const claimedArea = requestedPriceArea(body?.price_area_code)

  if (!monthlyKwh || !annualKwh || !postalCode || !/^\d{5}$/.test(postalCode) || !city || !address || !offerReference || !customerType || !areaToken || !isStrictCalendarDate(canonicalStartDate)) {
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
    if (verifiedArea.payload.quote_ready !== true) {
      return NextResponse.json(
        {
          error: 'Elområdet är identifierat, men en offert kan inte skapas just nu.',
          code: 'resolution_quote_not_ready',
          request_id: requestId,
        },
        { status: 409, headers: { 'Cache-Control': 'private, no-store' } },
      )
    }

    const contractsSnapshot = await fetchOpsPublicContractsSnapshot(customerType)
    const contract = contractsSnapshot.contracts.find((item) => item.offer_reference === offerReference)
    if (!contract || !buildPublicContractDisplay(contract).ready) {
      return NextResponse.json({ error: 'Valt elavtal kunde inte verifieras.' }, { status: 404 })
    }

    const opsQuote = await fetchOpsWebsiteQuote({
      resolution_id: verifiedArea.payload.resolution_id,
      offer_reference: offerReference,
      annual_consumption_kwh: annualKwh,
      start_date: canonicalStartDate,
      customer_type: customerType,
    })
    if (
      opsQuote.contract.offer_reference !== offerReference ||
      opsQuote.resolution_id !== verifiedArea.payload.resolution_id ||
      opsQuote.start_date !== canonicalStartDate ||
      opsQuote.priceArea !== verifiedArea.payload.price_area_code ||
      Math.abs((opsQuote.annual_consumption_kwh ?? 0) - annualKwh) > 0.001
    ) {
      return NextResponse.json(
        { error: 'OPS-priset matchar inte den verifierade adressen eller förbrukningen.', code: 'ops_quote_context_mismatch' },
        { status: 409 },
      )
    }

    const enrichedQuote = {
      ...opsQuote,
      public_contract_etag: opsQuote.public_contract_etag ?? contractsSnapshot.etag,
      publication_revision: opsQuote.publication_revision ?? contractsSnapshot.publication_revision,
    }
    const pricingSnapshotReference = await persistWebsitePricingSnapshot({
      preview: enrichedQuote,
      contract,
      customerType,
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
    const opsCode = isOpsError(error) ? error.code : null
    console.error('[website pricing quote] failed', {
      request_id: requestId,
      upstream_request_id: isOpsError(error) ? error.requestId : null,
      correlation_id: isOpsError(error) ? error.correlationId : null,
      endpoint: isOpsError(error) ? error.endpoint : null,
      status: isOpsError(error) ? error.status : null,
      code: opsCode,
      retryable: isOpsError(error) ? error.retryable : null,
      message: error instanceof Error ? error.message : String(error),
    })
    const publicCode = opsCode === 'resolution_pricing_not_ready' || opsCode === 'resolution_not_ready'
      ? 'resolution_pricing_not_ready'
      : opsCode === 'resolution_quote_not_ready'
        ? 'resolution_quote_not_ready'
        : opsCode === 'resolution_expired'
          ? 'resolution_expired'
          : opsCode === 'resolution_not_found'
            ? 'resolution_not_found'
            : isOpsError(error)
              ? 'ops_quote_failed'
              : 'website_quote_failed'
    const publicMessage = publicCode === 'resolution_pricing_not_ready'
      ? 'Adressen behöver kompletteras eller kontrolleras innan priset kan hämtas.'
      : publicCode === 'resolution_quote_not_ready'
        ? 'Elområdet är identifierat, men en offert kan inte skapas just nu.'
        : publicCode === 'resolution_expired'
          ? 'Adresskontrollen har löpt ut. Kontrollera adressen igen.'
          : publicCode === 'resolution_not_found'
            ? 'Adresskontrollen kunde inte verifieras. Kontrollera adressen igen.'
            : `Elområdet hittades, men priset kunde inte hämtas för valt avtal. Referens: ${requestId.slice(0, 8)}.`
    return NextResponse.json(
      { error: publicMessage, code: publicCode, request_id: requestId },
      { status: isOpsError(error) ? error.status : 503 },
    )
  }
}
