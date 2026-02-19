// app/(public)/kundservice/page.tsx

import type { Metadata } from 'next'
import KundserviceClient from './KundserviceClient'

export const metadata: Metadata = {
  title: 'Kundservice – kontakta Gridex',
  description:
    'Kontakta Gridex kundservice. Skicka ärende via formulär eller maila support@gridex.se.',
}

export default function KundservicePage() {
  return <KundserviceClient />
}