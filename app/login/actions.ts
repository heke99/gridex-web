'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { safeRedirectPath } from '@/lib/auth/safeRedirectPath'
import { loadUserPermissionsWithClient } from '@/lib/auth/permissions'
import { canEnterAdminConsole } from '@/lib/admin/access'
import { resumePortalOnboardingForConfirmedUserSafely } from '@/lib/customerPortal/onboardingResume'

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export async function loginWithPassword(formData: FormData) {
  const email = normalizeEmail(String(formData.get('email') || ''))
  const password = String(formData.get('password') || '')
  const next = safeRedirectPath(String(formData.get('next') || ''), '/mina-sidor')

  if (!email || !looksLikeEmail(email) || !password) {
    redirect(
      `/login?error=${encodeURIComponent('Fel e-post eller lösenord')}&next=${encodeURIComponent(next)}`
    )
  }

  const supabase = await createSupabaseServerActionClient()

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError) {
    redirect(
      `/login?error=${encodeURIComponent('Fel e-post eller lösenord')}&next=${encodeURIComponent(next)}`
    )
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    await supabase.auth.signOut()
    redirect(`/login?error=${encodeURIComponent('Kunde inte verifiera sessionen')}`)
  }

  let permissions: string[] = []
  try {
    permissions = await loadUserPermissionsWithClient(supabase, user.id)
  } catch {
    if (next.startsWith('/admin')) {
      await supabase.auth.signOut()
      redirect(`/login?error=${encodeURIComponent('Kunde inte verifiera adminbehörighet')}`)
    }
  }
  const isAdmin = canEnterAdminConsole(permissions)

  try {
    await supabase.rpc('gridex_log_customer_login', { p_user_id: user.id })
  } catch (error) {
    console.error('[loginWithPassword] gridex_log_customer_login failed', error)
  }

  try {
    const onboarding = await resumePortalOnboardingForConfirmedUserSafely({
      userId: user.id,
      email: user.email ?? null,
    })
    if (onboarding.blocked > 0) {
      console.warn('[loginWithPassword] portal onboarding requires stable identity review', {
        blocked: onboarding.blocked,
      })
    }
  } catch (error) {
    // Portal reconciliation must never make an otherwise valid login fail.
    console.error('[loginWithPassword] portal onboarding resume failed', error)
  }

  if (next.startsWith('/admin') && !isAdmin) {
    await supabase.auth.signOut()
    redirect(`/login?reason=${encodeURIComponent('forbidden')}`)
  }

  if (next === '/dashboard' && isAdmin) {
    redirect('/admin')
  }

  redirect(next)
}
