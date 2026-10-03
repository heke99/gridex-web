// lib/supabase/server.ts
import { cookies } from 'next/headers'
import { cache } from 'react'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireCustomerAuthHost } from '@/lib/auth/customerHostBoundary'

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
 * Next 15 forbids cookie mutation here.
 * Enterprise: guarantees anon context for public pages while still supporting session cookies when present.
 */
export const createSupabaseServerClient = cache(async (): Promise<SupabaseClient> => {
  await requireCustomerAuthHost()
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

/**
 * Share verified authentication between layouts and pages in one React server
 * render. React discards this cache for the next request, so sessions are never
 * reused across customers. Mutable action clients deliberately remain uncached.
 */
const verifySupabaseUser = cache((supabase: SupabaseClient) => supabase.auth.getUser())

export async function getSupabaseUser(suppliedClient?: SupabaseClient) {
  const supabase = suppliedClient ?? await createSupabaseServerClient()
  return verifySupabaseUser(supabase)
}

/**
 * READ + WRITE for Server Actions & Route Handlers.
 * Use this when calling auth signIn/signOut server-side.
 */
export async function createSupabaseServerActionClient(): Promise<SupabaseClient> {
  await requireCustomerAuthHost()
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
