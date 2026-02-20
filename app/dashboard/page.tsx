// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Översikt</h1>
        <p className="mt-2 text-sm text-white/60">
          Välkommen <span className="text-white/80">{user.email}</span>. Här kommer du
          se status för avtal, fakturor och notiser.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
          <div className="text-sm font-medium">Avtal</div>
          <div className="mt-1 text-xs text-white/60">
            Kommande: aktivt avtal & prisform
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
          <div className="text-sm font-medium">Fakturor</div>
          <div className="mt-1 text-xs text-white/60">
            Kommande: betalstatus & PDF
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
          <div className="text-sm font-medium">Support</div>
          <div className="mt-1 text-xs text-white/60">
            Kommande: ärenden & historik
          </div>
        </div>
      </div>
    </div>
  )
}