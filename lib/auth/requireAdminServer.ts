import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function requireAdminServer() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data } = await supabase
    .from('user_roles')
    .select('role,is_active')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .eq('is_active', true)
    .single()

  if (!data) {
    throw new Error('Forbidden')
  }

  return { id: user.id }
}