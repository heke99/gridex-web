import type { Metadata } from 'next'
import HubPage from '@/components/seo/HubPage'
import { SITE_URL, elprisPages } from '@/lib/seo/content'

export const metadata: Metadata = {
  title: 'Elpriser – elpris idag, spotpris och SE1–SE4',
  description:
    'Se elpriser hos Gridex: elpris idag, elpris nu, spotpris, historiska elpriser, prognos, SE1, SE2, SE3 och SE4.',
  alternates: { canonical: `${SITE_URL}/elpriser` },
  robots: { index: true, follow: true },
}

export default function ElpriserHubPage() {
  return (
    <HubPage
      title="Elpriser, spotpris och elområde"
      description="Här samlar Gridex sidorna som hjälper dig förstå elpris idag, spotpris, historik, prognos och skillnader mellan SE1, SE2, SE3 och SE4. Börja med prisdata och gå sedan vidare till rätt elavtal."
      eyebrow="Elpris-hub"
      path="/elpriser"
      pages={elprisPages}
      groups={[
        {
          title: 'Aktuellt elpris',
          body: 'Se dagens marknadspris och förstå varför aktuellt spotpris inte är samma sak som totalpris på fakturan.',
          href: '/elpriser/elpris-idag',
        },
        {
          title: 'Elområden SE1–SE4',
          body: 'Jämför prisbild och elavtal utifrån rätt svenskt elområde.',
          href: '/guider/elomraden-se1-se2-se3-se4',
        },
        {
          title: 'Välj avtalsform',
          body: 'Gå från prisdata till tydlig jämförelse mellan rörligt, fast och kvartspris.',
          href: '/elavtal/jamfor-elavtal',
        },
      ]}
    />
  )
}
