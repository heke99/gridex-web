'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import {
  GRIDEX_COOKIE_CONSENT_EVENT,
  GRIDEX_COOKIE_CONSENT_KEY,
  type GridexCookieConsent,
  googleConsentState,
  parseGridexCookieConsent,
} from '@/lib/analytics/googleConsent'

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(GRIDEX_COOKIE_CONSENT_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(GRIDEX_COOKIE_CONSENT_EVENT, callback)
  }
}

function getSnapshot(): GridexCookieConsent {
  if (typeof window === 'undefined') return null
  return parseGridexCookieConsent(window.localStorage.getItem(GRIDEX_COOKIE_CONSENT_KEY))
}

function getServerSnapshot(): GridexCookieConsent {
  return null
}

function persistConsent(value: Exclude<GridexCookieConsent, null>) {
  window.localStorage.setItem(GRIDEX_COOKIE_CONSENT_KEY, value)
  window.gtag?.('consent', 'update', googleConsentState(value))
  window.dispatchEvent(new Event(GRIDEX_COOKIE_CONSENT_EVENT))
}

export default function CookieBanner() {
  const consent = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  if (consent !== null) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[999999] px-4 pb-4">
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#0B0F17] p-6 shadow-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm leading-6 text-gray-300">
            <div className="mb-1 font-semibold text-white">Vi använder cookies</div>
            <div className="text-gray-400">
              Gridex använder nödvändiga cookies för funktionalitet och, om du godkänner,
              mätning av trafik och annonsering. Läs mer eller ändra dina inställningar i vår{' '}
              <Link
                href="/cookies"
                className="text-cyan-300 underline hover:text-cyan-200"
              >
                cookiepolicy
              </Link>
              .
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => persistConsent('rejected')}
              className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-gray-200 transition hover:border-cyan-500/40"
            >
              Avvisa
            </button>
            <button
              type="button"
              onClick={() => persistConsent('accepted')}
              className="h-10 rounded-xl bg-cyan-500 px-4 text-sm font-bold text-black transition hover:bg-cyan-400"
            >
              Acceptera
            </button>
            <Link
              href="/cookies"
              className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-gray-200 transition hover:border-cyan-500/40 flex items-center"
            >
              Hantera val
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
