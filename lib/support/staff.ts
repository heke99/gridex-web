import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
import { normalizePermissions } from '@/lib/admin/access'

export async function loadGlobalSupportPermissions(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data: { user }, error } = await getSupabaseUser(supabase)
  if (error || !user || user.id !== userId) return []
  const result = await supabaseService.rpc('gridex_get_user_permissions', { p_user_id: userId, p_company_id: null })
  if (result.error) return []
  return normalizePermissions(result.data)
}

export function opsStaffSupportUrl(): string {
  const configured = process.env.GRIDEX_OPS_STAFF_SUPPORT_URL?.trim()
  if (configured) {
    try {
      const url = new URL(configured)
      if (url.protocol === 'https:' && !url.username && !url.password) return url.toString()
    } catch { /* use the configured public OPS application default */ }
  }
  return 'https://app.gridex.se/admin/customer-cases'
}
