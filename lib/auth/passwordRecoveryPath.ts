import { safeRedirectPath } from './safeRedirectPath'

export function passwordRecoveryPath(
  path: '/login' | '/login/forgot-password' | '/login/reset-password',
  next: string | null,
  params: Record<string, string> = {},
): string {
  const query = new URLSearchParams(params)
  query.set('next', safeRedirectPath(next))
  return `${path}?${query}`
}
