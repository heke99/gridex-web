'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) return setError('Lösenordet måste vara minst 8 tecken.')
    if (password !== confirm) return setError('Lösenorden matchar inte.')

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) return setError(error.message)

      setSuccess(true)
      setTimeout(() => router.push('/login'), 1200)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div>
              <label className="text-xs text-white/70">Bekräfta lösenord</label>
              <input
                type="password"
                required
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
              className="w-full h-11 rounded-xl bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-60 transition"
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
    </main>
  )
}