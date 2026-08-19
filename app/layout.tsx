import './globals.css'
import AuthSessionSync from '@/components/auth/AuthSessionSync'
import Footer from '@/components/layout/Footer'
import CookieBanner from '@/components/legal/CookieBanner'
import GoogleMarketingTags from '@/components/analytics/GoogleMarketingTags'

const GOOGLE_CONSENT_DEFAULTS = `
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });
`

export const metadata = {
  title: 'Gridex AB – Elhandelsbolag',
  description: 'Gridex AB erbjuder tydliga elavtal och prisberäkning för svenska elområden (SE1–SE4).',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv">
      <head>
        <script
          id="gridex-google-consent-defaults"
          dangerouslySetInnerHTML={{ __html: GOOGLE_CONSENT_DEFAULTS }}
        />
      </head>
      <body className="bg-black text-white min-h-screen flex flex-col">
        <AuthSessionSync />

        {/* Skip link for improved accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only absolute left-0 top-0 m-2 rounded bg-cyan-500 px-3 py-2 text-black"
        >
          Hoppa till innehåll
        </a>

        <main id="main-content" className="flex-1">
          {children}
        </main>

        <Footer />

        <GoogleMarketingTags />
        <CookieBanner />
      </body>
    </html>
  )
}
