'use client'

import Script from 'next/script'
import { useEffect, useMemo, useSyncExternalStore } from 'react'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const CONSENT_KEY = 'gridex_cookie_consent'

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function currentConsent() {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(CONSENT_KEY)
  return value === 'accepted' ? 'accepted' : value === 'rejected' ? 'rejected' : null
}

function serverConsent() {
  return null
}

function eventKey() {
  return 'gridex_application_conversion_verified_tack'
}

export default function GoogleMarketingTags() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()
  const conversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL?.trim()
  const primaryTagId = gaId || adsId
  const consent = useSyncExternalStore(subscribe, currentConsent, serverConsent)

  const enabled = consent === 'accepted' && Boolean(primaryTagId)

  const bootstrap = useMemo(() => {
    if (!enabled) return ''

    const configLines = [
      gaId
        ? `gtag('config', '${gaId}', { send_page_view: false, anonymize_ip: true });`
        : null,
      adsId ? `gtag('config', '${adsId}', { send_page_view: false });` : null,
    ]
      .filter(Boolean)
      .join('\n')

    return `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      window.gtag = gtag;
      gtag('js', new Date());
      ${configLines}
    `
  }, [adsId, enabled, gaId])

  useEffect(() => {
    if (!enabled) return

    const sendWhenReady = (attempt = 0) => {
      if (!window.gtag) {
        if (attempt < 10) window.setTimeout(() => sendWhenReady(attempt + 1), 250)
        return
      }

      const url = new URL(window.location.href)
      const isResultPage = url.pathname === '/teckna-avtal/tack'
      const analyticsUrl = isResultPage ? `${url.origin}${url.pathname}` : url.href
      const pathWithQuery = isResultPage ? url.pathname : `${url.pathname}${url.search}`

      window.gtag('event', 'page_view', {
        page_path: pathWithQuery,
        page_location: analyticsUrl,
        page_title: document.title,
      })

      if (
        isResultPage &&
        document.querySelector('[data-gridex-verified-application-received="true"]')
      ) {
        const key = eventKey()
        if (window.sessionStorage.getItem(key)) return
        window.sessionStorage.setItem(key, '1')

        window.gtag('event', 'application_received', {
          event_category: 'lead',
          event_label: 'gridex_teckna_avtal_tack',
        })

        if (adsId && conversionLabel) {
          window.gtag('event', 'conversion', {
            send_to: `${adsId}/${conversionLabel}`,
          })
        }
      }
    }

    sendWhenReady()
  }, [adsId, conversionLabel, enabled])

  if (!enabled || !primaryTagId) return null

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${primaryTagId}`} strategy="afterInteractive" />
      <Script id="gridex-google-marketing-tags" strategy="afterInteractive">
        {bootstrap}
      </Script>
    </>
  )
}
