'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parsePrivacyIntent, PRIVACY_REQUEST_LABELS, type PrivacyRequestKind } from '@/lib/customerPortal/privacyRules'

export default function PrivacyRequestForm({ kind, userId }: { kind: PrivacyRequestKind; userId: string }) {
  const router = useRouter()
  const operationId = useRef('')
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const storageKey = `gridex:privacy-intent:v1:${userId}:${kind}`
  useEffect(() => {
    let saved: string | null = null
    try { saved = sessionStorage.getItem(storageKey) } catch { /* This tab still retains its operation ID. */ }
    operationId.current = parsePrivacyIntent({ kind, client_operation_id: saved })?.operationId ?? crypto.randomUUID()
    try { sessionStorage.setItem(storageKey, operationId.current) } catch { /* No personal data is stored here. */ }
    setReady(true)
  }, [storageKey, kind])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !operationId.current) return
    setPending(true)
    setMessage('')
    try {
      const response = await fetch('/api/web/customer/privacy-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, client_operation_id: operationId.current }),
        signal: AbortSignal.timeout(20_000),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message || 'Begäran kunde inte sparas.')
      if (response.status !== 202 || typeof result.data?.id !== 'string') throw new Error('Bekräftelsen kunde inte läsas.')
      setMessage('Din begäran är sparad. Du kan följa överföringen till kundservice nedan.')
      operationId.current = crypto.randomUUID()
      try { sessionStorage.setItem(storageKey, operationId.current) } catch { /* In-memory ID remains stable. */ }
      router.refresh()
    } catch (error) {
      setMessage(`${error instanceof Error ? error.message : 'Bekräftelsen saknas.'} Du kan försöka igen med samma begäran.`)
    } finally { setPending(false) }
  }

  return <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 p-5">
    <h2 className="text-lg font-semibold">{PRIVACY_REQUEST_LABELS[kind]}</h2>
    <p className="text-sm leading-6 text-white/70">{kind === 'access'
      ? 'Begär information om hur dina personuppgifter behandlas och en kopia av uppgifterna.'
      : 'Begär att dina personuppgifter raderas. Kundservice prövar vilka uppgifter som kan raderas och vilka som behöver sparas enligt lag eller avtal.'}</p>
    <button disabled={!ready || pending} className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">
      {pending ? 'Sparar…' : kind === 'access' ? 'Begär registerutdrag' : 'Begär radering'}
    </button>
    <p role="status" className="text-sm text-cyan-200">{message}</p>
  </form>
}
