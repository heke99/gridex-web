'use client'

import { useState } from 'react'

const STORAGE_KEY = 'gridex_cookie_consent'

type Consent = 'accepted' | 'rejected' | null

function label(value: Consent) {
  if (value === 'accepted') return 'Accepterat'
  if (value === 'rejected') return 'Avvisat'
  return 'Inget val sparat'
}

export default function CookieSettings() {
  const [consent, setConsent] = useState<Consent>(() => {
    if (typeof window === 'undefined') return null
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'accepted' || stored === 'rejected' ? stored : null
  })

  function save(value: Consent) {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
    setConsent(value)
    window.dispatchEvent(new Event('storage'))
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-6">
      <h2 className="text-xl font-semibold text-white">Ändra cookieval</h2>
      <p className="mt-3 text-sm leading-6 text-gray-300">
        Gridex sätter inga icke-nödvändiga cookies från den här webbplatsen innan du har accepterat det. Ditt val sparas lokalt i webbläsaren så att bannern inte behöver visas varje gång.
      </p>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
        Nuvarande val: <span className="font-semibold text-white">{label(consent)}</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => save('accepted')}
          className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-cyan-400"
        >
          Acceptera
        </button>
        <button
          type="button"
          onClick={() => save('rejected')}
          className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-500/40 hover:bg-white/5"
        >
          Avvisa
        </button>
        <button
          type="button"
          onClick={() => save(null)}
          className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-cyan-500/40 hover:bg-white/5"
        >
          Nollställ valet
        </button>
      </div>
    </section>
  )
}
