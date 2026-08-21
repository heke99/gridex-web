import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { syncConfirmedUserProfileDurably } from '@/lib/customerPortal/authProfileSync'
import { resumePortalOnboardingForConfirmedUserSafely } from '@/lib/customerPortal/onboardingResume'
import { safeRedirectPath } from '@/lib/auth/safeRedirectPath'

const ALLOWED_TYPES = new Set<EmailOtpType>([
  'email',
  'recovery',
  'invite',
  'email_change',
])

function fallbackForType(type: EmailOtpType): string {
  switch (type) {
    case 'recovery':
      return '/login/reset-password'
    case 'invite':
      return '/login/reset-password'
    case 'email_change':
      return '/dashboard/profile?status=email-updated'
    case 'email':
    default:
      return '/login?status=verified'
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const tokenHash = searchParams.get('token_hash')
  const typeParam = searchParams.get('type')

  if (!tokenHash || !typeParam || !ALLOWED_TYPES.has(typeParam as EmailOtpType)) {
    return NextResponse.redirect(
      new URL('/login?error=Ogiltig%20eller%20utg%C3%A5ngen%20l%C3%A4nk', origin)
    )
  }

  const type = typeParam as EmailOtpType
  const next = safeRedirectPath(searchParams.get('next'), fallbackForType(type))
  const supabase = await createSupabaseServerActionClient()

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  })

  if (error) {
    const target =
      type === 'recovery'
        ? '/login/forgot-password?error=L%C3%A4nken%20%C3%A4r%20ogiltig%20eller%20har%20g%C3%A5tt%20ut'
        : '/login?error=L%C3%A4nken%20%C3%A4r%20ogiltig%20eller%20har%20g%C3%A5tt%20ut'

    return NextResponse.redirect(new URL(target, origin))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let portalLinkPending = false
  if (user?.id) {
    const email = user.email?.trim().toLowerCase() ?? null
    const profileSync = await syncConfirmedUserProfileDurably({
      userId: user.id,
      email,
      type,
    })
    if (!profileSync.completed) {
      portalLinkPending = true
      console.warn('[auth confirm] durable profile sync queued', profileSync.error)
    }

    try {
      const resumed = await resumePortalOnboardingForConfirmedUserSafely({ userId: user.id, email })
      if (resumed.processed > resumed.completed || resumed.blocked > 0) portalLinkPending = true
    } catch (error) {
      portalLinkPending = true
      console.warn('[auth confirm] portal onboarding resume queued', error)
    }
  }

  const target = new URL(next, origin)
  if (portalLinkPending) target.searchParams.set('portal_link', 'pending')
  return NextResponse.redirect(target)
}
