export const GRIDEX_SUPPORT_HOST = 'support123.gridex.se'

export function normalizedHostname(host: string): string {
  return host.trim().toLowerCase().split(':')[0] ?? ''
}

export function isSupportHost(host: string): boolean {
  return normalizedHostname(host) === GRIDEX_SUPPORT_HOST
}

/** Only GET/HEAD may use this pass-through; extensions never grant a bypass. */
export function isPublicAssetPath(pathname: string): boolean {
  return pathname.startsWith('/_next/static/') || pathname === '/_next/image' ||
    ['/favicon.ico', '/icon.svg', '/icon.png', '/next.svg', '/vercel.svg', '/globe.svg', '/file.svg', '/window.svg',
      '/brand/gridex-logo-upload.svg', '/brand/gridex-logo.png', '/brand/gridex-logo-inverted.svg',
      '/brand/gridex-logo.svg', '/brand/gridex-mark.svg', '/brand/gridex-wordmark.webp', '/brand/gridex-og.png'].includes(pathname)
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
