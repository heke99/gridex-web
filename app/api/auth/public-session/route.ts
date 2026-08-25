import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function sessionResponse(authenticatedEmail: string | null) {
  return NextResponse.json(
    { authenticatedEmail },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        Vary: 'Cookie',
      },
    },
  )
}

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return sessionResponse(null)
  }

  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) return sessionResponse(null)
    return sessionResponse(user?.email ?? null)
  } catch {
    return sessionResponse(null)
  }
}
