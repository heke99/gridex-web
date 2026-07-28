import { createHmac, timingSafeEqual } from 'node:crypto'
import type { OpsWebsiteEnergyResolution, OpsWebsitePriceArea } from '@/lib/ops/client'
import { websiteServerSigningKeyring } from '@/lib/website/serverTokenSecret'

const TOKEN_VERSION = 'ea5'
const MAX_TOKEN_TTL_MS = 30 * 60_000

export type WebsiteEnergyAreaTokenPayload = {
  version: 2
  issued_at: string
  expires_at: string
  resolution_id: string
  price_area_code: OpsWebsitePriceArea
  grid_area_code: string | null
  grid_owner_id: string | null
  grid_owner_name: string | null
  confidence: number | null
  pricing_ready: true
  quote_ready: boolean
  contract_version: string
  location_fingerprint: string
}

function keys() {
  return websiteServerSigningKeyring('energy-area')
}

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv-SE')
}

function fingerprint(input: { postalCode: string; city: string; address: string }, key: string): string {
  const source = [input.postalCode.replace(/\s+/g, ''), normalized(input.city), normalized(input.address)].join('|')
  return createHmac('sha256', key).update(`energy-area:${source}`).digest('base64url')
}

function sign(value: string, key: string): string {
  return createHmac('sha256', key).update(value).digest('base64url')
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function energyAreaTokenConfigured(): boolean {
  return Boolean(keys())
}

export function issueWebsiteEnergyAreaToken(input: {
  resolution: OpsWebsiteEnergyResolution
  location: { postalCode: string; city: string; address: string }
  now?: Date
}): { token: string; payload: WebsiteEnergyAreaTokenPayload } | null {
  const keyring = keys()
  const key = keyring?.active.key ?? null
  const resolutionId = input.resolution.resolution_id?.trim()
  const area = input.resolution.price_area_code
  const validUntil = input.resolution.valid_until?.trim()
  if (
    !key ||
    !resolutionId ||
    !area ||
    input.resolution.capabilities.pricing_ready !== true ||
    !validUntil ||
    !Number.isFinite(Date.parse(validUntil)) ||
    !input.resolution.contract_version
  ) return null

  const now = input.now ?? new Date()
  const upstreamExpiry = Date.parse(validUntil)
  if (upstreamExpiry <= now.getTime()) return null
  const expiresAt = new Date(Math.min(upstreamExpiry, now.getTime() + MAX_TOKEN_TTL_MS)).toISOString()
  const payload: WebsiteEnergyAreaTokenPayload = {
    version: 2,
    issued_at: now.toISOString(),
    expires_at: expiresAt,
    resolution_id: resolutionId,
    price_area_code: area,
    grid_area_code: input.resolution.grid_area_code ?? null,
    grid_owner_id: input.resolution.grid_owner_id ?? null,
    grid_owner_name: input.resolution.grid_owner_name ?? null,
    confidence: input.resolution.confidence ?? null,
    pricing_ready: true,
    quote_ready: input.resolution.capabilities.quote_ready,
    contract_version: input.resolution.contract_version,
    location_fingerprint: fingerprint(input.location, key),
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const unsigned = `${TOKEN_VERSION}.${keyring!.active.kid}.${encoded}`
  return {
    token: `${unsigned}.${sign(unsigned, key)}`,
    payload,
  }
}

export function verifyWebsiteEnergyAreaToken(input: {
  token: string | null | undefined
  location: { postalCode: string; city: string; address: string }
  now?: Date
}): { ok: true; payload: WebsiteEnergyAreaTokenPayload } | { ok: false; reason: string } {
  const keyring = keys()
  if (!keyring) return { ok: false, reason: 'not_configured' }
  const [version, kid, encoded, signature, ...rest] = (input.token ?? '').split('.')
  if (version !== TOKEN_VERSION || !kid || !encoded || !signature || rest.length) {
    return { ok: false, reason: 'invalid' }
  }
  const key = keyring.verification.find((candidate) => candidate.kid === kid)?.key
  if (!key) return { ok: false, reason: 'invalid' }
  const unsigned = `${version}.${kid}.${encoded}`
  if (!safeEqual(sign(unsigned, key), signature)) return { ok: false, reason: 'invalid' }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as WebsiteEnergyAreaTokenPayload
    const now = input.now ?? new Date()
    if (
      payload.version !== 2 ||
      !payload.resolution_id ||
      !['SE1', 'SE2', 'SE3', 'SE4'].includes(payload.price_area_code) ||
      payload.pricing_ready !== true ||
      typeof payload.quote_ready !== 'boolean' ||
      !payload.contract_version ||
      !Number.isFinite(Date.parse(payload.issued_at)) ||
      !Number.isFinite(Date.parse(payload.expires_at)) ||
      Date.parse(payload.issued_at) > now.getTime() + 60_000 ||
      Date.parse(payload.expires_at) <= now.getTime() ||
      Date.parse(payload.expires_at) - Date.parse(payload.issued_at) > MAX_TOKEN_TTL_MS + 1_000 ||
      !safeEqual(payload.location_fingerprint, fingerprint(input.location, key))
    ) return { ok: false, reason: 'invalid_or_expired' }
    return { ok: true, payload }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}
