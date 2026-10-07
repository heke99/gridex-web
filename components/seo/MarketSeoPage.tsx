import { notFound } from 'next/navigation'
import SeoLandingPage from '@/components/seo/SeoLandingPage'
import { findPageByPath, marketPages } from '@/lib/seo/content'

export default function MarketSeoPage({
  path,
  sectionLabel,
  sectionHref,
  schemaType = 'webpage',
}: {
  path: string
  sectionLabel: string
  sectionHref: string
  schemaType?: 'article' | 'service' | 'webpage'
}) {
  const page = findPageByPath(marketPages, path)
  if (!page) notFound()

  return (
    <SeoLandingPage
      page={page}
      sectionLabel={sectionLabel}
      sectionHref={sectionHref}
      schemaType={schemaType}
    />
  )
}
