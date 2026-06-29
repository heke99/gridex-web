// app/layout/header.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import HeaderClient from '@/components/layout/HeaderClient'

export const dynamic = 'force-dynamic'

type Role =
  | 'admin'
  | 'support'
  | 'partner'
  | 'customer'

export default async function Header() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let roles: Role[] = []

  if (user) {
    const { data } = await supabase
      .from('user_roles')
      .select('role,is_active')
      .eq('user_id', user.id)

    if (data) {
      roles = data
        .filter((r) => r.is_active !== false)
        .map((r) => r.role as Role)
    }
  }

  return (
    <HeaderClient
      userEmail={user?.email ?? null}
      roles={roles}
    />
  )
}