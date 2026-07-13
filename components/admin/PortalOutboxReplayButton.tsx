'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function PortalOutboxReplayButton({ outboxId }: { outboxId: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle')

  async function replay() {
    setState('working')
    const response = await fetch('/api/admin/customer-portal/outbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: outboxId }),
    }).catch(() => null)
    if (!response?.ok) {
      setState('error')
      return
    }
    router.refresh()
  }

  return (
    <button type="button" onClick={replay} disabled={state === 'working'} className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50">
      {state === 'working' ? 'Köar…' : state === 'error' ? 'Försök igen' : 'Kör om'}
    </button>
  )
}
