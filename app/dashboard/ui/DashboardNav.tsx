'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutForm from '@/components/account/LogoutForm'

type Role =
  | 'admin'
  | 'support'
  | 'partner'
  | 'customer'

type NavItem = {
  label: string
  href: string
  description?: string
  roles?: Role[] // optional role restriction
}

type Props = {
  roles?: Role[]
}

const BASE_NAV: NavItem[] = [
  { label: 'Översikt', href: '/dashboard', description: 'Status & genvägar' },
  { label: 'Mina avtal', href: '/dashboard/contracts', description: 'Produkt & villkor' },
  { label: 'Fakturor', href: '/dashboard/invoices', description: 'PDF & betalningsstatus' },
  { label: 'Profil', href: '/dashboard/profile', description: 'Kontaktuppgifter' },
  { label: 'Support', href: '/dashboard/support', description: 'Ärenden & hjälp' },
]

const ROLE_NAV: NavItem[] = [
  {
    label: 'Adminpanel',
    href: '/admin',
    description: 'Systemadministration',
    roles: ['admin'],
  },
  {
    label: 'Supportpanel',
    href: '/support-admin',
    description: 'Kundärenden & tickets',
    roles: ['support', 'admin'],
  },
  {
    label: 'Partnerpanel',
    href: '/partner',
    description: 'Partnerverktyg & statistik',
    roles: ['partner', 'admin'],
  },
]

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

export default function DashboardNav({ roles = [] }: Props) {
  const pathname = usePathname()

  const filteredRoleNav = ROLE_NAV.filter((item) =>
    item.roles?.some((role) => roles.includes(role))
  )

  const fullNav = [...BASE_NAV, ...filteredRoleNav]

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-3">

      {/* HEADER */}
      <div className="px-3 py-3">
        <div className="text-sm font-semibold flex items-center justify-between">
          Mina sidor
          {roles.length > 0 && (
            <span className="text-[10px] border border-white/10 bg-white/5 px-2 py-1 rounded-full text-white/60">
              {roles.join(', ')}
            </span>
          )}
        </div>

        <div className="mt-1 text-xs text-white/60">
          Hantera konto, avtal och fakturor.
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="mt-2 space-y-1">
        {fullNav.map((it) => {
          const active = isActive(pathname, it.href)

          return (
            <Link
              key={it.href}
              href={it.href}
              className={[
                'block rounded-2xl px-3 py-2 transition group',
                active
                  ? 'bg-cyan-500/15 border border-cyan-500/30 text-white'
                  : 'border border-transparent text-white/80 hover:bg-white/5',
              ].join(' ')}
            >
              <div className="text-sm font-medium flex items-center justify-between">
                {it.label}

                {active && (
                  <span className="text-[10px] text-cyan-400">
                    ●
                  </span>
                )}
              </div>

              {it.description && (
                <div className="text-[11px] text-white/60 group-hover:text-white/70">
                  {it.description}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* FOOTER */}
      <div className="mt-3 border-t border-white/10 pt-3 px-2">
        <LogoutForm variant="ghost" />
      </div>
    </div>
  )
}