import type { Metadata } from 'next'
import Link from 'next/link'
import FaqJsonLd from '@/components/seo/FaqJsonLd'
import { faqItems } from '@/lib/content/faq'
import FaqExplorer from './FaqExplorer'

export const metadata: Metadata = {
  title: 'Vanliga frågor om elavtal – Gridex',
  description: 'Svar om pris, teckning, anläggnings-ID, leverantörsbyte, villkor, ångerrätt och Mina sidor hos Gridex.',
  alternates: { canonical: 'https://gridex.se/vanliga-fragor' },
}

export default function VanligaFragorPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-14 md:py-16">
      <FaqJsonLd items={faqItems} />
      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">Hjälp före och efter teckning</div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">Vanliga frågor</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-300">Sök svar om elavtal, pris, byte, juridik och Mina sidor. Hittar du inte svaret kan du <Link href="/kundservice" className="text-cyan-300 underline underline-offset-4">kontakta kundservice</Link>.</p>
      </section>
      <FaqExplorer items={faqItems} />
    </div>
  )
}
