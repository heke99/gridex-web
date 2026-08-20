// components/layout/PublicHeader.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import GridexLogo from '@/components/brand/GridexLogo'

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

export default function PublicHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

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
          <Link
            href="/mina-sidor"
            prefetch
            className="text-sm text-gray-300 transition hover:text-white"
          >
            Mina sidor
          </Link>

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
        >
          {open ? 'Stäng' : 'Meny'}
        </button>
      </div>

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
              <Link
                href="/mina-sidor"
                prefetch
                className="block text-sm text-cyan-300"
                onClick={() => setOpen(false)}
              >
                Mina sidor
              </Link>

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
