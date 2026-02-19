'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function safeNext(next?: string | null) {
  if (!next) return '/admin'
  // Tillåt endast interna paths
  if (!next.startsWith('/')) return '/admin'
  if (next.startsWith('//')) return '/admin'
  return next
}

export async function loginWithPassword(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const next = safeNext(String(formData.get('next') || '') || '/admin')

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Undvik att läcka för mycket info – men ge användbar feedback.
    redirect(`/login?error=${encodeURIComponent('Fel e-post eller lösenord')}&next=${encodeURIComponent(next)}`)
  }

  redirect(next)
}