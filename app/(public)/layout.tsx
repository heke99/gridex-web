import type { Metadata } from 'next'
import PublicHeader from '@/components/layout/PublicHeader'

const SITE_URL = 'https://gridex.se'
const BRAND_LOGO_URL = `${SITE_URL}/brand/gridex-logo.png`
const BRAND_OG_URL = `${SITE_URL}/brand/gridex-og.png`

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Gridex El AB – elavtal för privatpersoner och företag',
    template: '%s | Gridex',
  },
  description:
    'Jämför elpris idag per elområde (SE1–SE4). Tydliga elavtal med full transparens: spot/portfölj/fastpris, påslag och månadsavgift innan du tecknar.',
  keywords: [
    'elpris idag',
    'elpris',
    'billigt elavtal',
    'elavtal',
    'spotpris el',
    'rörligt elpris',
    'fast elpris',
    'elpris se1',
    'elpris se2',
    'elpris se3',
    'elpris se4',
    'teckna elavtal',
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: 'Gridex – elavtal med tydliga priser och avgifter',
    description:
      'Se Gridex elavtal, jämför våra avtalsformer och räkna på elhandelskostnaden innan du tecknar.',
    url: SITE_URL,
    siteName: 'Gridex El AB',
    locale: 'sv_SE',
    type: 'website',
    images: [{ url: BRAND_OG_URL, width: 1200, height: 630, alt: 'Gridex elleverantör' }],
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Organization + Website JSON-LD (global) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            [
              {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                '@id': `${SITE_URL}/#organization`,
                alternateName: ['Gridex', 'Gridex El'],
                description: 'Svenskt elhandelsbolag med elavtal för privatpersoner och företag i Sverige.',
                contactPoint: { '@type': 'ContactPoint', email: 'support@gridex.se', contactType: 'customer service', availableLanguage: 'sv' },
                name: 'Gridex El AB',
                url: SITE_URL,
                email: 'support@gridex.se',
                logo: BRAND_LOGO_URL,
                image: BRAND_LOGO_URL,
                identifier: '559416-7149',
                legalName: 'Gridex El AB',
                vatID: 'SE559416714901',
                areaServed: 'SE',
              },
              {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                '@id': `${SITE_URL}/#website`,
                alternateName: ['Gridex', 'Gridex El'],
                inLanguage: 'sv-SE',
                name: 'Gridex El AB',
                url: SITE_URL,
                publisher: {
                  '@id': `${SITE_URL}/#organization`,
                  '@type': 'Organization',
                  name: 'Gridex El AB',
                  logo: BRAND_LOGO_URL,
                },
              },
            ],
            null,
            0
          ),
        }}
      />

      <div className="min-h-screen flex flex-col">
        <PublicHeader authenticatedEmail={null} resolveAuthClientSide />
        <div className="flex-1">{children}</div>
      </div>
    </>
  )
}
