import type { Metadata } from 'next'
import MarketSeoPage from '@/components/seo/MarketSeoPage'
import { SITE_URL, findPageByPath, marketPages } from '@/lib/seo/content'

export const dynamic = 'force-static'

const page = findPageByPath(marketPages, '/natagare')

export const metadata: Metadata = {
  title: page?.title ?? 'Gridex',
  description: page?.description ?? 'Information från Gridex.',
  alternates: { canonical: `${SITE_URL}/natagare` },
  robots: { index: true, follow: true },
  openGraph: page
    ? {
        title: page.title,
        description: page.description,
        url: `${SITE_URL}/natagare`,
        siteName: 'Gridex AB',
        locale: 'sv_SE',
        type: 'website',
      }
    : undefined,
}

export default function Page() {
  return (
    <MarketSeoPage
      path="/natagare"
      sectionLabel="Nätägare"
      sectionHref="/natagare"
      schemaType="webpage"
    />
  )
}
