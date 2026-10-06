import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function requireAdminServer() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw new Error(userError.message)
  }

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase.rpc('gridex_my_has_permission_v1', {
    p_permission: 'admin.access',
  })

  if (error) {
    throw new Error(error.message)
  }

  if (data !== true) {
    throw new Error('Forbidden')
  }

  return {
    id: user.id,
    email: user.email ?? null,
  }
}