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

  const baseClassName =
    variant === 'ghost'
      ? 'inline-flex h-10 w-full items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white/80 transition hover:bg-white/5'
      : 'inline-flex h-10 w-full items-center justify-center rounded-2xl bg-white px-3 text-sm font-semibold text-black transition hover:bg-white/90'

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
        className={[
          baseClassName,
          loading ? 'cursor-not-allowed opacity-70' : '',
        ].join(' ')}
      >
        {loading ? 'Loggar ut…' : label}
      </button>
    </form>
  )
}