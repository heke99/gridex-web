// app/layout.tsx
import './globals.css'
import AuthSessionSync from '@/components/auth/AuthSessionSync'
import Header from '@/app/layout/header'

export const metadata = {
  title: 'Gridex – Energy Fintech',
  description: 'Enterprise energy pricing platform for Sweden (SE1–SE4).',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv">
      <body className="bg-black text-white min-h-screen flex flex-col">

        {/* GLOBAL HEADER */}
        <Header />

        {/* Auth sync (RSC refresh) */}
        <AuthSessionSync />

        {/* Page Content */}
        <main className="flex-1">
          {children}
        </main>

      </body>
    </html>
  )
}