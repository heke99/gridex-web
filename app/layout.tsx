import './globals.css'
import { Geist, Geist_Mono } from 'next/font/google'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata = {
  title: 'Gridex AB – Elhandelsbolag',
  description: 'Gridex AB erbjuder tydliga elavtal och prisberäkning för svenska elområden (SE1–SE4).',
  icons: {
    icon: [{ url: '/icon.svg?v=20260820', type: 'image/svg+xml' }],
    shortcut: '/icon.svg?v=20260820',
    apple: '/icon.svg?v=20260820',
  },
}

export default function RootLayout({
  children,
  chrome,
}: {
  children: React.ReactNode
  chrome: React.ReactNode
}) {
  return (
    <html lang="sv">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only absolute left-0 top-0 z-[100] m-2 rounded-lg bg-[var(--gx-accent)] px-3 py-2 font-medium text-[var(--gx-accent-ink)]"
        >
          Hoppa till innehåll
        </a>

        <main id="main-content" className="flex-1">
          {children}
        </main>

        {chrome}
      </body>
    </html>
  )
}
