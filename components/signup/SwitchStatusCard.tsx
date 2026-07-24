'use client'

import { useEffect, useState } from 'react'

type SwitchStatus = {
  status: string
  label: string
  message: string
  updated_at: string | null
  terminal: boolean
}

function timestamp(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function SwitchStatusCard({
  resultToken,
  initialStatus,
}: {
  resultToken: string
  initialStatus?: string | null
}) {
  const [status, setStatus] = useState<SwitchStatus | null>(initialStatus ? {
    status: initialStatus,
    label: 'Leverantörsbytets status',
    message: 'Den senaste statusen från teckningen visas här och uppdateras automatiskt.',
    updated_at: null,
    terminal: false,
  } : null)

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const load = async () => {
      try {
        const response = await fetch(`/api/v1/website/switch-status?result_token=${encodeURIComponent(resultToken)}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        const payload = await response.json().catch(() => null) as { data?: SwitchStatus } | null
        if (!stopped && response.ok && payload?.data) {
          setStatus(payload.data)
          if (payload.data.terminal) return
        }
      } catch {
        // The receipt remains valid even if a status refresh is temporarily unavailable.
      }
      if (!stopped) timer = setTimeout(load, 30_000)
    }
    void load()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [resultToken])

  if (!status) return null
  const updatedAt = timestamp(status.updated_at)
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5" aria-live="polite">
      <div className="text-sm font-semibold text-white">{status.label}</div>
      <p className="mt-2 text-sm leading-6 text-gray-300">{status.message}</p>
      {updatedAt ? <div className="mt-2 text-xs text-gray-500">Senast uppdaterad {updatedAt}</div> : null}
    </div>
  )
}
