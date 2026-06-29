// app/api/me/permissions/route.ts

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { loadUserPermissions } from '@/lib/auth/permissions'

export async function GET() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ permissions: [] })
  }

  const permissions = await loadUserPermissions(user.id)

  return NextResponse.json({ permissions })
}