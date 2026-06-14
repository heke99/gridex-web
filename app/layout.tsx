import './globals.css'
import AuthSessionSync from '@/components/auth/AuthSessionSync'
import Footer from '@/components/layout/Footer'
import CookieBanner from '@/components/legal/CookieBanner'

export const metadata = {
  title: 'Gridex AB – Elhandelsbolag',
  description: 'Gridex AB erbjuder tydliga elavtal och prisberäkning för svenska elområden (SE1–SE4).',
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

        {/* Skip link for improved accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only absolute left-0 top-0 m-2 rounded bg-cyan-500 px-3 py-2 text-black"
        >
          Hoppa till innehåll
        </a>

        <main id="main-content" className="flex-1">
          {children}
        </main>

        <Footer />

        <CookieBanner />
      </body>
    </html>
  )
}