import 'server-only'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createStaffApiClient, StaffApiError, type StaffApiClient } from '../../../lib/staff-api/client'
import { STAFF_SUBJECT_UUID } from '../../../lib/staff-api/config'
import { resolveStaffIdentity } from '../../../lib/staff-api/identity'
import type { StaffIdentityBinding } from '../../../lib/staff-api/assertion'
import { readSupportAuthConfig, SupportAuthError, SUPPORT_AUTH_COOKIE_NAME, type SupportAuthConfig } from './auth-config'

export { SupportAuthError } from './auth-config'

type HostCookieOptions = Omit<CookieOptions, 'domain' | 'sameSite' | 'secure' | 'httpOnly'> & { sameSite: 'lax'; secure: boolean; httpOnly: true; path: '/' }
type SupportCookieStore = { getAll: () => { name: string; value: string }[]; set: (name: string, value: string, options: HostCookieOptions) => unknown }
type CookieUpdate = { name: string; value: string; options: CookieOptions }
const OWN_COOKIE = /^gridex-support-auth(?:\.\d+|-code-verifier(?:\.\d+)?)?$/

/** Cookie domain and security settings cannot be widened by SDK options. */
export function writeSupportAuthCookies(store: Pick<SupportCookieStore, 'set'>, updates: CookieUpdate[], secure: boolean): void {
  if (updates.some(({ name }) => !OWN_COOKIE.test(name))) throw new SupportAuthError('support_auth_cookie_invalid')
  try {
    for (const { name, value, options } of updates) {
      const hostOptions = { ...options }
      delete hostOptions.domain
      store.set(name, value, { ...hostOptions, path: '/', httpOnly: true, secure, sameSite: 'lax' })
    }
  } catch (error) {
    // Next Server Components are read-only. Server Actions and Route Handlers
    // use the same adapter with writable cookies; other errors must surface.
    if (error instanceof Error && /^Cookies can only be modified in a Server Action or Route Handler\./.test(error.message)) return
    throw error
  }
}

export type SupportAuthDependencies = { config?: SupportAuthConfig; cookieStore?: SupportCookieStore; serverClient?: typeof createServerClient }
export async function createSupportAuthClient(dependencies: SupportAuthDependencies = {}): Promise<SupabaseClient> {
  const config = dependencies.config ?? readSupportAuthConfig()
  const cookieStore = dependencies.cookieStore ?? await cookies()
  const serverClient = dependencies.serverClient ?? createServerClient
  return serverClient(config.url, config.anonKey, {
    cookieOptions: { name: SUPPORT_AUTH_COOKIE_NAME, path: '/', httpOnly: true, secure: config.cookieSecure, sameSite: 'lax' },
    cookies: {
      getAll: () => cookieStore.getAll().filter(({ name }) => OWN_COOKIE.test(name)),
      setAll: (updates) => writeSupportAuthCookies(cookieStore, updates, config.cookieSecure),
    },
  })
}

export type SupportSession = { userId: string; localAuthUserId: string; email: string | null; api: StaffApiClient }
type VerifiedAuthUser = { id: string; email?: string; user_metadata?: Record<string, unknown> }
export type SupportSessionDependencies = {
  authClient: () => Promise<{ auth: {
    getUser: () => Promise<{ data: { user: VerifiedAuthUser | null }; error: unknown }>
    getSession: () => Promise<{ data: { session: { access_token: string } | null }; error: unknown }>
  } }>
  resolveIdentity: (localAuthUserId: string, accessToken: string) => Promise<StaffIdentityBinding>
  apiClient: (centralActorUserId: string, binding: StaffIdentityBinding) => StaffApiClient
  redirect: (path: string) => never
}

/** Pure dependency boundary; authorization still comes only from the staff API. */
export async function resolveSupportSession(dependencies: SupportSessionDependencies): Promise<SupportSession> {
  const auth = await dependencies.authClient()
  let result: Awaited<ReturnType<typeof auth.auth.getUser>>
  try { result = await auth.auth.getUser() }
  catch { throw new SupportAuthError('support_auth_unavailable') }
  if (result.error) {
    const error = result.error as { name?: string; status?: number }
    if (error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403) dependencies.redirect('/login')
    throw new SupportAuthError('support_auth_unavailable')
  }
  const user = result.data.user
  if (!user || typeof user.id !== 'string' || !STAFF_SUBJECT_UUID.test(user.id)) dependencies.redirect('/login')
  if (user.user_metadata?.must_change_password === true) dependencies.redirect('/login/update-password')
  try {
    // getSession supplies the bearer transport only. Its cookie user is never
    // used as authority; OPS verifies that bearer at registered tenant Auth.
    let transport: Awaited<ReturnType<typeof auth.auth.getSession>>
    try { transport = await auth.auth.getSession() }
    catch { throw new SupportAuthError('support_auth_unavailable') }
    if (transport.error) {
      const error = transport.error as { name?: string; status?: number }
      if (error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403) dependencies.redirect('/login')
      throw new SupportAuthError('support_auth_unavailable')
    }
    if (!transport.data.session?.access_token) dependencies.redirect('/login')
    const binding = await dependencies.resolveIdentity(user.id, transport.data.session.access_token)
    if (binding.localAuthSubject !== user.id) throw new StaffApiError(401, 'staff_identity_binding_invalid')
    const api = dependencies.apiClient(binding.actorUserId, binding)
    // A valid Auth credential alone does not confer company membership, case
    // permissions or staff API scopes. Check the authoritative API each request.
    await api.listCases({ limit: 1 })
    return { userId: binding.actorUserId, localAuthUserId: user.id, email: user.email ?? null, api }
  } catch (error) {
    if (error instanceof StaffApiError && (error.status === 401 || error.status === 403)) dependencies.redirect('/login?reason=access_denied')
    throw error
  }
}

export async function requireSupportSession(): Promise<SupportSession> {
  return resolveSupportSession({ authClient: createSupportAuthClient,
    resolveIdentity: (subject, token) => resolveStaffIdentity(subject, token, `${readSupportAuthConfig().url}/auth/v1`),
    apiClient: (subject, binding) => createStaffApiClient(subject, { binding }), redirect })
}
