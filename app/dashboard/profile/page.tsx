import { getCustomerProfile, getPortalSession } from '@/lib/customerPortal/service'
import {
  updateCustomerEmailAction,
  updateCustomerPasswordAction,
  updateCustomerProfileAction,
} from './actions'

export const dynamic = 'force-dynamic'

export default async function DashboardProfilePage() {
  const { supabase, user } = await getPortalSession()
  const profile = await getCustomerProfile(supabase, user.id)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Profil & konto</h1>
        <p className="mt-2 text-sm text-white/60">
          Här uppdaterar kunden egna kontaktuppgifter, e-post och lösenord. Allt går via samma Supabase-session som resten av plattformen.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={updateCustomerProfileAction} className="rounded-3xl border border-white/10 bg-black/30 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Kontaktuppgifter</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <input name="first_name" defaultValue={profile?.first_name ?? ''} placeholder="Förnamn" className="h-11 rounded-xl border border-white/10 bg-black/40 px-3" />
            <input name="last_name" defaultValue={profile?.last_name ?? ''} placeholder="Efternamn" className="h-11 rounded-xl border border-white/10 bg-black/40 px-3" />
          </div>
          <input name="phone" defaultValue={profile?.phone ?? ''} placeholder="Telefon" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3" />
          <select name="language_code" defaultValue={profile?.language_code ?? 'sv'} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3">
            <option value="sv">Svenska</option>
            <option value="en">English</option>
          </select>
          <button className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black">Spara profil</button>
        </form>

        <div className="space-y-6">
          <form action={updateCustomerEmailAction} className="rounded-3xl border border-white/10 bg-black/30 p-6 space-y-4">
            <h2 className="text-lg font-semibold">E-post</h2>
            <input name="email" type="email" defaultValue={user.email ?? profile?.email ?? ''} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3" />
            <button className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black">Uppdatera e-post</button>
          </form>

          <form action={updateCustomerPasswordAction} className="rounded-3xl border border-white/10 bg-black/30 p-6 space-y-4">
            <h2 className="text-lg font-semibold">Lösenord</h2>
            <input name="password" type="password" placeholder="Nytt lösenord" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3" />
            <button className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black">Uppdatera lösenord</button>
          </form>
        </div>
      </div>
    </div>
  )
}
