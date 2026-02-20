// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

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

function buildLoginRedirect(req: NextRequest): NextResponse {
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

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

  // Dashboard kräver bara session
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    if (!user) return buildLoginRedirect(req)
    return res
  }

  // Admin kräver session + admin_users
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!user) return buildLoginRedirect(req)

    const { data: adminRow, error: adminErr } = await supabase
      .from('admin_users')
      .select('user_id, is_active')
      .eq('user_id', user.id)
      .maybeSingle<{ user_id: string; is_active: boolean | null }>()

    if (adminErr || !adminRow || adminRow.is_active === false) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('reason', 'forbidden')
      return NextResponse.redirect(loginUrl)
    }

    return res
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*'],
}