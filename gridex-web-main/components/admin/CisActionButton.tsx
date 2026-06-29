'use client'

import { useState } from 'react'

export default function CisActionButton({
  actionId,
  operation,
  label,
}: {
  actionId: string
  operation: 'retry' | 'cancel' | 'resend_signature'
  label: string
}) {
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)

    try {
      const res = await fetch('/api/admin/cis/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, operation }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body.error ?? 'Kunde inte köra CIS-action.')
        return
      }

      window.location.reload()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={loading}
      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 hover:bg-white/10 disabled:opacity-50"
    >
      {loading ? 'Kör...' : label}
    </button>
  )
}
