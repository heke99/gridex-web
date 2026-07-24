import { createHash } from 'node:crypto'

const SECRET_ENV_NAMES = [
  'GRIDEX_WEBSITE_PRICING_QUOTE_SECRET',
  'GRIDEX_WEBSITE_HASH_PEPPER',
  'PII_HASH_PEPPER',
  'PII_ENCRYPTION_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

function sourceSecret(): string | null {
  for (const name of SECRET_ENV_NAMES) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return null
}

/**
 * Derives separate HMAC keys for browser tokens from an existing server-only
 * secret. The OPS API token is deliberately never used as local signing key.
 */
export function websiteServerSigningSecret(purpose: 'pricing-quote' | 'energy-area'): string | null {
  const source = sourceSecret()
  if (!source) return null
  return createHash('sha256')
    .update(`gridex-web:${purpose}:v1:${source}`)
    .digest('base64url')
}

export function websiteServerSigningConfigured(): boolean {
  return Boolean(sourceSecret())
}
