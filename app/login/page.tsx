// app/login/page.tsx
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
  if (!next) return '/dashboard'
  if (!next.startsWith('/')) return '/dashboard'
  if (next.startsWith('//')) return '/dashboard'
  return next
}

export default async function LoginPage({ searchParams }: Props) {
  const sp = (await searchParams) || {}

  const error = readParam(sp.error)
  const reason = readParam(sp.reason)
  const status = readParam(sp.status)
  const next = safeNext(readParam(sp.next) || '/dashboard')

  let banner = ''

  if (reason === 'forbidden') {
    banner = 'Du saknar behörighet för denna del av plattformen.'
  } else if (status === 'verified') {
    banner = 'Din e-post är verifierad. Du kan nu logga in.'
  } else if (status === 'registered') {
    banner = 'Kontot är skapat. Kontrollera din e-post för att verifiera kontot.'
  } else if (status === 'reset-sent') {
    banner = 'Om e-postadressen finns i systemet har en återställningslänk skickats.'
  } else if (status === 'password-updated') {
    banner = 'Lösenordet har uppdaterats. Du kan nu logga in.'
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-14 md:flex-row md:items-center md:py-24">
        <section className="flex-1">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Gridex Platform
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-5xl">
            Logga in till <span className="text-white/90">Gridex</span>
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-6 text-white/70 md:text-base">
            Säker autentisering till Gridex-plattformen.
          </p>

          <div className="mt-8 grid max-w-xl grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium">Server-side säkerhet</div>
              <div className="mt-1 text-xs text-white/70">
                Alla sessioner verifieras på servernivå.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium">Rollbaserad åtkomst</div>
              <div className="mt-1 text-xs text-white/70">
                Åtkomst kontrolleras via RBAC.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium">Spårbar publicering</div>
              <div className="mt-1 text-xs text-white/70">
                Alla ändringar loggas i audit-system.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium">BankID-förberett</div>
              <div className="mt-1 text-xs text-white/70">
                Stark autentisering planerad.
              </div>
            </div>
          </div>

          <div className="mt-8 text-xs text-white/60">
            Behöver du tillbaka till publika sidan?{' '}
            <Link
              className="text-white/80 underline decoration-white/20 underline-offset-4 hover:text-white"
              href="/"
            >
              Gå till startsidan
            </Link>
          </div>
        </section>

        <section className="w-full max-w-md">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Inloggning</div>
                <div className="mt-1 text-xs text-white/70">
                  Ange dina uppgifter för att fortsätta.
                </div>
              </div>

              <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] text-white/70">
                Secure
              </div>
            </div>

            {(banner || error) && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-white/80">
                {banner ? <div className={error ? 'mb-2' : ''}>{banner}</div> : null}
                {error ? <div className="text-rose-300">{error}</div> : null}
              </div>
            )}

            <form action={loginWithPassword} className="mt-6 space-y-4">
              <input type="hidden" name="next" value={next} />

              <div className="space-y-2">
                <label className="text-xs text-white/70">E-post</label>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-cyan-400"
                  placeholder="name@company.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-white/70">Lösenord</label>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-cyan-400"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-white/60">
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
                className="h-11 w-full rounded-xl bg-white text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Logga in
              </button>
            </form>

            <div className="mt-6 border-t border-white/10 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs text-white/60">Alternativ inloggning</div>
                <Link
                  href="/login/bankid"
                  className="text-xs text-white/80 underline decoration-white/20 underline-offset-4 hover:text-white"
                >
                  Läs mer
                </Link>
              </div>

              <button
                type="button"
                disabled
                className="h-11 w-full cursor-not-allowed rounded-xl border border-white/10 bg-black/30 text-sm text-white/50"
              >
                Logga in med BankID (kommer snart)
              </button>
            </div>

            <div className="mt-6 text-[11px] leading-5 text-white/55">
              Genom att logga in accepterar du våra{' '}
              <Link href="/villkor" className="text-white/70 underline hover:text-white">
                användarvillkor
              </Link>
              .
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}