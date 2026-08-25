// components/layout/PublicHeader.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import GridexLogo from '@/components/brand/GridexLogo'
import LogoutForm from '@/components/account/LogoutForm'

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return 'verifierat konto'
  const visibleLocal = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)
  return `${visibleLocal}${'*'.repeat(Math.min(5, Math.max(2, local.length - visibleLocal.length)))}@${domain}`
}

function NavLink({
  href,
  label,
  pathname,
  onClick,
}: {
  href: string
  label: string
  pathname: string
  onClick?: () => void
}) {
  const active = pathname === href

  return (
    <Link
      href={href}
      onClick={onClick}
      prefetch
      aria-current={active ? 'page' : undefined}
      className={[
        'group relative inline-flex min-h-11 items-center text-sm font-medium transition-colors duration-200',
        'after:absolute after:bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:bg-[var(--gx-accent)] after:transition-transform after:duration-200',
        active
          ? 'text-[var(--gx-text)] after:scale-x-100'
          : 'text-[var(--gx-text-muted)] after:scale-x-0 hover:text-[var(--gx-text)] hover:after:scale-x-100',
      ].join(' ')}
    >
      {label}
    </Link>
  )
}

type PublicHeaderProps = {
  authenticatedEmail?: string | null
  resolveAuthClientSide?: boolean
}

