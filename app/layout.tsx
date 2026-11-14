import './globals.css'
import { Geist, Geist_Mono } from 'next/font/google'
import Footer from '@/components/layout/Footer'
import { elklartDemoEnabled } from '@/lib/ops/elklartDemo'
import CookieBanner from '@/components/legal/CookieBanner'
import GoogleMarketingTags from '@/components/analytics/GoogleMarketingTags'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

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
  title: 'Gridex El AB – Elhandelsbolag',
  description: 'Gridex El AB erbjuder tydliga elavtal och prisberäkning för svenska elområden (SE1–SE4).',
  icons: {
    icon: [{ url: '/icon.svg?v=20260820', type: 'image/svg+xml' }],
    shortcut: '/icon.svg?v=20260820',
    apple: '/icon.svg?v=20260820',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isDemo = elklartDemoEnabled()
  return (
    <html lang="sv">
      <head>
        {!isDemo && <script
          id="gridex-google-consent-defaults"
          dangerouslySetInnerHTML={{ __html: GOOGLE_CONSENT_DEFAULTS }}
        />}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only absolute left-0 top-0 z-[100] m-2 rounded-lg bg-[var(--gx-accent)] px-3 py-2 font-medium text-[var(--gx-accent-ink)]"
        >
          Hoppa till innehåll
        </a>

        <main id="main-content" className="flex-1">
          {children}
        </main>

        {isDemo ? (
          <footer className="border-t border-white/10 bg-black px-6 py-4 text-sm text-white/70">
            Elklart · Demonstrationsmiljö
          </footer>
        ) : (
          <>
            <Footer />
            <GoogleMarketingTags />
            <CookieBanner />
          </>
        )}
      </body>
    </html>
  )
}
