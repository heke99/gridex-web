//app/register/page.tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

function calculateStrength(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function humanizeAuthError(message: string): string {
  const msg = message.toLowerCase()

  if (msg.includes('user already registered')) {
    return 'Det finns redan ett konto med denna e-postadress.'
  }

  if (msg.includes('password')) {
    return 'Lösenordet uppfyller inte kraven.'
  }

  if (msg.includes('database error saving new user')) {
    return 'Kunde inte skapa konto just nu. Försök igen om en stund.'
  }

  return message
}

function strengthLabel(strength: number): string {
  switch (strength) {
    case 1:
      return 'Svagt'
    case 2:
      return 'Okej'
    case 3:
      return 'Bra'
    case 4:
      return 'Starkt'
    default:
      return 'För svagt'
  }
}

export default function RegisterPage() {
  const supabase = createSupabaseBrowserClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [accepted, setAccepted] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const strength = useMemo(() => calculateStrength(password), [password])

  const strengthColor =
    ([
      'bg-red-500',
      'bg-orange-500',
      'bg-yellow-400',
      'bg-emerald-500',
    ][strength - 1] as string) || 'bg-gray-700'

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    setError(null)

    const cleanEmail = normalizeEmail(email)

    if (!cleanEmail || !looksLikeEmail(cleanEmail)) {
      setError('Ange en giltig e-postadress.')
      return
    }

    if (!accepted) {
      setError('Du måste acceptera användarvillkoren och integritetspolicyn.')
      return
    }

    if (password !== password2) {
      setError('Lösenorden matchar inte.')
      return
    }

    if (strength < 3) {
      setError('Lösenordet är för svagt. Välj ett starkare lösenord.')
      return
    }

    setLoading(true)

    try {
      const redirectNext = encodeURIComponent('/login?status=verified')

      const { error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${redirectNext}`,
        },
      })

      if (signUpError) {
        setError(humanizeAuthError(signUpError.message))
        return
      }

      setSuccess(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-10 px-6 py-12 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-20">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-3 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-300">
            Skapa kundkonto • Säker registrering • Gridex
          </div>

          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
              Skapa konto för
              <br />
              Mina sidor
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-300">
              Skapa ditt konto för att få tillgång till din kundportal hos Gridex.
              Där kan du hantera uppgifter, följa ditt avtal och logga in tryggt
              när du behöver.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                Enkel registrering
              </div>
              <div className="mt-2 text-sm text-gray-400">
                Kom igång snabbt med din e-postadress och ett säkert lösenord.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                E-postverifiering
              </div>
              <div className="mt-2 text-sm text-gray-400">
                Efter registrering bekräftar du din e-post för att aktivera kontot.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                Säker åtkomst
              </div>
              <div className="mt-2 text-sm text-gray-400">
                Ditt konto skyddas med lösenord och säker inloggning.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                Mina sidor
              </div>
              <div className="mt-2 text-sm text-gray-400">
                Få tillgång till information kopplad till ditt avtal och din profil.
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-400">
            Har du redan konto?{' '}
            <Link
              className="text-white underline decoration-white/20 underline-offset-4 hover:text-cyan-300"
              href="/login"
            >
              Logga in här
            </Link>
          </div>
        </section>

        <section className="w-full max-w-md md:ml-auto">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-xl md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-semibold text-white">Skapa konto</div>
                <div className="mt-1 text-sm text-gray-400">
                  Registrera dig för att komma igång.
                </div>
              </div>

              <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] text-white/70">
                Secure
              </div>
            </div>

            {success ? (
              <div className="mt-6 space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm text-emerald-100">
                <div className="font-medium text-emerald-200">
                  Kontot är nästan klart
                </div>
                <p className="leading-6 text-emerald-100/90">
                  Vi har skickat en verifieringslänk till din e-postadress.
                  Öppna mailet och bekräfta kontot för att kunna logga in.
                </p>
                <div className="pt-2">
                  <Link
                    href="/login"
                    className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                  >
                    Till inloggning
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/75">E-post</label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-white/75">Lösenord</label>
                  <input
                    type="password"
                    required
                    placeholder="Skapa ett lösenord"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-cyan-400"
                  />

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className={`h-full transition-all ${strengthColor}`}
                      style={{ width: `${(strength / 4) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Minst 8 tecken, versal, siffra och specialtecken.</span>
                    <span>{strengthLabel(strength)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-white/75">Bekräfta lösenord</label>
                  <input
                    type="password"
                    required
                    placeholder="Bekräfta lösenord"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    autoComplete="new-password"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-cyan-400"
                  />
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="leading-6">
                    Jag accepterar{' '}
                    <Link href="/villkor" className="text-cyan-300 underline hover:text-cyan-200">
                      användarvillkoren
                    </Link>{' '}
                    och{' '}
                    <Link href="/integritet" className="text-cyan-300 underline hover:text-cyan-200">
                      integritetspolicy
                    </Link>
                    .
                  </span>
                </label>

                {error ? (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
                    {error}
                  </div>
                ) : null}

                <button
                  className="h-12 w-full rounded-2xl bg-cyan-500 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? 'Skapar konto…' : 'Skapa konto'}
                </button>

                <div className="text-sm text-gray-400">
                  Har du redan konto?{' '}
                  <Link
                    href="/login"
                    className="underline decoration-white/20 underline-offset-4 hover:text-white"
                  >
                    Logga in
                  </Link>
                </div>
              </form>
            )}

            <div className="mt-6 text-xs leading-6 text-gray-500">
              Genom att skapa konto godkänner du våra{' '}
              <Link href="/villkor" className="text-white/70 underline hover:text-white">
                användarvillkor
              </Link>{' '}
              och våra{' '}
              <Link href="/integritet" className="text-white/70 underline hover:text-white">
                integritetspolicy
              </Link>
              .
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}