export const GRIDEX_COOKIE_CONSENT_KEY = 'gridex_cookie_consent'
export const GRIDEX_COOKIE_CONSENT_EVENT = 'gridex:cookie-consent'
export const GRIDEX_GOOGLE_ADS_ID = 'AW-18268724498'

export type GridexCookieConsent = 'accepted' | 'rejected' | null

export type GoogleConsentValue = 'granted' | 'denied'

export type GoogleConsentState = {
  ad_storage: GoogleConsentValue
  ad_user_data: GoogleConsentValue
  ad_personalization: GoogleConsentValue
  analytics_storage: GoogleConsentValue
}

export function parseGridexCookieConsent(value: string | null): GridexCookieConsent {
  return value === 'accepted' || value === 'rejected' ? value : null
}

export function googleConsentState(consent: Exclude<GridexCookieConsent, null>): GoogleConsentState {
  const value: GoogleConsentValue = consent === 'accepted' ? 'granted' : 'denied'

  return {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  }
}

let temporaryConsent: GridexCookieConsent | undefined

export function subscribeToCookieConsent(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(GRIDEX_COOKIE_CONSENT_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(GRIDEX_COOKIE_CONSENT_EVENT, callback)
  }
}

export function serverCookieConsent(): undefined {
  return undefined
}

function storedCookieConsent(): GridexCookieConsent | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return parseGridexCookieConsent(window.localStorage.getItem(GRIDEX_COOKIE_CONSENT_KEY))
  } catch {
    return undefined
  }
}

export function measurementCookieConsent(): GridexCookieConsent {
  return temporaryConsent === undefined ? storedCookieConsent() ?? null : null
}

export function currentCookieConsent(): GridexCookieConsent {
  return temporaryConsent !== undefined ? temporaryConsent : measurementCookieConsent()
}

export function saveCookieConsent(value: GridexCookieConsent) {
  try {
    if (value === null) window.localStorage.removeItem(GRIDEX_COOKIE_CONSENT_KEY)
    else window.localStorage.setItem(GRIDEX_COOKIE_CONSENT_KEY, value)
    temporaryConsent = storedCookieConsent() === value ? undefined : value
  } catch {
    temporaryConsent = value
  }
  try {
    window.gtag?.('consent', 'update', googleConsentState(measurementCookieConsent() ?? 'rejected'))
  } finally {
    window.dispatchEvent(new Event(GRIDEX_COOKIE_CONSENT_EVENT))
  }
}
