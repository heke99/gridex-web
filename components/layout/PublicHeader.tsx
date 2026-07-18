// components/layout/PublicHeader.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import GridexLogo from '@/components/brand/GridexLogo'

function NavLink({
  href,
  label,
  onClick,
}: {
  href: string
  label: string
  onClick?: () => void
}) {
  const pathname = usePathname()
  const active = pathname === href

  return (
    <Link
      href={href}
      onClick={onClick}
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

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Gridex startsida">
          <GridexLogo className="h-11 w-auto max-w-[180px]" inverted />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <NavLink href="/#rakna-elpris" label="Räkna elpris" />
          <NavLink href="/elavtal" label="Elavtal" />
          <NavLink href="/elpriser" label="Elpriser" />
          <NavLink href="/elpriser/elpris-idag" label="Elpris idag" />
          <NavLink href="/guider" label="Guider" />
          <NavLink href="/kundservice" label="Kundservice" />
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/mina-sidor"
            className="text-sm text-gray-300 transition hover:text-white"
          >
            Mina sidor
          </Link>

          <Link
            href="/teckna-avtal"
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
        <div className="border-t border-white/10 bg-black/80 md:hidden">
          <div className="mx-auto grid max-w-6xl gap-3 px-6 py-4">
            <div className="grid gap-2">
              <NavLink
                href="/#rakna-elpris"
                label="Räkna elpris"
                onClick={() => setOpen(false)}
              />
              <NavLink
                href="/elavtal"
                label="Elavtal"
                onClick={() => setOpen(false)}
              />
              <NavLink
                href="/elpriser"
                label="Elpriser"
                onClick={() => setOpen(false)}
              />
              <NavLink
                href="/elpriser/elpris-idag"
                label="Elpris idag"
                onClick={() => setOpen(false)}
              />
              <NavLink
                href="/guider"
                label="Guider"
                onClick={() => setOpen(false)}
              />
              <NavLink
                href="/kundservice"
                label="Kundservice"
                onClick={() => setOpen(false)}
              />
              <NavLink
                href="/vanliga-fragor"
                label="Vanliga frågor"
                onClick={() => setOpen(false)}
              />
            </div>

            <div className="mt-2 border-t border-white/10 pt-4">
              <Link
                href="/mina-sidor"
                className="block text-sm text-cyan-300"
                onClick={() => setOpen(false)}
              >
                Mina sidor
              </Link>

              <Link
                href="/teckna-avtal"
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
