import type { Metadata } from 'next'
import FaqJsonLd from '@/components/seo/FaqJsonLd'
import KundserviceClient from './KundserviceClient'
import { customerServiceFaqItems } from '@/lib/content/faq'

export const metadata: Metadata = {
  title: 'Kundservice – kontakta Gridex',
  description:
    'Kontakta Gridex kundservice. Få hjälp med elavtal, teckning, faktura, flytt, Mina sidor och anläggningsuppgifter.',
  alternates: { canonical: 'https://gridex.se/kundservice' },
}

export default function KundservicePage() {
  return (
    <>
      <FaqJsonLd items={customerServiceFaqItems} />
      <KundserviceClient faqItems={customerServiceFaqItems} />
    </>
  )
}
