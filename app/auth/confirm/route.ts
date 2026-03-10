import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

const ALLOWED_TYPES = new Set<EmailOtpType>([
  'email',
  'recovery',
  'invite',
  'email_change',
])

function safeNext(value: string | null, fallback: string): string {
  if (!value) return fallback

  const normalized = value.trim()

  if (!normalized.startsWith('/')) return fallback
  if (normalized.startsWith('//')) return fallback

  return normalized
}

function fallbackForType(type: EmailOtpType): string {
  switch (type) {
    case 'recovery':
      return '/login/reset-password'
    case 'invite':
      return '/login?status=invited'
    case 'email_change':
      return '/dashboard/profile?status=email-updated'
    case 'email':
    default:
      return '/login?status=verified'
  }
}

async function syncConfirmedUserProfile(params: {
  userId: string
  email: string | null
  type: EmailOtpType
}) {
  const { userId, email, type } = params
  const now = new Date().toISOString()

  const customerProfilePatch: Record<string, unknown> = {
    user_id: userId,
    email,
    email_verified_at: now,
  }

  if (type === 'email' || type === 'invite') {
    customerProfilePatch.onboarding_state = 'verified'
  }

  await Promise.allSettled([
    supabaseService.from('customer_profiles').upsert(customerProfilePatch, {
      onConflict: 'user_id',
    }),

    supabaseService.from('user_profiles').upsert(
      {
        id: userId,
        user_id: userId,
        email,
      },
      { onConflict: 'id' }
    ),
  ])
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
  const next = safeNext(searchParams.get('next'), fallbackForType(type))
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

  if (user?.id) {
    await syncConfirmedUserProfile({
      userId: user.id,
      email: user.email?.trim().toLowerCase() ?? null,
      type,
    })
  }

  return NextResponse.redirect(new URL(next, origin))
}