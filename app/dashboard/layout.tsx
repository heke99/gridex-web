import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import UserMenu from '@/components/account/UserMenu'
import DashboardNav from './ui/DashboardNav'
import { loadUserPermissions } from '@/lib/auth/permissions'
import { PermissionsProvider } from '@/components/auth/PermissionsProvider'

export const dynamic = 'force-dynamic'

type Role =
  | 'admin'
  | 'super_admin'
  | 'pricing_manager'
  | 'pricing_approver'
  | 'compliance_officer'
  | 'support'
  | 'partner'
  | 'customer'

function buildLoginRedirect(nextPath: string) {
  const qs = new URLSearchParams()
  qs.set('next', nextPath)
  return `/login?${qs.toString()}`
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

  if (!user) redirect(buildLoginRedirect('/dashboard'))

  // Roles (existing multi-role system)
  let roles: Role[] = []

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role,is_active')
    .eq('user_id', user.id)

  if (roleRows) {
    roles = roleRows
      .filter((r) => r.is_active !== false)
      .map((r) => r.role as Role)
  }

  const isAdmin = roles.includes('admin') || roles.includes('super_admin')
  const isSupport = roles.includes('support')
  const isPartner = roles.includes('partner')

  // Permissions (new)
  const permissions = await loadUserPermissions(user.id)

  return (
    <PermissionsProvider permissions={permissions}>
      <div className="min-h-screen bg-black text-white flex flex-col">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm font-semibold tracking-tight">
                Gridex <span className="text-white/60">Mina sidor</span>
              </Link>

              <div className="hidden text-xs text-white/60 md:block">
                Konto & avtal • fakturor • support
              </div>

              <div className="hidden md:flex gap-2">
                {roles.map((role) => (
                  <span
                    key={role}
                    className="text-[10px] border border-white/10 bg-white/5 px-2 py-1 rounded-full text-white/70"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/kundservice"
                className="hidden h-9 items-center justify-center rounded-xl border border-white/10 bg-black/30 px-3 text-xs text-white/80 hover:bg-black/20 md:inline-flex"
              >
                Support
              </Link>

              <UserMenu
                email={user.email ?? '—'}
                showAdminLink={isAdmin}
                roleLabel={roles[0] ?? null}
                items={[
                  { label: 'Profil', href: '/dashboard/profile' },
                  { label: 'Mina sidor', href: '/dashboard' },
                  ...(isPartner ? [{ label: 'Partnerpanel', href: '/partner' }] : []),
                  ...(isSupport ? [{ label: 'Supportpanel', href: '/support-admin' }] : []),
                ]}
              />
            </div>
          </div>
        </header>

        <div className="flex-1 mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 py-8 md:grid-cols-[260px_1fr]">
          <aside className="md:sticky md:top-[76px] md:h-[calc(100vh-76px-32px)]">
            <DashboardNav roles={roles} permissions={permissions} />
          </aside>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </PermissionsProvider>
  )
}