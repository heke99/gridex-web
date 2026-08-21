import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { resumePortalOnboardingFromResultProof } from '@/lib/customerPortal/portalClaim'
import { isWebsiteApplicationResultTokenShape } from '@/lib/website/applicationResultStore'

function loginRedirect(request: NextRequest, resultToken: string): NextResponse {
  const claimPath = `/auth/portal-claim?result=${encodeURIComponent(resultToken)}`
  const url = new URL('/login', request.url)
  url.searchParams.set('status', 'portal-link-required')
  url.searchParams.set('next', claimPath)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const resultToken = request.nextUrl.searchParams.get('result')?.trim() ?? ''
  if (!isWebsiteApplicationResultTokenShape(resultToken)) {
    return NextResponse.redirect(new URL('/login?error=Kunde%20inte%20verifiera%20teckningen', request.url))
  }

  const supabase = await createSupabaseServerActionClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return loginRedirect(request, resultToken)

  try {
    const claim = await resumePortalOnboardingFromResultProof({
      userId: user.id,
      email: user.email ?? null,
      resultToken,
    })

    const target = new URL('/mina-sidor', request.url)
    if (claim.status === 'linked') target.searchParams.set('portal_link', 'completed')
    else if (claim.status === 'pending') target.searchParams.set('portal_link', 'pending')
    else if (claim.status === 'blocked') target.searchParams.set('portal_link', 'review')
    else target.searchParams.set('portal_link', 'invalid')
    return NextResponse.redirect(target)
  } catch (error) {
    console.error('[portal claim route] claim failed', error)
    return NextResponse.redirect(new URL('/mina-sidor?portal_link=pending', request.url))
  }
}
