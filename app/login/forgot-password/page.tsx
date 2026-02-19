'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createSupabaseBrowserClient()

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const redirectTo = `${window.location.origin}/login/reset-password`

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (error) {
        setError(error.message)
        return
      }

      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Återställ lösenord</h1>
          <p className="mt-2 text-sm text-white/60">
            Ange din e-post så skickar vi en länk där du kan skapa ett nytt lösenord.
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Om adressen finns registrerad har vi skickat en återställningslänk.
            <div className="mt-3">
              <Link href="/login" className="underline text-emerald-100 hover:text-white">
                Tillbaka till inloggning
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="text-xs text-white/70">E-post</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
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
              {loading ? 'Skickar…' : 'Skicka återställningslänk'}
            </button>

            <div className="text-xs text-white/60">
              <Link href="/login" className="underline hover:text-white">
                Tillbaka
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}