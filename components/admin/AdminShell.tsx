import Link from 'next/link'
import { headers } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ADMIN_NAV, type AdminNavItem } from '@/lib/admin/nav.schema'
import type { AdminContext } from '@/lib/admin/getAdminContext'
import { canAccessByRule } from '@/lib/admin/guards'

type LegacyProps = {
  email: string | null
  roles?: string[]
  permissions?: string[]
}

type EnterpriseProps = {
  ctx: AdminContext
}

function SidebarLink({
  item,
  active,
  allowed,
}: {
  item: AdminNavItem
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

  return (
    h.get('x-invoke-path') ??
    h.get('next-url') ??
    ''
  )
}

export default async function AdminShell({
  children,
  ...props
}: {
  children: React.ReactNode
} & (LegacyProps | EnterpriseProps)) {

  const path = await getActivePathnameFromHeaders()

  const email =
    'ctx' in props ? props.ctx.email : props.email

  const roles =
    'ctx' in props ? props.ctx.roles : props.roles ?? []

  const permissions =
    'ctx' in props
      ? props.ctx.permissions
      : props.permissions ?? []

  const navCtx: AdminContext =
    'ctx' in props
      ? props.ctx
      : {
          userId: '__legacy__',
          email: email ?? null,
          roles,
          permissions,
          isAdmin: true,
          supabase: null as unknown as SupabaseClient,
        }

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
            {ADMIN_NAV.map((group) => (
              <div key={group.title}>

                <div className="px-3 pb-2 text-xs text-gray-500 uppercase tracking-wider">
                  {group.title}
                </div>

                <div className="space-y-1">
                  {group.items.map((it) => {

                    const active =
                      it.href === '/admin'
                        ? path === '/admin'
                        : path === it.href ||
                          path.startsWith(it.href + '/')

                    const allowed =
                      canAccessByRule(navCtx, it.access)

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