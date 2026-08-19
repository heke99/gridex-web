//app/dashboard/layout.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import UserMenu from '@/components/account/UserMenu'
import DashboardNav from './ui/DashboardNav'
import { loadUserPermissionsWithClient } from '@/lib/auth/permissions'
import { PermissionsProvider } from '@/components/auth/PermissionsProvider'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

type Role =
  | 'admin'
  | 'super_admin'
  | 'pricing_manager'
  | 'pricing_approver'
  | 'compliance_officer'
  | 'support'
  | 'partner'
  | 'customer'

type RoleRow = {
  role: string
  is_active: boolean | null
}

function buildLoginRedirect(nextPath: string) {
  const qs = new URLSearchParams()
  qs.set('next', nextPath)
  return `/login?${qs.toString()}`
}

function mapRole(value: string): Role | null {
  switch (value) {
    case 'admin':
    case 'super_admin':
    case 'pricing_manager':
    case 'pricing_approver':
    case 'compliance_officer':
    case 'support':
    case 'partner':
    case 'customer':
      return value
    default:
      return null
  }
}

function getUserMenuRoleLabel(roles: Role[]): string | null {
  if (roles.includes('super_admin')) return 'Admin'
  if (roles.includes('admin')) return 'Admin'
  if (roles.includes('support')) return 'Support'
  if (roles.includes('partner')) return 'Partner'
  return null
}

function getVisibleRoleBadges(roles: Role[]): string[] {
  const badges: string[] = []

  if (roles.includes('super_admin') || roles.includes('admin')) {
    badges.push('Admin')
  }

  if (roles.includes('support')) {
    badges.push('Support')
  }

  if (roles.includes('partner')) {
    badges.push('Partner')
  }

  return badges
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(buildLoginRedirect('/dashboard'))
  }

  const [{ data: roleRows }, permissions] = await Promise.all([
    supabase
      .from('user_roles')
      .select('role,is_active')
      .eq('user_id', user.id)
      .returns<RoleRow[]>(),
    loadUserPermissionsWithClient(supabase, user.id),
  ])

  const roles: Role[] = (roleRows ?? [])
    .filter((row) => row.is_active !== false)
    .map((row) => mapRole(row.role))
    .filter((role): role is Role => role !== null)

  const isAdmin = roles.includes('admin') || roles.includes('super_admin')
  const isSupport = roles.includes('support')
  const isPartner = roles.includes('partner')

  const roleLabel = getUserMenuRoleLabel(roles)
  const roleBadges = getVisibleRoleBadges(roles)

  return (
    <PermissionsProvider permissions={permissions}>
      <div className="flex min-h-screen flex-col bg-black text-white">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <Link
                  href="/"
                  className="truncate text-sm font-semibold tracking-tight sm:text-base"
                >
                  Gridex <span className="text-white/60">Mina sidor</span>
                </Link>

                <div className="lg:hidden">
                  <UserMenu
                    email={user.email ?? '—'}
                    showAdminLink={isAdmin}
                    roleLabel={roleLabel}
                    items={[
                      { label: 'Översikt', href: '/dashboard' },
                      { label: 'Profil', href: '/dashboard/profile' },
                      ...(isPartner
                        ? [{ label: 'Partnerpanel', href: '/partner' }]
                        : []),
                      ...(isSupport
                        ? [{ label: 'Supportpanel', href: '/support-admin' }]
                        : []),
                    ]}
                  />
                </div>
              </div>

              <div className="text-xs text-white/60">
                Konto • avtal • fakturor • dokument
              </div>

              {roleBadges.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {roleBadges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <UserMenu
                email={user.email ?? '—'}
                showAdminLink={isAdmin}
                roleLabel={roleLabel}
                items={[
                  { label: 'Översikt', href: '/dashboard' },
                  { label: 'Profil', href: '/dashboard/profile' },
                  ...(isPartner ? [{ label: 'Partnerpanel', href: '/partner' }] : []),
                  ...(isSupport ? [{ label: 'Supportpanel', href: '/support-admin' }] : []),
                ]}
              />
            </div>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-4 py-6 sm:px-6 md:py-8 md:grid-cols-[280px_1fr]">
          <aside className="md:sticky md:top-[88px] md:h-[calc(100vh-88px-32px)]">
            <DashboardNav roles={roles} permissions={permissions} />
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </PermissionsProvider>
  )
}
