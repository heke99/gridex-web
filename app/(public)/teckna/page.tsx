import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Teckna elavtal – Gridex',
  description: 'Teckna elavtal hos Gridex.',
  alternates: { canonical: 'https://gridex.se/teckna-avtal' },
  robots: { index: false, follow: true },
}

export default function TecknaRedirectPage() {
  permanentRedirect('/teckna-avtal')
}
