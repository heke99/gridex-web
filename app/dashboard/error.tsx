'use client'

import { useRef, useState } from 'react'
import { readCustomerWriteResponse, pendingCustomerWrite } from '@/lib/customerPortal/writeResponse'

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const operation = useRef<string | null>(null)
  const [state, setState] = useState<'idle' | 'working' | 'pending' | 'done' | 'error'>('idle')

  async function repairLink() {
    setState('working')
    try {
      operation.current ??= `portal-repair:${crypto.randomUUID()}`
      const response = await fetch('/api/web/customer-portal/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_operation_id: operation.current }),
      })
      const result = await readCustomerWriteResponse(response)
      if (pendingCustomerWrite(result)) {
        setState('pending')
        return
      }
      operation.current = null
      setState('done')
      reset()
    } catch {
      setState('error')
    }
  }

  return (
    <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6">
      <h1 className="text-xl font-semibold">Vi kunde inte koppla dina kunduppgifter</h1>
      <p className="mt-2 text-sm text-white/70">Det här visas i stället för en tom kundportal. Uppdatera kopplingen och försök igen.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={repairLink} disabled={state === 'working'} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
          {state === 'working' ? 'Uppdaterar…' : 'Uppdatera kopplingen'}
        </button>
        <button type="button" onClick={reset} className="rounded-full border border-white/15 px-4 py-2 text-sm">Försök igen</button>
      </div>
      {state === 'pending' ? <p className="mt-3 text-sm text-amber-200">Kopplingen inväntar behandling. Tillgången är ännu inte bekräftad.</p> : null}
      {state === 'done' ? <p className="mt-3 text-sm text-emerald-200">Kopplingen är uppdaterad.</p> : null}
      {state === 'error' ? <p className="mt-3 text-sm text-rose-200">Kopplingen kunde inte uppdateras automatiskt. Kundservice kan hjälpa dig.</p> : null}
    </div>
  )
}
