import { NextResponse } from 'next/server'
import { fetchOpsWebsiteEnergyArea, getOpsClientStatus, isOpsError } from '@/lib/ops/client'
import { issueWebsiteEnergyAreaToken, energyAreaTokenConfigured } from '@/lib/website/energyAreaToken'
import { persistOpsEnergyAreaResolution } from '@/lib/website/energyAreaStore'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ResolvePayload = { postal_code?: unknown; postalCode?: unknown; city?: unknown; street?: unknown; address?: unknown; apartment?: unknown }

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
  return 'Adressen behöver kontrolleras innan priset kan hämtas.'
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

  const body = await req.json().catch(() => null) as ResolvePayload | null
  const postalCode = String(body?.postal_code ?? body?.postalCode ?? '').replace(/\s+/g, '')
  const city = text(body?.city)
  const address = text(body?.address ?? body?.street)
  const apartment = text(body?.apartment, 40)
  if (!/^\d{5}$/.test(postalCode) || !city || !address) {
    return NextResponse.json({ error: 'Ange adress, ort och ett svenskt postnummer med fem siffror.' }, { status: 400 })
  }

  try {
    const resolution = await fetchOpsWebsiteEnergyArea({
      postal_code: postalCode,
      city,
      address,
      street: address,
      apartment,
    })
    const resolutionStatus = String(resolution.resolution_status ?? resolution.status).trim().toLowerCase()
    const explicitlyUnresolved = /unresolved|ambiguous|manual|review|failed|invalid|not_found|needs_review/.test(resolutionStatus)
    const confidenceTooLow = resolution.confidence != null && resolution.confidence < 0.75
    const automationBlocked = resolution.automation_allowed !== true
    if (
      !resolution.price_area_code ||
      !resolution.resolution_id ||
      !resolution.valid_until ||
      explicitlyUnresolved ||
      confidenceTooLow ||
      automationBlocked
    ) {
      console.warn('[website energy resolve] resolution is not ready for automatic pricing', {
        request_id: requestId,
        resolution_id: resolution.resolution_id ?? null,
        resolution_status: resolution.resolution_status ?? resolution.status,
        automation_allowed: resolution.automation_allowed,
        next_required_action: resolution.next_required_action ?? null,
        warnings: resolution.warnings,
        conflict_code: resolution.conflict_code ?? null,
        error_code: resolution.error_code ?? null,
        confidence: resolution.confidence ?? null,
      })
      return NextResponse.json(
        {
          error: resolution.customer_message || resolutionBlockedMessage(resolution.next_required_action),
          code: 'resolution_not_ready',
          next_required_action: resolution.next_required_action ?? null,
          warnings: resolution.warnings,
          request_id: requestId,
        },
        { status: 409, headers: { 'Cache-Control': 'private, no-store' } },
      )
    }
    const location = { postalCode, city, address }
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
          automation_allowed: true,
          warnings: resolution.warnings,
          source: 'ops',
          customer_message: resolution.customer_message ?? null,
          assurance_level: assuranceLevel,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('[website energy resolve] OPS resolver failed', {
      request_id: requestId,
      status: isOpsError(error) ? error.status : null,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: `Vi kunde inte kontrollera elområdet just nu. Referens: ${requestId.slice(0, 8)}.` },
      { status: isOpsError(error) ? error.status : 503 },
    )
  }
}
