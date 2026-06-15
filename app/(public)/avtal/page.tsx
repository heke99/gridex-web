import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Elavtal – Gridex',
  description: 'Jämför Gridex elavtal.',
  alternates: { canonical: 'https://gridex.se/elavtal' },
  robots: { index: false, follow: true },
}

export default function AvtalRedirectPage() {
  redirect('/elavtal')
}
