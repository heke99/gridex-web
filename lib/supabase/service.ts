import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

function serviceClient(): SupabaseClient {
  if (cachedClient) return cachedClient
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase service client is not configured for this runtime request.')
  }
  cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedClient
}

/** Lazily resolves secrets on first runtime use, never during module import/build discovery. */
export const supabaseService = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = serviceClient()
    const value = Reflect.get(client, property, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
