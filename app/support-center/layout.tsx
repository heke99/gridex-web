import Link from 'next/link'
import type { Metadata } from 'next'
import { createSupabaseServerClient, getSupabaseUser } from '@/lib/supabase/server'
import { loadGlobalSupportPermissions } from '@/lib/support/staff'
export const metadata: Metadata = { title: 'Gridex kundservice', robots: { index: false, follow: false } }
export default async function SupportCenterLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await getSupabaseUser(supabase)
  const permissions = user && !error ? await loadGlobalSupportPermissions(supabase, user.id) : []
  const canUseStaff = permissions.includes('support_tickets.read')
  return <div className="min-h-screen bg-slate-950 text-white"><header className="border-b border-white/10 bg-slate-950/90"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5"><Link href="/support-center" className="text-lg font-semibold">Gridex <span className="font-normal text-white/55">kundservice</span></Link><nav aria-label="Supportnavigation" className="flex gap-5 text-sm text-white/65"><Link href="/dashboard" className="hover:text-white">Mina sidor</Link>{canUseStaff ? <Link href="/support-center/staff" className="hover:text-white">Personal</Link> : null}<a href="mailto:support@gridex.se" className="hover:text-white">E-post</a></nav></div></header><div className="mx-auto max-w-7xl px-5 py-8">{children}</div></div>
}
