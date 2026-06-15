//app/login/reset-password/page.tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

function calculateStrength(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

function humanizeAuthError(message: string): string {
  const msg = message.toLowerCase()

  if (msg.includes('same password')) {
    return 'Det nya lösenordet måste skilja sig från det gamla.'
  }

  if (msg.includes('password')) {
    return 'Lösenordet uppfyller inte kraven.'
  }

  if (msg.includes('session')) {
    return 'Länken är ogiltig eller har gått ut. Begär en ny återställningslänk.'
  }

  return 'Kunde inte uppdatera lösenordet.'
}

export default function ResetPasswordPage() {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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

  async function handleSetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (loading) return

    setError(null)

    if (!password || password.length < 8) {
      setError('Lösenordet måste vara minst 8 tecken.')
      return
    }

    if (strength < 3) {
      setError('Lösenordet är för svagt.')
      return
    }

    if (password !== confirm) {
      setError('Lösenorden matchar inte.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setError(humanizeAuthError(error.message))
        return
      }

      setSuccess(true)

      window.setTimeout(() => {
        router.push('/login?status=password-updated')
      }, 1200)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Skapa nytt lösenord</h1>
          <p className="mt-2 text-sm text-white/60">
            Ange ett nytt lösenord för ditt konto.
          </p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Lösenord uppdaterat. Du omdirigeras…
          </div>
        ) : (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="text-xs text-white/70">Nytt lösenord</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-cyan-400 transition"
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

            <div>
              <label className="text-xs text-white/70">Bekräfta lösenord</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-2 w-full h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-cyan-400 transition"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Uppdaterar…' : 'Uppdatera lösenord'}
            </button>

            <div className="text-xs text-white/60">
              <Link href="/login" className="underline hover:text-white">
                Tillbaka till inloggning
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}