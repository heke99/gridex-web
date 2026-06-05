//components/layout/HeaderClient.tsx
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

function DesktopNavLink({
  href,
  label,
  pathname,
}: {
  href: string
  label: string
  pathname: string
}) {
  const active = pathname === href

  return (
    <Link
      href={href}
      className={[
        'relative inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm font-medium transition',
        active
          ? 'bg-white/10 text-white'
          : 'text-white/75 hover:bg-white/5 hover:text-white',
      ].join(' ')}
    >
      {label}
    </Link>
  )
}

export default function HeaderClient({ userEmail, roles = [] }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const safeRoles = useMemo(() => roles ?? [], [roles])

  const isAdmin =
    safeRoles.includes('admin') || safeRoles.includes('super_admin')
  const isSupport = safeRoles.includes('support')
  const isPartner = safeRoles.includes('partner')

  return (
    <header
      key={pathname}
      className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Öppna meny"
          >
            {mobileOpen ? 'Stäng' : 'Meny'}
          </button>

          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 font-bold text-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.10)]">
              G
            </div>

            <div className="leading-tight">
              <div className="font-bold tracking-tight text-white">Gridex AB</div>
              <div className="hidden text-xs text-gray-400 sm:block">
                Elhandelsbolag • kundservice • mina sidor
              </div>
            </div>
          </Link>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <DesktopNavLink href="/#rakna-elpris" label="Räkna elpris" pathname={pathname} />
          <DesktopNavLink href="/avtal" label="Elavtal" pathname={pathname} />
          <DesktopNavLink href="/aktuella-elpriser" label="Elpris idag" pathname={pathname} />
          <DesktopNavLink
            href="/kundservice"
            label="Kundservice"
            pathname={pathname}
          />
          <DesktopNavLink
            href="/dashboard"
            label="Mina sidor"
            pathname={pathname}
          />
        </div>

        <div className="flex items-center gap-3">
          {!userEmail ? (
            <Link
              href="/login"
              className="hidden rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500 hover:text-black md:inline-flex"
            >
              Logga in
            </Link>
          ) : null}

          <UserMenu
            email={userEmail ?? '—'}
            showAdminLink={isAdmin}
            roleLabel={safeRoles[0] ?? null}
            items={[
              { label: 'Mina sidor', href: '/dashboard' },
              ...(isAdmin ? [{ label: 'Adminpanel', href: '/admin' }] : []),
              ...(isSupport
                ? [{ label: 'Supportpanel', href: '/support-admin' }]
                : []),
              ...(isPartner ? [{ label: 'Partnerpanel', href: '/partner' }] : []),
            ]}
          />
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-black/80 md:hidden">
          <div className="mx-auto grid w-full max-w-7xl gap-2 px-6 py-4">
            <Link
              href="/#rakna-elpris"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85"
              onClick={() => setMobileOpen(false)}
            >
              Räkna elpris
            </Link>

            <Link
              href="/avtal"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85"
              onClick={() => setMobileOpen(false)}
            >
              Elavtal
            </Link>

            <Link
              href="/aktuella-elpriser"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85"
              onClick={() => setMobileOpen(false)}
            >
              Elpris idag
            </Link>

            <Link
              href="/kundservice"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85"
              onClick={() => setMobileOpen(false)}
            >
              Kundservice
            </Link>

            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85"
              onClick={() => setMobileOpen(false)}
            >
              Mina sidor
            </Link>

            {!userEmail ? (
              <Link
                href="/login"
                className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300"
                onClick={() => setMobileOpen(false)}
              >
                Logga in
              </Link>
            ) : null}

            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-white"
                onClick={() => setMobileOpen(false)}
              >
                Adminpanel
              </Link>
            )}

            {isSupport && (
              <Link
                href="/support-admin"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85"
                onClick={() => setMobileOpen(false)}
              >
                Supportpanel
              </Link>
            )}

            {isPartner && (
              <Link
                href="/partner"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85"
                onClick={() => setMobileOpen(false)}
              >
                Partnerpanel
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}