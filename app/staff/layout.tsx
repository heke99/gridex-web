import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gridex · Personal', description: 'Gridex personalportal för kundservice.',
  robots: { index: false, follow: false },
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-950 text-white">{children}</div>
}
