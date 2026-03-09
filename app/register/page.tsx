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
      setError('Du måste acceptera användarvillkoren.')
      return
    }

    if (password !== password2) {
      setError('Lösenorden matchar inte.')
      return
    }

    if (strength < 3) {
      setError('Lösenordet är för svagt.')
      return
    }

    setLoading(true)

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
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
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Skapa konto</h1>
          <p className="text-xs text-white/60 mt-1">
            Konto kräver e-postverifiering. Admin-åtkomst ges separat.
          </p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Kontrollera din e-post för att verifiera ditt konto.
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-5">
            <input
              type="email"
              required
              placeholder="E-post"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full h-11 rounded-xl border border-white/10 bg-black/40 px-3"
            />

            <div>
              <input
                type="password"
                required
                placeholder="Lösenord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full h-11 rounded-xl border border-white/10 bg-black/40 px-3"
              />

              <div className="mt-2 h-2 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className={`h-full transition-all ${strengthColor}`}
                  style={{ width: `${(strength / 4) * 100}%` }}
                />
              </div>

              <div className="text-xs text-white/60 mt-1">
                Minst 8 tecken, versal, siffra och specialtecken.
              </div>
            </div>

            <input
              type="password"
              required
              placeholder="Bekräfta lösenord"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              className="w-full h-11 rounded-xl border border-white/10 bg-black/40 px-3"
            />

            <div className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>
                Jag accepterar{' '}
                <Link href="/villkor" className="underline text-cyan-400">
                  användarvillkoren
                </Link>
              </span>
            </div>

            {error && <div className="text-rose-400 text-sm">{error}</div>}

            <button
              className="w-full h-11 rounded-xl bg-white text-black font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Skapar konto…' : 'Skapa konto'}
            </button>

            <div className="text-xs text-white/60 text-center">
              Har du redan konto?{' '}
              <Link href="/login" className="underline">
                Logga in
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}