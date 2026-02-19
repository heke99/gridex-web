import Link from 'next/link'
import type { AdminRole } from '@/lib/auth/rbac'
import AdminNav from './AdminNav'
import LogoutButton from './LogoutButton'

export default function AdminShell({
  children,
  userEmail,
  role,
}: {
  children: React.ReactNode
  userEmail: string
  role: AdminRole
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-sm font-semibold tracking-tight">
              Gridex <span className="text-white/60">Admin</span>
            </Link>
            <div className="hidden text-xs text-white/60 md:block">
              {userEmail ? userEmail : '—'} • <span className="text-white/80">{role}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden h-9 items-center justify-center rounded-xl border border-white/10 bg-black/30 px-3 text-xs text-white/80 hover:bg-black/20 md:inline-flex"
            >
              Publik sida
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 py-8 md:grid-cols-[240px_1fr]">
        <aside className="md:sticky md:top-[76px] md:h-[calc(100vh-76px-32px)]">
          <AdminNav role={role} />
        </aside>

        <main className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}