//components/layout/PublicHeader.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

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
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 font-bold text-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.10)]">
            G
          </div>

          <div className="leading-tight">
            <div className="font-bold tracking-tight text-white">Gridex</div>
            <div className="text-xs text-gray-400">
              Tydliga elavtal för hushåll
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <NavLink href="/avtal" label="Elavtal" />
          <NavLink href="/teckna" label="Teckna elavtal" />
          <NavLink href="/kundservice" label="Kundservice" />
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="mailto:support@gridex.se"
            className="text-sm text-gray-300 transition hover:text-white"
          >
            support@gridex.se
          </a>

          <Link
            href="/login"
            className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500 hover:text-black"
          >
            Logga in
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
                href="/avtal"
                label="Elavtal"
                onClick={() => setOpen(false)}
              />
              <NavLink
                href="/teckna"
                label="Teckna elavtal"
                onClick={() => setOpen(false)}
              />
              <NavLink
                href="/kundservice"
                label="Kundservice"
                onClick={() => setOpen(false)}
              />
            </div>

            <div className="mt-2 border-t border-white/10 pt-4">
              <a
                href="mailto:support@gridex.se"
                className="block text-sm text-cyan-300"
                onClick={() => setOpen(false)}
              >
                support@gridex.se
              </a>

              <Link
                href="/login"
                className="mt-3 block rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-3 text-center text-sm font-semibold text-cyan-300"
                onClick={() => setOpen(false)}
              >
                Logga in
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}