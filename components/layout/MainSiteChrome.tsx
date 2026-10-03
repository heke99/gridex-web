import Footer from './Footer'
import CookieBanner from '@/components/legal/CookieBanner'
import GoogleMarketingTags from '@/components/analytics/GoogleMarketingTags'

const GOOGLE_CONSENT_DEFAULTS = `
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', wait_for_update: 500
  });
`

/** Route-scoped server chrome preserves static public pages and a bare staff shell. */
export default function MainSiteChrome() {
  return <><script id="gridex-google-consent-defaults" dangerouslySetInnerHTML={{ __html: GOOGLE_CONSENT_DEFAULTS }} />
    <Footer /><GoogleMarketingTags /><CookieBanner /></>
}
