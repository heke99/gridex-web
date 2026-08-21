import { connection } from 'next/server'
import PublicHeader from '@/components/layout/PublicHeader'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function PublicHeaderAuth() {
  // Keep marketing routes statically renderable while resolving cookie-backed auth
  // only for the actual request. This avoids turning the whole public site into a
  // build-time Supabase dependency.
  await connection()

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <PublicHeader authenticatedEmail={null} />
  }

  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      console.warn('[public header] auth state unavailable')
      return <PublicHeader authenticatedEmail={null} />
    }

    return <PublicHeader authenticatedEmail={user?.email ?? null} />
  } catch {
    console.warn('[public header] auth state unavailable')
    return <PublicHeader authenticatedEmail={null} />
  }
}
