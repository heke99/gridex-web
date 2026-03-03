import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function requireAdminServer() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase.rpc(
    'gridex_has_permission',
    {
      p_user_id: user.id,
      p_permission: 'admin.access',
    }
  )

  if (error || data !== true) {
    throw new Error('Forbidden')
  }

  return { id: user.id }
}