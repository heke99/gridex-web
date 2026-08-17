'use client'

import { useState } from 'react'
import {
  GRIDEX_COOKIE_CONSENT_EVENT,
  GRIDEX_COOKIE_CONSENT_KEY,
  type GridexCookieConsent,
  googleConsentState,
  parseGridexCookieConsent,
} from '@/lib/analytics/googleConsent'

function label(value: GridexCookieConsent) {
  if (value === 'accepted') return 'Accepterat'
  if (value === 'rejected') return 'Avvisat'
  return 'Inget val sparat'
}

export default function CookieSettings() {
  const [consent, setConsent] = useState<GridexCookieConsent>(() => {
    if (typeof window === 'undefined') return null
    return parseGridexCookieConsent(window.localStorage.getItem(GRIDEX_COOKIE_CONSENT_KEY))
  })

  function save(value: GridexCookieConsent) {
    if (value) {
      window.localStorage.setItem(GRIDEX_COOKIE_CONSENT_KEY, value)
      window.gtag?.('consent', 'update', googleConsentState(value))
    } else {
      window.localStorage.removeItem(GRIDEX_COOKIE_CONSENT_KEY)
      window.gtag?.('consent', 'update', googleConsentState('rejected'))
    }

    setConsent(value)
    window.dispatchEvent(new Event(GRIDEX_COOKIE_CONSENT_EVENT))
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-6">
      <h2 className="text-xl font-semibold text-white">Ändra cookieval</h2>
      <p className="mt-3 text-sm leading-6 text-gray-300">
        Gridex använder Google Consent Mode. Google-taggen kan laddas med analys- och annonslagring avstängd innan du har gjort ett val. Full mätning och lagring aktiveras först om du accepterar. Ditt val sparas lokalt i webbläsaren så att bannern inte behöver visas varje gång.
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
