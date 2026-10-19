'use client'

import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { pendingCustomerWrite, readCustomerWriteResponse } from '@/lib/customerPortal/writeResponse'

export default function CustomerPortalLinkForm({ customerNumber }: { customerNumber?: string | null }) {
  const router = useRouter()
  const [number, setNumber] = useState(customerNumber ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const operation = useRef<string | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      operation.current ??= `portal-link:${crypto.randomUUID()}`
      const response = await fetch('/api/web/customer-portal/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_number: number.trim(), client_operation_id: operation.current }),
      })
      const result = await readCustomerWriteResponse(response)
      if (pendingCustomerWrite(result) || result.data?.status !== 'linked' || result.data?.ok !== true || result.data?.synced?.access_granted !== true) {
        throw new Error('Kundkopplingen är ännu inte bekräftad. Försök igen senare.')
      }
      router.replace('/mina-sidor')
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Kundkontot kunde inte kopplas just nu.')
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} aria-busy={busy} className="mt-6 space-y-4">
      <div>
        <label htmlFor="customer-number" className="block text-sm font-medium">Kundnummer</label>
        <input id="customer-number" name="customer_number" value={number} required maxLength={100}
          readOnly={Boolean(customerNumber)} disabled={busy} autoComplete="off"
          onChange={event => { setNumber(event.target.value); operation.current = null }}
          className="mt-2 w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white" />
      </div>
      <button type="submit" disabled={busy || !number.trim()} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-black disabled:opacity-50">
        {busy ? 'Kopplar…' : 'Koppla kundkonto'}
      </button>
      {error ? <p role="alert" className="text-sm text-rose-200">{error}</p> : null}
    </form>
  )
}
