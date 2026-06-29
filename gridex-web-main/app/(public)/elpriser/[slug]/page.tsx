import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SeoLandingPage from '@/components/seo/SeoLandingPage'
import { DEFAULT_LAST_MODIFIED, SITE_URL, elprisPages, findPage } from '@/lib/seo/content'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return elprisPages.map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = findPage(elprisPages, slug)
  if (!page) return {}

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `${SITE_URL}${page.path}` },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `${SITE_URL}${page.path}`,
      type: 'website',
      locale: 'sv_SE',
      siteName: 'Gridex AB',
    },
    robots: { index: true, follow: true },
  }
}

export default async function ElpriserSeoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = findPage(elprisPages, slug)
  if (!page) notFound()

  page.lastModified = page.lastModified ?? DEFAULT_LAST_MODIFIED

  return (
    <SeoLandingPage
      page={page}
      sectionLabel="Elpriser"
      sectionHref="/elpriser"
      schemaType="webpage"
    />
  )
}
