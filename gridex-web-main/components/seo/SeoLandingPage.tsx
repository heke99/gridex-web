import Link from 'next/link'
import type { SeoPageContent } from '@/lib/seo/content'
import { SITE_URL, DEFAULT_LAST_MODIFIED } from '@/lib/seo/content'
import FaqJsonLd from '@/components/seo/FaqJsonLd'
import JsonLd, {
  articleJsonLd,
  breadcrumbJsonLd,
  serviceJsonLd,
  webPageJsonLd,
} from '@/components/seo/JsonLd'
import Breadcrumbs from '@/components/seo/Breadcrumbs'

type Props = {
  page: SeoPageContent
  sectionLabel: string
  sectionHref: string
  schemaType?: 'article' | 'service' | 'webpage'
}

export default function SeoLandingPage({
  page,
  sectionLabel,
  sectionHref,
  schemaType = 'webpage',
}: Props) {
  const absoluteUrl = `${SITE_URL}${page.path}`
  const modified = (page.lastModified ?? DEFAULT_LAST_MODIFIED)
    .toISOString()
    .slice(0, 10)
  const jsonLd = [
    breadcrumbJsonLd([
      { name: 'Start', url: SITE_URL },
      { name: sectionLabel, url: `${SITE_URL}${sectionHref}` },
      { name: page.h1, url: absoluteUrl },
    ]),
    webPageJsonLd({ name: page.title, description: page.description, url: absoluteUrl }),
    schemaType === 'article'
      ? articleJsonLd({
          headline: page.h1,
          description: page.description,
          url: absoluteUrl,
          dateModified: modified,
        })
      : schemaType === 'service'
        ? serviceJsonLd({ name: page.h1, description: page.description, url: absoluteUrl })
        : null,
  ].filter(Boolean)

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-14 md:py-16">
      <FaqJsonLd items={page.faq} />
      <JsonLd data={jsonLd} />

      <Breadcrumbs
        items={[
          { label: 'Start', href: '/' },
          { label: sectionLabel, href: sectionHref },
          { label: page.h1, href: page.path },
        ]}
      />

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative max-w-4xl">
          <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
            {page.eyebrow}
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
            {page.h1}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-300">
            {page.lead}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href={page.primaryCta.href}
              className="rounded-xl bg-cyan-500 px-6 py-3 text-center font-bold text-black transition hover:bg-cyan-400"
            >
              {page.primaryCta.label}
            </Link>
            {page.secondaryCta ? (
              <Link
                href={page.secondaryCta.href}
                className="rounded-xl border border-white/10 px-6 py-3 text-center font-semibold text-gray-100 transition hover:border-cyan-500/40 hover:bg-white/5"
              >
                {page.secondaryCta.label}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {page.bullets.map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-gray-950 p-5">
            <div className="text-sm font-semibold text-white">{item}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {page.sections.map((section) => (
            <article key={section.title} className="rounded-3xl border border-white/10 bg-gray-950 p-7 md:p-8">
              <h2 className="text-2xl font-bold text-white">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-gray-300 md:text-base">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-6">
            <h2 className="text-lg font-bold text-white">Rätt nästa steg</h2>
            <p className="mt-3 text-sm leading-6 text-cyan-50/80">{page.intent}</p>
            <Link
              href={page.primaryCta.href}
              className="mt-5 block rounded-xl bg-cyan-500 px-4 py-3 text-center text-sm font-bold text-black transition hover:bg-cyan-400"
            >
              {page.primaryCta.label}
            </Link>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-6">
            <h2 className="text-lg font-bold text-white">Relaterade sidor</h2>
            <div className="mt-4 space-y-3">
              {page.related.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-500/40"
                >
                  <div className="text-sm font-semibold text-cyan-200">{item.label}</div>
                  <p className="mt-1 text-xs leading-5 text-gray-400">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-7 md:p-8">
        <h2 className="text-2xl font-bold text-white">Vanliga frågor</h2>
        <div className="mt-5 space-y-3">
          {page.faq.map((item) => (
            <details key={item.question} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-6 text-gray-300">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
