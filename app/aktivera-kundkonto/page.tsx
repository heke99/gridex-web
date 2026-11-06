import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import CustomerPortalLinkForm from '@/components/customer/CustomerPortalLinkForm'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCustomerProfile } from '@/lib/customerPortal/service'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Koppla kundkonto | Gridex', robots: { index: false, follow: false } }

export default async function ActivateCustomerPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?next=%2Faktivera-kundkonto')
  const profile = await getCustomerProfile(supabase, user.id, user)
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0B0F17] p-7">
        <Link href="/" className="text-sm text-cyan-300">Gridex</Link>
        <h1 className="mt-5 text-2xl font-semibold">Koppla ditt kundkonto</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">Ange kundnumret från din avtalsbekräftelse. Använd samma e-postadress som på avtalet.</p>
        <p className="mt-3 text-sm text-white/80">Inloggad som {user.email}</p>
        {user.email_confirmed_at ? <CustomerPortalLinkForm customerNumber={profile?.customer_number} /> :
          <p role="alert" className="mt-5 text-sm text-amber-200">Bekräfta din e-postadress innan du kopplar kundkontot.</p>}
        <Link href="/mina-sidor" className="mt-6 block text-center text-sm text-cyan-300 underline">Till Mina sidor</Link>
      </section>
    </main>
  )
}
