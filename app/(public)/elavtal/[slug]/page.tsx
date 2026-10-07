import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SeoLandingPage from '@/components/seo/SeoLandingPage'
import { SITE_OG_IMAGE, SITE_URL, elavtalPages, findPage } from '@/lib/seo/content'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return elavtalPages.map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = findPage(elavtalPages, slug)
  if (!page) return {}

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `${SITE_URL}${page.path}` },
    openGraph: {
    images: [SITE_OG_IMAGE],
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

export default async function ElavtalSeoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = findPage(elavtalPages, slug)
  if (!page) notFound()

  return (
    <SeoLandingPage
      page={page}
      sectionLabel="Elavtal"
      sectionHref="/elavtal"
      schemaType="service"
    />
  )
}
