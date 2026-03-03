// app/layout.tsx
import './globals.css'
import AuthSessionSync from '@/components/auth/AuthSessionSync'
import Footer from '@/components/layout/Footer'
import CookieBanner from '@/components/legal/CookieBanner'

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
        <AuthSessionSync />

        <main className="flex-1">
          {children}
        </main>

        <Footer />

        {/* 🔥 SKA LIGGA INUTI BODY */}
        <CookieBanner />
      </body>
    </html>
  )
}