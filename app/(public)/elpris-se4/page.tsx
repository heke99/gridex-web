import type { Metadata } from 'next'
import ElprisAreaLanding from '@/components/seo/ElprisAreaLanding'

export const metadata: Metadata = {
  title: 'Elpris SE4 – elpris idag & billiga elavtal',
  description:
    'Se elpris idag i SE4. Datadrivna elavtal med transparent specifikation: spot/portfölj/fastpris, påslag och månadsavgift.',
  alternates: { canonical: 'https://gridex.se/elpris-se4' },
}

export default function Page() {
  return <ElprisAreaLanding area="SE4" />
}