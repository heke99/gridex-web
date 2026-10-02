import type { SupabaseClient } from '@supabase/supabase-js'
import { buildRBACClaims } from './rbacClaims'
import type { RBACClaims } from './types'

export async function setRBACClaims(
  supabase: SupabaseClient,
  userId: string
): Promise<RBACClaims> {

  const claims = await buildRBACClaims(supabase, userId)

  // PostgREST calls run in separate transactions. A set_config call cannot
  // authorize a later request; RLS derives current grants from database rows.
  return claims
}
