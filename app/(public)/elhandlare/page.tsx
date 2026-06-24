import type { Metadata } from 'next'
import MarketSeoPage from '@/components/seo/MarketSeoPage'
import { SITE_URL, findPageByPath, marketPages } from '@/lib/seo/content'

export const dynamic = 'force-static'

const page = findPageByPath(marketPages, '/elhandlare')

export const metadata: Metadata = {
  title: page?.title ?? 'Gridex',
  description: page?.description ?? 'Information från Gridex.',
  alternates: { canonical: `${SITE_URL}/elhandlare` },
  robots: { index: true, follow: true },
  openGraph: page
    ? {
        title: page.title,
        description: page.description,
        url: `${SITE_URL}/elhandlare`,
        siteName: 'Gridex AB',
        locale: 'sv_SE',
        type: 'website',
      }
    : undefined,
}

export default function Page() {
  return (
    <MarketSeoPage
      path="/elhandlare"
      sectionLabel="Elhandlare"
      sectionHref="/elhandlare"
      schemaType="webpage"
    />
  )
}
