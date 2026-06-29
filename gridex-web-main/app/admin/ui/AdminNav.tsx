'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type AccessRule = {
  anyOf?: string[]
  allOf?: string[]
}

type NavItemConfig = {
  href: string
  label: string
  subtitle: string
  rule?: AccessRule
}

function canAccess(permissions: string[], rule?: AccessRule): boolean {
  if (!rule) return true

  if (rule.allOf && !rule.allOf.every((permission) => permissions.includes(permission))) {
    return false
  }

  if (rule.anyOf && !rule.anyOf.some((permission) => permissions.includes(permission))) {
    return false
  }

  return true
}

function isItemActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavItem({
  href,
  label,
  subtitle,
  active,
}: {
  href: string
  label: string
  subtitle: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={[
        'group flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 transition',
        active
          ? 'border-cyan-500/30 bg-cyan-500/10'
          : 'border-white/10 bg-black/30 hover:bg-white/5',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-white/90">{label}</div>
        <div className="mt-0.5 truncate text-[11px] text-white/50">
          {subtitle}
        </div>
      </div>

      <div
        className={[
          'shrink-0 text-sm transition',
          active ? 'text-cyan-200' : 'text-white/25 group-hover:text-white/45',
        ].join(' ')}
      >
        →
      </div>
    </Link>
  )
}

export default function AdminNav({
  permissions,
  roles,
}: {
  permissions: string[]
  roles: string[]
}) {
  const pathname = usePathname()

  const operationsItems: NavItemConfig[] = [
    {
      href: '/admin',
      label: 'Dashboard',
      subtitle: 'Översikt, KPI:er och status',
      rule: { anyOf: ['admin.access', 'support_tickets.manage'] },
    },
    {
      href: '/admin/contracts',
      label: 'Avtal',
      subtitle: 'contract_products, publish, sortering',
      rule: { anyOf: ['contracts.read', 'contracts.write', 'admin.access'] },
    },
    {
      href: '/admin/pricing',
      label: 'Pricing & versioner',
      subtitle: 'versionsflöde, publicering, audit',
      rule: {
        anyOf: [
          'pricing.read',
          'pricing.write',
          'pricing.publish',
          'pricing.publish_prod',
          'admin.access',
        ],
      },
    },
    {
      href: '/admin/spot-settings',
      label: 'Spot Settings',
      subtitle: 'SE1–SE4 och area-inställningar',
      rule: {
        anyOf: [
          'spot.read',
          'spot.write',
          'spot.publish',
          'pricing.write',
          'admin.access',
        ],
      },
    },
    {
      href: '/admin/monthly-spot',
      label: 'Månads-spot',
      subtitle: 'aktiv spot-basis, publish och rollback',
      rule: {
        anyOf: [
          'spot.read',
          'spot.write',
          'spot.publish',
          'pricing.write',
          'admin.access',
        ],
      },
    },
    {
      href: '/admin/portfolio-pricing',
      label: 'Portfölj & fastpris',
      subtitle: 'SE1–SE4 priser för portfolio/fixed',
      rule: {
        anyOf: [
          'portfolio.read',
          'portfolio.write',
          'pricing.write',
          'admin.access',
        ],
      },
    },
    {
      href: '/admin/calculator',
      label: 'Kalkylator',
      subtitle: 'preview och validering',
      rule: { anyOf: ['admin.access'] },
    },
    {
      href: '/admin/customer-spec',
      label: 'Kundspec-preview',
      subtitle: 'kontroll av kundens prisrad',
      rule: { anyOf: ['admin.access'] },
    },
    {
      href: '/admin/rbac/roles',
      label: 'RBAC • Roller',
      subtitle: 'roller och role_permissions',
      rule: { anyOf: ['rbac.write', 'admin.access'] },
    },
    {
      href: '/admin/rbac/permissions',
      label: 'RBAC • Permissions',
      subtitle: 'registry för access control',
      rule: { anyOf: ['rbac.write', 'admin.access'] },
    },
    {
      href: '/admin/support-tickets',
      label: 'Supportärenden',
      subtitle: 'tilldelning, status, svar',
      rule: { anyOf: ['admin.access', 'support_tickets.manage'] },
    },
    {
      href: '/admin/billing',
      label: 'Fakturering',
      subtitle: 'betalningar, ekonomi och CIS-flöden',
      rule: { anyOf: ['admin.access'] },
    },
  ]

  const visibleOperations = operationsItems.filter((item) =>
    canAccess(permissions, item.rule)
  )

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">
          Navigation
        </div>

        <div className="mt-4 space-y-2">
          {visibleOperations.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              subtitle={item.subtitle}
              active={isItemActive(pathname, item.href)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">
          Behörighet
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <div className="text-[11px] text-white/45">Roller</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {roles.length > 0 ? (
                roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/75"
                  >
                    {role}
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/60">
                  Ingen roll
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-white/45">Permissions</div>
            <div className="mt-2 text-xs text-white/75">
              {permissions.length > 0
                ? `${permissions.length} st laddade`
                : 'Inga permissions hittades'}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-[11px] leading-5 text-white/55">
            Menyn byggs dynamiskt från användarens permissions. Det gör att
            endast relevanta adminmoduler exponeras för rätt roll.
          </div>
        </div>
      </div>
    </div>
  )
}