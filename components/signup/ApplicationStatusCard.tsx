'use client'

import { useEffect, useState } from 'react'

type Status = {
  checkout?: { page_state: 'success' | 'success_action_required' | 'action_required' | 'processing'; customer_action_required: boolean; confirmation_email: { expected: boolean; status: 'not_expected' | 'pending' | 'queued' | 'sent' | 'delivered' | 'failed' } }
  status: 'accepted' | 'processing' | 'needs_customer_information' | 'completed' | 'rejected' | 'failed'
  stage: string
  customer_number?: string | null
  supplier_switch_status?: string | null
  missing_customer_action: boolean
  next_step?: string | null
  blocking_reason?: string | null
  updated_at: string | null
}

const LABELS: Record<Status['status'], { title: string; body: string }> = {
  accepted: { title: 'Ansökan mottagen', body: 'Vi har tagit emot din teckning och hanterar nästa steg.' },
  processing: { title: 'Behandlas', body: 'Vi hanterar din teckning och kontaktar dig om vi behöver något från dig.' },
  needs_customer_information: { title: 'Vi behöver en komplettering', body: 'Kontrollera din e-post eller Mina sidor för information om vad vi behöver från dig.' },
  completed: { title: 'Klart', body: 'Teckningen är färdigbehandlad. Du kan följa ditt avtal och kommande steg via Mina sidor.' },
  rejected: { title: 'Teckningen kunde inte slutföras', body: 'Du får mer information via e-post eller Mina sidor.' },
  failed: { title: 'Vi hanterar ditt ärende', body: 'Vi kontrollerar teckningen och kontaktar dig om något behöver kompletteras.' },
}

export default function ApplicationStatusCard({ applicationNumber, resultToken, initialStatus }: {
  applicationNumber: string
  resultToken: string
  initialStatus: string
}) {
  const [status, setStatus] = useState<Status | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    const controller = new AbortController()
    const schedule = () => {
      if (active) timer = setTimeout(load, Math.min(5 * 60_000, 60_000 * 2 ** failures))
    }
    const load = async () => {
      if (document.visibilityState === 'hidden' || !navigator.onLine) { schedule(); return }
      const response = await fetch(
        `/api/checkout/applications/${encodeURIComponent(applicationNumber)}?result_token=${encodeURIComponent(resultToken)}`,
        { headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]) },
      ).catch(() => null)
      if (!active) return
      if (!response?.ok) {
        setUnavailable(true)
        failures += 1
        if (response && [400, 401, 403, 404, 410].includes(response.status)) return
        schedule(); return
      }
      const payload = await response.json().catch(() => null) as { data?: Status } | null
      if (!active) return
      if (payload?.data && Object.hasOwn(LABELS, payload.data.status)) {
        setStatus(payload.data); setUnavailable(false); failures = 0
        const email = payload.data.checkout?.confirmation_email
        if (['rejected','failed','completed'].includes(payload.data.status) && (!email?.expected || ['delivered','failed','not_expected'].includes(email.status))) return
      }
      schedule()
    }
    void load()
    return () => { active = false; controller.abort(); if (timer) clearTimeout(timer) }
  }, [applicationNumber, resultToken])

  const fallbackStatus: Status['status'] = Object.hasOwn(LABELS, initialStatus)
    ? initialStatus as Status['status']
    : 'processing'
  const currentStatus = status?.checkout?.customer_action_required || status?.checkout?.page_state === 'action_required'
    ? 'needs_customer_information'
    : status?.checkout?.page_state === 'processing' ? 'processing' : status?.status ?? fallbackStatus
  const copy = LABELS[currentStatus as Status['status']] ?? LABELS.processing
  const emailStatus = status?.checkout?.confirmation_email.status
  const emailCopy = emailStatus ? ({ not_expected: 'Ingen avtalsbekräftelse förväntas ännu.', pending: 'Avtalsbekräftelsen förbereds.', queued: 'Avtalsbekräftelsen är köad.', sent: 'Avtalsbekräftelsen har skickats.', delivered: 'Avtalsbekräftelsen har levererats till mottagarens mejlserver.', failed: 'Avtalsbekräftelsen kunde inte levereras. Vi följer upp ärendet.' }[emailStatus]) : null

  return (
    <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5" data-application-status={currentStatus}>
      <div className="text-sm font-semibold text-white">{copy.title}</div>
      <p className="mt-2 text-sm leading-6 text-gray-200">{copy.body}</p>
      {(status?.missing_customer_action || status?.checkout?.customer_action_required) ? <p className="mt-2 text-xs text-amber-200">Vi behöver en komplettering från dig. Kontrollera din e-post eller Mina sidor.</p> : null}
      {emailCopy ? <p className="mt-2 text-sm text-gray-300" role="status">{emailCopy}</p> : null}
      {unavailable ? <p className="mt-2 text-xs text-gray-400">Aktuell status kunde inte hämtas. Din teckning är fortfarande registrerad.</p> : null}
    </div>
  )
}