export default function PublicHeader({
  authenticatedEmail = null,
  resolveAuthClientSide = false,
}: PublicHeaderProps) {
  const [open, setOpen] = useState(false)
  const [sessionEmail, setSessionEmail] = useState<string | null>(authenticatedEmail)
  const pathname = usePathname()

  useEffect(() => {
    setSessionEmail(authenticatedEmail)
    if (!resolveAuthClientSide || authenticatedEmail) return

    const controller = new AbortController()

    void fetch('/api/auth/public-session', {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null
        const payload = (await response.json()) as {
          authenticatedEmail?: string | null
        }
        return payload.authenticatedEmail ?? null
      })
      .then((email) => {
        if (!controller.signal.aborted) setSessionEmail(email)
      })
      .catch(() => {
        if (!controller.signal.aborted) setSessionEmail(null)
      })

    return () => controller.abort()
  }, [authenticatedEmail, resolveAuthClientSide])

  const isAuthenticated = Boolean(sessionEmail)
  const maskedEmail = sessionEmail ? maskEmail(sessionEmail) : null
  const showCheckoutSessionNotice = isAuthenticated && pathname === '/teckna-avtal'

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--gx-border)] bg-[var(--gx-canvas)]/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-2">
        <Link href="/" prefetch className="flex shrink-0 items-center" aria-label="Gridex startsida">
          <GridexLogo className="h-[68px] w-auto max-w-none sm:h-[72px]" inverted priority />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Huvudnavigation">
          <NavLink href="/#rakna-elpris" label="Räkna elpris" pathname={pathname} />
          <NavLink href="/elavtal" label="Elavtal" pathname={pathname} />
          <NavLink href="/elpriser" label="Elpriser" pathname={pathname} />
          <NavLink href="/elpriser/elpris-idag" label="Elpris idag" pathname={pathname} />
          <NavLink href="/guider" label="Guider" pathname={pathname} />
          <NavLink href="/kundservice" label="Kundservice" pathname={pathname} />
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="max-w-40 truncate text-xs text-[var(--gx-text-subtle)]" title="Du är inloggad">
                <span className="sr-only">Inloggad som </span>
                {maskedEmail}
              </div>
              <Link
                href="/mina-sidor"
                prefetch
                className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--gx-text-muted)] transition-colors duration-200 hover:text-[var(--gx-text)]"
              >
                Mina sidor
              </Link>
              <LogoutForm
                redirectTo="/"
                variant="ghost"
                label="Logga ut"
                className="w-24"
              />
            </div>
          ) : (
            <Link
              href="/mina-sidor"
              prefetch
              className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--gx-text-muted)] transition-colors duration-200 hover:text-[var(--gx-text)]"
            >
              Mina sidor
            </Link>
          )}

          <Link
            href="/teckna-avtal"
            prefetch
            className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--gx-radius-sm)] bg-[var(--gx-accent)] px-4 py-2 text-sm font-semibold text-[var(--gx-accent-ink)] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-[var(--gx-accent-hover)]"
          >
            Teckna elavtal
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--gx-radius-sm)] border border-[var(--gx-border)] px-3 py-2 text-sm font-medium text-[var(--gx-text)] transition-colors duration-200 hover:bg-white/[0.04] lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Stäng meny' : 'Öppna meny'}
          aria-expanded={open}
          aria-controls="gridex-mobile-navigation"
        >
          {open ? 'Stäng' : 'Meny'}
        </button>
      </div>

      {showCheckoutSessionNotice ? (
        <div className="border-t border-[var(--gx-border)] bg-[var(--gx-accent-soft)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-3 text-xs leading-5 text-[var(--gx-text-muted)] sm:flex-row sm:items-center sm:justify-between">
            <p>
              Du tecknar medan du är inloggad som <span className="font-semibold text-[var(--gx-text)]">{maskedEmail}</span>. Fortsätter du medan du är inloggad kopplas teckningen till detta Mina sidor-konto även om du anger en annan kontaktadress. Logga ut först om avtalet ska kopplas till ett annat konto.
            </p>
            <LogoutForm
              redirectTo="/teckna-avtal"
              variant="ghost"
              label="Logga ut och fortsätt med annan e-post"
              className="w-full shrink-0 sm:w-72"
            />
          </div>
        </div>
      ) : null}

      {open ? (
        <div id="gridex-mobile-navigation" className="border-t border-[var(--gx-border)] bg-[var(--gx-canvas)] lg:hidden">
          <div className="mx-auto max-w-6xl px-6 py-4">
            <nav className="grid divide-y divide-[var(--gx-border)]" aria-label="Mobilnavigation">
              <NavLink href="/#rakna-elpris" label="Räkna elpris" pathname={pathname} onClick={() => setOpen(false)} />
              <NavLink href="/elavtal" label="Elavtal" pathname={pathname} onClick={() => setOpen(false)} />
              <NavLink href="/elpriser" label="Elpriser" pathname={pathname} onClick={() => setOpen(false)} />
              <NavLink href="/elpriser/elpris-idag" label="Elpris idag" pathname={pathname} onClick={() => setOpen(false)} />
              <NavLink href="/guider" label="Guider" pathname={pathname} onClick={() => setOpen(false)} />
              <NavLink href="/kundservice" label="Kundservice" pathname={pathname} onClick={() => setOpen(false)} />
              <NavLink href="/vanliga-fragor" label="Vanliga frågor" pathname={pathname} onClick={() => setOpen(false)} />
            </nav>

            <div className="mt-4 border-t border-[var(--gx-border)] pt-4">
              {isAuthenticated ? (
                <div className="space-y-3">
                  <div className="text-xs text-[var(--gx-text-subtle)]">
                    Inloggad som <span className="font-medium text-[var(--gx-text)]">{maskedEmail}</span>
                  </div>
                  <Link
                    href="/mina-sidor"
                    prefetch
                    className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--gx-text)]"
                    onClick={() => setOpen(false)}
                  >
                    Mina sidor
                  </Link>
                  <LogoutForm redirectTo="/" variant="ghost" label="Logga ut" />
                </div>
              ) : (
                <Link
                  href="/mina-sidor"
                  prefetch
                  className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--gx-text)]"
                  onClick={() => setOpen(false)}
                >
                  Mina sidor
                </Link>
              )}

              <Link
                href="/teckna-avtal"
                prefetch
                className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--gx-radius-sm)] bg-[var(--gx-accent)] px-4 py-3 text-center text-sm font-semibold text-[var(--gx-accent-ink)] transition-colors duration-200 hover:bg-[var(--gx-accent-hover)]"
                onClick={() => setOpen(false)}
              >
                Teckna elavtal <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
