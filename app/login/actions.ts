'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { safeRedirectPath } from '@/lib/auth/safeRedirectPath'
import { resumePortalOnboardingForConfirmedUserSafely } from '@/lib/customerPortal/onboardingResume'

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

type RoleRow = {
  role: string
  is_active: boolean | null
}

function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'super_admin'
}

async function logCustomerLogin(supabase: Awaited<ReturnType<typeof createSupabaseServerActionClient>>) {
  try {
    const { error } = await supabase.rpc('gridex_my_log_login_v1')
    if (error) throw error
  } catch (error) {
    console.error('[loginWithPassword] gridex_log_customer_login failed', error)
  }
}

async function resumeCustomerPortal(user: { id: string; email?: string | null }) {
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
    console.error('[loginWithPassword] portal onboarding resume failed', error)
  }
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
    const status = signInError.status
    const temporary = status === 0 || status === 429 || (status !== undefined && status >= 500)
    const message = temporary
      ? 'Inloggningen är tillfälligt otillgänglig. Försök igen om en stund.'
      : 'Fel e-post eller lösenord'
    redirect(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`)
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    await supabase.auth.signOut()
    const message = 'Kunde inte verifiera sessionen. Försök logga in igen.'
    redirect(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`)
  }

  const adminDestination = next.startsWith('/admin')
  let isAdmin = false
  if (adminDestination || next === '/dashboard') {
    const [permissionsResult, rolesResult] = await Promise.allSettled([
      supabase.rpc('gridex_my_permissions_v1'),
      supabase
        .from('user_roles')
        .select('role,is_active')
        .eq('user_id', user.id)
        .returns<RoleRow[]>(),
    ])

    const permissionsData =
      permissionsResult.status === 'fulfilled' && !permissionsResult.value.error
        ? permissionsResult.value.data
        : []
    const rolesData =
      rolesResult.status === 'fulfilled' && !rolesResult.value.error
        ? rolesResult.value.data
        : []

    if (
      adminDestination &&
      ((permissionsResult.status === 'fulfilled' && permissionsResult.value.error) ||
        (rolesResult.status === 'fulfilled' && rolesResult.value.error) ||
        permissionsResult.status === 'rejected' ||
        rolesResult.status === 'rejected')
    ) {
      await supabase.auth.signOut()
      redirect(`/login?error=${encodeURIComponent('Kunde inte verifiera adminbehörighet')}`)
    }

    const permissions = Array.isArray(permissionsData)
      ? permissionsData.filter((v): v is string => typeof v === 'string')
      : []

    const roles = Array.isArray(rolesData)
      ? rolesData.filter((row) => row.is_active !== false && typeof row.role === 'string').map((row) => row.role)
      : []

    isAdmin = permissions.includes('admin.access') || roles.some((role) => isAdminRole(role))
  }

  await Promise.all([
    logCustomerLogin(supabase),
    resumeCustomerPortal(user),
  ])

  if (adminDestination && !isAdmin) {
    await supabase.auth.signOut()
    redirect(`/login?reason=${encodeURIComponent('forbidden')}`)
  }

  if (next === '/dashboard' && isAdmin) {
    redirect('/admin')
  }

  redirect(next)
}
