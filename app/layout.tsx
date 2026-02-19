// app/layout.tsx
import './globals.css'
import AuthSessionSync from '@/components/auth/AuthSessionSync'

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
      <body className="bg-black text-white min-h-screen">
        {/* Säkerställer att RSC refreshas korrekt vid login/logout */}
        <AuthSessionSync />
        {children}
      </body>
    </html>
  )
}