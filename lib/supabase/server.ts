// lib/supabase/server.ts
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

function getSupabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!v) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }
  return v
}

function getSupabaseAnonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!v) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return v
}

/**
 * READ-ONLY client for Server Components
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name: string): string | undefined {
        return cookieStore.get(name)?.value
      },
      // No cookie mutations allowed in Server Components
      set(): void {},
      remove(): void {},
    },
  })
}

/**
 * READ + WRITE client for:
 * - Server Actions
 * - Route Handlers
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