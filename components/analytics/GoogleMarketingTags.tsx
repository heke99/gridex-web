'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  GRIDEX_COOKIE_CONSENT_EVENT,
  GRIDEX_COOKIE_CONSENT_KEY,
  GRIDEX_GOOGLE_ADS_ID,
  googleConsentState,
  parseGridexCookieConsent,
} from '@/lib/analytics/googleConsent'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const GOOGLE_ADS_PURCHASE_SEND_TO = 'AW-18268724498/tA4dCL_0hOgcEJK6modE'

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(GRIDEX_COOKIE_CONSENT_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(GRIDEX_COOKIE_CONSENT_EVENT, callback)
  }
}

function currentConsent() {
  if (typeof window === 'undefined') return null
  return parseGridexCookieConsent(window.localStorage.getItem(GRIDEX_COOKIE_CONSENT_KEY))
}

function serverConsent() {
  return null
}

function eventKey(event: string, applicationNumber?: string | null) {
  const suffix = (applicationNumber || 'verified').replace(/[^a-zA-Z0-9_-]/g, '_')
  return `gridex_${event}_${suffix}`
}

export default function GoogleMarketingTags() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()
  const adsId = GRIDEX_GOOGLE_ADS_ID
  const primaryTagId = gaId || adsId
  const pathname = usePathname()
  const consent = useSyncExternalStore(subscribe, currentConsent, serverConsent)
  const measurementConsentGranted = consent === 'accepted'

  const bootstrap = useMemo(() => {
    if (!primaryTagId) return ''

    const grantedConsent = JSON.stringify(googleConsentState('accepted'))
    const configLines = [
      gaId
        ? `window.gtag('config', ${JSON.stringify(gaId)}, { send_page_view: false, anonymize_ip: true });`
        : null,
      adsId
        ? `window.gtag('config', ${JSON.stringify(adsId)}, { send_page_view: false });`
        : null,
    ]
      .filter(Boolean)
      .join('\n')

    return `
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
      window.gtag('consent', 'update', ${grantedConsent});
      window.gtag('js', new Date());
      ${configLines}
    `
  }, [adsId, gaId, primaryTagId])

  useEffect(() => {
    if (!measurementConsentGranted) return

    let cancelled = false
    let timeoutId: number | undefined

    const sendWhenReady = (attempt = 0) => {
      if (cancelled) return
      if (!window.gtag) {
        if (attempt < 12) {
          timeoutId = window.setTimeout(() => sendWhenReady(attempt + 1), 250)
        }
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

      if (!isResultPage) return

      const marker = document.querySelector<HTMLElement>(
        '[data-gridex-verified-application-received="true"]'
      )
      if (!marker) return

      const applicationNumber = marker.dataset.gridexApplicationNumber || null
      const applicationKey = eventKey('application_submitted', applicationNumber)

      if (!window.sessionStorage.getItem(applicationKey)) {
        window.gtag('event', 'application_received', {
          event_category: 'lead',
          event_label: 'gridex_teckna_avtal_verified',
        })
        window.gtag('event', 'application_submitted', {
          event_category: 'lead',
          event_label: 'gridex_teckna_avtal_verified',
        })
        window.sessionStorage.setItem(applicationKey, '1')
      }

      const contractSigned = marker.dataset.gridexContractSigned === 'true'
      if (!contractSigned || !applicationNumber) return

      const signedKey = eventKey('contract_signed', applicationNumber)
      if (!window.sessionStorage.getItem(signedKey)) {
        window.gtag('event', 'contract_signed', {
          event_category: 'purchase',
          event_label: 'gridex_contract_signed_verified',
        })
        window.sessionStorage.setItem(signedKey, '1')
      }

      const adsConversionKey = eventKey('google_ads_purchase_conversion', applicationNumber)
      if (window.sessionStorage.getItem(adsConversionKey)) return

      const newCustomerState = marker.dataset.gridexNewCustomer
      const conversionParams: Record<string, string | boolean> = {
        send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
        transaction_id: applicationNumber,
      }
      if (newCustomerState === 'true') conversionParams.new_customer = true
      if (newCustomerState === 'false') conversionParams.new_customer = false

      window.gtag('event', 'conversion', conversionParams)
      window.sessionStorage.setItem(adsConversionKey, '1')
    }

    sendWhenReady()

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [measurementConsentGranted, pathname])

  if (!primaryTagId || !measurementConsentGranted) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryTagId)}`}
        strategy="lazyOnload"
      />
      <Script id="gridex-google-marketing-tags" strategy="lazyOnload">
        {bootstrap}
      </Script>
    </>
  )
}
