import 'server-only'

export const SUPPORT_AUTH_COOKIE_NAME = 'gridex-support-auth' as const
export const SUPPORT_AUTH_URL = 'https://ayiuxjlfazkjmmtlvhsl.supabase.co' as const
export type SupportAuthConfig = { url: typeof SUPPORT_AUTH_URL; anonKey: string; cookieSecure: boolean }

export class SupportAuthError extends Error {
  readonly code: string
  readonly status = 503
  constructor(code: 'support_auth_not_configured' | 'support_auth_unavailable' | 'support_auth_cookie_invalid') {
    super('Supportinloggningen kunde inte slutföras. Försök igen senare.')
    this.name = 'SupportAuthError'
    this.code = code
  }
}

/** Dedicated public gridex-prod Auth credentials only; never website or service credentials. */
export function readSupportAuthConfig(environment: NodeJS.ProcessEnv = process.env): SupportAuthConfig {
  const url = environment.GRIDEX_SUPPORT_SUPABASE_URL?.trim()
  const anonKey = environment.GRIDEX_SUPPORT_SUPABASE_ANON_KEY?.trim() ?? ''
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(anonKey)
  if (!publicKey && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(anonKey)) {
    try {
      const payload = JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64url').toString('utf8'))
      publicKey = payload.role === 'anon' && payload.ref === 'ayiuxjlfazkjmmtlvhsl'
    } catch { publicKey = false }
  }
  // Reading the legacy public token's role is configuration validation only.
  // Supabase validates the token itself; no user/session authority comes from it.
  if (url !== SUPPORT_AUTH_URL || !publicKey) throw new SupportAuthError('support_auth_not_configured')
  return { url: SUPPORT_AUTH_URL, anonKey, cookieSecure: environment.NODE_ENV === 'production' }
}
