import type { Metadata } from 'next'
import Link from 'next/link'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import JsonLd, { breadcrumbJsonLd, itemListJsonLd, webPageJsonLd } from '@/components/seo/JsonLd'
import { SITE_URL, glossaryPages } from '@/lib/seo/content'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Ordlista för elavtal och elpris – Gridex',
  description:
    'Förstå vanliga begrepp som kWh, spotpris, påslag, elnätsavgift, elområde och bindningstid innan du väljer elavtal.',
  alternates: { canonical: `${SITE_URL}/ordlista` },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Ordlista för elavtal och elpris',
    description: 'Gridex förklarar vanliga elbegrepp på enkel svenska.',
    url: `${SITE_URL}/ordlista`,
    siteName: 'Gridex AB',
    locale: 'sv_SE',
    type: 'website',
  },
}

export default function OrdlistaPage() {
  const items = glossaryPages.map((page) => ({ name: page.h1, url: `${SITE_URL}${page.path}` }))

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-14 md:py-16">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Start', url: SITE_URL },
            { name: 'Ordlista', url: `${SITE_URL}/ordlista` },
          ]),
          webPageJsonLd({
            name: 'Ordlista för elavtal och elpris',
            description: 'Förstå vanliga begrepp inom elavtal, elpris och faktura.',
            url: `${SITE_URL}/ordlista`,
          }),
          itemListJsonLd({ name: 'Gridex ordlista', items }),
        ]}
      />
      <Breadcrumbs items={[{ label: 'Start', href: '/' }, { label: 'Ordlista', href: '/ordlista' }]} />

      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
          Ordlista
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Ordlista för elavtal och elpris
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-300">
          Förstå begreppen innan du jämför elavtal. Här samlar Gridex korta och tydliga förklaringar av ord som ofta dyker upp på avtal, fakturor och prisjämförelser.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {glossaryPages.map((page) => (
          <Link
            key={page.path}
            href={page.path}
            className="rounded-3xl border border-white/10 bg-gray-950 p-6 transition hover:border-cyan-500/40 hover:bg-white/[0.04]"
          >
            <div className="text-lg font-bold text-white">{page.h1}</div>
            <p className="mt-2 text-sm leading-6 text-gray-400">{page.description}</p>
          </Link>
        ))}
      </section>
    </div>
  )
}
