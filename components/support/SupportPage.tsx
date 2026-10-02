import { redirect } from 'next/navigation'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { createSupabaseServerClient, getSupabaseUser } from '@/lib/supabase/server'
import { fetchOpsCustomerSupportTickets } from '@/lib/ops/client/support'
import SupportWorkspace from './SupportWorkspace'
import type { SupportListResponse } from '@/lib/support/types'

export default async function SupportPage({ loginNext }: { loginNext: string }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await getSupabaseUser(supabase)
  if (authError || !user) redirect(`/login?next=${encodeURIComponent(loginNext)}`)
  let initial: SupportListResponse | null = null
  let initialError: string | null = null
  try {
    initial = await fetchOpsCustomerSupportTickets(await getOpsPortalIdentityForUser(supabase, user), { limit: 20 })
  } catch (error) {
    console.error('[support] Initial case list unavailable', { code: error instanceof Error && 'code' in error ? error.code : 'unknown' })
    initialError = 'Dina ärenden kunde inte hämtas just nu. Uppdatera ärendelistan för att försöka igen eller kontakta support@gridex.se.'
  }
  return <SupportWorkspace key={user.id} initial={initial} initialError={initialError} />
}
