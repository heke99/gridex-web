import { GRIDEX_API_BASE_URL } from '@/lib/ops/contract'

const MIN_SIGNING_SECRET_BYTES = 32
let deprecatedWebsiteKeyWarningEmitted = false

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value || undefined
}

function normalizeApiBase(value: string): string {
  const normalized = value.replace(/\/+$/, '')
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`
}

function allowedNonProductionOrigins(): Set<string> {
  const configured = readEnv('GRIDEX_OPS_STAGING_ALLOWED_ORIGINS')
  const origins = new Set<string>()
  for (const item of (configured ?? '').split(',')) {
    const candidate = item.trim()
    if (!candidate) continue
    try {
      origins.add(new URL(candidate).origin)
    } catch {
      // Invalid entries are ignored here and surfaced by the base URL check.
    }
  }
  return origins
}

function apiKeyConfiguration(): {
  value?: string
  source: 'GRIDEX_API_KEY' | 'GRIDEX_WEBSITE_API_KEY' | null
  invalidReason?: string
  deprecatedVariablesInUse: string[]
} {
  const canonical = readEnv('GRIDEX_API_KEY')
  const deprecatedWebsiteKey = readEnv('GRIDEX_WEBSITE_API_KEY')
  const value = canonical ?? deprecatedWebsiteKey
  const source = canonical
    ? 'GRIDEX_API_KEY'
    : deprecatedWebsiteKey
      ? 'GRIDEX_WEBSITE_API_KEY'
      : null

  if (source === 'GRIDEX_WEBSITE_API_KEY' && !deprecatedWebsiteKeyWarningEmitted) {
    deprecatedWebsiteKeyWarningEmitted = true
    console.warn('[gridex-config] GRIDEX_WEBSITE_API_KEY används som deprecated fallback. Byt till GRIDEX_API_KEY.')
  }

  if (!value) {
    return {
      source,
      deprecatedVariablesInUse: source === 'GRIDEX_WEBSITE_API_KEY' ? ['GRIDEX_WEBSITE_API_KEY'] : [],
    }
  }

  if (/^gdxp_[a-z0-9]+$/i.test(value) && value.length <= 18) {
    return {
      source,
      invalidReason: 'GRIDEX_API_KEY innehåller endast ett synligt nyckelprefix.',
      deprecatedVariablesInUse: source === 'GRIDEX_WEBSITE_API_KEY' ? ['GRIDEX_WEBSITE_API_KEY'] : [],
    }
  }

  return {
    value,
    source,
    deprecatedVariablesInUse: source === 'GRIDEX_WEBSITE_API_KEY' ? ['GRIDEX_WEBSITE_API_KEY'] : [],
  }
}

function validateApiBase(value: string): { value?: string; reason?: string } {
  let url: URL
  try {
    url = new URL(normalizeApiBase(value))
  } catch {
    return { reason: 'GRIDEX_API_BASE_URL är ogiltig.' }
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    return { reason: 'GRIDEX_API_BASE_URL måste vara en ren HTTPS-adress.' }
  }
  if (url.pathname.replace(/\/+$/, '') !== '/api/v1') {
    return { reason: 'GRIDEX_API_BASE_URL måste sluta med /api/v1.' }
  }

  const canonicalOrigin = new URL(GRIDEX_API_BASE_URL).origin
  const deploymentEnvironment = readEnv('VERCEL_ENV') ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development')
  if (deploymentEnvironment === 'production' && url.origin !== canonicalOrigin) {
    return { reason: 'Produktionsmiljön får endast använda canonical OPS-origin.' }
  }
  if (
    deploymentEnvironment !== 'production' &&
    url.origin !== canonicalOrigin &&
    !allowedNonProductionOrigins().has(url.origin)
  ) {
    return { reason: 'OPS-origin är inte uttryckligen godkänd för denna miljö.' }
  }

  return { value: url.toString().replace(/\/+$/, '') }
}

export type GridexConfigurationStatus = {
  configured: boolean
  apiKeyConfigured: boolean
  apiBaseUrlValid: boolean
  signingSecretConfigured: boolean
  missingVariables: string[]
  deprecatedVariablesInUse: string[]
}

export function getGridexApiKey(): { value?: string; invalidReason?: string } {
  const configuration = apiKeyConfiguration()
  return {
    ...(configuration.value ? { value: configuration.value } : {}),
    ...(configuration.invalidReason ? { invalidReason: configuration.invalidReason } : {}),
  }
}

export function getGridexApiBaseUrl(): string {
  const configured = readEnv('GRIDEX_API_BASE_URL') ?? GRIDEX_API_BASE_URL
  const result = validateApiBase(configured)
  if (!result.value) throw new Error(result.reason ?? 'GRIDEX_API_BASE_URL är ogiltig.')
  return result.value
}

export function getGridexConfigurationStatus(): GridexConfigurationStatus {
  const apiKey = apiKeyConfiguration()
  const base = validateApiBase(readEnv('GRIDEX_API_BASE_URL') ?? GRIDEX_API_BASE_URL)
  const signingSecret = readEnv('GRIDEX_WEBSITE_STATE_SIGNING_SECRET')
  const signingSecretConfigured = Boolean(
    signingSecret && Buffer.byteLength(signingSecret, 'utf8') >= MIN_SIGNING_SECRET_BYTES,
  )
  const missingVariables = [
    ...(!apiKey.value ? ['GRIDEX_API_KEY'] : []),
    ...(!base.value ? ['GRIDEX_API_BASE_URL'] : []),
    ...(!signingSecretConfigured ? ['GRIDEX_WEBSITE_STATE_SIGNING_SECRET'] : []),
  ]

  return {
    configured: Boolean(apiKey.value && base.value && signingSecretConfigured),
    apiKeyConfigured: Boolean(apiKey.value),
    apiBaseUrlValid: Boolean(base.value),
    signingSecretConfigured,
    missingVariables,
    deprecatedVariablesInUse: apiKey.deprecatedVariablesInUse,
  }
}

export function getGridexRuntimeSetting(name: string): string | undefined {
  return readEnv(name)
}

export function getGridexWebsiteSigningConfiguration(): {
  activeSecret?: string
  activeKid: string
  previousSecret?: string
  previousKid: string
} {
  return {
    ...(readEnv('GRIDEX_WEBSITE_STATE_SIGNING_SECRET')
      ? { activeSecret: readEnv('GRIDEX_WEBSITE_STATE_SIGNING_SECRET') }
      : {}),
    activeKid: readEnv('GRIDEX_WEBSITE_STATE_SIGNING_KID') ?? 'current',
    ...(readEnv('GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_SECRET')
      ? { previousSecret: readEnv('GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_SECRET') }
      : {}),
    previousKid: readEnv('GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_KID') ?? 'previous',
  }
}

export function getGridexDeploymentMetadata(): {
  commitSha: string | null
  deploymentId: string | null
  buildTimestamp: string | null
} {
  return {
    commitSha: readEnv('VERCEL_GIT_COMMIT_SHA') ?? readEnv('GIT_COMMIT_SHA') ?? null,
    deploymentId: readEnv('VERCEL_DEPLOYMENT_ID') ?? readEnv('VERCEL_URL') ?? null,
    buildTimestamp: readEnv('GRIDEX_BUILD_TIMESTAMP') ?? null,
  }
}
