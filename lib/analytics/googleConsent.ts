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
