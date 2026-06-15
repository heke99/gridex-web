import type { Metadata } from 'next'
import Link from 'next/link'
import { getCustomerProfile, getPortalSession } from '@/lib/customerPortal/service'
import {
  updateCustomerEmailAction,
  updateCustomerPasswordAction,
  updateCustomerProfileAction,
} from './actions'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

type Props = {
  searchParams?: Promise<{ status?: string }>
}

function statusMessage(status?: string) {
  switch (status) {
    case 'profile-updated':
      return 'Dina kontaktuppgifter har sparats.'
    case 'email-updated':
      return 'E-postadressen har uppdaterats eller behöver bekräftas via e-post.'
    case 'password-updated':
      return 'Lösenordet har uppdaterats.'
    default:
      return null
  }
}

export default async function DashboardProfilePage({ searchParams }: Props) {
  const { supabase, user } = await getPortalSession()
  const profile = await getCustomerProfile(supabase, user.id)
  const params = (await searchParams) ?? {}
  const message = statusMessage(params.status)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold">Profil och konto</h1>
        <p className="mt-2 text-sm text-white/60">
          Här kan du uppdatera kontaktuppgifter, e-postadress och lösenord. Vissa ändringar kan kräva bekräftelse eller hantering av kundservice.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100" aria-live="polite">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          action={updateCustomerProfileAction}
          className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6"
        >
          <h2 className="text-lg font-semibold">Kontaktuppgifter</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="first_name" className="text-xs text-white/60">Förnamn</label>
              <input id="first_name" name="first_name" defaultValue={profile?.first_name ?? ''} autoComplete="given-name" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30" />
            </div>

            <div className="space-y-2">
              <label htmlFor="last_name" className="text-xs text-white/60">Efternamn</label>
              <input id="last_name" name="last_name" defaultValue={profile?.last_name ?? ''} autoComplete="family-name" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30" />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className="text-xs text-white/60">Telefon</label>
            <input id="phone" name="phone" defaultValue={profile?.phone ?? ''} autoComplete="tel" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30" />
          </div>

          <div className="space-y-2">
            <label htmlFor="language_code" className="text-xs text-white/60">Språk</label>
            <select id="language_code" name="language_code" defaultValue={profile?.language_code ?? 'sv'} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30">
              <option value="sv">Svenska</option>
              <option value="en">English</option>
            </select>
          </div>

          <button className="h-11 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-100 sm:w-auto">
            Spara uppgifter
          </button>
        </form>

        <div className="space-y-6">
          <form action={updateCustomerEmailAction} className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6">
            <h2 className="text-lg font-semibold">E-postadress</h2>
            <p className="text-sm text-white/60">Vid ändring kan en bekräftelse skickas till den nya adressen.</p>
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs text-white/60">Ny e-postadress</label>
              <input id="email" name="email" type="email" autoComplete="email" defaultValue={user.email ?? profile?.email ?? ''} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30" />
            </div>
            <button className="h-11 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-100 sm:w-auto">
              Uppdatera e-post
            </button>
          </form>

          <form action={updateCustomerPasswordAction} className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Lösenord</h2>
            <p className="text-sm text-white/60">Välj ett lösenord med minst 8 tecken.</p>
            <div className="space-y-2">
              <label htmlFor="password" className="text-xs text-white/60">Nytt lösenord</label>
              <input id="password" name="password" type="password" autoComplete="new-password" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30" />
            </div>
            <button className="h-11 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-100 sm:w-auto">
              Uppdatera lösenord
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Data och rättigheter</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Du kan begära datautdrag, rättelse eller radering/avslut där det är möjligt enligt lag. Vissa uppgifter måste sparas för avtal, fakturering och bokföring.
          </p>
          <Link href="/dashboard/support" className="mt-4 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm text-white transition hover:border-cyan-500/40 hover:bg-white/5">
            Skapa ärende om personuppgifter
          </Link>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Säkerhet</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Senaste inloggning visas när den uppgiften finns tillgänglig. Kontakta kundservice om du misstänker obehörig aktivitet på kontot.
          </p>
          <Link href="/dashboard/support" className="mt-4 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm text-white transition hover:border-cyan-500/40 hover:bg-white/5">
            Rapportera misstänkt aktivitet
          </Link>
        </section>
      </div>
    </div>
  )
}
