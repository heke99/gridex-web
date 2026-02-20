// app/login/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'

function safeNext(next?: string | null): string {
  if (!next) return '/admin'
  const n = String(next)
  if (!n.startsWith('/')) return '/admin'
  if (n.startsWith('//')) return '/admin'
  return n
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export async function loginWithPassword(formData: FormData) {
  const email = normalizeEmail(String(formData.get('email') || ''))
  const password = String(formData.get('password') || '')
  const next = safeNext(String(formData.get('next') || '') || '/admin')

  if (!email || !looksLikeEmail(email) || !password) {
    redirect(
      `/login?error=${encodeURIComponent('Fel e-post eller lösenord')}&next=${encodeURIComponent(
        next
      )}`
    )
  }

  const supabase = await createSupabaseServerActionClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent('Fel e-post eller lösenord')}&next=${encodeURIComponent(
        next
      )}`
    )
  }

  // Enterprise-guard: om man försöker gå till /admin, kontrollera RBAC direkt.
  if (next.startsWith('/admin')) {
    const { data: u } = await supabase.auth.getUser()
    if (!u?.user) {
      await supabase.auth.signOut()
      redirect(`/login?reason=${encodeURIComponent('forbidden')}`)
    }

    const { data: adminRow, error: adminErr } = await supabase
      .from('admin_users')
      .select('user_id, is_active')
      .eq('user_id', u.user.id)
      .maybeSingle<{ user_id: string; is_active: boolean | null }>()

    if (adminErr || !adminRow || adminRow.is_active === false) {
      await supabase.auth.signOut()
      redirect(`/login?reason=${encodeURIComponent('forbidden')}`)
    }
  }

  redirect(next)
}