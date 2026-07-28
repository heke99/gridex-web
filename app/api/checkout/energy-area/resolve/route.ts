import { NextResponse } from 'next/server'
import { fetchOpsWebsiteEnergyArea, getOpsClientStatus, isOpsError } from '@/lib/ops/client'
import { issueWebsiteEnergyAreaToken, energyAreaTokenConfigured } from '@/lib/website/energyAreaToken'
import { persistOpsEnergyAreaResolution } from '@/lib/website/energyAreaStore'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'
import { readWebJson } from '@/lib/api/webBoundary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ResolvePayload = {
  postal_code?: unknown
  city?: unknown
  street?: unknown
  street_number?: unknown
  address?: unknown
  country?: unknown
  grid_area_code?: unknown
  facility_id?: unknown
  metering_point_id?: unknown
  requested_start_mode?: unknown
  requested_start_date?: unknown
}

function text(value: unknown, max = 180): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().slice(0, max)
  return normalized || null
}

function resolutionBlockedMessage(nextAction: string | null | undefined): string {
  const action = (nextAction ?? '').trim().toLowerCase()
  if (/facility|metering|anlägg|matpunkt|mätpunkt/.test(action)) {
    return 'Vi behöver fler anläggningsuppgifter innan priset kan hämtas.'
  }
  if (/address|postal|street|city|adress|postnummer|ort/.test(action)) {
    return 'Adressen behöver kompletteras eller kontrolleras innan priset kan hämtas.'
  }
  return 'Elområdet kunde identifieras, men priset är inte tillgängligt just nu.'
}

function publicBlockers(blockers: Array<{ code: string; message?: string | null; field?: string | null; retryable?: boolean | null }>) {
  return blockers.map((blocker) => ({
    code: blocker.code,
    message: blocker.message ?? null,
    field: blocker.field ?? null,
    retryable: blocker.retryable ?? null,
  }))
}

