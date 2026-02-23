// components/admin/AdminShell.tsx
import Link from 'next/link'
import { headers } from 'next/headers'

type NavItem = {
  label: string
  href: string
  description?: string
  /** If provided: user must have ANY of these permissions to access the item */
  permissionsAny?: string[]
  /** If provided: user must have ANY of these roles to access the item */
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
  // Either roles OR permissions can grant access.
  const roleOk = hasAny(roles, item.rolesAny)
  const permOk = hasAny(permissions, item.permissionsAny)

  // If neither guard is defined -> allowed.
  // If one defined -> must satisfy at least one of defined guards.
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
  const base = 'group block rounded-2xl px-3 py-2 transition border text-sm'

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
      <div aria-disabled="true" className={cls} title="Saknar behörighet">
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
  // Next.js doesn't expose pathname directly in server components.
  // We infer from headers when available (RSC), otherwise fallback.
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
        permissionsAny: ['contracts.write', 'contracts.read', 'admin.access'],
      },
    ],
  },
  {
    title: 'Priser',
    items: [
      {
        label: 'Pricing-versioner',
        href: '/admin/pricing',
        description: 'Versioner • clone • skriv • publish',
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
        description: 'pricing_version_audit • export',
        permissionsAny: ['admin.access'],
      },
    ],
  },
  {
    title: 'Spot & Portfölj',
    items: [
      {
        label: 'Månads-Spot',
        href: '/admin/monthly-spot',
        description: 'Importunderlag • priskomponenter',
        permissionsAny: ['admin.access'],
      },
      {
        label: 'Spot-inställningar',
        href: '/admin/spot-settings',
        description: 'gridex_spot_area_settings • SE1–SE4',
        permissionsAny: ['spot.write', 'admin.access'],
      },
      {
        label: 'Portfölj & Fastpris',
        href: '/admin/portfolio-pricing',
        description: 'gridex_portfolio_area_pricing • SE1–SE4',
        permissionsAny: ['portfolio.write', 'admin.access'],
      },
      {
        label: 'Postområden',
        href: '/admin/postal-areas',
        description: 'Koppling postnr → elområde',
        permissionsAny: ['admin.access'],
      },
    ],
  },
  {
    title: 'Validering',
    items: [
      {
        label: 'Kalkylator (preview)',
        href: '/admin/calculator',
        description: 'Se exakt kundspec per kWh + område',
        permissionsAny: ['admin.access'],
      },
      {
        label: 'Kundspecifikation (preview)',
        href: '/admin/customer-spec',
        description: 'Prisrad • markup • avgifter • månadsavgift',
        permissionsAny: ['admin.access'],
      },
    ],
  },
  {
    title: 'RBAC & Compliance',
    items: [
      {
        label: 'RBAC översikt',
        href: '/admin/rbac',
        description: 'roller • permissions • assignments',
        permissionsAny: ['rbac.read', 'rbac.write', 'admin.access'],
      },
      {
        label: 'Roles',
        href: '/admin/rbac/roles',
        description: 'Skapa/hantera roller',
        permissionsAny: ['rbac.write', 'admin.access'],
      },
      {
        label: 'Permissions',
        href: '/admin/rbac/permissions',
        description: 'Skapa/hantera permissions',
        permissionsAny: ['rbac.write', 'admin.access'],
      },
      {
        label: 'Assignments',
        href: '/admin/rbac/assignments',
        description: 'user_roles + user_permissions',
        permissionsAny: ['rbac.write', 'admin.access'],
      },
    ],
  },
  {
    title: 'Framtid',
    items: [
      {
        label: 'Settlements',
        href: '/admin/settlements',
        description: 'eSett/BRP • avräkning • placeholders',
        permissionsAny: ['admin.access'],
      },
      {
        label: 'Fakturering & betalningar',
        href: '/admin/billing',
        description: 'status • export • placeholders',
        permissionsAny: ['admin.access'],
      },
      {
        label: 'Support tickets',
        href: '/admin/support-tickets',
        description: 'ärenden • SLA • placeholders',
        permissionsAny: ['support.access', 'admin.access'],
      },
      {
        label: 'Integrationer',
        href: '/admin/integrations',
        description: 'status • webhook • placeholders',
        permissionsAny: ['admin.access'],
      },
      {
        label: 'Incident management',
        href: '/admin/incidents',
        description: 'drift • loggar • placeholders',
        permissionsAny: ['admin.access'],
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
        {/* Sidebar */}
        <aside className="border-r border-gray-800 bg-gray-950/40">
          <div className="px-6 py-5 border-b border-gray-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold tracking-tight">Gridex Admin</div>
                <div className="text-xs text-gray-400 mt-1">{email ?? ''}</div>
              </div>

              {roles.length > 0 && (
                <span className="text-[10px] border border-white/10 bg-white/5 px-2 py-1 rounded-full text-white/70">
                  {roles[0]}
                </span>
              )}
            </div>

            {permissions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {permissions.slice(0, 6).map((p) => (
                  <span
                    key={p}
                    className="text-[10px] border border-white/10 bg-white/5 px-2 py-1 rounded-full text-white/60"
                    title={p}
                  >
                    {p}
                  </span>
                ))}
                {permissions.length > 6 && (
                  <span className="text-[10px] text-white/50">
                    +{permissions.length - 6}
                  </span>
                )}
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
                        : path === it.href || path.startsWith(it.href + '/')
                    const allowed = canAccess(it, roles, permissions)

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

            <div className="pt-2 px-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center w-full border border-gray-800 hover:border-cyan-500/40 transition px-3 py-2 rounded-2xl text-gray-200"
              >
                Till publika sidan
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main */}
        <div>
          <div className="border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-300">
                  Enterprise Admin Console
                </div>
                <div className="text-[11px] text-gray-500">
                  RBAC • audit • pricing publish flow • SE1–SE4
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {email ? 'Session OK' : '—'}
              </div>
            </div>
          </div>

          <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
        </div>
      </div>
    </div>
  )
}