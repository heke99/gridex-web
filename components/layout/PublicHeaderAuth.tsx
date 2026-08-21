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

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return <PublicHeader authenticatedEmail={user?.email ?? null} />
}
