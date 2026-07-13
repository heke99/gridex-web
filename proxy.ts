import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

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

function isProtectedPath(pathname: string) {
  return pathname.startsWith('/admin') || pathname.startsWith('/dashboard') || pathname === '/mina-sidor'
}

function isPreviewHost(host: string) {
  const normalized = host.toLowerCase().split(':')[0] ?? ''
  return normalized.endsWith('.vercel.app') && normalized !== PRODUCTION_HOST
}

function withPreviewNoindex(req: NextRequest, res: NextResponse) {
  const host = req.headers.get('host') ?? ''
  if (isPreviewHost(host)) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }
  return res
}

function buildLoginRedirect(req: NextRequest): NextResponse {
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
  return withPreviewNoindex(req, NextResponse.redirect(loginUrl))
}

export async function proxy(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0] ?? ''

  if (host === WWW_HOST) {
    const url = req.nextUrl.clone()
    url.hostname = PRODUCTION_HOST
    return NextResponse.redirect(url, 308)
  }

  const res = withPreviewNoindex(req, NextResponse.next())

  if (!isProtectedPath(req.nextUrl.pathname)) {
    return res
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name: string): string | undefined {
        return req.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions): void {
        res.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions): void {
        res.cookies.set({ name, value: '', ...options })
      },
    },
  })

  const { data } = await supabase.auth.getUser()
  const user = data.user

  // Dashboard kräver bara session.
  if (req.nextUrl.pathname.startsWith('/dashboard') || req.nextUrl.pathname === '/mina-sidor') {
    if (!user) return buildLoginRedirect(req)
    return res
  }

  // Admin kräver session + (legacy admin_users OR permission admin.access).
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!user) return buildLoginRedirect(req)

    // Legacy admin_users (behåll exakt).
    const { data: adminRow, error: adminErr } = await supabase
      .from('admin_users')
      .select('user_id, is_active')
      .eq('user_id', user.id)
      .maybeSingle<{ user_id: string; is_active: boolean | null }>()

    const legacyAllowed = !!adminRow && adminRow.is_active !== false && !adminErr

    // New permission system.
    const { data: hasPerm, error: permErr } = await supabase.rpc(
      'gridex_has_permission',
      { p_user_id: user.id, p_permission: 'admin.access' },
    )

    const permAllowed = !permErr && hasPerm === true

    if (!legacyAllowed && !permAllowed) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('reason', 'forbidden')
      return withPreviewNoindex(req, NextResponse.redirect(loginUrl))
    }

    return res
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)).*)',
  ],
}
