// components/layout/PublicHeader.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
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
      className={[
        'relative text-sm font-medium transition',
        active ? 'text-white' : 'text-gray-300 hover:text-white',
      ].join(' ')}
    >
      <span>{label}</span>
      {active ? (
        <span className="absolute -bottom-2 left-0 h-[2px] w-full rounded-full bg-cyan-400" />
      ) : null}
    </Link>
  )
}

export default function PublicHeader({
  authenticatedEmail,
}: {
  authenticatedEmail?: string | null
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const isAuthenticated = Boolean(authenticatedEmail)
  const maskedEmail = authenticatedEmail ? maskEmail(authenticatedEmail) : null
  const showCheckoutSessionNotice = isAuthenticated && pathname === '/teckna-avtal'

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2">
        <Link href="/" prefetch className="flex shrink-0 items-center" aria-label="Gridex startsida">
          <GridexLogo className="h-[68px] w-auto max-w-none sm:h-[72px]" inverted priority />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <NavLink href="/#rakna-elpris" label="Räkna elpris" pathname={pathname} />
          <NavLink href="/elavtal" label="Elavtal" pathname={pathname} />
          <NavLink href="/elpriser" label="Elpriser" pathname={pathname} />
          <NavLink href="/elpriser/elpris-idag" label="Elpris idag" pathname={pathname} />
          <NavLink href="/guider" label="Guider" pathname={pathname} />
          <NavLink href="/kundservice" label="Kundservice" pathname={pathname} />
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="max-w-44 truncate text-xs text-gray-300" title="Du är inloggad">
                Inloggad som <span className="font-medium text-white">{maskedEmail}</span>
              </div>
              <Link
                href="/mina-sidor"
                prefetch
                className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
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
              className="text-sm text-gray-300 transition hover:text-white"
            >
              Mina sidor
            </Link>
          )}

          <Link
            href="/teckna-avtal"
            prefetch
            className="rounded-xl border border-cyan-500/50 bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
          >
            Teckna elavtal
          </Link>
        </div>

        <button
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Öppna meny"
          aria-expanded={open}
        >
          {open ? 'Stäng' : 'Meny'}
        </button>
      </div>

      {showCheckoutSessionNotice ? (
        <div className="border-t border-cyan-400/20 bg-cyan-400/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-3 text-xs text-cyan-50 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Du tecknar medan du är inloggad som <span className="font-semibold">{maskedEmail}</span>. Fortsätter du medan du är inloggad kopplas teckningen till detta Mina sidor-konto även om du anger en annan kontaktadress. Logga ut först om avtalet ska kopplas till ett annat konto.
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

      {open && (
        <div className="border-t border-white/10 bg-black/90 md:hidden">
          <div className="mx-auto grid max-w-6xl gap-3 px-6 py-4">
            <div className="grid gap-2">
              <NavLink href="/#rakna-elpris" label="Räkna elpris" pathname={pathname} onClick={() => setOpen(false)} />
              <NavLink href="/elavtal" label="Elavtal" pathname={pathname} onClick={() => setOpen(false)} />
              <NavLink href="/elpriser" label="Elpriser" pathname={pathname} onClick={() => setOpen(false)} />
              <NavLink href="/elpriser/elpris-idag" label="Elpris idag" pathname={pathname} onClick={() => setOpen(false)} />
              <NavLink href="/guider" label="Guider" pathname={pathname} onClick={() => setOpen(false)} />
              <NavLink href="/kundservice" label="Kundservice" pathname={pathname} onClick={() => setOpen(false)} />
              <NavLink href="/vanliga-fragor" label="Vanliga frågor" pathname={pathname} onClick={() => setOpen(false)} />
            </div>

            <div className="mt-2 border-t border-white/10 pt-4">
              {isAuthenticated ? (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-gray-300">
                    Inloggad som <span className="font-medium text-white">{maskedEmail}</span>
                  </div>
                  <Link
                    href="/mina-sidor"
                    prefetch
                    className="block text-sm font-medium text-cyan-300"
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
                  className="block text-sm text-cyan-300"
                  onClick={() => setOpen(false)}
                >
                  Mina sidor
                </Link>
              )}

              <Link
                href="/teckna-avtal"
                prefetch
                className="mt-3 block rounded-xl border border-cyan-500/50 bg-cyan-500 px-4 py-3 text-center text-sm font-semibold text-black"
                onClick={() => setOpen(false)}
              >
                Teckna elavtal
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
