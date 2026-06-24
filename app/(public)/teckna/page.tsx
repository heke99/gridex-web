import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Ansök om elavtal – Gridex',
  description: 'Ansök om elavtal hos Gridex.',
  alternates: { canonical: 'https://gridex.se/teckna-avtal' },
  robots: { index: false, follow: true },
}

export default function TecknaRedirectPage() {
  permanentRedirect('/teckna-avtal')
}
