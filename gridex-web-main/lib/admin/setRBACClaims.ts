import type { SupabaseClient } from '@supabase/supabase-js'
import { buildRBACClaims } from './rbacClaims'
import type { RBACClaims } from './types'

export async function setRBACClaims(
  supabase: SupabaseClient,
  userId: string
): Promise<RBACClaims> {

  const claims = await buildRBACClaims(supabase, userId)

  await supabase.rpc('set_config', {
    key: 'request.jwt.claims',
    value: JSON.stringify({
      roles: claims.roles,
      permissions: claims.permissions,
      isAdmin: claims.isAdmin,
    }),
  })

  return claims
}