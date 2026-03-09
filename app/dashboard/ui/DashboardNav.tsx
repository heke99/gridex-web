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
  permissions?: string[]
}

type Props = {
  roles?: Role[]
  permissions?: string[]
}

const BASE_NAV: NavItem[] = [
  {
    label: 'Översikt',
    href: '/dashboard',
    description: 'Samlad överblick',
  },
  {
    label: 'Mina avtal',
    href: '/dashboard/contracts',
    description: 'Avtal och status',
  },
  {
    label: 'Fakturor',
    href: '/dashboard/invoices',
    description: 'Belopp och underlag',
  },
  {
    label: 'Profil',
    href: '/dashboard/profile',
    description: 'Konto och kontaktuppgifter',
  },
  {
    label: 'Support',
    href: '/dashboard/support',
    description: 'Ärenden och meddelanden',
  },
]

const ROLE_NAV: NavItem[] = [
  {
    label: 'Adminpanel',
    href: '/admin',
    description: 'Administration',
    roles: ['admin', 'super_admin'],
    permissions: ['admin.access'],
  },
  {
    label: 'Supportpanel',
    href: '/support-admin',
    description: 'Kundärenden',
    roles: ['support', 'admin', 'super_admin'],
    permissions: ['support.access'],
  },
  {
    label: 'Partnerpanel',
    href: '/partner',
    description: 'Partneröversikt',
    roles: ['partner', 'admin', 'super_admin'],
    permissions: ['partner.access'],
  },
]

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard'
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function roleOk(item: NavItem, roles: Role[]) {
  if (!item.roles || item.roles.length === 0) {
    return true
  }

  return item.roles.some((role) => roles.includes(role))
}

function permissionOk(item: NavItem, permissions: string[]) {
  if (!item.permissions || item.permissions.length === 0) {
    return true
  }

  return item.permissions.some((permission) => permissions.includes(permission))
}

function shouldShowItem(item: NavItem, roles: Role[], permissions: string[]) {
  const hasRoleRestriction = Boolean(item.roles && item.roles.length > 0)
  const hasPermissionRestriction = Boolean(
    item.permissions && item.permissions.length > 0
  )

  if (!hasRoleRestriction && !hasPermissionRestriction) {
    return true
  }

  if (hasRoleRestriction && roleOk(item, roles)) {
    return true
  }

  if (hasPermissionRestriction && permissionOk(item, permissions)) {
    return true
  }

  return false
}

function getRoleSummary(roles: Role[]): string | null {
  if (roles.includes('super_admin') || roles.includes('admin')) {
    return 'Admin'
  }

  if (roles.includes('support')) {
    return 'Support'
  }

  if (roles.includes('partner')) {
    return 'Partner'
  }

  return null
}

export default function DashboardNav({
  roles = [],
  permissions = [],
}: Props) {
  const pathname = usePathname()

  const filteredRoleNav = ROLE_NAV.filter((item) =>
    shouldShowItem(item, roles, permissions)
  )

  const fullNav = [...BASE_NAV, ...filteredRoleNav]
  const roleSummary = getRoleSummary(roles)

  return (
    <>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
        <div className="px-3 py-3">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold">
            <span>Mina sidor</span>

            {roleSummary ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/60">
                {roleSummary}
              </span>
            ) : null}
          </div>

          <div className="mt-1 text-xs text-white/60">
            Hantera konto, avtal, fakturor och support.
          </div>
        </div>

        <nav className="mt-2 hidden space-y-1 md:block">
          {fullNav.map((item) => {
            const active = isActive(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'group block rounded-2xl px-3 py-2 transition',
                  active
                    ? 'border border-cyan-500/30 bg-cyan-500/15 text-white'
                    : 'border border-transparent text-white/80 hover:bg-white/5',
                ].join(' ')}
              >
                <div className="flex items-center justify-between text-sm font-medium">
                  {item.label}
                  {active ? (
                    <span className="text-[10px] text-cyan-400">●</span>
                  ) : null}
                </div>

                {item.description ? (
                  <div className="text-[11px] text-white/60 group-hover:text-white/70">
                    {item.description}
                  </div>
                ) : null}
              </Link>
            )
          })}
        </nav>

        <div className="mt-3 hidden border-t border-white/10 px-2 pt-3 md:block">
          <LogoutForm variant="ghost" />
        </div>

        <div className="md:hidden">
          <div className="mt-2 -mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max gap-2">
              {fullNav.map((item) => {
                const active = isActive(pathname, item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'inline-flex min-h-[44px] items-center rounded-2xl border px-4 py-2 text-sm font-medium whitespace-nowrap transition',
                      active
                        ? 'border-cyan-500/30 bg-cyan-500/15 text-white'
                        : 'border-white/10 bg-black/20 text-white/80 hover:bg-white/5',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="mt-3 border-t border-white/10 px-2 pt-3">
            <LogoutForm variant="ghost" />
          </div>
        </div>
      </div>
    </>
  )
}