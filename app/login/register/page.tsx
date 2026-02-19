// app/register/page.tsx
'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'

function calculateStrength(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

export default function RegisterPage() {
  const supabase = createSupabaseBrowserClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const strength = calculateStrength(password)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!accepted) {
      setError('Du måste acceptera användarvillkoren.')
      return
    }

    if (strength < 3) {
      setError('Lösenordet är för svagt.')
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(true)
  }

  const strengthColor = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-400',
    'bg-emerald-500',
  ][strength - 1] || 'bg-gray-700'

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">

        <h1 className="text-xl font-semibold">Skapa konto</h1>

        {success ? (
          <div className="text-emerald-400 text-sm">
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
              className="w-full h-11 rounded-xl border border-white/10 bg-black/40 px-3"
            />

            <div>
              <input
                type="password"
                required
                placeholder="Lösenord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 rounded-xl border border-white/10 bg-black/40 px-3"
              />

              {/* Strength meter */}
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

            <button className="w-full h-11 rounded-xl bg-white text-black font-semibold">
              Skapa konto
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