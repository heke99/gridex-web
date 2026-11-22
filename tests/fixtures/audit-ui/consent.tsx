import CookieBanner from '@/components/legal/CookieBanner'
import CookieSettings from '@/components/legal/CookieSettings'
import GoogleMarketingTags from '@/components/analytics/GoogleMarketingTags'

export default function AuditConsent() {
  return <main>
    <h1>Samtyckesprov</h1>
    <GoogleMarketingTags />
    <CookieBanner />
    <CookieSettings />
  </main>
}
