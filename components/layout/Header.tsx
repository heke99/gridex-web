'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="border-b border-gray-800 bg-black/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Gridex
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-gray-300">
          <Link href="/avtal" className="hover:text-white">Elavtal</Link>
          <Link href="/teckna" className="hover:text-white">Teckna elavtal</Link>
          <Link href="/kundservice" className="hover:text-white">Kundservice</Link>
          <Link href="/login" className="border border-cyan-500 px-4 py-2 rounded-lg text-cyan-400 hover:bg-cyan-500 hover:text-black transition">
            Logga in
          </Link>
        </nav>

        <button
          className="md:hidden"
          onClick={() => setOpen(!open)}
        >
          ☰
        </button>
      </div>

      {open && (
        <div className="md:hidden px-6 pb-4 space-y-3 text-gray-300">
          <Link href="/avtal">Elavtal</Link>
          <Link href="/teckna">Teckna elavtal</Link>
          <Link href="/kundservice">Kundservice</Link>
          <Link href="/login">Logga in</Link>
        </div>
      )}
    </header>
  )
}