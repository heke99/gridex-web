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
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold">Profil och konto</h1>
        <p className="mt-2 text-sm text-white/60">
          Här kan du uppdatera dina kontaktuppgifter, din e-postadress och ditt lösenord.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          action={updateCustomerProfileAction}
          className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6"
        >
          <h2 className="text-lg font-semibold">Kontaktuppgifter</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs text-white/60">Förnamn</label>
              <input
                name="first_name"
                defaultValue={profile?.first_name ?? ''}
                placeholder="Förnamn"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-white/60">Efternamn</label>
              <input
                name="last_name"
                defaultValue={profile?.last_name ?? ''}
                placeholder="Efternamn"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white/60">Telefon</label>
            <input
              name="phone"
              defaultValue={profile?.phone ?? ''}
              placeholder="Telefon"
              className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white/60">Språk</label>
            <select
              name="language_code"
              defaultValue={profile?.language_code ?? 'sv'}
              className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3"
            >
              <option value="sv">Svenska</option>
              <option value="en">English</option>
            </select>
          </div>

          <button className="h-11 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black sm:w-auto">
            Spara uppgifter
          </button>
        </form>

        <div className="space-y-6">
          <form
            action={updateCustomerEmailAction}
            className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6"
          >
            <h2 className="text-lg font-semibold">E-postadress</h2>

            <div className="space-y-2">
              <label className="text-xs text-white/60">Ny e-postadress</label>
              <input
                name="email"
                type="email"
                defaultValue={user.email ?? profile?.email ?? ''}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3"
              />
            </div>

            <button className="h-11 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black sm:w-auto">
              Uppdatera e-post
            </button>
          </form>

          <form
            action={updateCustomerPasswordAction}
            className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6"
          >
            <h2 className="text-lg font-semibold">Lösenord</h2>

            <div className="space-y-2">
              <label className="text-xs text-white/60">Nytt lösenord</label>
              <input
                name="password"
                type="password"
                placeholder="Nytt lösenord"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3"
              />
            </div>

            <button className="h-11 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black sm:w-auto">
              Uppdatera lösenord
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}