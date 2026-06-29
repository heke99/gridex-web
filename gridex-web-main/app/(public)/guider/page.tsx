import type { Metadata } from 'next'
import HubPage from '@/components/seo/HubPage'
import { SITE_URL, guidePages } from '@/lib/seo/content'

export const metadata: Metadata = {
  title: 'Guider om elpris och elavtal – Gridex',
  description:
    'Lär dig om elpris, elområden, spotpris, fast eller rörligt elpris, elfaktura, förbrukning och hur du jämför elavtal.',
  alternates: { canonical: `${SITE_URL}/guider` },
  robots: { index: true, follow: true },
}

export default function GuiderHubPage() {
  return (
    <HubPage
      title="Guider om elpris och elavtal"
      description="Gridex guider förklarar hur elpriset fungerar, hur du jämför elavtal och vad som skiljer elhandel från elnät. Målet är att du ska kunna välja avtal med full förståelse."
      eyebrow="Kunskapshub"
      path="/guider"
      pages={guidePages}
      groups={[
        {
          title: 'Förstå elpriset',
          body: 'Börja med vad som påverkar priset, elområden och spotpris.',
          href: '/guider/vad-paverkar-elpriset',
        },
        {
          title: 'Välj rätt avtal',
          body: 'Jämför fast, rörligt, timpris och kvartspris utifrån din risknivå.',
          href: '/guider/fast-eller-rorligt-elpris',
        },
        {
          title: 'Läs din faktura',
          body: 'Förstå skillnaden mellan elhandel, elnät, avgifter och moms.',
          href: '/guider/sa-laser-du-din-elfaktura',
        },
      ]}
    />
  )
}
