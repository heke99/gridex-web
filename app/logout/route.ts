// app/logout/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'

function getRedirectToFromRequest(req: Request): string {
  const url = new URL(req.url)
  // tillåter ?redirectTo=/login eller form field i future,
  // men defaultar alltid till /login
  const redirectTo = url.searchParams.get('redirectTo') || '/login'
  if (!redirectTo.startsWith('/')) return '/login'
  if (redirectTo.startsWith('//')) return '/login'
  return redirectTo
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  await supabase.auth.signOut()

  const redirectTo = getRedirectToFromRequest(req)
  return NextResponse.redirect(new URL(redirectTo, req.url))
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  await supabase.auth.signOut()

  const redirectTo = getRedirectToFromRequest(req)
  return NextResponse.redirect(new URL(redirectTo, req.url))
}