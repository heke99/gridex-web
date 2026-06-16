import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { sendOpsCustomerEvent } from '@/lib/ops/client'

function getRedirectToFromRequest(req: Request): string {
  const url = new URL(req.url)
  const redirectTo = url.searchParams.get('redirectTo') || '/login'

  if (!redirectTo.startsWith('/')) return '/login'
  if (redirectTo.startsWith('//')) return '/login'

  return redirectTo
}

async function performLogout(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    try {
      await sendOpsCustomerEvent(
        { userId: user.id, email: user.email ?? null },
        { event_type: 'customer.logout', source: 'gridex_website' }
      )
    } catch {
      // Utloggning ska inte stoppas om händelseloggning är tillfälligt otillgänglig.
    }
  }

  await supabase.auth.signOut()

  const redirectTo = getRedirectToFromRequest(req)
  return NextResponse.redirect(new URL(redirectTo, req.url))
}

export async function POST(req: Request) {
  return performLogout(req)
}
