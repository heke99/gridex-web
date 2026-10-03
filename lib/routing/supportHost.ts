export const GRIDEX_SUPPORT_HOST = 'support123.gridex.se'

export function normalizedHostname(host: string): string {
  return host.trim().toLowerCase().split(':')[0] ?? ''
}

export function isSupportHost(host: string): boolean {
  return normalizedHostname(host) === GRIDEX_SUPPORT_HOST
}

/** Staff pages use their own shell and authentication; APIs keep exact paths. */
export function supportRewritePath(host: string, pathname: string): string | null {
  if (!isSupportHost(host) || isPathWithin(pathname, '/api/staff') || ['/staff', '/staff/login', '/staff/recovery', '/staff/verify'].includes(pathname)) return null
  if (pathname === '/') return '/staff'
  if (pathname === '/login/recovery') return '/staff/recovery'
  if (pathname === '/login/verify') return '/staff/verify'
  return '/staff/login'
}

export function isPathWithin(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`)
}

export function isProtectedPage(pathname: string): boolean {
  return isPathWithin(pathname, '/admin') || isPathWithin(pathname, '/dashboard') ||
    isPathWithin(pathname, '/support-center') || pathname === '/mina-sidor'
}
