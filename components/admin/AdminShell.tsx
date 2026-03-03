// components/admin/AdminShell.tsx
import Link from 'next/link'
import { headers } from 'next/headers'

type NavItem = {
  label: string
  href: string
  description?: string
  permissionsAny?: string[]
  rolesAny?: string[]
}

type NavGroup = {
  title: string
  items: NavItem[]
}

function hasAny(haystack: string[], needles?: string[]) {
  if (!needles || needles.length === 0) return true
  if (!haystack || haystack.length === 0) return false
  return needles.some((n) => haystack.includes(n))
}

function canAccess(item: NavItem, roles: string[], permissions: string[]) {
  const roleOk = hasAny(roles, item.rolesAny)
  const permOk = hasAny(permissions, item.permissionsAny)

  const hasRoleGuard = !!item.rolesAny && item.rolesAny.length > 0
  const hasPermGuard = !!item.permissionsAny && item.permissionsAny.length > 0

  if (!hasRoleGuard && !hasPermGuard) return true
  return (hasRoleGuard && roleOk) || (hasPermGuard && permOk)
}

function SidebarLink({
  item,
  active,
  allowed,
}: {
  item: NavItem
  active: boolean
  allowed: boolean
}) {
  const base =
    'group block rounded-2xl px-3 py-2 transition border text-sm'

  const cls = allowed
    ? [
        base,
        active
          ? 'bg-cyan-500/15 border-cyan-500/30 text-white'
          : 'border-transparent text-white/80 hover:bg-white/5',
      ].join(' ')
    : [
        base,
        active
          ? 'bg-white/5 border-white/10 text-white/70'
          : 'border-transparent text-white/40',
        'cursor-not-allowed',
      ].join(' ')

  const inner = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{item.label}</span>
        {allowed ? (
          active ? (
            <span className="text-[10px] text-cyan-400">●</span>
          ) : (
            <span className="text-white/20">→</span>
          )
        ) : (
          <span className="text-white/25">🔒</span>
        )}
      </div>

      {item.description && (
        <div className="mt-0.5 text-[11px] text-white/55 group-hover:text-white/70">
          {item.description}
        </div>
      )}
    </>
  )

  if (!allowed) {
    return (
      <div
        aria-disabled="true"
        className={cls}
        title="Saknar behörighet"
      >
        {inner}
      </div>
    )
  }

  return (
    <Link href={item.href} className={cls}>
      {inner}
    </Link>
  )
}

async function getActivePathnameFromHeaders(): Promise<string> {
  const h = await headers()
  return h.get('x-invoke-path') || h.get('next-url') || ''
}

const NAV: NavGroup[] = [
  {
    title: 'Översikt',
    items: [
      {
        label: 'Dashboard',
        href: '/admin',
        description: 'KPI • status • genvägar',
        permissionsAny: ['admin.access'],
      },
    ],
  },

  {
    title: 'Avtal',
    items: [
      {
        label: 'Avtalsprodukter',
        href: '/admin/contracts',
        description: 'CRUD • aktiv/inaktiv • featured',
        permissionsAny: [
          'contracts.write',
          'contracts.read',
          'admin.access',
        ],
      },
      {
        label: 'Signerade avtal',
        href: '/admin/agreements',
        description: 'PDF • juridik • finalize • export',
        permissionsAny: [
          'agreements.read',
          'agreements.write',
          'admin.access',
        ],
      },
    ],
  },

  {
    title: 'Compliance',
    items: [
      {
        label: 'Juridiska loggar',
        href: '/admin/legal-acceptances',
        description:
          'IP • user agent • version hash • revisionsspår',
        permissionsAny: [
          'compliance.read',
          'admin.access',
        ],
      },
      {
        label: 'Avtals-audit',
        href: '/admin/audit/agreements',
        description: 'finalize • sign • system events',
        permissionsAny: [
          'compliance.read',
          'admin.access',
        ],
      },
    ],
  },

  {
    title: 'Priser',
    items: [
      {
        label: 'Pricing-versioner',
        href: '/admin/pricing',
        description:
          'Versioner • clone • skriv • publish',
        permissionsAny: [
          'pricing.write',
          'pricing.publish',
          'pricing.publish_prod',
          'admin.access',
        ],
      },
      {
        label: 'Audit: pricing',
        href: '/admin/audit/pricing',
        description:
          'pricing_version_audit • export',
        permissionsAny: ['admin.access'],
      },
    ],
  },

  {
    title: 'RBAC & Security',
    items: [
      {
        label: 'RBAC översikt',
        href: '/admin/rbac',
        description:
          'roller • permissions • assignments',
        permissionsAny: [
          'rbac.read',
          'rbac.write',
          'admin.access',
        ],
      },
      {
        label: 'Roles',
        href: '/admin/rbac/roles',
        description: 'Skapa/hantera roller',
        permissionsAny: [
          'rbac.write',
          'admin.access',
        ],
      },
      {
        label: 'Permissions',
        href: '/admin/rbac/permissions',
        description: 'Skapa/hantera permissions',
        permissionsAny: [
          'rbac.write',
          'admin.access',
        ],
      },
      {
        label: 'Assignments',
        href: '/admin/rbac/assignments',
        description:
          'user_roles + user_permissions',
        permissionsAny: [
          'rbac.write',
          'admin.access',
        ],
      },
    ],
  },
]

export default async function AdminShell({
  email,
  roles = [],
  permissions = [],
  children,
}: {
  email: string | null
  roles?: string[]
  permissions?: string[]
  children: React.ReactNode
}) {
  const path = await getActivePathnameFromHeaders()

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="grid lg:grid-cols-[300px_1fr]">
        <aside className="border-r border-gray-800 bg-gray-950/40">
          <div className="px-6 py-5 border-b border-gray-800">
            <div className="font-bold tracking-tight">
              Gridex Enterprise Admin
            </div>

            <div className="text-xs text-gray-400 mt-2">
              {email ?? ''}
            </div>

            {roles.length > 0 && (
              <div className="mt-2 text-[10px] text-cyan-400">
                Role: {roles.join(', ')}
              </div>
            )}
          </div>

          <nav className="px-4 py-4 space-y-4 text-sm">
            {NAV.map((g) => (
              <div key={g.title}>
                <div className="px-3 pb-2 text-xs text-gray-500 uppercase tracking-wider">
                  {g.title}
                </div>

                <div className="space-y-1">
                  {g.items.map((it) => {
                    const active =
                      it.href === '/admin'
                        ? path === '/admin'
                        : path === it.href ||
                          path.startsWith(it.href + '/')

                    const allowed = canAccess(
                      it,
                      roles,
                      permissions
                    )

                    return (
                      <SidebarLink
                        key={it.href}
                        item={it}
                        active={active}
                        allowed={allowed}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div>
          <div className="border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-300">
                  Enterprise Control Panel
                </div>
                <div className="text-[11px] text-gray-500">
                  RLS enforced • hashed legal docs • signed PDFs
                </div>
              </div>

              <div className="text-xs text-gray-500">
                {email ? 'Secure session active' : '—'}
              </div>
            </div>
          </div>

          <main className="max-w-7xl mx-auto px-6 py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}