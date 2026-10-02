import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isPathWithin, isProtectedPage, isSupportHost, supportRewritePath } from '@/lib/routing/supportHost'

const PRODUCTION_HOST = 'gridex.se'
const WWW_HOST = 'www.gridex.se'

function getSupabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!v) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  return v
}

function getSupabaseAnonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!v) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return v
}

function isPreviewHost(host: string) {
  const normalized = host.toLowerCase().split(':')[0] ?? ''
  return normalized.endsWith('.vercel.app') && normalized !== PRODUCTION_HOST
}

function withPreviewNoindex(req: NextRequest, res: NextResponse) {
  const host = req.headers.get('host') ?? ''
  if (isPreviewHost(host) || isSupportHost(host)) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }
  return res
}

function buildLoginRedirect(req: NextRequest, source: NextResponse): NextResponse {
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
  const redirect = withPreviewNoindex(req, NextResponse.redirect(loginUrl))
  redirect.headers.set('Cache-Control', 'private, no-store')
  for (const cookie of source.cookies.getAll()) redirect.cookies.set(cookie)
  return redirect
}

export async function proxy(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0] ?? ''

  if (host === WWW_HOST) {
    const url = req.nextUrl.clone()
    url.hostname = PRODUCTION_HOST
    return NextResponse.redirect(url, 308)
  }

  const rewrittenPath = supportRewritePath(host, req.nextUrl.pathname)
  const effectivePath = rewrittenPath ?? req.nextUrl.pathname
  const rewriteUrl = req.nextUrl.clone()
  rewriteUrl.pathname = effectivePath
  const createResponse = () => withPreviewNoindex(req, rewrittenPath
    ? NextResponse.rewrite(rewriteUrl, { request: { headers: req.headers } })
    : NextResponse.next({ request: { headers: req.headers } }))
  let res = createResponse()

  if (!isProtectedPage(effectivePath)) {
    return res
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        const previousCookies = res.cookies.getAll()
        for (const { name, value } of cookiesToSet) {
          req.cookies.set(name, value)
        }
        res = createResponse()
        for (const cookie of previousCookies) res.cookies.set(cookie)
        for (const { name, value, options } of cookiesToSet) res.cookies.set(name, value, options)
      },
    },
  })

  const { data } = await supabase.auth.getUser()
  const user = data.user

  // Dashboard kräver bara session.
  if (isPathWithin(effectivePath, '/dashboard') || isPathWithin(effectivePath, '/support-center') || effectivePath === '/mina-sidor') {
    if (!user) return buildLoginRedirect(req, res)
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  }

  // Admin permissions are checked by the server layout and operation guards.
  if (isPathWithin(effectivePath, '/admin')) {
    if (!user) return buildLoginRedirect(req, res)
    // The server layout and each mutation enforce current, scoped permissions.
    // Avoid a second broad or stale permission gate in the routing layer.
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)).*)',
  ],
}
