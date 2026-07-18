// lib/supabase/client.ts
'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let resolvedBrowserClient: SupabaseClient | null = null
let lazyBrowserClient: SupabaseClient | null = null

function resolveBrowserClient(): SupabaseClient {
  if (resolvedBrowserClient) return resolvedBrowserClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) throw new Error('Supabase browser client is not configured.')
  resolvedBrowserClient = createBrowserClient(url, key)
  return resolvedBrowserClient
}

export function createSupabaseBrowserClient(): SupabaseClient {
  if (lazyBrowserClient) return lazyBrowserClient
  lazyBrowserClient = new Proxy({} as SupabaseClient, {
    get(_target, property) {
      const client = resolveBrowserClient()
      const value = Reflect.get(client, property, client)
      return typeof value === 'function' ? value.bind(client) : value
    },
  })
  return lazyBrowserClient
}
