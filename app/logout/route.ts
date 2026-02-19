// app/logout/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  await supabase.auth.signOut()

  const url = new URL('/login', req.url)
  return NextResponse.redirect(url)
}

export async function GET(req: Request) {
  // Tillåt GET för enkelhet (t.ex. klick från UI) men håll POST i UI om du vill.
  const supabase = await createSupabaseServerActionClient()
  await supabase.auth.signOut()

  const url = new URL('/login', req.url)
  return NextResponse.redirect(url)
}