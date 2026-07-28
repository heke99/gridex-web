import { createHash } from 'node:crypto'

type Purpose = 'pricing-quote' | 'energy-area'

export type WebsiteSigningKey = {
  kid: string
  key: string
}

function validSourceSecret(value: string | undefined): string | null {
  const normalized = value?.trim()
  if (!normalized) return null
  let byteLength = Buffer.byteLength(normalized)
  try {
    const decoded = Buffer.from(normalized, 'base64url')
    if (decoded.length >= 32) byteLength = decoded.length
  } catch {
    // Plain random strings are allowed when they contain at least 32 bytes.
  }
  return byteLength >= 32 ? normalized : null
}

function derive(source: string, purpose: Purpose): string {
  return createHash('sha256')
    .update(`gridex-web-state:${purpose}:v2:${source}`)
    .digest('base64url')
}

export function websiteServerSigningKeyring(purpose: Purpose): {
  active: WebsiteSigningKey
  verification: WebsiteSigningKey[]
} | null {
  const activeSource = validSourceSecret(process.env.GRIDEX_WEBSITE_STATE_SIGNING_SECRET)
  if (!activeSource) return null
  const active = {
    kid: process.env.GRIDEX_WEBSITE_STATE_SIGNING_KID?.trim() || 'current',
    key: derive(activeSource, purpose),
  }
  const previousSource = validSourceSecret(
    process.env.GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_SECRET,
  )
  const previous = previousSource
    ? {
        kid: process.env.GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_KID?.trim() || 'previous',
        key: derive(previousSource, purpose),
      }
    : null
  if (previous?.kid === active.kid) return null
  return {
    active,
    verification: previous ? [active, previous] : [active],
  }
}

export function websiteServerSigningSecret(purpose: Purpose): string | null {
  return websiteServerSigningKeyring(purpose)?.active.key ?? null
}

export function websiteServerSigningConfigured(): boolean {
  return Boolean(websiteServerSigningKeyring('pricing-quote'))
}
