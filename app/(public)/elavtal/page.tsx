import type { Metadata } from 'next'
import AvtalPage from '../avtal/page'

export const metadata: Metadata = {
  title: 'Elavtal – rörligt, portfölj och fastpris',
  description:
    'Jämför Gridex elavtal och välj rörligt elpris, portföljavtal eller fastpris innan du tecknar.',
  alternates: { canonical: 'https://gridex.se/elavtal' },
}

export default AvtalPage
