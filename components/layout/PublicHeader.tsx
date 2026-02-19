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
        'text-sm transition',
        active ? 'text-white' : 'text-gray-300 hover:text-white',
      ].join(' ')}
    >
      {label}
    </Link>
  )
}

export default function PublicHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="border-b border-gray-800 bg-black/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center font-bold">
            G
          </div>
          <div className="leading-tight">
            <div className="text-white font-bold tracking-tight">Gridex</div>
            <div className="text-xs text-gray-400">Energy Fintech</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <NavLink href="/avtal" label="Elavtal" />
          <NavLink href="/teckna" label="Teckna elavtal" />
          <NavLink href="/kundservice" label="Kundservice" />
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="mailto:support@gridex.se"
            className="text-sm text-gray-300 hover:text-white"
          >
            support@gridex.se
          </a>

          <Link
            href="/login"
            className="border border-cyan-500/70 text-cyan-300 hover:bg-cyan-500 hover:text-black transition px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Logga in
          </Link>
        </div>

        <button
          className="md:hidden border border-gray-800 rounded-lg px-3 py-2 text-sm"
          onClick={() => setOpen((v) => !v)}
          aria-label="Öppna meny"
        >
          {open ? 'Stäng' : 'Meny'}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-800 px-6 py-4 space-y-3">
          <div className="space-y-2">
            <NavLink href="/avtal" label="Elavtal" onClick={() => setOpen(false)} />
            <NavLink href="/teckna" label="Teckna elavtal" onClick={() => setOpen(false)} />
            <NavLink href="/kundservice" label="Kundservice" onClick={() => setOpen(false)} />
          </div>

          <div className="pt-3 border-t border-gray-800 flex items-center justify-between">
            <a
              href="mailto:support@gridex.se"
              className="text-sm text-cyan-300"
              onClick={() => setOpen(false)}
            >
              support@gridex.se
            </a>

            <Link
              href="/login"
              className="text-sm font-semibold border border-cyan-500/70 text-cyan-300 px-4 py-2 rounded-lg"
              onClick={() => setOpen(false)}
            >
              Logga in
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}