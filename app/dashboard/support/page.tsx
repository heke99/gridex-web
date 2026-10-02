import type { Metadata } from 'next'
import SupportPage from '@/components/support/SupportPage'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kundservice – Mina sidor', robots: { index: false, follow: false } }
export default function DashboardSupportPage() {
  return <SupportPage loginNext="/dashboard/support" />
}
