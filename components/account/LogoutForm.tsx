// components/account/LogoutForm.tsx
'use client'

import { useState } from 'react'

type Props = {
  redirectTo?: string
  className?: string
  variant?: 'primary' | 'ghost'
  label?: string
}

export default function LogoutForm({
  redirectTo = '/login',
  className,
  variant = 'primary',
  label = 'Logga ut',
}: Props) {
  const [loading, setLoading] = useState(false)

  const base =
    variant === 'ghost'
      ? 'inline-flex h-9 w-full items-center justify-center rounded-xl border border-white/10 bg-black/30 px-3 text-xs font-semibold text-white/80 hover:bg-black/20'
      : 'inline-flex h-9 w-full items-center justify-center rounded-xl bg-white px-3 text-xs font-semibold text-black hover:bg-white/90'

  return (
    <form
      action={`/logout?redirectTo=${encodeURIComponent(redirectTo)}`}
      method="post"
      onSubmit={() => setLoading(true)}
      className={className}
    >
      <button
        type="submit"
        disabled={loading}
        className={[base, loading ? 'opacity-70 cursor-not-allowed' : ''].join(' ')}
      >
        {loading ? 'Loggar ut…' : label}
      </button>
    </form>
  )
}