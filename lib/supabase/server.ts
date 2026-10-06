// lib/supabase/server.ts
import { cookies } from 'next/headers'
import { cache } from 'react'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

function getSupabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!v) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  return v
}

function getSupabaseAnonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!v) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return v
}

/**
 * READ-ONLY for Server Components (pages/layouts).
 * Share the cookie-backed client only within one React server render.
 * React.cache is request scoped; route handlers/actions get a fresh client.
 */
export const createSupabaseServerClient = cache(async (): Promise<SupabaseClient> => {
  const cookieStore = await cookies()

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name: string): string | undefined {
        return cookieStore.get(name)?.value
      },
      // No-op in Server Components
      set(): void {},
      remove(): void {},
    },
  })
})

/** Verify with Auth once per client/server render; never trust an unverified session. */
export const getVerifiedServerUser = cache(async (supabase: SupabaseClient) => {
  return supabase.auth.getUser()
})

/**
 * READ + WRITE for Server Actions & Route Handlers.
 * Use this when calling auth signIn/signOut server-side.
 */
export async function createSupabaseServerActionClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name: string): string | undefined {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions): void {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions): void {
        cookieStore.set({ name, value: '', ...options })
      },
    },
  })
}
