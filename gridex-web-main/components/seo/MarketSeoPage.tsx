import { notFound } from 'next/navigation'
import SeoLandingPage from '@/components/seo/SeoLandingPage'
import { DEFAULT_LAST_MODIFIED, findPageByPath, marketPages } from '@/lib/seo/content'

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

  page.lastModified = page.lastModified ?? DEFAULT_LAST_MODIFIED

  return (
    <SeoLandingPage
      page={page}
      sectionLabel={sectionLabel}
      sectionHref={sectionHref}
      schemaType={schemaType}
    />
  )
}
