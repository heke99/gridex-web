'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import UserMenu from '@/components/account/UserMenu'

type Role =
  | 'admin'
  | 'super_admin'
  | 'pricing_manager'
  | 'pricing_approver'
  | 'compliance_officer'
  | 'support'
  | 'partner'
  | 'customer'

type Props = {
  userEmail: string | null
  roles?: Role[]
}

export default function HeaderClient({ userEmail, roles = [] }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const safeRoles = useMemo(() => roles ?? [], [roles])

  const isAdmin = safeRoles.includes('admin') || safeRoles.includes('super_admin')
  const isSupport = safeRoles.includes('support')
  const isPartner = safeRoles.includes('partner')

  // IMPORTANT: no setState in useEffect
  // mobileOpen toggles via onClick only; key={pathname} ensures reset on navigation

  return (
    <header
      key={pathname}
      className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
            onClick={() => setMobileOpen((v) => !v)}
          >
            Meny
          </button>

          <Link href="/" className="text-sm font-semibold tracking-tight">
            Gridex
          </Link>

          <div className="hidden md:block text-xs text-white/60">
            Elavtal • kalkylator • kundservice
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/avtal"
            className="hidden md:inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-white/80 hover:bg-white/10"
          >
            Avtal
          </Link>
          <Link
            href="/kundservice"
            className="hidden md:inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-white/80 hover:bg-white/10"
          >
            Kundservice
          </Link>

          <UserMenu
            email={userEmail ?? '—'}
            showAdminLink={isAdmin}
            roleLabel={safeRoles[0] ?? null}
            items={[
              { label: 'Mina sidor', href: '/dashboard' },
              ...(isAdmin ? [{ label: 'Adminpanel', href: '/admin' }] : []),
              ...(isSupport ? [{ label: 'Supportpanel', href: '/support-admin' }] : []),
              ...(isPartner ? [{ label: 'Partnerpanel', href: '/partner' }] : []),
            ]}
          />
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-black/70">
          <div className="mx-auto w-full max-w-7xl px-6 py-4 grid gap-2">
            <Link
              href="/avtal"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
              onClick={() => setMobileOpen(false)}
            >
              Avtal
            </Link>
            <Link
              href="/kundservice"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
              onClick={() => setMobileOpen(false)}
            >
              Kundservice
            </Link>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
              onClick={() => setMobileOpen(false)}
            >
              Mina sidor
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-white"
                onClick={() => setMobileOpen(false)}
              >
                Adminpanel
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}