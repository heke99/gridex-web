'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import UserMenu from '@/components/account/UserMenu'

type Role =
  | 'admin'
  | 'support'
  | 'partner'
  | 'customer'

type Props = {
  userEmail: string | null
  roles: Role[]
}

export default function HeaderClient({ userEmail, roles }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isLoggedIn = !!userEmail
  const safeRoles = roles ?? []

  const isAdmin = safeRoles.includes('admin')
  const isSupport = safeRoles.includes('support')
  const isPartner = safeRoles.includes('partner')

  /* ===============================
     Stable Menu Items
  =============================== */
  const menuItems = useMemo(() => {
    const items = [
      { label: 'Profil', href: '/dashboard/profile' },
      { label: 'Mina sidor', href: '/dashboard' },
    ]

    if (isPartner) {
      items.push({ label: 'Partnerpanel', href: '/partner' })
    }

    if (isSupport) {
      items.push({ label: 'Supportpanel', href: '/support-admin' })
    }

    return items
  }, [isPartner, isSupport])

  const primaryRole = safeRoles[0] ?? null

  const closeMobile = () => setOpen(false)

  return (
    <header className="border-b border-gray-800 bg-black/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* LOGO */}
        <Link href="/" className="text-xl font-bold tracking-tight">
          Gridex
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-8 text-sm text-gray-300">

          <Link
            href="/avtal"
            className={pathname.startsWith('/avtal') ? 'text-white' : 'hover:text-white'}
          >
            Elavtal
          </Link>

          <Link
            href="/teckna"
            className={pathname.startsWith('/teckna') ? 'text-white' : 'hover:text-white'}
          >
            Teckna elavtal
          </Link>

          <Link
            href="/kundservice"
            className={pathname.startsWith('/kundservice') ? 'text-white' : 'hover:text-white'}
          >
            Kundservice
          </Link>

          {!isLoggedIn && (
            <Link
              href="/login"
              className="border border-cyan-500 px-4 py-2 rounded-lg text-cyan-400 hover:bg-cyan-500 hover:text-black transition"
            >
              Logga in
            </Link>
          )}

          {isLoggedIn && (
            <UserMenu
              email={userEmail!}
              showAdminLink={isAdmin}
              items={menuItems}
              roleLabel={primaryRole}
            />
          )}
        </nav>

        {/* MOBILE TOGGLE */}
        <button
          aria-label="Öppna meny"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className="md:hidden text-gray-300"
        >
          ☰
        </button>
      </div>

      {/* MOBILE NAV */}
      {open && (
        <div
          key={pathname}
          className="md:hidden px-6 pb-4 space-y-3 text-gray-300 border-t border-white/10"
        >
          <Link href="/avtal" onClick={closeMobile}>Elavtal</Link>
          <Link href="/teckna" onClick={closeMobile}>Teckna elavtal</Link>
          <Link href="/kundservice" onClick={closeMobile}>Kundservice</Link>

          {!isLoggedIn && (
            <Link href="/login" onClick={closeMobile}>
              Logga in
            </Link>
          )}

          {isLoggedIn && (
            <div className="pt-2 border-t border-white/10">
              <UserMenu
                email={userEmail!}
                showAdminLink={isAdmin}
                items={menuItems}
                roleLabel={primaryRole}
              />
            </div>
          )}
        </div>
      )}
    </header>
  )
}