import Link from 'next/link'
import type { SeoPageContent } from '@/lib/seo/content'
import JsonLd, { itemListJsonLd, breadcrumbJsonLd, webPageJsonLd } from '@/components/seo/JsonLd'
import { SITE_URL } from '@/lib/seo/content'
import Breadcrumbs from '@/components/seo/Breadcrumbs'

type Props = {
  title: string
  description: string
  eyebrow: string
  path: string
  pages: SeoPageContent[]
  groups?: Array<{ title: string; body: string; href: string }>
}

export default function HubPage({ title, description, eyebrow, path, pages, groups = [] }: Props) {
  const absoluteUrl = `${SITE_URL}${path}`

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-14 md:py-16">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Start', url: SITE_URL },
            { name: title, url: absoluteUrl },
          ]),
          webPageJsonLd({ name: title, description, url: absoluteUrl }),
          itemListJsonLd({
            name: title,
            items: pages.map((page) => ({ name: page.h1, url: `${SITE_URL}${page.path}` })),
          }),
        ]}
      />
      <Breadcrumbs items={[{ label: 'Start', href: '/' }, { label: title, href: path }]} />

      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
          {eyebrow}
        </div>
        <h1 className="mt-5 max-w-4xl text-4xl font-bold tracking-tight text-white md:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-300">{description}</p>
      </section>

      {groups.length > 0 ? (
        <section className="grid gap-5 md:grid-cols-3">
          {groups.map((group) => (
            <Link
              key={group.href}
              href={group.href}
              className="rounded-3xl border border-white/10 bg-gray-950 p-6 transition hover:border-cyan-500/40"
            >
              <h2 className="text-lg font-bold text-white">{group.title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-400">{group.body}</p>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {pages.map((page) => (
          <Link
            key={page.path}
            href={page.path}
            className="flex min-h-[250px] flex-col justify-between rounded-3xl border border-white/10 bg-gray-950 p-6 transition hover:border-cyan-500/40"
          >
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">{page.eyebrow}</div>
              <h2 className="mt-3 text-xl font-bold text-white">{page.h1}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-400">{page.description}</p>
            </div>
            <div className="mt-6 text-sm font-semibold text-cyan-300">Läs mer →</div>
          </Link>
        ))}
      </section>
    </div>
  )
}
