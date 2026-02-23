'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutForm from '@/components/account/LogoutForm'

type Role =
  | 'admin'
  | 'super_admin'
  | 'pricing_manager'
  | 'pricing_approver'
  | 'compliance_officer'
  | 'support'
  | 'partner'
  | 'customer'

type NavItem = {
  label: string
  href: string
  description?: string
  roles?: Role[]
  permissions?: string[] // NEW: optional permission restriction
}

type Props = {
  roles?: Role[]
  permissions?: string[]
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
    roles: ['admin', 'super_admin'],
    permissions: ['admin.access'], // NEW (does not break legacy)
  },
  {
    label: 'Supportpanel',
    href: '/support-admin',
    description: 'Kundärenden & tickets',
    roles: ['support', 'admin'],
    permissions: ['support.access'],
  },
  {
    label: 'Partnerpanel',
    href: '/partner',
    description: 'Partnerverktyg & statistik',
    roles: ['partner', 'admin'],
    permissions: ['partner.access'],
  },
]

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

function roleOk(item: NavItem, roles: Role[]) {
  if (!item.roles || item.roles.length === 0) return true
  return item.roles.some((r) => roles.includes(r))
}

function permissionOk(item: NavItem, permissions: string[]) {
  if (!item.permissions || item.permissions.length === 0) return true
  // allow if any permission matches
  return item.permissions.some((p) => permissions.includes(p))
}

export default function DashboardNav({ roles = [], permissions = [] }: Props) {
  const pathname = usePathname()

  const filteredRoleNav = ROLE_NAV.filter((item) => roleOk(item, roles) || permissionOk(item, permissions))
  const fullNav = [...BASE_NAV, ...filteredRoleNav]

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
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
                {active && <span className="text-[10px] text-cyan-400">●</span>}
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

      <div className="mt-3 border-t border-white/10 pt-3 px-2">
        <LogoutForm variant="ghost" />
      </div>
    </div>
  )
}