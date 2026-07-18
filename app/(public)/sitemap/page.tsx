import type { Metadata } from 'next'
import Link from 'next/link'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import JsonLd, { breadcrumbJsonLd, itemListJsonLd, webPageJsonLd } from '@/components/seo/JsonLd'
import { SITE_URL, canonicalPublicRoutes } from '@/lib/seo/content'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Sitemap – alla sidor på Gridex',
  description: 'HTML-sitemap med viktiga sidor om elavtal, elpriser, guider, ordlista och juridik hos Gridex.',
  alternates: { canonical: `${SITE_URL}/sitemap` },
  robots: { index: true, follow: true },
}

function labelFromPath(path: string) {
  if (path === '/') return 'Startsida'
  return path
    .split('/')
    .filter(Boolean)
    .map((part) =>
      part
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    )
    .join(' / ')
}

const groups = [
  { title: 'Huvudsidor', match: (path: string) => ['/', '/teckna-avtal', '/kundservice', '/vanliga-fragor'].includes(path) },
  { title: 'Elavtal', match: (path: string) => path.startsWith('/elavtal') },
  { title: 'Elpriser', match: (path: string) => path.startsWith('/elpriser') },
  { title: 'Guider', match: (path: string) => path.startsWith('/guider') },
  { title: 'Ordlista', match: (path: string) => path.startsWith('/ordlista') },
  { title: 'Elbolag och nätägare', match: (path: string) => path.startsWith('/elbolag') || path.startsWith('/elhandlare') || path.startsWith('/natagare') },
  { title: 'Juridik', match: (path: string) => ['/integritetspolicy', '/allmanna-villkor', '/angerratt', '/prisvillkor', '/fullmakt', '/cookies', '/angerblankett', '/foretagsvillkor'].includes(path) },
]

export default function HtmlSitemapPage() {
  const itemList = canonicalPublicRoutes.map((path) => ({
    name: labelFromPath(path),
    url: `${SITE_URL}${path === '/' ? '' : path}`,
  }))

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-14 md:py-16">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Start', url: SITE_URL },
            { name: 'Sitemap', url: `${SITE_URL}/sitemap` },
          ]),
          webPageJsonLd({
            name: 'Sitemap',
            description: 'Alla viktiga publika sidor på Gridex.',
            url: `${SITE_URL}/sitemap`,
          }),
          itemListJsonLd({ name: 'Gridex sitemap', items: itemList }),
        ]}
      />
      <Breadcrumbs items={[{ label: 'Start', href: '/' }, { label: 'Sitemap', href: '/sitemap' }]} />

      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
          Sitemap
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Alla viktiga sidor på Gridex
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-300">
          Här hittar du våra indexerbara sidor om elavtal, elpriser, guider, ordlista, nätägare och juridiska villkor.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((group) => {
          const paths = canonicalPublicRoutes.filter(group.match)
          if (paths.length === 0) return null

          return (
            <section key={group.title} className="rounded-3xl border border-white/10 bg-gray-950 p-6">
              <h2 className="text-xl font-bold text-white">{group.title}</h2>
              <div className="mt-4 grid gap-2">
                {paths.map((path) => (
                  <Link
                    key={path}
                    href={path}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200 transition hover:border-cyan-500/40 hover:text-white"
                  >
                    {labelFromPath(path)}
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
