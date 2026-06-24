import type { Metadata } from 'next'
import PublicHeader from '@/components/layout/PublicHeader'

const SITE_URL = 'https://gridex.se'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Elpris idag – tydliga elavtal | Gridex AB',
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
    title: 'Elpris idag – Billiga & datadrivna elavtal',
    description:
      'Elpris per elområde (SE1–SE4). Transparent prismotor och tydlig specifikation innan teckning.',
    url: SITE_URL,
    siteName: 'Gridex AB',
    locale: 'sv_SE',
    type: 'website',
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
                name: 'Gridex AB',
                url: SITE_URL,
                email: 'support@gridex.se',
                identifier: '559416-7149',
                legalName: 'Gridex AB',
                vatID: 'SE559416714901',
                areaServed: 'SE',
              },
              {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'Gridex AB',
                url: SITE_URL,
              },
            ],
            null,
            0
          ),
        }}
      />

      <div className="min-h-screen flex flex-col">
        <PublicHeader />
        <div className="flex-1">{children}</div>
      </div>
    </>
  )
}