export async function POST(req: Request) {
  const requestId = globalThis.crypto.randomUUID()
  const rateLimit = await checkRateLimit(
    `website-energy-resolve:${clientIpFromHeaders(new Headers(req.headers))}`,
    { limit: 30, windowMs: 5 * 60_000 },
  )
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'För många adresskontroller. Vänta en stund och försök igen.' },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) } },
    )
  }
  if (!getOpsClientStatus().configured || !energyAreaTokenConfigured()) {
    return NextResponse.json({ error: 'Elområdeskontrollen är inte konfigurerad just nu.' }, { status: 503 })
  }

  const parsedBody = await readWebJson<ResolvePayload>(req)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.value
  const postalCode = text(body?.postal_code, 20)?.replace(/\s+/g, '') ?? null
  const city = text(body?.city)
  const address = text(body?.address ?? body?.street)
  const streetNumber = text(body?.street_number, 40)
  const country = text(body?.country, 2)?.toUpperCase() ?? 'SE'
  const gridAreaCode = text(body?.grid_area_code, 80)
  const facilityId = text(body?.facility_id, 120)
  const meteringPointId = text(body?.metering_point_id, 120)
  const requestedStartMode = text(body?.requested_start_mode, 40)
  const requestedStartDate = text(body?.requested_start_date, 10)

  const hasStrongIdentifier = Boolean(gridAreaCode || facilityId || meteringPointId)
  if (!hasStrongIdentifier && (!postalCode || !/^\d{5}$/.test(postalCode) || !city || !address)) {
    return NextResponse.json(
      { error: 'Ange en fullständig adress eller ett giltigt anläggnings-ID.' },
      { status: 400 },
    )
  }

  try {
    const resolution = await fetchOpsWebsiteEnergyArea({
      postal_code: postalCode,
      city,
      address,
      street: address,
      street_number: streetNumber,
      country,
      grid_area_code: gridAreaCode,
      facility_id: facilityId,
      metering_point_id: meteringPointId,
      requested_start_mode:
        requestedStartMode === 'specific_date' || requestedStartMode === 'earliest_possible'
          ? requestedStartMode
          : null,
      requested_start_date: requestedStartDate,
    })

    const structurallyResolved = Boolean(
      resolution.price_area_code &&
      resolution.resolution_id &&
      resolution.valid_until,
    )
    if (!structurallyResolved || resolution.capabilities.pricing_ready !== true) {
      console.warn('[website energy resolve] pricing is blocked', {
        request_id: requestId,
        resolution_id: resolution.resolution_id ?? null,
        resolution_status: resolution.resolution_status ?? resolution.status,
        pricing_ready: resolution.capabilities.pricing_ready,
        quote_ready: resolution.capabilities.quote_ready,
        pricing_blockers: resolution.blockers.pricing.map((blocker) => blocker.code),
        next_required_action: resolution.next_required_action ?? null,
        retryable: resolution.retryable,
        confidence: resolution.confidence ?? null,
      })
      return NextResponse.json(
        {
          error: resolution.customer_message || resolutionBlockedMessage(resolution.next_required_action),
          code: 'resolution_pricing_not_ready',
          next_required_action: resolution.next_required_action ?? null,
          blockers: publicBlockers(resolution.blockers.pricing),
          warnings: resolution.warnings,
          retryable: resolution.retryable,
          request_id: requestId,
        },
        { status: 409, headers: { 'Cache-Control': 'private, no-store' } },
      )
    }

    const location = {
      postalCode: postalCode ?? '',
      city: city ?? '',
      address: address ?? meteringPointId ?? facilityId ?? gridAreaCode ?? '',
    }
    const issued = issueWebsiteEnergyAreaToken({ resolution, location })
    if (!issued) throw new Error('OPS energy-area resolution could not be signed.')
    await persistOpsEnergyAreaResolution({ resolution, location })

    const confidence = resolution.confidence ?? 0
    const assuranceLevel = confidence >= 0.95 ? 'sufficient_for_application' : 'verified'
    return NextResponse.json(
      {
        data: {
          status: resolution.status,
          resolution_id: resolution.resolution_id,
          resolution_token: issued.token,
          valid_until: resolution.valid_until,
          price_area_code: resolution.price_area_code,
          grid_area_code: resolution.grid_area_code ?? null,
          grid_owner_id: resolution.grid_owner_id ?? null,
          grid_owner_name: resolution.grid_owner_name ?? null,
          confidence: resolution.confidence ?? null,
          capabilities: resolution.capabilities,
          blockers: {
            pricing: publicBlockers(resolution.blockers.pricing),
            quote: publicBlockers(resolution.blockers.quote),
            facility_lookup: publicBlockers(resolution.blockers.facility_lookup),
            switch_creation: publicBlockers(resolution.blockers.switch_creation),
            switch_dispatch: publicBlockers(resolution.blockers.switch_dispatch),
          },
          retryable: resolution.retryable,
          warnings: resolution.warnings,
          source: resolution.source
            ? {
                provider: resolution.source.provider ?? null,
                reference: resolution.source.reference ?? null,
                resolved_by: resolution.source.resolved_by ?? null,
                as_of: resolution.source.as_of ?? null,
              }
            : null,
          contract_version: resolution.contract_version,
          customer_message: resolution.customer_message ?? null,
          assurance_level: assuranceLevel,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('[website energy resolve] OPS resolver failed', {
      request_id: requestId,
      upstream_request_id: isOpsError(error) ? error.requestId : null,
      correlation_id: isOpsError(error) ? error.correlationId : null,
      endpoint: isOpsError(error) ? error.endpoint : null,
      status: isOpsError(error) ? error.status : null,
      code: isOpsError(error) ? error.code : null,
      retryable: isOpsError(error) ? error.retryable : null,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        error: `Vi kunde inte kontrollera elområdet just nu. Referens: ${requestId.slice(0, 8)}.`,
        code: isOpsError(error) ? error.code : 'energy_resolution_failed',
        request_id: requestId,
        retryable: isOpsError(error) ? error.retryable : true,
      },
      { status: isOpsError(error) ? error.status : 503 },
    )
  }
}
