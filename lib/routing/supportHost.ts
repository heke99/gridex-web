export const GRIDEX_SUPPORT_HOST = 'support123.gridex.se'

export function normalizedHostname(host: string): string {
  return host.trim().toLowerCase().split(':')[0] ?? ''
}

export function isSupportHost(host: string): boolean {
  return normalizedHostname(host) === GRIDEX_SUPPORT_HOST
}

/** Keep authentication, APIs and assets on their original paths. */
export function supportRewritePath(host: string, pathname: string): string | null {
  if (!isSupportHost(host)) return null
  if (pathname === '/') return '/support-center'
  if (pathname === '/staff') return '/support-center/staff'
  return null
}

export function isPathWithin(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`)
}

export function isProtectedPage(pathname: string): boolean {
  return isPathWithin(pathname, '/admin') || isPathWithin(pathname, '/dashboard') ||
    isPathWithin(pathname, '/support-center') || pathname === '/mina-sidor'
}
