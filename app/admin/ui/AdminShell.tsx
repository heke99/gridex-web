import Link from 'next/link'
import type { AdminContext } from '@/lib/admin/getAdminContext'
import AdminNav from './AdminNav'
import LogoutButton from './LogoutButton'

function formatRoleLabel(roles: string[]) {
  if (!roles.length) return 'Ingen roll'
  return roles.join(', ')
}

export default function AdminShell({
  children,
  ctx,
}: {
  children: React.ReactNode
  ctx: AdminContext
}) {
  const roleLabel = formatRoleLabel(ctx.roles)

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
            >
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                Gridex
              </span>
              <span className="text-white">Admin</span>
            </Link>

            <div className="mt-1 hidden text-xs text-white/60 md:block">
              <span className="truncate">{ctx.email ?? '—'}</span>
              <span className="mx-2 text-white/30">•</span>
              <span className="text-white/80">{roleLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="hidden h-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-4 text-xs font-medium text-white/80 transition hover:bg-white/5 md:inline-flex"
            >
              Publik sida
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
        <div className="mb-5 space-y-4 md:hidden">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                  Inloggad som
                </div>
                <div className="mt-1 truncate text-sm text-white/90">
                  {ctx.email ?? '—'}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {ctx.roles.length > 0 ? (
                  ctx.roles.map((role) => (
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

              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/"
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-4 text-xs font-medium text-white/80 transition hover:bg-white/5"
                >
                  Publik sida
                </Link>
                <LogoutButton fullWidth />
              </div>
            </div>
          </div>

          <AdminNav permissions={ctx.permissions} roles={ctx.roles} />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden md:block">
            <div className="sticky top-[92px] space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                  Admin-session
                </div>
                <div className="mt-2 truncate text-sm text-white/90">
                  {ctx.email ?? '—'}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ctx.roles.length > 0 ? (
                    ctx.roles.map((role) => (
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

              <AdminNav permissions={ctx.permissions} roles={ctx.roles} />
            </div>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  )
}