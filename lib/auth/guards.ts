// lib/auth/guards.ts

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { userHasPermission } from './permissions'
import { userHasRole } from './roles'

export async function requirePermission(
  permission: string,
  fallback: 'dashboard' | 'login' = 'dashboard'
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?reason=unauthorized')
  }

  const allowed = await userHasPermission(user.id, permission)

  if (!allowed) {
    if (fallback === 'login') {
      redirect('/login?reason=forbidden')
    } else {
      redirect('/dashboard?reason=forbidden')
    }
  }

  return user
}

export async function requireRole(
  role: string,
  fallback: 'dashboard' | 'login' = 'dashboard'
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?reason=unauthorized')
  }

  const allowed = await userHasRole(user.id, role)

  if (!allowed) {
    if (fallback === 'login') {
      redirect('/login?reason=forbidden')
    } else {
      redirect('/dashboard?reason=forbidden')
    }
  }

  return user
}