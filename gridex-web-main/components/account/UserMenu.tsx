'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import LogoutForm from './LogoutForm'

type Item = {
  label: string
  href: string
}

type Props = {
  email: string
  roleLabel?: string | null
  items?: Item[]
  showAdminLink?: boolean
}

function getInitials(email: string): string {
  const localPart = email.split('@')[0] || 'U'
  return (
    localPart.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'U'
  )
}

export default function UserMenu({
  email,
  roleLabel = null,
  items = [{ label: 'Mina sidor', href: '/dashboard' }],
  showAdminLink = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)

    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  const initials = getInitials(email)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/80 transition hover:bg-black/20"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/15 text-[11px] font-bold text-cyan-200">
          {initials}
        </span>

        <span className="hidden max-w-[220px] truncate text-left md:block">
          <span className="block truncate text-[11px] text-white/60">
            Inloggad som
          </span>
          <span className="block truncate text-xs text-white/90">{email}</span>
        </span>

        {roleLabel ? (
          <span className="hidden rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70 md:inline">
            {roleLabel}
          </span>
        ) : null}

        <span className="text-white/60">▾</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-black/90 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-[11px] text-white/60">Konto</div>
            <div className="truncate text-xs text-white/90">{email}</div>
          </div>

          <div className="p-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/5"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            {showAdminLink ? (
              <Link
                href="/admin"
                className="mt-1 block rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/5"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                Admin
              </Link>
            ) : null}
          </div>

          <div className="border-t border-white/10 p-2">
            <LogoutForm variant="ghost" />
          </div>
        </div>
      ) : null}
    </div>
  )
}