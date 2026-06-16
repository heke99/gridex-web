'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { sendOpsCustomerEvent } from '@/lib/ops/client'

function safeNext(next?: string | null): string {
  if (!next) return '/mina-sidor'

  const normalized = String(next).trim()

  if (!normalized.startsWith('/')) return '/mina-sidor'
  if (normalized.startsWith('//')) return '/mina-sidor'

  return normalized
}

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

export async function loginWithPassword(formData: FormData) {
  const email = normalizeEmail(String(formData.get('email') || ''))
  const password = String(formData.get('password') || '')
  const next = safeNext(String(formData.get('next') || '') || '/mina-sidor')

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

  const [permissionsResult, rolesResult] = await Promise.allSettled([
    supabase.rpc('gridex_get_user_permissions', { p_user_id: user.id }),
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
    next.startsWith('/admin') &&
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

  const isAdmin = permissions.includes('admin.access') || roles.some((role) => isAdminRole(role))

  try {
    await supabase.rpc('gridex_log_customer_login', { p_user_id: user.id })
  } catch (error) {
    console.error('[loginWithPassword] gridex_log_customer_login failed', error)
  }

  try {
    await sendOpsCustomerEvent(
      { userId: user.id, email: user.email ?? email },
      {
        event_type: 'customer.login',
        source: 'gridex_website',
        metadata: { next },
      }
    )
  } catch {
    // Inloggning ska inte stoppas om händelseloggning är tillfälligt otillgänglig.
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