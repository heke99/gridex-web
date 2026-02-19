import type { Metadata } from 'next'
import ElprisAreaLanding from '@/components/seo/ElprisAreaLanding'

export const metadata: Metadata = {
  title: 'Elpris SE3 – elpris idag & billiga elavtal',
  description:
    'Se elpris idag i SE3. Datadrivna elavtal med transparent specifikation: spot/portfölj/fastpris, påslag och månadsavgift.',
  alternates: { canonical: 'https://gridex.se/elpris-se3' },
}

export default function Page() {
  return <ElprisAreaLanding area="SE3" />
}