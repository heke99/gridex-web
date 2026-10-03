import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isPathWithin, isProtectedPage, isPublicAssetPath, isSupportHost, supportRewritePath } from '@/lib/routing/supportHost'

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
  const requestHeaders = new Headers(req.headers)
  // No caller can select a staff shell or claim authenticated routing state.
  for (const key of [...requestHeaders.keys()]) {
    if (/^x-(?:gridex-)?(?:staff|support)-(?:host|mode|route|authenticated)$/.test(key)) requestHeaders.delete(key)
  }

  // Staff pages and BFFs never enter Web's customer Auth/session path. Block
  // server-action POSTs before they could select a customer login action.
  if (isSupportHost(host)) {
    if (!['GET', 'HEAD'].includes(req.method) && !isPathWithin(req.nextUrl.pathname, '/api/staff')) {
      return withPreviewNoindex(req, NextResponse.json({ error: { code: 'staff_route_forbidden',
        message: 'Använd personalportalens inloggning.', retryable: false } }, {
        status: 403, headers: { 'Cache-Control': 'private, no-store' },
      }))
    }
    if (['GET', 'HEAD'].includes(req.method) && isPublicAssetPath(req.nextUrl.pathname)) {
      return withPreviewNoindex(req, NextResponse.next({ request: { headers: requestHeaders } }))
    }
    const rewrittenPath = supportRewritePath(host, req.nextUrl.pathname)
    const url = req.nextUrl.clone()
    if (rewrittenPath) { url.pathname = rewrittenPath; url.search = '' }
    const response = withPreviewNoindex(req, rewrittenPath
      ? NextResponse.rewrite(url, { request: { headers: requestHeaders } })
      : NextResponse.next({ request: { headers: requestHeaders } }))
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }
  if (isPathWithin(req.nextUrl.pathname, '/staff') || isPathWithin(req.nextUrl.pathname, '/api/staff')) {
    return NextResponse.json({ error: { code: 'staff_host_required', message: 'Personalportalen finns på supportdomänen.', retryable: false } }, {
      status: 404, headers: { 'Cache-Control': 'private, no-store' },
    })
  }

  if (host === WWW_HOST) {
    const url = req.nextUrl.clone()
    url.hostname = PRODUCTION_HOST
    return NextResponse.redirect(url, 308)
  }

  const effectivePath = req.nextUrl.pathname
  const createResponse = () => withPreviewNoindex(req,
    NextResponse.next({ request: { headers: requestHeaders } }))
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
  // Server Actions can be selected on an extension-looking or missing asset
  // path. Every path/method must pass the host mutation boundary first.
  matcher: ['/:path*'],
}
