//app/login/page.tsx
import Link from 'next/link'
import { loginWithPassword } from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readParam(v: string | string[] | undefined): string {
  if (!v) return ''
  return Array.isArray(v) ? (v[0] ?? '') : v
}

function safeNext(next: string): string {
  if (!next) return '/mina-sidor'
  if (!next.startsWith('/')) return '/mina-sidor'
  if (next.startsWith('//')) return '/mina-sidor'
  return next
}

export default async function LoginPage({ searchParams }: Props) {
  const sp = (await searchParams) || {}

  const error = readParam(sp.error)
  const reason = readParam(sp.reason)
  const status = readParam(sp.status)
  const next = safeNext(readParam(sp.next) || '/mina-sidor')

  let banner = ''

  if (reason === 'forbidden') {
    banner = 'Du har inte tillgång till den sidan.'
  } else if (status === 'verified') {
    banner = 'Din e-post är verifierad. Du kan nu logga in.'
  } else if (status === 'registered') {
    banner = 'Kontot är skapat. Kontrollera din e-post för att verifiera kontot.'
  } else if (status === 'reset-sent') {
    banner = 'Om e-postadressen finns i systemet har en återställningslänk skickats.'
  } else if (status === 'password-updated') {
    banner = 'Lösenordet har uppdaterats. Du kan nu logga in.'
  } else if (status === 'invited') {
    banner = 'Din inbjudan är verifierad. Du kan nu logga in.'
  } else if (status === 'email-updated') {
    banner = 'Din e-postadress är nu uppdaterad.'
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-10 px-6 py-12 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-20">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-3 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-300">
            Säker kundportal • Enkel inloggning • Gridex
          </div>

          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
              Logga in till
              <br />
              Mina sidor
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-300">
              Här kan du följa ditt avtal, hantera dina uppgifter och få tillgång
              till din kundportal hos Gridex.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                Säker inloggning
              </div>
              <div className="mt-2 text-sm text-gray-400">
                Dina uppgifter hanteras i en skyddad inloggningsmiljö.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                Mina sidor
              </div>
              <div className="mt-2 text-sm text-gray-400">
                Se information kopplad till ditt avtal och din kundprofil.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                Snabb åtkomst
              </div>
              <div className="mt-2 text-sm text-gray-400">
                Logga in med din e-postadress och ditt lösenord.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                Hjälp vid behov
              </div>
              <div className="mt-2 text-sm text-gray-400">
                Behöver du hjälp finns kundservice alltid nära till hands.
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-400">
            Behöver du gå tillbaka?{' '}
            <Link
              className="text-white underline decoration-white/20 underline-offset-4 hover:text-cyan-300"
              href="/"
            >
              Till startsidan
            </Link>
          </div>
        </section>

        <section className="w-full max-w-md md:ml-auto">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-xl md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-semibold text-white">Logga in</div>
                <div className="mt-1 text-sm text-gray-400">
                  Ange dina uppgifter för att fortsätta.
                </div>
              </div>

              <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] text-white/70">
                Tryggt
              </div>
            </div>

            {(banner || error) && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/80">
                {banner ? <div className={error ? 'mb-2' : ''}>{banner}</div> : null}
                {error ? <div className="text-rose-300">{error}</div> : null}
              </div>
            )}

            <form action={loginWithPassword} className="mt-6 space-y-4">
              <input type="hidden" name="next" value={next} />

              <div className="space-y-2">
                <label className="text-sm text-white/75">E-post</label>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-cyan-400"
                  placeholder="name@example.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/75">Lösenord</label>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-cyan-400"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex items-center justify-between text-sm text-gray-400">
                <Link
                  href="/login/forgot-password"
                  className="underline decoration-white/20 underline-offset-4 hover:text-white"
                >
                  Glömt lösenord?
                </Link>

                <Link
                  href="/register"
                  className="underline decoration-white/20 underline-offset-4 hover:text-white"
                >
                  Skapa konto
                </Link>
              </div>

              <button
                type="submit"
                className="h-12 w-full rounded-2xl bg-cyan-500 text-sm font-semibold text-black transition hover:bg-cyan-400"
              >
                Logga in
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
              Logga in med e-post och lösenord. När fler inloggningssätt är tillgängliga visas de här.
            </div>

            <div className="mt-6 text-xs leading-6 text-gray-500">
              Genom att använda tjänsten godkänner du våra{' '}
              <Link href="/allmanna-villkor" className="text-white/70 underline hover:text-white">
                användarvillkor
              </Link>
              , vår{' '}
              <Link href="/integritetspolicy" className="text-white/70 underline hover:text-white">
                integritetspolicy
              </Link>{' '}
              och våra{' '}
              <Link href="/cookies" className="text-white/70 underline hover:text-white">
                cookiepolicy
              </Link>
              .
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}